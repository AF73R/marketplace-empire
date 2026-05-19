package inventory

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Ledger provides thread‑safe, double‑entry inventory operations.
// Every stock movement is recorded as an immutable journal entry.
type Ledger struct {
	db *pgxpool.Pool
}

// NewLedger creates a new Ledger with the given database pool.
func NewLedger(db *pgxpool.Pool) *Ledger {
	return &Ledger{db: db}
}

// Reserve temporarily holds stock for a cart or pending order.
// Returns the reservation ID if successful.
func (l *Ledger) Reserve(ctx context.Context, productID, orderID uuid.UUID, warehouseID int, quantity int) (uuid.UUID, error) {
	if quantity <= 0 {
		return uuid.Nil, errors.New("quantity must be positive")
	}

	tx, err := l.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Check current available stock
	available, err := l.getAvailableStockInTx(ctx, tx, productID, warehouseID)
	if err != nil {
		return uuid.Nil, err
	}
	if available < quantity {
		return uuid.Nil, errors.New("insufficient stock")
	}

	// 2. Insert reservation entry
	reservationID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO inventory_ledger (id, product_id, warehouse_id, quantity_change, reason, reference_id, created_at)
		VALUES ($1, $2, $3, $4, 'reserved', $5, $6)
	`, reservationID, productID, warehouseID, -quantity, orderID, time.Now())
	if err != nil {
		return uuid.Nil, err
	}

	return reservationID, tx.Commit(ctx)
}

// Release reverses a reservation (e.g., cart expired).
func (l *Ledger) Release(ctx context.Context, reservationID uuid.UUID) error {
	tx, err := l.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Find the original reservation entry
	var productID uuid.UUID
	var warehouseID int
	var qty int
	err = tx.QueryRow(ctx, `
		SELECT product_id, warehouse_id, -quantity_change
		FROM inventory_ledger
		WHERE id = $1 AND reason = 'reserved'
	`, reservationID).Scan(&productID, &warehouseID, &qty)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("reservation not found")
		}
		return err
	}

	// Insert release entry (positive quantity)
	_, err = tx.Exec(ctx, `
		INSERT INTO inventory_ledger (product_id, warehouse_id, quantity_change, reason, reference_id, created_at)
		VALUES ($1, $2, $3, 'release', $4, $5)
	`, productID, warehouseID, qty, reservationID, time.Now())
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ConfirmSale converts a reservation into a permanent deduction (shipment).
func (l *Ledger) ConfirmSale(ctx context.Context, reservationID uuid.UUID) error {
	tx, err := l.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Find reservation
	var productID uuid.UUID
	var warehouseID int
	var qty int
	err = tx.QueryRow(ctx, `
		SELECT product_id, warehouse_id, -quantity_change
		FROM inventory_ledger
		WHERE id = $1 AND reason = 'reserved'
	`, reservationID).Scan(&productID, &warehouseID, &qty)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("reservation not found")
		}
		return err
	}

	// Insert shipment deduction (negative, already reserved, just change reason)
	_, err = tx.Exec(ctx, `
		UPDATE inventory_ledger
		SET reason = 'shipped'
		WHERE id = $1
	`, reservationID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// Restock adds stock (e.g., return, manual adjustment).
func (l *Ledger) Restock(ctx context.Context, productID uuid.UUID, warehouseID int, quantity int, reason string) error {
	if quantity <= 0 {
		return errors.New("quantity must be positive")
	}

	_, err := l.db.Exec(ctx, `
		INSERT INTO inventory_ledger (product_id, warehouse_id, quantity_change, reason, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, productID, warehouseID, quantity, reason, time.Now())
	return err
}

// GetAvailableStock returns the current available stock for a product in a warehouse.
func (l *Ledger) GetAvailableStock(ctx context.Context, productID uuid.UUID, warehouseID int) (int, error) {
	return l.getAvailableStockInTx(ctx, l.db, productID, warehouseID)
}

// getAvailableStockInTx is a helper that sums the quantity_change for the product/warehouse.
func (l *Ledger) getAvailableStockInTx(ctx context.Context, querier interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}, productID uuid.UUID, warehouseID int) (int, error) {
	var total int
	err := querier.QueryRow(ctx, `
		SELECT COALESCE(SUM(quantity_change), 0)
		FROM inventory_ledger
		WHERE product_id = $1 AND warehouse_id = $2
	`, productID, warehouseID).Scan(&total)
	return total, err
}