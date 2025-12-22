-- Add updated_at column to products table
-- This is the MINIMAL version if you want to apply it quickly

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE products 
SET updated_at = NOW() 
WHERE updated_at IS NULL;
