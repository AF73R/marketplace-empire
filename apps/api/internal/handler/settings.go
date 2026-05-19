package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SettingsHandler struct {
	DB *pgxpool.Pool
}

func (h *SettingsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.GetSettings)
	r.Put("/", h.UpdateSettings)
}

// Settings holds all adjustable business parameters.
type Settings struct {
	TaxDefaultRate      float64 `json:"tax_default_rate"`      // e.g., 0.20 = 20%
	TaxCountryRates     string  `json:"tax_country_rates"`     // "DE:0.19,FR:0.20"
	ShippingDefaultRate int     `json:"shipping_default_rate"` // cents
	ShippingPerKgRate   int     `json:"shipping_per_kg_rate"`  // cents per kg
	ShippingFreeThreshold int   `json:"shipping_free_threshold"` // cents subtotal
	AdditionalCost      int     `json:"additional_cost"`       // flat extra charge, cents
}

// defaultSettings returns the initial values (same as env‑based defaults).
func defaultSettings() Settings {
	return Settings{
		TaxDefaultRate:       0.20,
		TaxCountryRates:      "DE:0.19,FR:0.20,UK:0.20",
		ShippingDefaultRate:  500,
		ShippingPerKgRate:    200,
		ShippingFreeThreshold: 5000,
		AdditionalCost:        0,
	}
}

// GetSettings reads the current settings from a single‑row table.
func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	var s Settings
	err := h.DB.QueryRow(r.Context(), `
		SELECT tax_default_rate, tax_country_rates,
		       shipping_default_rate, shipping_per_kg_rate,
		       shipping_free_threshold, additional_cost
		FROM settings
		WHERE id = 1
	`).Scan(&s.TaxDefaultRate, &s.TaxCountryRates,
		&s.ShippingDefaultRate, &s.ShippingPerKgRate,
		&s.ShippingFreeThreshold, &s.AdditionalCost)
	if err != nil {
		// Return defaults if table/row missing
		s = defaultSettings()
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// UpdateSettings modifies the live settings.
func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req Settings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO settings (id, tax_default_rate, tax_country_rates,
		                      shipping_default_rate, shipping_per_kg_rate,
		                      shipping_free_threshold, additional_cost)
		VALUES (1, $1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			tax_default_rate = EXCLUDED.tax_default_rate,
			tax_country_rates = EXCLUDED.tax_country_rates,
			shipping_default_rate = EXCLUDED.shipping_default_rate,
			shipping_per_kg_rate = EXCLUDED.shipping_per_kg_rate,
			shipping_free_threshold = EXCLUDED.shipping_free_threshold,
			additional_cost = EXCLUDED.additional_cost
	`, req.TaxDefaultRate, req.TaxCountryRates,
		req.ShippingDefaultRate, req.ShippingPerKgRate,
		req.ShippingFreeThreshold, req.AdditionalCost)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}