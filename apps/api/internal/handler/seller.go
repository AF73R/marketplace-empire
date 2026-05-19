package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SellerHandler struct {
	DB *pgxpool.Pool
}

func (h *SellerHandler) RegisterRoutes(r chi.Router) {
	r.Get("/{sellerId}", h.GetSellerProfile)
	r.Get("/{sellerId}/products", h.GetSellerProducts)
}

type SellerProfile struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Email               string    `json:"email,omitempty"`
	Phone               *string   `json:"phone,omitempty"`
	Address             *string   `json:"address,omitempty"`
	AvatarURL           *string   `json:"avatar_url,omitempty"`
	CoverURL            *string   `json:"cover_url,omitempty"`
	CreatedAt           time.Time `json:"created_at"`            // ★ time.Time, not string
	TotalSales          int       `json:"total_sales"`
	ActiveProductsCount int       `json:"active_products_count"`
}

// GetSellerProfile returns public profile info for a seller.
func (h *SellerHandler) GetSellerProfile(w http.ResponseWriter, r *http.Request) {
	sellerID, err := uuid.Parse(chi.URLParam(r, "sellerId"))
	if err != nil {
		http.Error(w, `{"error":"invalid seller id"}`, http.StatusBadRequest)
		return
	}

	var profile SellerProfile
	err = h.DB.QueryRow(r.Context(), `
		SELECT id, name, email, phone, address, avatar_url, cover_url, created_at
		FROM users WHERE id = $1
	`, sellerID).Scan(&profile.ID, &profile.Name, &profile.Email,
		&profile.Phone, &profile.Address, &profile.AvatarURL, &profile.CoverURL, &profile.CreatedAt)
	if err != nil {
		http.Error(w, `{"error":"seller not found"}`, http.StatusNotFound)
		return
	}

	// total sales
	err = h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM order_items oi
		JOIN products p ON p.id = oi.product_id
		WHERE p.seller_id = $1
	`, sellerID).Scan(&profile.TotalSales)
	if err != nil {
		profile.TotalSales = 0
	}

	// active products count
	err = h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM products
		WHERE seller_id = $1 AND is_active = true
	`, sellerID).Scan(&profile.ActiveProductsCount)
	if err != nil {
		profile.ActiveProductsCount = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

// GetSellerProducts returns all active products for a seller.
func (h *SellerHandler) GetSellerProducts(w http.ResponseWriter, r *http.Request) {
	sellerID, err := uuid.Parse(chi.URLParam(r, "sellerId"))
	if err != nil {
		http.Error(w, `{"error":"invalid seller id"}`, http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, title, description, slug, price, images, category, tags, created_at, updated_at
		FROM products
		WHERE seller_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`, sellerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type productRow struct {
		ID          string    `json:"id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Slug        string    `json:"slug"`
		Price       int       `json:"price"`
		Images      []string  `json:"images"`
		Category    []string  `json:"category"`
		Tags        []string  `json:"tags"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	var products []productRow
	for rows.Next() {
		var p productRow
		if err := rows.Scan(&p.ID, &p.Title, &p.Description, &p.Slug, &p.Price,
			&p.Images, &p.Category, &p.Tags, &p.CreatedAt, &p.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		products = append(products, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}