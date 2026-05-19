package shipping

import (
	"context"
	"log"
)

// RateService defines the contract for fetching shipping rates.
type RateService interface {
	GetRates(ctx context.Context, req RateRequest) ([]Rate, error)
}

// rateService is the default implementation using the configured carrier.
type rateService struct {
	carrier Carrier
}

// NewRateService creates a RateService that delegates to the given carrier.
func NewRateService(carrier Carrier) RateService {
	return &rateService{carrier: carrier}
}

// GetRates fetches live rates. The service may add caching or business logic later.
func (s *rateService) GetRates(ctx context.Context, req RateRequest) ([]Rate, error) {
	rates, err := s.carrier.GetRates(ctx, req)
	if err != nil {
		log.Printf("Rate fetch failed: %v", err)
		return nil, err
	}
	// Optional: filter or enrich rates here (e.g., add handling fee)
	return rates, nil
}