package tax

import (
	"context"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Service calculates tax amounts based on country‑specific rates loaded from the database.
type Service struct {
	mu          sync.RWMutex
	defaultRate float64
	rates       map[string]float64
	pool        *pgxpool.Pool
	lastRefresh time.Time
}

// NewService creates a Tax service that loads its configuration from the settings table.
func NewService(pool *pgxpool.Pool) *Service {
	s := &Service{
		pool:  pool,
		rates: make(map[string]float64),
	}
	s.loadFromDB()
	// Fallback to env vars if still empty
	if s.defaultRate == 0 {
		if val := os.Getenv("TAX_DEFAULT_RATE"); val != "" {
			if rate, err := strconv.ParseFloat(val, 64); err == nil {
				s.defaultRate = rate
			}
		}
		if s.defaultRate == 0 {
			s.defaultRate = 0.20 // ultimate fallback
		}
	}
	if len(s.rates) == 0 {
		if val := os.Getenv("TAX_RATES"); val != "" {
			for _, pair := range strings.Split(val, ",") {
				parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
				if len(parts) == 2 {
					country := strings.ToUpper(strings.TrimSpace(parts[0]))
					rate, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
					if err == nil {
						s.rates[country] = rate
					}
				}
			}
		}
	}
	log.Printf("Tax service loaded: default=%.2f%%, country rates=%v", s.defaultRate*100, s.rates)
	return s
}

// Refresh reloads the configuration from the database.
func (s *Service) Refresh() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Since(s.lastRefresh) < 5*time.Second {
		return
	}
	s.loadFromDB()
}

// loadFromDB reads the settings row and populates the service.
func (s *Service) loadFromDB() {
	if s.pool == nil {
		return
	}
	var defaultRate float64
	var countryRates string
	err := s.pool.QueryRow(context.Background(), `
		SELECT tax_default_rate, tax_country_rates FROM settings WHERE id = 1
	`).Scan(&defaultRate, &countryRates)
	if err != nil {
		log.Printf("Tax service: could not read settings from DB: %v", err)
		return
	}
	s.defaultRate = defaultRate
	s.rates = make(map[string]float64)
	if countryRates != "" {
		for _, pair := range strings.Split(countryRates, ",") {
			parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
			if len(parts) == 2 {
				country := strings.ToUpper(strings.TrimSpace(parts[0]))
				rate, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
				if err == nil {
					s.rates[country] = rate
				}
			}
		}
	}
	s.lastRefresh = time.Now()
}

// CalculateTax returns the tax amount in cents for a given subtotal (in cents) and shipping country code.
func (s *Service) CalculateTax(subtotal int, country string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rate := s.defaultRate
	if customRate, ok := s.rates[strings.ToUpper(country)]; ok {
		rate = customRate
	}
	tax := float64(subtotal) * rate
	return int(tax + 0.5) // round to nearest cent
}

// GetEffectiveRate returns the tax rate that will be applied for a given country.
func (s *Service) GetEffectiveRate(country string) float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if customRate, ok := s.rates[strings.ToUpper(country)]; ok {
		return customRate
	}
	return s.defaultRate
}