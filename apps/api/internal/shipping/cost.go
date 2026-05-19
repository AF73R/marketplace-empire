package shipping

import (
	"context"
	"log"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ShippingCostService calculates shipping cost based on destination, weight, and admin settings.
type ShippingCostService struct {
	mu             sync.RWMutex
	pool           *pgxpool.Pool
	baseRates      map[string]int // country -> base cost in cents (env‑based for now)
	defaultRate    int
	perKgRate      int
	freeThreshold  int
	additionalCost int
	lastRefresh    time.Time
}

// NewShippingCostService creates a service that loads its configuration from the settings table.
func NewShippingCostService(pool *pgxpool.Pool) *ShippingCostService {
	s := &ShippingCostService{
		pool:      pool,
		baseRates: make(map[string]int),
	}
	s.loadFromDB()
	// fallback env vars
	if s.defaultRate == 0 {
		s.defaultRate = envInt("SHIPPING_DEFAULT_RATE", 500)
	}
	if s.perKgRate == 0 {
		s.perKgRate = envInt("SHIPPING_PER_KG", 200)
	}
	if s.freeThreshold == 0 {
		s.freeThreshold = envInt("SHIPPING_FREE_THRESHOLD", 5000)
	}
	// load country‑specific base rates from env (could be moved to DB later)
	if val := os.Getenv("SHIPPING_COUNTRY_RATES"); val != "" {
		for _, pair := range strings.Split(val, ",") {
			parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
			if len(parts) == 2 {
				country := strings.ToUpper(strings.TrimSpace(parts[0]))
				rate, err := strconv.Atoi(strings.TrimSpace(parts[1]))
				if err == nil {
					s.baseRates[country] = rate
				}
			}
		}
	}
	log.Printf("Shipping service loaded: default=%d, perKg=%d, freeThreshold=%d, additional=%d", s.defaultRate, s.perKgRate, s.freeThreshold, s.additionalCost)
	return s
}

// Refresh reloads the configuration from the database.
func (s *ShippingCostService) Refresh() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Since(s.lastRefresh) < 5*time.Second {
		return
	}
	s.loadFromDB()
}

// loadFromDB reads the settings row and populates the service.
func (s *ShippingCostService) loadFromDB() {
	if s.pool == nil {
		return
	}
	var shippingDefaultRate, shippingPerKgRate, shippingFreeThreshold, additionalCost int
	err := s.pool.QueryRow(context.Background(), `
		SELECT shipping_default_rate, shipping_per_kg_rate, shipping_free_threshold, additional_cost
		FROM settings WHERE id = 1
	`).Scan(&shippingDefaultRate, &shippingPerKgRate, &shippingFreeThreshold, &additionalCost)
	if err != nil {
		log.Printf("Shipping service: could not read settings from DB: %v", err)
		return
	}
	s.defaultRate = shippingDefaultRate
	s.perKgRate = shippingPerKgRate
	s.freeThreshold = shippingFreeThreshold
	s.additionalCost = additionalCost
	s.lastRefresh = time.Now()
}

// CalculateCost returns the total shipping cost in cents.
func (s *ShippingCostService) CalculateCost(country string, weightKg float64, orderSubtotal int) int {
	_, _, _, total := s.CalculateDetailedCost(country, weightKg, orderSubtotal)
	return total
}

// CalculateDetailedCost returns the individual components: base cost, weight charge, additional cost, and total.
func (s *ShippingCostService) CalculateDetailedCost(country string, weightKg float64, orderSubtotal int) (base, weightCharge, additional, total int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Free shipping if subtotal meets threshold
	if s.freeThreshold > 0 && orderSubtotal >= s.freeThreshold {
		return 0, 0, 0, 0
	}

	base = s.defaultRate
	if rate, ok := s.baseRates[strings.ToUpper(country)]; ok {
		base = rate
	}

	weightCharge = int(math.Ceil(weightKg)) * s.perKgRate
	additional = s.additionalCost
	total = base + weightCharge + additional
	return
}

func envInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return fallback
}