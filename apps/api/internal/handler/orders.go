package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/marketplace-empire/api/internal/auth"
	"github.com/marketplace-empire/api/internal/order"
	"github.com/marketplace-empire/api/internal/tax"
)

// ShippingCostCalculator matches the saga's interface for calculating shipping cost.
type ShippingCostCalculator interface {
	CalculateCost(country string, weightKg float64, subtotal int) int
}

// DetailedShippingCalculator returns a full breakdown
type DetailedShippingCalculator interface {
	CalculateDetailedCost(country string, weightKg float64, subtotal int) (base, weightCharge, additional, total int)
}

type OrderHandler struct {
	DB           *pgxpool.Pool
	CMDs         *order.CommandHandler
	Saga         *order.Saga
	TaxSvc       *tax.Service
	ShippingCalc interface{} // ShippingCostCalculator or DetailedShippingCalculator
}

func (h *OrderHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Post("/", h.PlaceOrder)
		r.Get("/", h.ListMyOrders)
		r.Get("/{id}", h.GetOrder)
		r.Post("/{id}/cancel", h.CancelOrder)
	})
}

func (h *OrderHandler) PlaceOrder(w http.ResponseWriter, r *http.Request) {
	bodyBytes, _ := io.ReadAll(r.Body)
	r.Body.Close()
	log.Printf("RAW BODY: %s", string(bodyBytes))
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Items           []order.CreateOrderItem `json:"items"`
		ShippingAddress order.ShippingAddress   `json:"shipping_address"`
		PaymentMethod   string                  `json:"payment_method"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if len(req.Items) == 0 {
		http.Error(w, `{"error":"order must contain at least one item"}`, http.StatusBadRequest)
		return
	}
	if req.PaymentMethod != "stripe" && req.PaymentMethod != "cod" {
		req.PaymentMethod = "stripe"
	}

	createReq := order.CreateOrderRequest{
		UserID:          userID,
		Items:           req.Items,
		ShippingAddress: req.ShippingAddress,
	}

	var orderResp *order.CreateOrderResponse
	if req.PaymentMethod == "cod" {
		// 1. Create order (reserves inventory) – returns initial subtotal
		resp, err := h.CMDs.CreateOrder(r.Context(), createReq)
		if err != nil {
			log.Printf("CreateOrder (COD) failed: %v", err)
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		// 2. Calculate tax
		subtotal := resp.TotalAmount
		taxAmount := 0
		if h.TaxSvc != nil {
			taxAmount = h.TaxSvc.CalculateTax(subtotal, req.ShippingAddress.Country)
		}

		// 3. Calculate shipping (detailed if available)
		totalQty := 0
		for _, item := range req.Items {
			totalQty += item.Quantity
		}
		weightKg := float64(totalQty)
		if weightKg < 1 {
			weightKg = 1
		}

		var shippingCost int
		if detailed, ok := h.ShippingCalc.(DetailedShippingCalculator); ok {
			_, _, _, total := detailed.CalculateDetailedCost(req.ShippingAddress.Country, weightKg, subtotal)
			shippingCost = total
		} else if calc, ok := h.ShippingCalc.(ShippingCostCalculator); ok {
			shippingCost = calc.CalculateCost(req.ShippingAddress.Country, weightKg, subtotal)
		}

		newTotal := subtotal + taxAmount + shippingCost
		log.Printf("COD NEW TOTAL: subtotal=%d + tax=%d + shipping=%d = %d", subtotal, taxAmount, shippingCost, newTotal)

		// 4. Update the order with total, shipping, and tax columns
		_, err = h.DB.Exec(r.Context(), `
			UPDATE orders
			SET total_amount = $1,
			    shipping_cost = $2,
			    tax_amount = $3
			WHERE id = $4
		`, newTotal, shippingCost, taxAmount, resp.OrderID)
		if err != nil {
			log.Printf("Failed to update COD order totals: %v", err)
		}

		// 5. Update the response total
		resp.TotalAmount = newTotal

		// 6. Confirm the order
		if err := h.CMDs.ConfirmOrder(r.Context(), resp.OrderID); err != nil {
			log.Printf("ConfirmOrder (COD) failed for order %s: %v", resp.OrderID, err)
			http.Error(w, `{"error":"failed to confirm order"}`, http.StatusInternalServerError)
			return
		}
		orderResp = resp
	} else {
		// Stripe – Saga already updates total_amount, shipping_cost, tax_amount
		resp, err := h.Saga.ProcessOrder(r.Context(), createReq)
		if err != nil {
			log.Printf("ProcessOrder (Stripe) failed: %v", err)
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
		orderResp = resp
	}

	_, _ = h.DB.Exec(r.Context(), `UPDATE orders SET payment_method = $1 WHERE id = $2`, req.PaymentMethod, orderResp.OrderID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(orderResp)
}

func (h *OrderHandler) ListMyOrders(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, status, total_amount, currency, shipping_address, payment_method, created_at, updated_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type orderRow struct {
		ID              uuid.UUID             `json:"id"`
		Status          string                `json:"status"`
		TotalAmount     int                   `json:"total_amount"`
		Currency        string                `json:"currency"`
		ShippingAddress order.ShippingAddress `json:"shipping_address"`
		PaymentMethod   string                `json:"payment_method"`
		CreatedAt       time.Time             `json:"created_at"`
		UpdatedAt       time.Time             `json:"updated_at"`
	}

	var orders []orderRow
	for rows.Next() {
		var o orderRow
		if err := rows.Scan(&o.ID, &o.Status, &o.TotalAmount, &o.Currency, &o.ShippingAddress, &o.PaymentMethod, &o.CreatedAt, &o.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		orders = append(orders, o)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

func (h *OrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid order id"}`, http.StatusBadRequest)
		return
	}

	var (
		oID            uuid.UUID
		oOwnerID       uuid.UUID
		oStatus        string
		oTotalAmount   int
		oCurrency      string
		oShippingAddr  order.ShippingAddress
		oPaymentMethod string
		oCreatedAt     time.Time
		oUpdatedAt     time.Time
	)
	err = h.DB.QueryRow(r.Context(), `
		SELECT id, user_id, status, total_amount, currency, shipping_address, payment_method, created_at, updated_at
		FROM orders WHERE id = $1
	`, id).Scan(&oID, &oOwnerID, &oStatus, &oTotalAmount, &oCurrency, &oShippingAddr, &oPaymentMethod, &oCreatedAt, &oUpdatedAt)
	if err != nil {
		log.Printf("GetOrder scan error: %v", err)
		http.Error(w, `{"error":"order not found"}`, http.StatusNotFound)
		return
	}
	if oOwnerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	// Fetch items – now also returns product slug
	itemRows, err := h.DB.Query(r.Context(), `
		SELECT oi.id, oi.product_id, p.title, p.slug,
		       CASE WHEN jsonb_array_length(p.images) > 0 THEN p.images->>0 ELSE '' END,
		       oi.quantity, oi.unit_price, oi.total_price
		FROM order_items oi
		JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
	`, id)
	if err != nil {
		log.Printf("GetOrder items query error: %v", err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer itemRows.Close()

	type itemRow struct {
		ID           uuid.UUID `json:"id"`
		ProductID    uuid.UUID `json:"product_id"`
		ProductTitle string    `json:"product_title"`
		ProductSlug  string    `json:"product_slug"`           // ★ NEW
		ProductImage string    `json:"product_image,omitempty"`
		Quantity     int       `json:"quantity"`
		UnitPrice    int       `json:"unit_price"`
		TotalPrice   int       `json:"total_price"`
	}

	var items []itemRow
	var computedSubtotal int
	for itemRows.Next() {
		var it itemRow
		if err := itemRows.Scan(&it.ID, &it.ProductID, &it.ProductTitle, &it.ProductSlug,
			&it.ProductImage, &it.Quantity, &it.UnitPrice, &it.TotalPrice); err != nil {
			log.Printf("GetOrder item scan error: %v", err)
			http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			return
		}
		computedSubtotal += it.TotalPrice
		items = append(items, it)
	}

	// … rest of the handler (tax, shipment, response) unchanged
	taxAmount := oTotalAmount - computedSubtotal
	if taxAmount < 0 {
		taxAmount = 0
	}

	// Shipment (unchanged)
	var shipment *struct {
		Carrier         string `json:"carrier"`
		TrackingNumber  string `json:"tracking_number"`
		LabelURL        string `json:"label_url"`
		Status          string `json:"status"`
		EstDelivery     string `json:"estimated_delivery"`
	}
	var carrier, tracking, labelURL, shipStatus string
	var shipCreatedAt time.Time
	err = h.DB.QueryRow(r.Context(), `
		SELECT carrier, tracking_number, label_url, status, created_at
		FROM shipments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1
	`, id).Scan(&carrier, &tracking, &labelURL, &shipStatus, &shipCreatedAt)
	if err == nil {
		shipment = &struct {
			Carrier         string `json:"carrier"`
			TrackingNumber  string `json:"tracking_number"`
			LabelURL        string `json:"label_url"`
			Status          string `json:"status"`
			EstDelivery     string `json:"estimated_delivery"`
		}{
			Carrier:        carrier,
			TrackingNumber: tracking,
			LabelURL:       labelURL,
			Status:         shipStatus,
			EstDelivery:    shipCreatedAt.AddDate(0, 0, 5).Format("2006-01-02"),
		}
	}

	resp := map[string]interface{}{
		"id":               oID,
		"status":           oStatus,
		"subtotal":         computedSubtotal,
		"tax_amount":       taxAmount,
		"total_amount":     oTotalAmount,
		"currency":         oCurrency,
		"shipping_address": oShippingAddr,
		"payment_method":   oPaymentMethod,
		"items":            items,
		"created_at":       oCreatedAt,
		"updated_at":       oUpdatedAt,
	}
	if shipment != nil {
		resp["shipment"] = shipment
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *OrderHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid order id"}`, http.StatusBadRequest)
		return
	}

	var ownerID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `SELECT user_id FROM orders WHERE id = $1`, id).Scan(&ownerID)
	if err != nil {
		http.Error(w, `{"error":"order not found"}`, http.StatusNotFound)
		return
	}
	if ownerID != userID {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	if err := h.CMDs.CancelOrder(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}