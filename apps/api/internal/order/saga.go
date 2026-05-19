package order

import (
	"context"
	"errors"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/marketplace-empire/api/internal/inventory"
	"github.com/marketplace-empire/api/internal/tax"
)

// ShippingCostCalculator defines the method to calculate shipping cost.
type ShippingCostCalculator interface {
	CalculateCost(country string, weightKg float64, subtotal int) int
}

// ShippingService abstracts carrier label creation.
type ShippingService interface {
	CreateLabel(ctx context.Context, orderID uuid.UUID, address ShippingAddress, weight, dimensions string) (string, error)
}

// PaymentService abstracts the payment gateway.
type PaymentService interface {
	Capture(ctx context.Context, orderID uuid.UUID, amount int, currency string) (string, error)
	Refund(ctx context.Context, paymentID string, amount int) error
}

// Saga orchestrates the distributed transaction for order processing.
type Saga struct {
	db           *pgxpool.Pool
	cmd          *CommandHandler
	ledger       *inventory.Ledger
	shipping     ShippingService
	payment      PaymentService
	taxSvc       *tax.Service
	shippingCalc ShippingCostCalculator
}

// NewSaga creates a new Saga with required dependencies.
func NewSaga(
	db *pgxpool.Pool,
	cmd *CommandHandler,
	ledger *inventory.Ledger,
	shipping ShippingService,
	payment PaymentService,
	taxSvc *tax.Service,
	shippingCalc ShippingCostCalculator,
) *Saga {
	return &Saga{
		db:           db,
		cmd:          cmd,
		ledger:       ledger,
		shipping:     shipping,
		payment:      payment,
		taxSvc:       taxSvc,
		shippingCalc: shippingCalc,
	}
}

// ProcessOrder is the entry point after a user submits an order (Stripe).
func (s *Saga) ProcessOrder(ctx context.Context, req CreateOrderRequest) (*CreateOrderResponse, error) {
	// 1. Create the order (reserves inventory) – subtotal only
	orderResp, err := s.cmd.CreateOrder(ctx, req)
	if err != nil {
		return nil, err
	}

	// 2. Calculate tax based on shipping country
	subtotal := orderResp.TotalAmount
	taxAmount := 0
	if s.taxSvc != nil {
		taxAmount = s.taxSvc.CalculateTax(subtotal, req.ShippingAddress.Country)
	}

	// 3. Calculate shipping cost
	totalQty := 0
	for _, item := range req.Items {
		totalQty += item.Quantity
	}
	weightKg := float64(totalQty)
	if weightKg < 1 {
		weightKg = 1
	}
	shippingCost := 0
	if s.shippingCalc != nil {
		shippingCost = s.shippingCalc.CalculateCost(req.ShippingAddress.Country, weightKg, subtotal)
	}

	// 4. Update order: set total_amount, shipping_cost, tax_amount
	newTotal := subtotal + taxAmount + shippingCost
	_, err = s.db.Exec(ctx, `
		UPDATE orders
		SET total_amount = $1,
		    shipping_cost = $2,
		    tax_amount = $3
		WHERE id = $4
	`, newTotal, shippingCost, taxAmount, orderResp.OrderID)
	if err != nil {
		log.Printf("Failed to update order totals: %v", err)
	}

	// 5. Capture payment with the new total
	paymentID, err := s.payment.Capture(ctx, orderResp.OrderID, newTotal, "USD")
	if err != nil {
		log.Printf("Payment failed for order %s: %v. Releasing inventory.", orderResp.OrderID, err)
		if cancelErr := s.cmd.CancelOrder(ctx, orderResp.OrderID); cancelErr != nil {
			log.Printf("Failed to cancel order %s after payment failure: %v", orderResp.OrderID, cancelErr)
		}
		return nil, errors.New("payment failed")
	}

	// 6. Confirm order
	if err := s.cmd.ConfirmOrder(ctx, orderResp.OrderID); err != nil {
		log.Printf("Failed to confirm order %s: %v. Refunding payment %s.", orderResp.OrderID, err, paymentID)
		if refundErr := s.payment.Refund(ctx, paymentID, newTotal); refundErr != nil {
			log.Printf("CRITICAL: Refund failed for payment %s: %v", paymentID, refundErr)
		}
		return nil, err
	}

	// 7. Create shipping label
	labelURL, err := s.shipping.CreateLabel(ctx, orderResp.OrderID, req.ShippingAddress, "0.5", "20x15x5")
	if err != nil {
		log.Printf("Shipping label creation failed for order %s: %v. Manual intervention needed.", orderResp.OrderID, err)
	} else {
		log.Printf("Shipping label created for order %s: %s", orderResp.OrderID, labelURL)
		if shipErr := s.cmd.ShipOrder(ctx, orderResp.OrderID); shipErr != nil {
			log.Printf("Failed to ship order %s after label creation: %v", orderResp.OrderID, shipErr)
		}
	}

	// Update the response total
	orderResp.TotalAmount = newTotal
	return orderResp, nil
}