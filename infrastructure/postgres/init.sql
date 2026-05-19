-- ─────────────────────────────────────────────────────────────────
-- Marketplace Empire — Core Schema
-- Executed automatically on first Postgres container startup
-- ─────────────────────────────────────────────────────────────────

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";           -- case‑insensitive text fields

-- ─── Users ────────────────────────────────────────────────────────
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       CITEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    password    TEXT NOT NULL,                     -- bcrypt hashed
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Products ─────────────────────────────────────────────────────
CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    slug        TEXT UNIQUE NOT NULL,
    price       INTEGER NOT NULL,                  -- stored in cents
    currency    TEXT NOT NULL DEFAULT 'USD',
    images      JSONB NOT NULL DEFAULT '[]',       -- array of image URLs
    category    TEXT[] NOT NULL DEFAULT '{}',
    tags        TEXT[] NOT NULL DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Inventory Ledger (double‑entry, per warehouse) ───────────────
CREATE TABLE warehouses (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    location    TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO warehouses (name, location) VALUES ('Main Warehouse', 'Default');

CREATE TABLE inventory_ledger (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id    INT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity_change INTEGER NOT NULL,              -- positive = stock in, negative = stock out
    reason          TEXT NOT NULL,                 -- 'initial', 'order_placed', 'shipped', 'returned', 'adjustment'
    reference_id    UUID,                          -- optional link to order
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Carts (ephemeral, backed by Redis in production) ────────────
CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,  -- nullable for guests
    session_id  TEXT,                                         -- for guest carts
    items       JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)                                           -- one active cart per user
);

-- ─── Orders ───────────────────────────────────────────────────────
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          TEXT NOT NULL DEFAULT 'pending',         -- pending, confirmed, shipped, delivered, cancelled, returned
    total_amount    INTEGER NOT NULL,                        -- subtotal + shipping - discounts
    currency        TEXT NOT NULL DEFAULT 'USD',
    shipping_address JSONB NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  INTEGER NOT NULL,                     -- price in cents at time of purchase
    total_price INTEGER NOT NULL
);

-- ─── Shipments ────────────────────────────────────────────────────
CREATE TABLE shipments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    carrier         TEXT NOT NULL,
    service         TEXT,
    tracking_number TEXT UNIQUE,
    label_url       TEXT,
    status          TEXT NOT NULL DEFAULT 'label_created',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Returns ──────────────────────────────────────────────────────
CREATE TABLE returns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'requested',  -- requested, approved, in_transit, received, inspected, refunded, rejected
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE return_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id   UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0)
);

-- ─── Indexes ──────────────────────────────────────────────────────
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_inventory_product ON inventory_ledger(product_id, warehouse_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_returns_order ON returns(order_id);