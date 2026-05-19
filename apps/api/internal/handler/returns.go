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

type ReturnsHandler struct {
	DB *pgxpool.Pool
}

func (h *ReturnsHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Post("/", h.RequestReturn)          // buyer requests a return
		r.Get("/", h.ListReturns)             // list user's returns
		r.Get("/{id}", h.GetReturn)           // single return details
	})
}

// AdminRoutes provides admin‑only endpoints.
func (h *ReturnsHandler) AdminRoutes(r chi.Router) {
	r.Get("/", h.ListAllReturns)
	r.Put("/{id}/process", h.ProcessReturn)
}

// ReturnRequest is the payload sent by the buyer.
type ReturnRequest struct {
	OrderID string `json:"order_id"`
	Reason  string `json:"reason"`
}

// ReturnInfo is the response model.
type ReturnInfo struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	Reason    string    `json:"reason"`
	Status    string    `json:"status"` // requested, approved, rejected, refunded
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RequestReturn creates a new return request.
func (h *ReturnsHandler) RequestReturn(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req ReturnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.OrderID == "" || req.Reason == "" {
		http.Error(w, `{"error":"order_id and reason are required"}`, http.StatusBadRequest)
		return
	}

	// Verify the order belongs to the user
	var orderOwnerID uuid.UUID
	err := h.DB.QueryRow(r.Context(), `SELECT user_id FROM orders WHERE id = $1`, req.OrderID).Scan(&orderOwnerID)
	if err != nil {
		http.Error(w, `{"error":"order not found"}`, http.StatusNotFound)
		return
	}
	if orderOwnerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	// Create return
	var returnID uuid.UUID
	var createdAt, updatedAt time.Time
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO returns (order_id, reason, status, created_at, updated_at)
		VALUES ($1, $2, 'requested', now(), now())
		RETURNING id, created_at, updated_at
	`, req.OrderID, req.Reason).Scan(&returnID, &createdAt, &updatedAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp := ReturnInfo{
		ID:        returnID.String(),
		OrderID:   req.OrderID,
		Reason:    req.Reason,
		Status:    "requested",
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// ListReturns returns all return requests for the authenticated user.
func (h *ReturnsHandler) ListReturns(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT ret.id, ret.order_id, ret.reason, ret.status, ret.created_at, ret.updated_at
		FROM returns ret
		JOIN orders o ON o.id = ret.order_id
		WHERE o.user_id = $1
		ORDER BY ret.created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var returns []ReturnInfo
	for rows.Next() {
		var ri ReturnInfo
		if err := rows.Scan(&ri.ID, &ri.OrderID, &ri.Reason, &ri.Status, &ri.CreatedAt, &ri.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		returns = append(returns, ri)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(returns)
}

// GetReturn returns details of a single return request.
func (h *ReturnsHandler) GetReturn(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var ri ReturnInfo
	var orderOwnerID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `
		SELECT ret.id, ret.order_id, ret.reason, ret.status, ret.created_at, ret.updated_at, o.user_id
		FROM returns ret
		JOIN orders o ON o.id = ret.order_id
		WHERE ret.id = $1
	`, id).Scan(&ri.ID, &ri.OrderID, &ri.Reason, &ri.Status, &ri.CreatedAt, &ri.UpdatedAt, &orderOwnerID)
	if err != nil {
		http.Error(w, `{"error":"return not found"}`, http.StatusNotFound)
		return
	}
	if orderOwnerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ri)
}

// ListAllReturns returns every return request across all users.
func (h *ReturnsHandler) ListAllReturns(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT id, order_id, reason, status, created_at, updated_at
		FROM returns
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ReturnInfo struct {
		ID        string    `json:"id"`
		OrderID   string    `json:"order_id"`
		Reason    string    `json:"reason"`
		Status    string    `json:"status"`
		CreatedAt time.Time `json:"created_at"`
		UpdatedAt time.Time `json:"updated_at"`
	}

	var returns []ReturnInfo
	for rows.Next() {
		var ri ReturnInfo
		if err := rows.Scan(&ri.ID, &ri.OrderID, &ri.Reason, &ri.Status, &ri.CreatedAt, &ri.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		returns = append(returns, ri)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(returns)
}

// ProcessReturn unchanged (as before)
func (h *ReturnsHandler) ProcessReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Status != "approved" && req.Status != "rejected" {
		http.Error(w, `{"error":"status must be 'approved' or 'rejected'"}`, http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec(r.Context(), `UPDATE returns SET status = $1, updated_at = now() WHERE id = $2`, req.Status, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}