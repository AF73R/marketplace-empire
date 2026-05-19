package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/marketplace-empire/api/internal/ws"
)

type AdminHandler struct {
	DB  *pgxpool.Pool
	Hub *ws.Hub
}

func (h *AdminHandler) RegisterRoutes(r chi.Router) {
	r.Get("/users", h.ListUsers)
	r.Delete("/users/{id}", h.DeleteUser)

	r.Get("/products", h.ListAllProducts)
	r.Put("/products/{id}", h.UpdateProduct)

	r.Get("/orders", h.ListAllOrders)
	r.Put("/orders/{id}/status", h.UpdateOrderStatus)
}

// ─── Users ─────────────────────────────────────────────────────────

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, email, name, phone, address, created_at FROM users ORDER BY created_at DESC`)
	if err != nil {
		log.Printf("Error querying users: %v", err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type userRow struct {
		ID        string    `json:"id"`
		Email     string    `json:"email"`
		Name      string    `json:"name"`
		Phone     *string   `json:"phone,omitempty"`    // ★ added
		Address   *string   `json:"address,omitempty"`  // ★ added
		CreatedAt time.Time `json:"created_at"`
	}
	var users []userRow
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Phone, &u.Address, &u.CreatedAt); err != nil {
			log.Printf("Error scanning user: %v", err)
			http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}
	_, err = h.DB.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		log.Printf("Error deleting user %s: %v", id, err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Products (unchanged) ──────────────────────────────────────────

func (h *AdminHandler) ListAllProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT p.id, p.title, p.price, p.is_active, u.name
		FROM products p
		JOIN users u ON u.id = p.seller_id
		ORDER BY p.created_at DESC`)
	if err != nil {
		log.Printf("Error querying products: %v", err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type productRow struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Price    int    `json:"price"`
		IsActive bool   `json:"is_active"`
		Seller   string `json:"seller"`
	}
	var products []productRow
	for rows.Next() {
		var p productRow
		if err := rows.Scan(&p.ID, &p.Title, &p.Price, &p.IsActive, &p.Seller); err != nil {
			log.Printf("Error scanning product: %v", err)
			http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			return
		}
		products = append(products, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *AdminHandler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		IsActive *bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	if req.IsActive != nil {
		_, err = h.DB.Exec(r.Context(),
			`UPDATE products SET is_active = $1, updated_at = now() WHERE id = $2`,
			*req.IsActive, id)
		if err != nil {
			log.Printf("Error updating product %s: %v", id, err)
			http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Orders (unchanged) ───────────────────────────────────────────

func (h *AdminHandler) ListAllOrders(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT o.id, u.name, o.total_amount, o.status,
		       COALESCE(o.payment_method, 'stripe'), o.created_at
		FROM orders o
		JOIN users u ON u.id = o.user_id
		ORDER BY o.created_at DESC LIMIT 100`)
	if err != nil {
		log.Printf("Error querying orders: %v", err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type orderRow struct {
		ID            string    `json:"id"`
		User          string    `json:"user"`
		Total         int       `json:"total"`
		Status        string    `json:"status"`
		PaymentMethod string    `json:"payment_method"`
		CreatedAt     time.Time `json:"created_at"`
	}
	var orders []orderRow
	for rows.Next() {
		var o orderRow
		if err := rows.Scan(&o.ID, &o.User, &o.Total, &o.Status, &o.PaymentMethod, &o.CreatedAt); err != nil {
			log.Printf("Error scanning order: %v", err)
			http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			return
		}
		orders = append(orders, o)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

func (h *AdminHandler) UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	_, err = h.DB.Exec(r.Context(),
		`UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`,
		req.Status, time.Now(), id)
	if err != nil {
		log.Printf("Error updating order status %s: %v", id, err)
		http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		return
	}

	if h.Hub != nil {
		h.Hub.PublishOrderStatus(id.String(), req.Status)
	}

	w.WriteHeader(http.StatusNoContent)
}