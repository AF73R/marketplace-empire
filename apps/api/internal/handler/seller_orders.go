package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/marketplace-empire/api/internal/auth"
	"github.com/marketplace-empire/api/internal/order"
)

type SellerOrderHandler struct {
	DB *pgxpool.Pool
}

func (h *SellerOrderHandler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTAuth)
		r.Get("/", h.ListSellerOrders)
		r.Put("/{id}/status", h.UpdateOrderStatus)
	})
}

// SellerOrderSummary is a lightweight view for the seller dashboard.
type SellerOrderSummary struct {
	ID          uuid.UUID         `json:"id"`
	BuyerName   string            `json:"buyer_name"`
	TotalAmount int               `json:"total_amount"` // full order total (incl. tax/shipping)
	Subtotal    int               `json:"subtotal"`     // sum of seller's items only
	Status      order.OrderStatus `json:"status"`
	ItemCount   int               `json:"item_count"`
	PlacedAt    time.Time         `json:"placed_at"`
}

func (h *SellerOrderHandler) ListSellerOrders(w http.ResponseWriter, r *http.Request) {
	sellerID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT o.id, u.name, o.total_amount, o.status, o.created_at,
		       COUNT(oi.id) AS item_count,
		       COALESCE(SUM(oi.total_price), 0) AS subtotal
		FROM orders o
		JOIN order_items oi ON oi.order_id = o.id
		JOIN products p ON p.id = oi.product_id
		JOIN users u ON u.id = o.user_id
		WHERE p.seller_id = $1
		GROUP BY o.id, u.name, o.total_amount, o.status, o.created_at
		ORDER BY o.created_at DESC
		LIMIT 50
	`, sellerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []SellerOrderSummary
	for rows.Next() {
		var os SellerOrderSummary
		if err := rows.Scan(&os.ID, &os.BuyerName, &os.TotalAmount, &os.Status, &os.PlacedAt, &os.ItemCount, &os.Subtotal); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		orders = append(orders, os)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

// UpdateOrderStatus allows a seller to mark an order as "shipped".
func (h *SellerOrderHandler) UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	sellerID, ok := auth.GetUserID(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid order id"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Status order.OrderStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	// Verify seller owns at least one product in this order
	var count int
	err = h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM order_items oi
		JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1 AND p.seller_id = $2
	`, id, sellerID).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, `{"error":"order not found or not your product"}`, http.StatusNotFound)
		return
	}

	if req.Status != order.StatusShipped {
		http.Error(w, `{"error":"sellers can only mark as shipped"}`, http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 AND status = 'confirmed'
	`, req.Status, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}