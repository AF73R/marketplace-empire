package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/marketplace-empire/api/internal/tax"
)

type TaxHandler struct {
	TaxService *tax.Service
}

func (h *TaxHandler) RegisterRoutes(r chi.Router) {
	r.Get("/calculate", h.CalculateTax)
}

// CalculateTax returns the tax amount in cents for a given country and subtotal.
func (h *TaxHandler) CalculateTax(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	if country == "" {
		country = "US"
	}

	subtotal := 0
	if s := r.URL.Query().Get("subtotal"); s != "" {
		if parsed, err := strconv.Atoi(s); err == nil {
			subtotal = parsed
		}
	}

	taxAmount := h.TaxService.CalculateTax(subtotal, country)
	// Also return the effective rate for display
	rate := h.TaxService.GetEffectiveRate(country)

	resp := map[string]interface{}{
		"tax_amount": taxAmount,
		"rate":       rate,
		"currency":   "USD",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}