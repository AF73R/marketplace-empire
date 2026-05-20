package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/marketplace-empire/api/internal/auth"
	"github.com/marketplace-empire/api/internal/handler"
	"github.com/marketplace-empire/api/internal/inventory"
	"github.com/marketplace-empire/api/internal/order"
	"github.com/marketplace-empire/api/internal/payment"
	"github.com/marketplace-empire/api/internal/search"
	"github.com/marketplace-empire/api/internal/shipping"
	"github.com/marketplace-empire/api/internal/static"
	"github.com/marketplace-empire/api/internal/tax"
	"github.com/marketplace-empire/api/internal/ws"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("Connected to PostgreSQL")

	// ─── Redis (Upstash) – use ParseURL to handle rediss:// ─────────
	var rdb *redis.Client
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		log.Println("REDIS_URL not set – running without Redis")
	} else {
		// Upstash gives a URL like rediss://default:password@host:port
		// redis.ParseURL understands that format.
		opts, err := redis.ParseURL(redisURL)
		if err != nil {
			log.Printf("Warning: could not parse REDIS_URL (%v) – Redis disabled", err)
		} else {
			rdb = redis.NewClient(opts)
			if err := rdb.Ping(ctx).Err(); err != nil {
				log.Printf("Warning: Redis not available (%v)", err)
				rdb = nil
			} else {
				log.Println("Connected to Redis")
				defer rdb.Close()
			}
		}
	}

	// ─── Auto‑migrations ──────────────────────────────────────────
	auth.EnsureAdminColumn(pool)
	auth.EnsureVerificationColumns(pool)
	pool.Exec(ctx, `DO $$ BEGIN
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_method') THEN
			ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'stripe';
		END IF;
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='cover_url') THEN
			ALTER TABLE users ADD COLUMN cover_url TEXT;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_cost') THEN
			ALTER TABLE orders ADD COLUMN shipping_cost INTEGER NOT NULL DEFAULT 0;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tax_amount') THEN
			ALTER TABLE orders ADD COLUMN tax_amount INTEGER NOT NULL DEFAULT 0;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
			ALTER TABLE users ADD COLUMN phone TEXT;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='address') THEN
			ALTER TABLE users ADD COLUMN address TEXT;
		END IF;
	END $$;`)

	// Settings table
	pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS settings (
			id INTEGER PRIMARY KEY DEFAULT 1,
			tax_default_rate REAL NOT NULL DEFAULT 0.20,
			tax_country_rates TEXT NOT NULL DEFAULT 'DE:0.19,FR:0.20,UK:0.20',
			shipping_default_rate INTEGER NOT NULL DEFAULT 500,
			shipping_per_kg_rate INTEGER NOT NULL DEFAULT 200,
			shipping_free_threshold INTEGER NOT NULL DEFAULT 99999999,
			additional_cost INTEGER NOT NULL DEFAULT 0
		);
		INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
		UPDATE settings SET shipping_free_threshold = 99999999 WHERE id = 1;
	`)

	// ─── Core services ────────────────────────────────────────────
	ledger := inventory.NewLedger(pool)
	if rdb != nil {
		_ = inventory.NewReservationManager(rdb, ledger, 15*time.Minute)
	}
	orderCommand := order.NewCommandHandler(pool, ledger)
	shippingSvc := shipping.NewSagaShippingAdapter(shipping.NewMockCarrier())
	paymentSvc := payment.NewStripeGateway()
	taxSvc := tax.NewService(pool)
	shippingCostSvc := shipping.NewShippingCostService(pool)
	shippingCostSvc.Refresh()

	orderSaga := order.NewSaga(pool, orderCommand, ledger, shippingSvc, paymentSvc, taxSvc, shippingCostSvc)

	hub := ws.NewHub()

	// ─── Handlers ─────────────────────────────────────────────────
	authHandler := &handler.AuthHandler{DB: pool}
	productHandler := &handler.ProductHandler{DB: pool}
	orderHandler := &handler.OrderHandler{
		DB:           pool,
		CMDs:         orderCommand,
		Saga:         orderSaga,
		TaxSvc:       taxSvc,
		ShippingCalc: shippingCostSvc,
	}
	profileHandler := &handler.ProfileHandler{DB: pool}
	cartHandler := &handler.CartHandler{DB: pool}
	sellerOrderHandler := &handler.SellerOrderHandler{DB: pool}
	adminHandler := &handler.AdminHandler{DB: pool, Hub: hub}
	sellerHandler := &handler.SellerHandler{DB: pool}
	shippingCostHandler := &handler.ShippingCostHandler{CostService: shippingCostSvc}
	taxCalcHandler := &handler.TaxHandler{TaxService: taxSvc}

	returnsHandler := &handler.ReturnsHandler{DB: pool}
	reviewsHandler := &handler.ReviewsHandler{DB: pool}
	addressesHandler := &handler.AddressesHandler{DB: pool}
	paymentHandler := handler.NewPaymentHandler()
	analyticsHandler := &handler.AnalyticsHandler{DB: pool}
	bulkHandler := &handler.BulkHandler{DB: pool}
	settingsHandler := &handler.SettingsHandler{DB: pool}
	sellerReturnsHandler := &handler.SellerReturnsHandler{DB: pool}

	uploadHandler, err := handler.NewUploadHandler()
	if err != nil {
		log.Printf("Upload handler disabled: %v", err)
	}

	var searchSvc *search.SearchService
	searchSvc, err = search.NewSearchService()
	if err != nil {
		log.Printf("Meilisearch not available: %v", err)
	} else {
		go func() {
			if err := searchSvc.IndexAll(pool); err != nil {
				log.Printf("Meilisearch indexing error: %v", err)
			}
		}()
	}

	// ─── Router ──────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "https://marketplace-empire.vercel.app"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("OK")) })
	r.Get("/ws", hub.WSHandler)
	// Remove local upload serving if using Cloudflare R2
	// r.Handle("/uploads/*", static.ServeUploads("./public/uploads"))

	r.Route("/api", func(r chi.Router) {
		// Public
		r.Mount("/auth", registerAuthRoutes(authHandler, pool))
		r.Mount("/products", registerProductRoutes(productHandler))
		r.Mount("/sellers", registerSellerRoutes(sellerHandler))
		r.Mount("/shipping", registerShippingCostRoutes(shippingCostHandler))
		r.Mount("/tax", registerTaxRoutes(taxCalcHandler))
		if searchSvc != nil {
			r.Mount("/search", registerSearchRoutes(searchSvc))
		}
		if uploadHandler != nil {
			r.Mount("/upload", registerUploadRoutes(uploadHandler))
		}

		// Authenticated
		r.Group(func(r chi.Router) {
			r.Use(auth.JWTAuth)

			r.Mount("/orders", registerOrderRoutes(orderHandler))
			r.Mount("/profile", registerProfileRoutes(profileHandler))
			r.Mount("/cart", registerCartRoutes(cartHandler))
			r.Mount("/seller-orders", registerSellerOrderRoutes(sellerOrderHandler))
			r.Mount("/seller-returns", registerSellerReturnsRoutes(sellerReturnsHandler))
			r.Mount("/returns", registerReturnsRoutes(returnsHandler))
			r.Mount("/reviews", registerReviewsRoutes(reviewsHandler))
			r.Mount("/addresses", registerAddressesRoutes(addressesHandler))
			r.Mount("/payment", registerPaymentRoutes(paymentHandler))

			// Admin (JWT + admin check)
			r.Group(func(r chi.Router) {
				r.Use(auth.AdminOnly(pool))

				r.Mount("/admin", registerAdminRoutes(adminHandler, returnsHandler, reviewsHandler))
				r.Mount("/settings", registerSettingsRoutes(settingsHandler))
				r.Mount("/analytics", registerAnalyticsRoutes(analyticsHandler))
				r.Mount("/bulk", registerBulkRoutes(bulkHandler))
			})
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{Addr: ":" + port, Handler: r, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Server starting on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-shutdown
	log.Println("Shutting down...")
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Shutdown error: %v", err)
	}
	log.Println("Server stopped")
}

// ─── Route registration helpers ────────────────────────────────────────
func registerAuthRoutes(a *handler.AuthHandler, pool *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()
	a.RegisterRoutes(r)
	r.Get("/verify", auth.VerifyEmailHandler(pool))
	return r
}
func registerProductRoutes(h *handler.ProductHandler) http.Handler    { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerSellerRoutes(h *handler.SellerHandler) http.Handler      { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerSearchRoutes(s *search.SearchService) http.Handler       { r := chi.NewRouter(); s.RegisterSearchRoute(r); return r }
func registerUploadRoutes(u *handler.UploadHandler) http.Handler      { r := chi.NewRouter(); u.RegisterRoutes(r); return r }
func registerShippingCostRoutes(h *handler.ShippingCostHandler) http.Handler { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerTaxRoutes(h *handler.TaxHandler) http.Handler            { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerOrderRoutes(h *handler.OrderHandler) http.Handler        { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerProfileRoutes(h *handler.ProfileHandler) http.Handler    { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerCartRoutes(h *handler.CartHandler) http.Handler          { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerSellerOrderRoutes(h *handler.SellerOrderHandler) http.Handler { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerSellerReturnsRoutes(h *handler.SellerReturnsHandler) http.Handler { r := chi.NewRouter(); h.RegisterRoutes(r); return r }

func registerAdminReturnsRoutes(h *handler.ReturnsHandler) http.Handler {
	r := chi.NewRouter()
	h.AdminRoutes(r)
	return r
}
func registerAdminReviewsRoutes(h *handler.ReviewsHandler) http.Handler {
	r := chi.NewRouter()
	h.AdminRoutes(r)
	return r
}

func registerAdminRoutes(adminHandler *handler.AdminHandler, returnsHandler *handler.ReturnsHandler, reviewsHandler *handler.ReviewsHandler) http.Handler {
	r := chi.NewRouter()
	adminHandler.RegisterRoutes(r)
	r.Mount("/returns", registerAdminReturnsRoutes(returnsHandler))
	r.Mount("/reviews", registerAdminReviewsRoutes(reviewsHandler))
	return r
}

func registerReturnsRoutes(h *handler.ReturnsHandler) http.Handler     { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerReviewsRoutes(h *handler.ReviewsHandler) http.Handler     { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerAddressesRoutes(h *handler.AddressesHandler) http.Handler { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerPaymentRoutes(h *handler.PaymentHandler) http.Handler     { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerAnalyticsRoutes(h *handler.AnalyticsHandler) http.Handler { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerBulkRoutes(h *handler.BulkHandler) http.Handler           { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
func registerSettingsRoutes(h *handler.SettingsHandler) http.Handler   { r := chi.NewRouter(); h.RegisterRoutes(r); return r }
