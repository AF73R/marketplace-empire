package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/marketplace-empire/api/internal/auth"
)

type CartHandler struct {
	DB *pgxpool.Pool
}

func (h *CartHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Get("/", h.GetCart)
		r.Put("/", h.UpdateCart)
		r.Delete("/", h.ClearCart)
	})
}

type CartItem struct {
	ProductID string `json:"product_id"`
	Title     string `json:"title"`
	Slug      string `json:"slug"`
	Price     int    `json:"price"`
	Quantity  int    `json:"quantity"`
	Image     string `json:"image,omitempty"`
	Size      string `json:"size,omitempty"`
}

type Cart struct {
	Items     []CartItem `json:"items"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (h *CartHandler) GetCart(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var itemsJSON []byte
	var updatedAt time.Time
	err := h.DB.QueryRow(r.Context(),
		`SELECT items, updated_at FROM carts WHERE user_id = $1`, userID,
	).Scan(&itemsJSON, &updatedAt)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Cart{Items: []CartItem{}, UpdatedAt: time.Now()})
		return
	}

	var items []CartItem
	if err := json.Unmarshal(itemsJSON, &items); err != nil {
		items = []CartItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Cart{Items: items, UpdatedAt: updatedAt})
}

func (h *CartHandler) UpdateCart(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Items []CartItem `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	itemsJSON, err := json.Marshal(req.Items)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO carts (user_id, items, updated_at)
		VALUES ($1, $2, now())
		ON CONFLICT (user_id)
		DO UPDATE SET items = EXCLUDED.items, updated_at = now()
	`, userID, itemsJSON)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *CartHandler) ClearCart(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM carts WHERE user_id = $1`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}