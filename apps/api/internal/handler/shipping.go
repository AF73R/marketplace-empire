package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/marketplace-empire/api/internal/shipping"
)

type ShippingCostHandler struct {
	CostService *shipping.ShippingCostService
}

func (h *ShippingCostHandler) RegisterRoutes(r chi.Router) {
	r.Get("/cost", h.CalculateCost)
}

// CalculateCost responds with a detailed shipping cost breakdown.
func (h *ShippingCostHandler) CalculateCost(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	if country == "" {
		country = "US"
	}

	weightKg := 1.0
	if w := r.URL.Query().Get("weight"); w != "" {
		if parsed, err := strconv.ParseFloat(w, 64); err == nil {
			weightKg = parsed
		}
	}

	subtotal := 0
	if s := r.URL.Query().Get("subtotal"); s != "" {
		if parsed, err := strconv.Atoi(s); err == nil {
			subtotal = parsed
		}
	}

	// Get detailed breakdown from service
	base, weightCharge, additional, total := h.CostService.CalculateDetailedCost(country, weightKg, subtotal)

	resp := map[string]interface{}{
		"base_cost":       base,
		"weight_charge":   weightCharge,
		"additional_cost": additional,
		"total_cost":      total,
		"currency":        "USD",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}