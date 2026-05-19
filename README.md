# Marketplace Empire 🏛️

> *Where clicks become cardboard, and code becomes commerce.*

Marketplace Empire is a production‑grade, headless marketplace for physical goods. It combines a blazing‑fast Next.js storefront with a high‑concurrency Go backend, all tied together with an event‑driven, double‑entry inventory ledger.

## 🜁 Architecture

┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│ Next.js 14 │────▶│ Go API │────▶│ PostgreSQL 16 │
│ Storefront │ │ (Checkout, │ │ (Inventory │
│ (Edge/SSR) │◀────│ Inventory) │◀────│ Ledger) │
└─────────────┘ └──────┬──────┘ └─────────────────┘
│
┌─────▼─────┐
│ Redis │
│ (Cart, │
│ Cache) │
└───────────┘


## 🚀 Quick Start

### Prerequisites
- Node.js ≥20, pnpm, Docker, Go 1.22+

### 1. Clone & install
```bash
git clone <repo> && cd marketplace-empire
pnpm install

##2. Start infrastructure

docker-compose -f infrastructure/docker-compose.yml up -d

docker compose -f infrastructure/docker-compose.yml up -d

##3. Configure environment

cp .env.example .env
# Edit .env with your keys (Stripe, AI, etc.)

##4. Run everything

pnpm dev


Frontend → http://localhost:3000
Backend → http://localhost:8080

