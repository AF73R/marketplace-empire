package auth

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// EnsureAdminColumn adds the is_admin column to users if it doesn't exist.
// Safe to call on every startup.
func EnsureAdminColumn(pool *pgxpool.Pool) error {
	_, err := pool.Exec(context.Background(), `
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'users' AND column_name = 'is_admin'
			) THEN
				ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
			END IF;
		END $$;
	`)
	return err
}

// AdminOnly is a middleware that rejects requests unless the authenticated user is_admin.
// It must be used after JWTAuth middleware, which sets the user ID in context.
func AdminOnly(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := GetUserID(r)
			if !ok {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			var isAdmin bool
			err := pool.QueryRow(r.Context(),
				`SELECT is_admin FROM users WHERE id = $1`, userID,
			).Scan(&isAdmin)
			if err != nil || !isAdmin {
				http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}