package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/marketplace-empire/api/internal/auth"
)

type ProfileHandler struct {
	DB *pgxpool.Pool
}

func (h *ProfileHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Get("/", h.GetProfile)
		r.Put("/", h.UpdateProfile)
		r.Put("/password", h.ChangePassword)
	})
}

type Profile struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Phone     *string   `json:"phone,omitempty"`
	Address   *string   `json:"address,omitempty"`   // ★ new
	AvatarURL *string   `json:"avatar_url,omitempty"`
	CoverURL  *string   `json:"cover_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (h *ProfileHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var p Profile
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, email, name, phone, address, avatar_url, cover_url, created_at, updated_at
		FROM users WHERE id = $1
	`, userID).Scan(&p.ID, &p.Email, &p.Name, &p.Phone, &p.Address, &p.AvatarURL, &p.CoverURL, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *ProfileHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Name      *string `json:"name"`
		Phone     *string `json:"phone"`
		Address   *string `json:"address"`       // ★ added
		AvatarURL *string `json:"avatar_url"`
		CoverURL  *string `json:"cover_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE users
		SET name = COALESCE($1, name),
		    phone = COALESCE($2, phone),
		    address = COALESCE($3, address),    -- ★ update address
		    avatar_url = COALESCE($4, avatar_url),
		    cover_url = COALESCE($5, cover_url),
		    updated_at = now()
		WHERE id = $6
	`, req.Name, req.Phone, req.Address, req.AvatarURL, req.CoverURL, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ProfileHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	var currentHash string
	err := h.DB.QueryRow(r.Context(), `SELECT password FROM users WHERE id = $1`, userID).Scan(&currentHash)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)); err != nil {
		http.Error(w, `{"error":"current password is incorrect"}`, http.StatusUnauthorized)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = h.DB.Exec(r.Context(), `UPDATE users SET password = $1, updated_at = now() WHERE id = $2`, string(newHash), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}