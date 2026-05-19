package static

import (
	"net/http"
	"os"
	"path/filepath"
)

// ServeUploads returns an http.Handler that serves files from the given directory
// under a prefix that should be stripped (e.g., "/uploads/").
func ServeUploads(uploadDir string) http.Handler {
	// Ensure absolute path for safety
	absDir, _ := filepath.Abs(uploadDir)
	if _, err := os.Stat(absDir); os.IsNotExist(err) {
		os.MkdirAll(absDir, 0755)
	}
	return http.StripPrefix("/uploads/", http.FileServer(http.Dir(absDir)))
}