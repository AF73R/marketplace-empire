#!/bin/bash
set -e

echo "🔥 Igniting the Marketplace Empire..."

# 1. Install Node dependencies
pnpm install

# 2. Download Go modules and tidy
cd apps/api
go mod download
go mod tidy
cd ../..

# 3. Start Go backend in background
cd apps/api
go run ./cmd/server &
API_PID=$!
cd ../..

# 4. Start Next.js frontend
pnpm --filter @marketplace/web dev &
WEB_PID=$!

# Trap to kill both on exit
cleanup() {
    echo "🛑 Shutting down..."
    kill $API_PID $WEB_PID 2>/dev/null
    exit
}
trap cleanup INT TERM

# Wait for any to exit
wait