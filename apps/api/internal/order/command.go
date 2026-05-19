package order

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/marketplace-empire/api/internal/inventory"
)

type CommandHandler struct {
	db     *pgxpool.Pool
	ledger *inventory.Ledger
}

func NewCommandHandler(db *pgxpool.Pool, ledger *inventory.Ledger) *CommandHandler {
	return &CommandHandler{db: db, ledger: ledger}
}

type CreateOrderRequest struct {
	UserID          uuid.UUID
	Items           []CreateOrderItem
	ShippingAddress ShippingAddress
}

// ★ Struct now has json tags to match the frontend payload
type CreateOrderItem struct {
	ProductID  uuid.UUID `json:"product_id"`
	Quantity   int       `json:"quantity"`
	UnitPrice  int       `json:"unit_price"`
	TotalPrice int       `json:"total_price"`
}

type CreateOrderResponse struct {
	OrderID     uuid.UUID
	TotalAmount int
	Status      OrderStatus
}

func (h *CommandHandler) CreateOrder(ctx context.Context, req CreateOrderRequest) (*CreateOrderResponse, error) {
	if len(req.Items) == 0 {
		return nil, errors.New("order must contain at least one item")
	}
	if req.ShippingAddress.Line1 == "" || req.ShippingAddress.City == "" || req.ShippingAddress.PostalCode == "" || req.ShippingAddress.Country == "" {
		return nil, errors.New("incomplete shipping address")
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	orderID := uuid.New()
	for _, item := range req.Items {
		if item.Quantity <= 0 {
			return nil, errors.New("item quantity must be positive")
		}

		// debug
		available, err := h.ledger.GetAvailableStock(ctx, item.ProductID, 1)
		if err != nil {
			log.Printf("DEBUG: failed to get stock for product %s: %v", item.ProductID, err)
		} else {
			log.Printf("DEBUG: product %s available stock = %d, requested = %d", item.ProductID, available, item.Quantity)
		}

		_, err = h.ledger.Reserve(ctx, item.ProductID, orderID, 1, item.Quantity)
		if err != nil {
			return nil, err
		}
	}

	order := &Order{
		ID:              orderID,
		UserID:          req.UserID,
		Status:          StatusPending,
		ShippingAddress: req.ShippingAddress,
		Currency:        "USD",
		Metadata:        map[string]any{},
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	total := 0
	for _, item := range req.Items {
		oi := OrderItem{
			ID:         uuid.New(),
			ProductID:  item.ProductID,
			Quantity:   item.Quantity,
			UnitPrice:  item.UnitPrice,
			TotalPrice: item.TotalPrice,
		}
		total += oi.TotalPrice
		order.Items = append(order.Items, oi)
	}
	order.TotalAmount = total

	_, err = tx.Exec(ctx, `
		INSERT INTO orders (id, user_id, status, total_amount, currency, shipping_address, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, order.ID, order.UserID, order.Status, order.TotalAmount, order.Currency, order.ShippingAddress, order.Metadata, order.CreatedAt, order.UpdatedAt)
	if err != nil {
		return nil, err
	}

	for _, item := range order.Items {
		_, err = tx.Exec(ctx, `
			INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, item.ID, order.ID, item.ProductID, item.Quantity, item.UnitPrice, item.TotalPrice)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &CreateOrderResponse{
		OrderID:     order.ID,
		TotalAmount: order.TotalAmount,
		Status:      order.Status,
	}, nil
}

func (h *CommandHandler) ConfirmOrder(ctx context.Context, orderID uuid.UUID) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var status OrderStatus
	err = tx.QueryRow(ctx, `SELECT status FROM orders WHERE id = $1 FOR UPDATE`, orderID).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("order not found")
		}
		return err
	}
	if status != StatusPending {
		return errors.New("only pending orders can be confirmed")
	}

	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, StatusConfirmed, time.Now(), orderID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (h *CommandHandler) ShipOrder(ctx context.Context, orderID uuid.UUID) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var status OrderStatus
	err = tx.QueryRow(ctx, `SELECT status FROM orders WHERE id = $1 FOR UPDATE`, orderID).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("order not found")
		}
		return err
	}
	if status != StatusConfirmed {
		return errors.New("only confirmed orders can be shipped")
	}

	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, StatusShipped, time.Now(), orderID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (h *CommandHandler) CancelOrder(ctx context.Context, orderID uuid.UUID) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var status OrderStatus
	err = tx.QueryRow(ctx, `SELECT status FROM orders WHERE id = $1 FOR UPDATE`, orderID).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("order not found")
		}
		return err
	}
	if status != StatusPending && status != StatusConfirmed {
		return errors.New("only pending or confirmed orders can be cancelled")
	}

	_, err = tx.Exec(ctx, `UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, StatusCancelled, time.Now(), orderID)
	if err != nil {
		return err
	}

	rows, err := tx.Query(ctx, `SELECT product_id, quantity FROM order_items WHERE order_id = $1`, orderID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var productID uuid.UUID
		var qty int
		if err := rows.Scan(&productID, &qty); err != nil {
			return err
		}
		if err := h.ledger.Restock(ctx, productID, 1, qty, "cancelled_order"); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}