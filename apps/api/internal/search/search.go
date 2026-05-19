package search

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/meilisearch/meilisearch-go"
)

// ProductDocument represents a product indexed in Meilisearch.
type ProductDocument struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Slug        string   `json:"slug"`
	Price       float64  `json:"price"` // dollars for filtering
	Category    []string `json:"category"`
	Tags        []string `json:"tags"`
	ImageURL    string   `json:"image_url"`
	SellerID    string   `json:"seller_id"`
	SellerName  string   `json:"seller_name"`
}

// SearchService handles Meilisearch indexing and querying.
type SearchService struct {
	client    *meilisearch.Client
	indexName string
}

// NewSearchService creates a SearchService using environment variables.
func NewSearchService() (*SearchService, error) {
	host := os.Getenv("MEILISEARCH_HOST")
	if host == "" {
		host = "http://localhost:7700"
	}
	apiKey := os.Getenv("MEILISEARCH_KEY")

	client := meilisearch.NewClient(meilisearch.ClientConfig{
		Host:   host,
		APIKey: apiKey,
	})

	// Verify connection
	_, err := client.GetVersion()
	if err != nil {
		return nil, fmt.Errorf("meilisearch connection failed: %w", err)
	}

	idxName := "products"
	// Ensure index exists
	_, err = client.GetIndex(idxName)
	if err != nil {
		_, err = client.CreateIndex(&meilisearch.IndexConfig{
			Uid:        idxName,
			PrimaryKey: "id",
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create meilisearch index: %w", err)
		}
		log.Println("Meilisearch index 'products' created")
	}

	svc := &SearchService{client: client, indexName: idxName}

	// Configure filterable & searchable attributes
	idx := client.Index(idxName)
	idx.UpdateFilterableAttributes(&[]string{"price", "category", "seller_id"})
	idx.UpdateSearchableAttributes(&[]string{"title", "description", "tags", "category"})

	return svc, nil
}

// IndexAll fetches all active products from PostgreSQL and adds them in bulk.
func (s *SearchService) IndexAll(pool *pgxpool.Pool) error {
	rows, err := pool.Query(context.Background(), `
		SELECT p.id, p.title, p.description, p.slug, p.price,
		       p.images, p.category, p.tags, u.name AS seller_name, p.seller_id
		FROM products p
		JOIN users u ON u.id = p.seller_id
		WHERE p.is_active = true
	`)
	if err != nil {
		return fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var docs []ProductDocument
	for rows.Next() {
		var d ProductDocument
		var images []string
		err := rows.Scan(&d.ID, &d.Title, &d.Description, &d.Slug, &d.Price,
			&images, &d.Category, &d.Tags, &d.SellerName, &d.SellerID)
		if err != nil {
			return fmt.Errorf("scan failed: %w", err)
		}
		d.Price = float64(d.Price) / 100.0
		if len(images) > 0 {
			d.ImageURL = images[0]
		}
		docs = append(docs, d)
	}

	if len(docs) == 0 {
		return nil
	}

	idx := s.client.Index(s.indexName)
	_, err = idx.AddDocuments(docs)
	if err != nil {
		return fmt.Errorf("meilisearch add documents failed: %w", err)
	}
	log.Printf("Indexed %d products in Meilisearch", len(docs))
	return nil
}

// IndexOne adds or updates a single product in Meilisearch.
func (s *SearchService) IndexOne(p ProductDocument) error {
	idx := s.client.Index(s.indexName)
	_, err := idx.UpdateDocuments([]ProductDocument{p})
	return err
}

// DeleteOne removes a product from Meilisearch.
func (s *SearchService) DeleteOne(productID string) error {
	idx := s.client.Index(s.indexName)
	_, err := idx.DeleteDocument(productID)
	return err
}

// SearchHandler exposes a search endpoint at GET /api/search?q=...&limit=...
func (s *SearchService) SearchHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		http.Error(w, `{"error":"missing query 'q'"}`, http.StatusBadRequest)
		return
	}

	limit := int64(20)
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = int64(n)
		}
	}

	req := &meilisearch.SearchRequest{
		Limit:  limit,
		Filter: "price >= 0",
	}

	idx := s.client.Index(s.indexName)
	result, err := idx.Search(q, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result.Hits)
}

// RegisterSearchRoute mounts the search endpoint.
func (s *SearchService) RegisterSearchRoute(r chi.Router) {
	r.Get("/", s.SearchHandler)
}