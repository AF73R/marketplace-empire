package payment

import (
	"context"
	"errors"
	"os"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/paymentintent"
	"github.com/stripe/stripe-go/v78/refund"
)

// StripeGateway implements PaymentService using Stripe's PaymentIntents.
type StripeGateway struct{}

// NewStripeGateway creates a new gateway and configures the Stripe secret key.
func NewStripeGateway() *StripeGateway {
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	return &StripeGateway{}
}

// Capture creates or confirms a PaymentIntent for the given order.
// The idempotency key is the orderID to ensure exactly-once capture.
func (g *StripeGateway) Capture(ctx context.Context, orderID uuid.UUID, amount int, currency string) (string, error) {
	params := &stripe.PaymentIntentParams{
		Amount:      stripe.Int64(int64(amount)),
		Currency:    stripe.String(currency),
		Description: stripe.String("Order " + orderID.String()),
		Metadata: map[string]string{
			"order_id": orderID.String(),
		},
	}
	params.SetIdempotencyKey(orderID.String())

	pi, err := paymentintent.New(params)
	if err != nil {
		return "", err
	}

	// Confirm immediately for automatic capture
	pi, err = paymentintent.Confirm(pi.ID, nil)
	if err != nil {
		return "", err
	}

	if pi.Status != stripe.PaymentIntentStatusSucceeded {
		return "", errors.New("payment not succeeded")
	}

	return pi.ID, nil
}

// Refund issues a full or partial refund for a given PaymentIntent.
func (g *StripeGateway) Refund(ctx context.Context, paymentID string, amount int) error {
	params := &stripe.RefundParams{
		PaymentIntent: stripe.String(paymentID),
		Amount:        stripe.Int64(int64(amount)),
	}
	_, err := refund.New(params)
	return err
}