package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// UploadHandler handles image uploads.
// Files are stored in the "public/uploads" directory and served via /uploads/ prefix.
type UploadHandler struct {
	UploadDir string // e.g., "./public/uploads"
	BaseURL   string // e.g., "http://localhost:8080/uploads"
}

// NewUploadHandler creates an UploadHandler using environment variables.
// Required: UPLOAD_DIR (default: ./public/uploads) , APP_BASE_URL (for constructing full URLs)
func NewUploadHandler() (*UploadHandler, error) {
	dir := os.Getenv("UPLOAD_DIR")
	if dir == "" {
		dir = "./public/uploads"
	}
	// Ensure the directory exists
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create upload dir: %w", err)
	}
	base := os.Getenv("APP_BASE_URL")
	if base == "" {
		base = "http://localhost:8080"
	}
	return &UploadHandler{UploadDir: dir, BaseURL: strings.TrimRight(base, "/") + "/uploads"}, nil
}

// RegisterRoutes mounts the upload endpoint.
func (h *UploadHandler) RegisterRoutes(r chi.Router) {
	r.Post("/", h.UploadFile)
}

// UploadFile accepts a multipart file upload and returns the public URL.
func (h *UploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	// Limit size to 5 MB
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)

	if err := r.ParseMultipartForm(5 << 20); err != nil {
		http.Error(w, `{"error":"file too large or invalid form"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"missing 'file' field"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowed[ext] {
		http.Error(w, `{"error":"unsupported file type (jpg, jpeg, png, webp)"}`, http.StatusBadRequest)
		return
	}

	// Generate unique filename
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dstPath := filepath.Join(h.UploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, `{"error":"failed to save file"}`, http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, `{"error":"failed to write file"}`, http.StatusInternalServerError)
		return
	}

	// Return the public URL
	imageURL := fmt.Sprintf("%s/%s", h.BaseURL, filename)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"url": imageURL})
}