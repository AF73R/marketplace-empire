package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/marketplace-empire/api/internal/auth"
)

type ProductHandler struct {
	DB *pgxpool.Pool
}

func (h *ProductHandler) RegisterRoutes(r chi.Router) {
	// Public – specific routes must come before parameterised ones
	r.Get("/", h.List)
	r.Get("/by-id/{id}", h.GetByID)      // ★ new endpoint
	r.Get("/{slug}", h.GetBySlug)        // catch‑all slug
	r.Get("/{id}/stock", h.GetStock)     // available stock

	// Authenticated (seller actions)
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Post("/", h.Create)
		r.Put("/{id}", h.Update)
		r.Delete("/{id}", h.Delete)
		r.Get("/my", h.ListMyProducts)
	})
}

// ─── Public endpoints ──────────────────────────────────────────────

func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
	query := `SELECT p.id, p.seller_id, p.title, p.description, p.slug,
			p.price, p.currency, p.images, p.category, p.tags,
			p.is_active, p.created_at, p.updated_at
		FROM products p
		WHERE p.is_active = true`

	sellerID := r.URL.Query().Get("seller_id")
	args := []interface{}{}
	argIdx := 1
	if sellerID != "" {
		query += ` AND p.seller_id = $` + strings.TrimSpace(string(rune(argIdx)))
		args = append(args, sellerID)
		argIdx++
	}
	query += ` ORDER BY p.created_at DESC LIMIT 50`

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type productRow struct {
		ID          uuid.UUID `json:"id"`
		SellerID    uuid.UUID `json:"seller_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Slug        string    `json:"slug"`
		Price       int       `json:"price"`
		Currency    string    `json:"currency"`
		Images      []string  `json:"images"`
		Category    []string  `json:"category"`
		Tags        []string  `json:"tags"`
		IsActive    bool      `json:"is_active"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	products := []productRow{}
	for rows.Next() {
		var p productRow
		err := rows.Scan(&p.ID, &p.SellerID, &p.Title, &p.Description, &p.Slug,
			&p.Price, &p.Currency, &p.Images, &p.Category, &p.Tags, &p.IsActive,
			&p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		products = append(products, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *ProductHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var p struct {
		ID          uuid.UUID `json:"id"`
		SellerID    uuid.UUID `json:"seller_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Slug        string    `json:"slug"`
		Price       int       `json:"price"`
		Currency    string    `json:"currency"`
		Images      []string  `json:"images"`
		Category    []string  `json:"category"`
		Tags        []string  `json:"tags"`
		IsActive    bool      `json:"is_active"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	err = h.DB.QueryRow(r.Context(), `
		SELECT id, seller_id, title, description, slug, price, currency,
		       images, category, tags, is_active, created_at, updated_at
		FROM products
		WHERE id = $1
	`, id).Scan(&p.ID, &p.SellerID, &p.Title, &p.Description, &p.Slug,
		&p.Price, &p.Currency, &p.Images, &p.Category, &p.Tags, &p.IsActive,
		&p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		http.Error(w, `{"error":"product not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *ProductHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var p struct {
		ID          uuid.UUID `json:"id"`
		SellerID    uuid.UUID `json:"seller_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Slug        string    `json:"slug"`
		Price       int       `json:"price"`
		Currency    string    `json:"currency"`
		Images      []string  `json:"images"`
		Category    []string  `json:"category"`
		Tags        []string  `json:"tags"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	err := h.DB.QueryRow(r.Context(), `
		SELECT id, seller_id, title, description, slug, price, currency,
		       images, category, tags, created_at, updated_at
		FROM products
		WHERE slug = $1 AND is_active = true
	`, slug).Scan(&p.ID, &p.SellerID, &p.Title, &p.Description, &p.Slug,
		&p.Price, &p.Currency, &p.Images, &p.Category, &p.Tags,
		&p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		http.Error(w, `{"error":"product not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// GetStock returns the available stock for a product.
func (h *ProductHandler) GetStock(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var available int
	err = h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(quantity_change), 0)
		FROM inventory_ledger
		WHERE product_id = $1 AND warehouse_id = 1
	`, productID).Scan(&available)
	if err != nil {
		available = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"available": available})
}

// ─── Seller endpoints ────────────────────────────────────────────────

func (h *ProductHandler) ListMyProducts(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, seller_id, title, description, slug, price, currency,
		       images, category, tags, is_active, created_at, updated_at
		FROM products
		WHERE seller_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type productRow struct {
		ID          uuid.UUID `json:"id"`
		SellerID    uuid.UUID `json:"seller_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Slug        string    `json:"slug"`
		Price       int       `json:"price"`
		Currency    string    `json:"currency"`
		Images      []string  `json:"images"`
		Category    []string  `json:"category"`
		Tags        []string  `json:"tags"`
		IsActive    bool      `json:"is_active"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	products := []productRow{}
	for rows.Next() {
		var p productRow
		err := rows.Scan(&p.ID, &p.SellerID, &p.Title, &p.Description, &p.Slug,
			&p.Price, &p.Currency, &p.Images, &p.Category, &p.Tags, &p.IsActive,
			&p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		products = append(products, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Price       int      `json:"price"`
		Images      []string `json:"images"`
		Category    []string `json:"category"`
		Tags        []string `json:"tags"`
		Stock       int      `json:"stock"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Title == "" || req.Price <= 0 {
		http.Error(w, `{"error":"title and price are required"}`, http.StatusBadRequest)
		return
	}

	slug := generateSlug(req.Title)

	var productID uuid.UUID
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO products (seller_id, title, description, slug, price, images, category, tags)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, userID, req.Title, req.Description, slug, req.Price, req.Images, req.Category, req.Tags).Scan(&productID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if req.Stock > 0 {
		_, err = h.DB.Exec(r.Context(), `
			INSERT INTO inventory_ledger (product_id, warehouse_id, quantity_change, reason, created_at)
			VALUES ($1, 1, $2, 'initial', now())
		`, productID, req.Stock)
		if err != nil {
			// log but don't fail
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":   productID,
		"slug": slug,
	})
}

func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var sellerID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `SELECT seller_id FROM products WHERE id = $1`, id).Scan(&sellerID)
	if err != nil {
		http.Error(w, `{"error":"product not found"}`, http.StatusNotFound)
		return
	}
	if sellerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	var req struct {
		Title       *string  `json:"title"`
		Description *string  `json:"description"`
		Price       *int     `json:"price"`
		Images      []string `json:"images"`
		Category    []string `json:"category"`
		Tags        []string `json:"tags"`
		Stock       *int     `json:"stock"`     // ★ optional stock adjustment
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	// Update product fields
	_, err = h.DB.Exec(r.Context(), `
		UPDATE products SET
			title = COALESCE($1, title),
			description = COALESCE($2, description),
			price = COALESCE($3, price),
			images = COALESCE($4, images),
			category = COALESCE($5, category),
			tags = COALESCE($6, tags),
			updated_at = now()
		WHERE id = $7
	`, req.Title, req.Description, req.Price, req.Images, req.Category, req.Tags, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// ★ Handle stock adjustment (add stock)
	if req.Stock != nil && *req.Stock > 0 {
		_, err = h.DB.Exec(r.Context(), `
			INSERT INTO inventory_ledger (product_id, warehouse_id, quantity_change, reason, created_at)
			VALUES ($1, 1, $2, 'adjustment', now())
		`, id, *req.Stock)
		if err != nil {
			// log but don't fail the whole update
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ProductHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var sellerID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `SELECT seller_id FROM products WHERE id = $1`, id).Scan(&sellerID)
	if err != nil {
		http.Error(w, `{"error":"product not found"}`, http.StatusNotFound)
		return
	}
	if sellerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	_, err = h.DB.Exec(r.Context(), `UPDATE products SET is_active = false, updated_at = now() WHERE id = $1`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func generateSlug(title string) string {
	s := strings.ToLower(title)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return -1
	}, s)
	if s == "" {
		s = "product"
	}
	return s + "-" + uuid.New().String()[:8]
}