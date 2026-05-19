-- 003_fill_missing_stock.sql
-- This migration adds 100 units of inventory to every active product
-- that currently has zero or negative available stock.

INSERT INTO inventory_ledger (product_id, warehouse_id, quantity_change, reason, created_at)
SELECT id, 1, 100, 'initial', now()
FROM products
WHERE is_active = true
  AND id NOT IN (
      SELECT product_id
      FROM inventory_ledger
      WHERE warehouse_id = 1
      GROUP BY product_id
      HAVING SUM(quantity_change) > 0
  );