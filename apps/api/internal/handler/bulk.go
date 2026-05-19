package handler

import (
	"encoding/csv"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/marketplace-empire/api/internal/auth"
)

type BulkHandler struct {
	DB *pgxpool.Pool
}

func (h *BulkHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Use(auth.AdminOnly(nil)) // pool injected in main.go
		r.Get("/export", h.ExportProducts)
		r.Post("/import", h.ImportProducts)
	})
}

func (h *BulkHandler) ExportProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, seller_id, title, description, slug, price, currency, images, category, tags, created_at
		FROM products
		WHERE is_active = true
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=products_export.csv")
	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"id", "seller_id", "title", "description", "slug", "price", "currency", "images", "category", "tags", "created_at"})

	for rows.Next() {
		var (
			id, sellerID, title, description, slug, currency, categoryStr, tagsStr, createdAt string
			price                                                                             int
			imagesJSON                                                                        []byte
			images                                                                            []string
		)
		if err := rows.Scan(&id, &sellerID, &title, &description, &slug, &price, &currency, &imagesJSON, &categoryStr, &tagsStr, &createdAt); err != nil {
			continue
		}
		json.Unmarshal(imagesJSON, &images)
		imagesJoined := strings.Join(images, "|")

		writer.Write([]string{id, sellerID, title, description, slug, strconv.Itoa(price), currency, imagesJoined, categoryStr, tagsStr, createdAt})
	}
}

func (h *BulkHandler) ImportProducts(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, `{"error":"file too large"}`, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"missing 'file' field"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		http.Error(w, `{"error":"failed to read CSV header"}`, http.StatusBadRequest)
		return
	}

	colIdx := make(map[string]int)
	for i, col := range header {
		colIdx[strings.TrimSpace(strings.ToLower(col))] = i
	}

	created := 0
	errors := []string{}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			errors = append(errors, "row could not be read")
			continue
		}

		title := getField(record, colIdx, "title")
		if title == "" {
			errors = append(errors, "row missing title")
			continue
		}
		description := getField(record, colIdx, "description")
		priceStr := getField(record, colIdx, "price")
		price, err := strconv.Atoi(priceStr)
		if err != nil || price <= 0 {
			errors = append(errors, "invalid price for "+title)
			continue
		}
		imagesStr := getField(record, colIdx, "images")
		images := []string{}
		if imagesStr != "" {
			images = strings.Split(imagesStr, "|")
		}
		categoryStr := getField(record, colIdx, "category")
		categories := parseCSVList(categoryStr)
		tagsStr := getField(record, colIdx, "tags")
		tags := parseCSVList(tagsStr)

		// Use the existing generateSlug from products.go
		slug := generateSlug(title)

		var productID uuid.UUID
		err = h.DB.QueryRow(r.Context(), `
			INSERT INTO products (seller_id, title, description, slug, price, images, category, tags)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`, userID, title, description, slug, price, images, categories, tags).Scan(&productID)
		if err != nil {
			log.Printf("Failed to import product %s: %v", title, err)
			errors = append(errors, "failed to create "+title)
			continue
		}

		stockStr := getField(record, colIdx, "stock")
		if stockStr != "" {
			stock, err := strconv.Atoi(stockStr)
			if err == nil && stock > 0 {
				h.DB.Exec(r.Context(), `
					INSERT INTO inventory_ledger (product_id, warehouse_id, quantity_change, reason, created_at)
					VALUES ($1, 1, $2, 'initial', now())
				`, productID, stock)
			}
		}

		created++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"created": created,
		"errors":  errors,
	})
}

// Helper functions
func getField(record []string, colIdx map[string]int, key string) string {
	if idx, ok := colIdx[key]; ok && idx < len(record) {
		return strings.TrimSpace(record[idx])
	}
	return ""
}

func parseCSVList(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}