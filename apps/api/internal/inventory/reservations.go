
package inventory

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// ReservationManager handles temporary stock holds using Redis.
// It works alongside the Ledger to prevent overselling during the
// add-to-cart → checkout window.
type ReservationManager struct {
	rdb    *redis.Client
	ledger *Ledger
	ttl    time.Duration
}

// NewReservationManager creates a new ReservationManager.
func NewReservationManager(rdb *redis.Client, ledger *Ledger, ttl time.Duration) *ReservationManager {
	return &ReservationManager{
		rdb:    rdb,
		ledger: ledger,
		ttl:    ttl,
	}
}

// HoldForCart reserves inventory for a user's cart.
// It creates a short‑lived reservation in the ledger and caches the hold key in Redis.
func (rm *ReservationManager) HoldForCart(ctx context.Context, productID, userID uuid.UUID, warehouseID, quantity int) error {
	// Use the ledger to reserve stock permanently (but with a release mechanism)
	reservationID, err := rm.ledger.Reserve(ctx, productID, uuid.Nil, warehouseID, quantity)
	if err != nil {
		return err
	}

	// Cache the reservation in Redis with a TTL for automatic release
	key := fmt.Sprintf("cart_hold:%s:%d", userID.String(), warehouseID)
	err = rm.rdb.Set(ctx, key, reservationID.String(), rm.ttl).Err()
	if err != nil {
		// Rollback the ledger reservation (best effort)
		_ = rm.ledger.Release(ctx, reservationID)
		return err
	}
	return nil
}

// ConfirmHold marks a cart hold as permanent (converted to an order).
func (rm *ReservationManager) ConfirmHold(ctx context.Context, userID uuid.UUID, warehouseID int) error {
	key := fmt.Sprintf("cart_hold:%s:%d", userID.String(), warehouseID)
	reservationIDStr, err := rm.rdb.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return errors.New("no active hold")
		}
		return err
	}

	reservationID, err := uuid.Parse(reservationIDStr)
	if err != nil {
		return err
	}

	// Confirm the sale in the ledger (changes reason from 'reserved' to 'shipped')
	if err := rm.ledger.ConfirmSale(ctx, reservationID); err != nil {
		return err
	}

	// Remove the Redis key
	rm.rdb.Del(ctx, key)
	return nil
}

// ReleaseHold cancels a hold and returns stock.
func (rm *ReservationManager) ReleaseHold(ctx context.Context, userID uuid.UUID, warehouseID int) error {
	key := fmt.Sprintf("cart_hold:%s:%d", userID.String(), warehouseID)
	reservationIDStr, err := rm.rdb.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil // nothing to release
		}
		return err
	}

	reservationID, err := uuid.Parse(reservationIDStr)
	if err != nil {
		return err
	}

	if err := rm.ledger.Release(ctx, reservationID); err != nil {
		return err
	}

	rm.rdb.Del(ctx, key)
	return nil
}