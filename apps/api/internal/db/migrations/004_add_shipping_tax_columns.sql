-- 004_add_shipping_tax_columns.sql
-- Add columns to store shipping cost and tax amount for each order.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'shipping_cost'
    ) THEN
        ALTER TABLE orders ADD COLUMN shipping_cost INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'tax_amount'
    ) THEN
        ALTER TABLE orders ADD COLUMN tax_amount INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;