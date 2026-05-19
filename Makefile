# Load environment variables from .env (if it exists)
ifneq (,$(wildcard .env))
include .env
export
endif

.PHONY: dev dev-web dev-api install tidy

dev: install tidy
	@echo "Starting Marketplace Empire..."
	@trap 'kill 0' EXIT; \
		$(MAKE) dev-api & \
		$(MAKE) dev-web & \
		wait

install:
	pnpm install
	cd apps/api && go mod download

tidy:
	cd apps/api && go mod tidy

dev-web:
	pnpm --filter @marketplace/web dev

dev-api:
	cd apps/api && go run ./cmd/server