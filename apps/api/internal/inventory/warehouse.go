package inventory

// Warehouse represents a physical location where products are stored.
type Warehouse struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Location string `json:"location"`
	IsActive bool   `json:"is_active"`
}