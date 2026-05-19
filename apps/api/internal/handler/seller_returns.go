package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/marketplace-empire/api/internal/auth"
)

type SellerReturnsHandler struct {
	DB *pgxpool.Pool
}

func (h *SellerReturnsHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Get("/count", h.CountReturns)
		r.Get("/", h.ListApprovedReturns)
	})
}

// CountReturns returns the number of approved return requests for products sold by the authenticated seller.
func (h *SellerReturnsHandler) CountReturns(w http.ResponseWriter, r *http.Request) {
	sellerID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var count int
	err := h.DB.QueryRow(r.Context(), `
		SELECT COUNT(DISTINCT ret.id)
		FROM returns ret
		JOIN orders o ON o.id = ret.order_id
		JOIN order_items oi ON oi.order_id = o.id
		JOIN products p ON p.id = oi.product_id
		WHERE p.seller_id = $1 AND ret.status = 'approved'
	`, sellerID).Scan(&count)
	if err != nil {
		count = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"count": count})
}

// ApprovedReturn represents an approved return for the seller's products.
type ApprovedReturn struct {
	ID         string    `json:"id"`
	OrderID    string    `json:"order_id"`
	ProductID  string    `json:"product_id"`
	Title      string    `json:"product_title"`
	Reason     string    `json:"reason"`
	Quantity   int       `json:"quantity"`
	ReturnedAt time.Time `json:"created_at"`
}

// ListApprovedReturns returns the list of approved returns for the seller's products.
func (h *SellerReturnsHandler) ListApprovedReturns(w http.ResponseWriter, r *http.Request) {
	sellerID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT ret.id, ret.order_id, p.id, p.title, ret.reason, oi.quantity, ret.created_at
		FROM returns ret
		JOIN orders o ON o.id = ret.order_id
		JOIN order_items oi ON oi.order_id = o.id
		JOIN products p ON p.id = oi.product_id
		WHERE p.seller_id = $1 AND ret.status = 'approved'
		ORDER BY ret.created_at DESC
	`, sellerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var returns []ApprovedReturn
	for rows.Next() {
		var r ApprovedReturn
		if err := rows.Scan(&r.ID, &r.OrderID, &r.ProductID, &r.Title, &r.Reason, &r.Quantity, &r.ReturnedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		returns = append(returns, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(returns)
}