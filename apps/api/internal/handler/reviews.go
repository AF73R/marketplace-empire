package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/marketplace-empire/api/internal/auth"
)

type ReviewsHandler struct {
	DB *pgxpool.Pool
}

func (h *ReviewsHandler) RegisterRoutes(r chi.Router) {
	// Public
	r.Get("/products/{productId}/reviews", h.ListByProduct)

	// Authenticated
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Post("/products/{productId}/reviews", h.Create)
	})
}

// AdminRoutes provides admin‑only endpoints for managing all reviews.
func (h *ReviewsHandler) AdminRoutes(r chi.Router) {
	r.Get("/", h.ListAllReviews)
	r.Delete("/{id}", h.DeleteReview)
}

// ListAllReviews returns every review across all products.
func (h *ReviewsHandler) ListAllReviews(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT r.id, r.product_id, r.user_id, u.name, r.rating, r.comment, r.created_at
		FROM reviews r
		JOIN users u ON u.id = r.user_id
		ORDER BY r.created_at DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Review struct {
		ID        uuid.UUID `json:"id"`
		ProductID uuid.UUID `json:"product_id"`
		UserID    uuid.UUID `json:"user_id"`
		UserName  string    `json:"user_name"`
		Rating    int       `json:"rating"`
		Comment   string    `json:"comment"`
		CreatedAt time.Time `json:"created_at"`
	}

	var reviews []Review
	for rows.Next() {
		var rv Review
		if err := rows.Scan(&rv.ID, &rv.ProductID, &rv.UserID, &rv.UserName, &rv.Rating, &rv.Comment, &rv.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		reviews = append(reviews, rv)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

// DeleteReview removes a review by ID.
func (h *ReviewsHandler) DeleteReview(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM reviews WHERE id = $1`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


type Review struct {
	ID        uuid.UUID `json:"id"`
	ProductID uuid.UUID `json:"product_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name"`
	Rating    int       `json:"rating"`     // 1-5
	Comment   string    `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

// Create a new review for a product.
func (h *ReviewsHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	productID, err := uuid.Parse(chi.URLParam(r, "productId"))
	if err != nil {
		http.Error(w, `{"error":"invalid product id"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		http.Error(w, `{"error":"rating must be between 1 and 5"}`, http.StatusBadRequest)
		return
	}

	// Verify product exists
	var exists bool
	err = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`, productID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, `{"error":"product not found"}`, http.StatusNotFound)
		return
	}

	// Prevent duplicate reviews (one per user per product)
	var count int
	err = h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM reviews WHERE user_id = $1 AND product_id = $2`,
		userID, productID).Scan(&count)
	if err == nil && count > 0 {
		http.Error(w, `{"error":"you have already reviewed this product"}`, http.StatusConflict)
		return
	}

	var reviewID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
		VALUES ($1, $2, $3, $4, now())
		RETURNING id
	`, productID, userID, req.Rating, req.Comment).Scan(&reviewID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": reviewID.String()})
}

// ListByProduct returns all reviews for a product, along with average rating.
func (h *ReviewsHandler) ListByProduct(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "productId"))
	if err != nil {
		http.Error(w, `{"error":"invalid product id"}`, http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT r.id, r.product_id, r.user_id, u.name, r.rating, r.comment, r.created_at
		FROM reviews r
		JOIN users u ON u.id = r.user_id
		WHERE r.product_id = $1
		ORDER BY r.created_at DESC
	`, productID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var reviews []Review
	totalRating := 0
	for rows.Next() {
		var rv Review
		if err := rows.Scan(&rv.ID, &rv.ProductID, &rv.UserID, &rv.UserName, &rv.Rating, &rv.Comment, &rv.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		reviews = append(reviews, rv)
		totalRating += rv.Rating
	}

	// Calculate average
	avg := 0.0
	count := len(reviews)
	if count > 0 {
		avg = float64(totalRating) / float64(count)
	}

	resp := map[string]interface{}{
		"reviews":       reviews,
		"average":       avg,
		"total_reviews": count,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}