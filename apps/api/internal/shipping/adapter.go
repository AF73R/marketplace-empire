
package shipping

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/marketplace-empire/api/internal/order"
)

// SagaShippingAdapter adapts the generic Carrier interface to the
// order.ShippingService interface required by the Order Saga.
type SagaShippingAdapter struct {
	carrier Carrier
}

// NewSagaShippingAdapter creates an adapter that fulfills
// order.ShippingService using the provided carrier.
func NewSagaShippingAdapter(carrier Carrier) order.ShippingService {
	return &SagaShippingAdapter{carrier: carrier}
}

// CreateLabel satisfies order.ShippingService.
func (a *SagaShippingAdapter) CreateLabel(
	ctx context.Context,
	orderID uuid.UUID,
	address order.ShippingAddress,
	weight, dimensions string,
) (string, error) {
	req := LabelRequest{
		OrderID: orderID,
		Destination: Address{
			Name:    address.Line1, // reuse first line as name for now
			Line1:   address.Line1,
			Line2:   address.Line2,
			City:    address.City,
			State:   address.State,
			Zip:     address.PostalCode,
			Country: address.Country,
		},
		Weight:     parseWeight(weight),
		Dimensions: dimensions,
	}

	resp, err := a.carrier.CreateLabel(ctx, req)
	if err != nil {
		return "", err
	}
	return resp.LabelURL, nil
}

// parseWeight converts a string weight like "0.5" into a float64 kg.
func parseWeight(w string) float64 {
	var val float64
	fmt.Sscanf(w, "%f", &val)
	return val
}