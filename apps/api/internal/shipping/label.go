package shipping

import (
	"context"
	"log"
)

// LabelService defines the contract for creating shipping labels.
type LabelService interface {
	CreateLabel(ctx context.Context, req LabelRequest) (*LabelResponse, error)
}

// labelService is the default implementation using the configured carrier.
type labelService struct {
	carrier Carrier
}

// NewLabelService creates a LabelService that delegates to the given carrier.
func NewLabelService(carrier Carrier) LabelService {
	return &labelService{carrier: carrier}
}

// CreateLabel generates a shipping label and stores relevant data.
func (s *labelService) CreateLabel(ctx context.Context, req LabelRequest) (*LabelResponse, error) {
	resp, err := s.carrier.CreateLabel(ctx, req)
	if err != nil {
		log.Printf("Label creation failed for order %s: %v", req.OrderID, err)
		return nil, err
	}
	// In production, persist the label details to the database here.
	return resp, nil
}