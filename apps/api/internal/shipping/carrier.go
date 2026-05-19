
package shipping

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// Carrier defines the contract that any shipping provider must fulfill.
type Carrier interface {
	// GetRates returns live shipping rates for a given cart and destination.
	GetRates(ctx context.Context, req RateRequest) ([]Rate, error)

	// CreateLabel generates a shipping label and returns its URL and tracking number.
	CreateLabel(ctx context.Context, req LabelRequest) (*LabelResponse, error)

	// Track returns the current status of a shipment.
	Track(ctx context.Context, trackingNumber string) (*TrackingInfo, error)
}

// RateRequest contains the parameters needed to calculate shipping rates.
type RateRequest struct {
	Origin      Address `json:"origin"`
	Destination Address `json:"destination"`
	Weight      float64 `json:"weight_kg"`      // kilograms
	Dimensions  string  `json:"dimensions"`     // "LxWxH" in cm
	Value       int     `json:"value"`          // in cents, for insurance
}

// Address is a standardized shipping address.
type Address struct {
	Name    string `json:"name"`
	Line1   string `json:"line1"`
	Line2   string `json:"line2,omitempty"`
	City    string `json:"city"`
	State   string `json:"state"`
	Zip     string `json:"zip"`
	Country string `json:"country"`
}

// Rate represents a single shipping option.
type Rate struct {
	Service  string  `json:"service"`
	Carrier  string  `json:"carrier"`
	Amount   int     `json:"amount"` // cents
	EstDays  int     `json:"estimated_days"`
}

// LabelRequest contains the data needed to create a shipping label.
type LabelRequest struct {
	OrderID     uuid.UUID `json:"order_id"`
	Destination Address   `json:"destination"`
	Weight      float64   `json:"weight_kg"`
	Dimensions  string    `json:"dimensions"`
}

// LabelResponse is returned after label creation.
type LabelResponse struct {
	TrackingNumber string `json:"tracking_number"`
	LabelURL       string `json:"label_url"`
	Carrier        string `json:"carrier"`
}

// TrackingInfo represents the current state of a shipment.
type TrackingInfo struct {
	Status           string   `json:"status"`
	EstimatedDelivery string  `json:"estimated_delivery"`
	Events           []TrackEvent `json:"events"`
}

// TrackEvent is a single tracking checkpoint.
type TrackEvent struct {
	Date        string `json:"date"`
	Description string `json:"description"`
	Location    string `json:"location,omitempty"`
}

// MockCarrier implements Carrier for development and testing.
type MockCarrier struct{}

func NewMockCarrier() *MockCarrier {
	return &MockCarrier{}
}

func (m *MockCarrier) GetRates(ctx context.Context, req RateRequest) ([]Rate, error) {
	return []Rate{
		{Service: "Standard", Carrier: "MockPost", Amount: 0, EstDays: 5},
		{Service: "Express", Carrier: "MockPost", Amount: 1299, EstDays: 2},
	}, nil
}

func (m *MockCarrier) CreateLabel(ctx context.Context, req LabelRequest) (*LabelResponse, error) {
	if req.OrderID == uuid.Nil {
		return nil, errors.New("invalid order ID")
	}
	return &LabelResponse{
		TrackingNumber: "MOCK" + uuid.New().String()[:8],
		LabelURL:       "https://mock.ship/label/" + req.OrderID.String(),
		Carrier:        "MockPost",
	}, nil
}

func (m *MockCarrier) Track(ctx context.Context, trackingNumber string) (*TrackingInfo, error) {
	return &TrackingInfo{
		Status:           "in_transit",
		EstimatedDelivery: "2026-05-12",
		Events: []TrackEvent{
			{Date: "2026-05-05T08:00:00Z", Description: "Label created", Location: "Mockville"},
			{Date: "2026-05-05T14:00:00Z", Description: "Package picked up", Location: "Mockville"},
		},
	}, nil
}