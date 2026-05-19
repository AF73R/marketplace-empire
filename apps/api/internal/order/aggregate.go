
package order

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// OrderStatus enumerates the possible lifecycle states of an order.
type OrderStatus string

const (
	StatusPending   OrderStatus = "pending"
	StatusConfirmed OrderStatus = "confirmed"
	StatusShipped   OrderStatus = "shipped"
	StatusDelivered OrderStatus = "delivered"
	StatusCancelled OrderStatus = "cancelled"
	StatusReturned  OrderStatus = "returned"
)

// ShippingAddress captures the destination for physical goods.
type ShippingAddress struct {
	Line1      string `json:"line1"`
	Line2      string `json:"line2,omitempty"`
	City       string `json:"city"`
	State      string `json:"state,omitempty"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
	Phone      string `json:"phone,omitempty"`
}

// OrderItem is a snapshot of a product when it was added to the cart.
type OrderItem struct {
	ID         uuid.UUID `json:"id"`
	ProductID  uuid.UUID `json:"product_id"`
	Title      string    `json:"product_title"`
	ImageURL   string    `json:"product_image,omitempty"`
	Quantity   int       `json:"quantity"`
	UnitPrice  int       `json:"unit_price"`  // in cents
	TotalPrice int       `json:"total_price"` // in cents
}

// Order is the central aggregate that enforces business invariants.
type Order struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"user_id"`
	Status          OrderStatus     `json:"status"`
	Items           []OrderItem     `json:"items"`
	TotalAmount     int             `json:"total_amount"` // cents
	Currency        string          `json:"currency"`
	ShippingAddress ShippingAddress `json:"shipping_address"`
	Metadata        map[string]any  `json:"metadata,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// NewOrder creates a new Order with the initial "pending" state.
func NewOrder(userID uuid.UUID, items []OrderItem, addr ShippingAddress) (*Order, error) {
	if len(items) == 0 {
		return nil, errors.New("order must contain at least one item")
	}
	if addr.Line1 == "" || addr.City == "" || addr.PostalCode == "" || addr.Country == "" {
		return nil, errors.New("incomplete shipping address")
	}

	total := 0
	for _, item := range items {
		if item.Quantity <= 0 {
			return nil, errors.New("item quantity must be positive")
		}
		if item.TotalPrice != item.UnitPrice*item.Quantity {
			return nil, errors.New("item total_price does not match unit_price * quantity")
		}
		total += item.TotalPrice
	}

	now := time.Now()
	return &Order{
		ID:              uuid.New(),
		UserID:          userID,
		Status:          StatusPending,
		Items:           items,
		TotalAmount:     total,
		Currency:        "USD",
		ShippingAddress: addr,
		CreatedAt:       now,
		UpdatedAt:       now,
	}, nil
}

// Confirm transitions the order from pending to confirmed.
func (o *Order) Confirm() error {
	if o.Status != StatusPending {
		return errors.New("only pending orders can be confirmed")
	}
	o.Status = StatusConfirmed
	o.UpdatedAt = time.Now()
	return nil
}

// Ship transitions the order from confirmed to shipped.
func (o *Order) Ship() error {
	if o.Status != StatusConfirmed {
		return errors.New("only confirmed orders can be shipped")
	}
	o.Status = StatusShipped
	o.UpdatedAt = time.Now()
	return nil
}

// Deliver transitions the order from shipped to delivered.
func (o *Order) Deliver() error {
	if o.Status != StatusShipped {
		return errors.New("only shipped orders can be delivered")
	}
	o.Status = StatusDelivered
	o.UpdatedAt = time.Now()
	return nil
}

// Cancel transitions the order to cancelled (only from pending or confirmed).
func (o *Order) Cancel() error {
	if o.Status != StatusPending && o.Status != StatusConfirmed {
		return errors.New("only pending or confirmed orders can be cancelled")
	}
	o.Status = StatusCancelled
	o.UpdatedAt = time.Now()
	return nil
}