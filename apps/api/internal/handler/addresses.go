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

type AddressesHandler struct {
	DB *pgxpool.Pool
}

func (h *AddressesHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Get("/", h.ListAddresses)
		r.Post("/", h.CreateAddress)
		r.Put("/{id}", h.UpdateAddress)
		r.Delete("/{id}", h.DeleteAddress)
	})
}

type Address struct {
	ID         uuid.UUID `json:"id"`
	Label      string    `json:"label"`
	Line1      string    `json:"line1"`
	Line2      string    `json:"line2,omitempty"`
	City       string    `json:"city"`
	State      string    `json:"state,omitempty"`
	PostalCode string    `json:"postal_code"`
	Country    string    `json:"country"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// ListAddresses returns all saved addresses for the authenticated user.
func (h *AddressesHandler) ListAddresses(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, label, line1, line2, city, state, postal_code, country, created_at, updated_at
		FROM addresses
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var addresses []Address
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.ID, &a.Label, &a.Line1, &a.Line2, &a.City, &a.State, &a.PostalCode, &a.Country, &a.CreatedAt, &a.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		addresses = append(addresses, a)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addresses)
}

// CreateAddress adds a new address for the authenticated user.
func (h *AddressesHandler) CreateAddress(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req Address
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Label == "" || req.Line1 == "" || req.City == "" || req.PostalCode == "" || req.Country == "" {
		http.Error(w, `{"error":"label, line1, city, postal_code, and country are required"}`, http.StatusBadRequest)
		return
	}

	var addressID uuid.UUID
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO addresses (user_id, label, line1, line2, city, state, postal_code, country, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
		RETURNING id
	`, userID, req.Label, req.Line1, req.Line2, req.City, req.State, req.PostalCode, req.Country).Scan(&addressID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": addressID.String()})
}

// UpdateAddress modifies an existing address (only if owned by the user).
func (h *AddressesHandler) UpdateAddress(w http.ResponseWriter, r *http.Request) {
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

	var req Address
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	// Verify ownership
	var ownerID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `SELECT user_id FROM addresses WHERE id = $1`, id).Scan(&ownerID)
	if err != nil {
		http.Error(w, `{"error":"address not found"}`, http.StatusNotFound)
		return
	}
	if ownerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE addresses
		SET label = COALESCE(NULLIF($1, ''), label),
		    line1 = COALESCE(NULLIF($2, ''), line1),
		    line2 = COALESCE($3, line2),
		    city = COALESCE(NULLIF($4, ''), city),
		    state = COALESCE($5, state),
		    postal_code = COALESCE(NULLIF($6, ''), postal_code),
		    country = COALESCE(NULLIF($7, ''), country),
		    updated_at = now()
		WHERE id = $8
	`, req.Label, req.Line1, req.Line2, req.City, req.State, req.PostalCode, req.Country, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeleteAddress removes an address owned by the authenticated user.
func (h *AddressesHandler) DeleteAddress(w http.ResponseWriter, r *http.Request) {
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

	// Verify ownership
	var ownerID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `SELECT user_id FROM addresses WHERE id = $1`, id).Scan(&ownerID)
	if err != nil {
		http.Error(w, `{"error":"address not found"}`, http.StatusNotFound)
		return
	}
	if ownerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM addresses WHERE id = $1`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}