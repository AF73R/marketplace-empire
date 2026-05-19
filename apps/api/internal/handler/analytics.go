package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsHandler struct {
	DB *pgxpool.Pool
}

func (h *AnalyticsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/overview", h.GetOverview)
	r.Get("/revenue", h.GetRevenueOverTime)
	r.Get("/top-sellers", h.GetTopSellers)
}

// Overview contains key metrics for the admin dashboard.
type Overview struct {
	TotalUsers      int `json:"total_users"`
	TotalProducts   int `json:"total_products"`
	TotalOrders     int `json:"total_orders"`
	TotalRevenue    int `json:"total_revenue"`   // subtotal of delivered orders only
	PendingOrders   int `json:"pending_orders"`
	ShippedOrders   int `json:"shipped_orders"`
	DeliveredOrders int `json:"delivered_orders"` // count of delivered orders
	ReturnsCount    int `json:"returns_count"`    // total return requests
	TotalShipping   int `json:"total_shipping"`   // total shipping from delivered orders
	TotalTax        int `json:"total_tax"`        // total tax from delivered orders
}

// GetOverview returns high‑level statistics.
func (h *AnalyticsHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	var overview Overview

	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&overview.TotalUsers)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM products WHERE is_active = true`).Scan(&overview.TotalProducts)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM orders`).Scan(&overview.TotalOrders)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM orders WHERE status IN ('pending','confirmed')`).Scan(&overview.PendingOrders)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM orders WHERE status IN ('shipped','out_for_delivery','delivered')`).Scan(&overview.ShippedOrders)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM orders WHERE status = 'delivered'`).Scan(&overview.DeliveredOrders)
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM returns`).Scan(&overview.ReturnsCount)

	// Total revenue = subtotal of delivered orders only
	h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(oi.total_price), 0)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.status = 'delivered'
	`).Scan(&overview.TotalRevenue)

	// Total shipping and tax from delivered orders
	h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(shipping_cost), 0), COALESCE(SUM(tax_amount), 0)
		FROM orders
		WHERE status = 'delivered'
	`).Scan(&overview.TotalShipping, &overview.TotalTax)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview)
}

// RevenueDataPoint is a single data point for a revenue chart.
type RevenueDataPoint struct {
	Date    string `json:"date"`
	Revenue int    `json:"revenue"`
}

// GetRevenueOverTime returns daily revenue for the last 30 days (unchanged).
func (h *AnalyticsHandler) GetRevenueOverTime(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT DATE(created_at) AS day, COALESCE(SUM(total_amount), 0) AS revenue
		FROM orders
		WHERE status != 'cancelled' AND created_at >= now() - INTERVAL '30 days'
		GROUP BY day
		ORDER BY day ASC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var data []RevenueDataPoint
	for rows.Next() {
		var dp RevenueDataPoint
		var day time.Time
		if err := rows.Scan(&day, &dp.Revenue); err != nil {
			continue
		}
		dp.Date = day.Format("2006-01-02")
		data = append(data, dp)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// TopSeller represents a seller with their revenue and order count.
type TopSeller struct {
	SellerID   string `json:"seller_id"`
	SellerName string `json:"seller_name"`
	Revenue    int    `json:"revenue"`
	OrderCount int    `json:"order_count"`
}

// GetTopSellers returns the top 10 sellers by revenue from delivered orders only,
// using only the item subtotal (not shipping/tax).
func (h *AnalyticsHandler) GetTopSellers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT u.id, u.name,
		       COALESCE(SUM(oi.total_price), 0) AS revenue,
		       COUNT(DISTINCT o.id) AS order_count
		FROM users u
		JOIN products p ON p.seller_id = u.id
		JOIN order_items oi ON oi.product_id = p.id
		JOIN orders o ON o.id = oi.order_id AND o.status = 'delivered'
		GROUP BY u.id, u.name
		ORDER BY revenue DESC
		LIMIT 10
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sellers []TopSeller
	for rows.Next() {
		var ts TopSeller
		if err := rows.Scan(&ts.SellerID, &ts.SellerName, &ts.Revenue, &ts.OrderCount); err != nil {
			continue
		}
		sellers = append(sellers, ts)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sellers)
}