package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// EnsureVerificationColumns adds necessary columns to the users table if they don't exist.
func EnsureVerificationColumns(pool *pgxpool.Pool) error {
	_, err := pool.Exec(context.Background(), `
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'users' AND column_name = 'is_verified'
			) THEN
				ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false;
			END IF;
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'users' AND column_name = 'verification_token'
			) THEN
				ALTER TABLE users ADD COLUMN verification_token TEXT;
			END IF;
		END $$;
	`)
	return err
}

// GenerateVerificationToken creates a cryptographically random hex token.
func GenerateVerificationToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// SendVerificationEmail sends an email with a verification link.
// Uses SMTP credentials from environment:
//
//	SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM, APP_BASE_URL
func SendVerificationEmail(to, token string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")
	baseURL := strings.TrimRight(os.Getenv("APP_BASE_URL")+"/api/auth/verify", "/")

	// Fallback for development: just log the link
	if smtpHost == "" || smtpPort == "" {
		log.Printf("[DEV] Verification link for %s: %s?token=%s", to, baseURL, token)
		return nil
	}

	subject := "Verify your Marketplace Empire account"
	body := fmt.Sprintf("Welcome to Marketplace Empire!\n\nVerify your email by clicking:\n%s?token=%s\n\nThis link expires in 24 hours.", baseURL, token)
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s", from, to, subject, body))

	auth := smtp.PlainAuth("", username, password, smtpHost)
	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{to}, msg)
	if err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}
	return nil
}

// VerifyEmailHandler is a GET handler that verifies a token.
// Mount it at: GET /api/auth/verify?token=...
func VerifyEmailHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, `{"error":"missing token"}`, http.StatusBadRequest)
			return
		}

		_, err := pool.Exec(r.Context(),
			`UPDATE users SET is_verified = true, verification_token = NULL, updated_at = now()
			 WHERE verification_token = $1 AND is_verified = false`, token)
		if err != nil {
			http.Error(w, `{"error":"verification failed"}`, http.StatusInternalServerError)
			return
		}

		// Redirect or return success
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `<html><body><h1>Email Verified!</h1><p>You may now log in and use all features.</p></body></html>`)
	}
}

// StoreVerificationTokenForUser stores a token for the given user ID.
func StoreVerificationTokenForUser(pool *pgxpool.Pool, userID, token string) error {
	_, err := pool.Exec(context.Background(),
		`UPDATE users SET verification_token = $1, updated_at = $2 WHERE id = $3`,
		token, time.Now(), userID)
	return err
}