package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/marketplace-empire/api/internal/auth"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/paymentintent"
)

// PaymentHandler exposes Stripe‑related endpoints.
type PaymentHandler struct{}

// NewPaymentHandler creates a new PaymentHandler.
func NewPaymentHandler() *PaymentHandler {
	return &PaymentHandler{}
}

// RegisterRoutes mounts payment routes.
func (h *PaymentHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Post("/create-intent", h.CreatePaymentIntent)
	})
}

// CreatePaymentIntent creates a Stripe PaymentIntent and returns its client secret.
// The frontend uses this secret to confirm the card payment.
func (h *PaymentHandler) CreatePaymentIntent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Amount   int    `json:"amount"`   // in cents
		Currency string `json:"currency"` // e.g., "usd"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, `{"error":"amount must be positive"}`, http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		req.Currency = "usd"
	}

	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(int64(req.Amount)),
		Currency: stripe.String(req.Currency),
	}
	pi, err := paymentintent.New(params)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"client_secret": pi.ClientSecret,
	})
}