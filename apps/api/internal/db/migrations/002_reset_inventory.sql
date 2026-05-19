-- 002_reset_inventory.sql
-- This migration resets all inventory for active products to a safe level (100 units).
-- Run this once to fix "insufficient stock" errors for existing products.

-- 1. Delete all existing ledger entries for every active product (orphaned reservations, old stock)
DELETE FROM inventory_ledger
WHERE product_id IN (SELECT id FROM products WHERE is_active = true)
  AND warehouse_id = 1;

-- 2. Insert fresh stock for each active product
INSERT INTO inventory_ledger (product_id, warehouse_id, quantity_change, reason, created_at)
SELECT id, 1, 100, 'initial', now()
FROM products
WHERE is_active = true;