-- Add archive-related columns to the products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS released_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE;

-- Optional: Update existing products to have default values if needed
UPDATE products SET archived = FALSE WHERE archived IS NULL;
