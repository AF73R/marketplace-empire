package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/marketplace-empire/api/internal/auth"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

func (h *AuthHandler) RegisterRoutes(r chi.Router) {
	r.Post("/register", h.Register)
	r.Post("/login", h.Login)
	// Note: GET /verify is mounted separately in main.go via auth.VerifyEmailHandler(pool)
}

// Register creates a new user account.
// A verification email is sent. In production, restrict certain actions until verified.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	// Basic validation
	if req.Email == "" || req.Name == "" || req.Password == "" {
		http.Error(w, `{"error":"email, name, and password are required"}`, http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	var userID string
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING id`,
		req.Email, req.Name, string(hash),
	).Scan(&userID)
	if err != nil {
		log.Printf("Registration insert error for email %s: %v", req.Email, err)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusConflict)
		return
	}

	// Generate verification token
	token, err := auth.GenerateVerificationToken()
	if err == nil {
		// Store token
		if err := auth.StoreVerificationTokenForUser(h.DB, userID, token); err != nil {
			// Non‑fatal; user can request a new verification later
			token = "" // clear so we don't try to send
		}
		// Send email (or log in dev)
		if token != "" {
			_ = auth.SendVerificationEmail(req.Email, token) // ignore send errors
		}
	}

	// Generate JWT for immediate login (optional: you could require verification first)
	jwtToken, err := generateToken(userID)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"token": jwtToken,
		"id":    userID,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	var userID, hash string
	var isVerified bool
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, password, is_verified FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &hash, &isVerified)
	if err != nil {
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	// Optionally warn if not verified (but still allow login)
	if !isVerified {
		// Could return a flag, but for now just let them in.
	}

	jwtToken, err := generateToken(userID)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token": jwtToken,
		"id":    userID,
	})
}

func generateToken(userID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-change-me-in-production-please"
	}
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(72 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}