-- ============================================
-- SUPABASE PRODUCTION SECURITY SETUP
-- ============================================
-- Run this SQL in Supabase SQL Editor to secure your production database
-- Dashboard: https://supabase.com/dashboard → SQL Editor

-- ============================================
-- 1. ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Enable RLS on orders table (if exists)
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. PRODUCTS TABLE POLICIES
-- ============================================

-- Policy: Public can view active (non-archived) products
CREATE POLICY "Public can view active products"
ON products FOR SELECT
USING (archived = false OR archived IS NULL);

-- Policy: Authenticated users can view all products (for admin panel)
CREATE POLICY "Authenticated users can view all products"
ON products FOR SELECT
TO authenticated
USING (true);

-- Policy: Only service role can insert products
-- (Your API uses service key, not anon key, for writes)
CREATE POLICY "Service role can insert products"
ON products FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Only service role can update products
CREATE POLICY "Service role can update products"
ON products FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Only service role can delete products
CREATE POLICY "Service role can delete products"
ON products FOR DELETE
TO service_role
USING (true);

-- ============================================
-- 3. VERIFY POLICIES
-- ============================================

-- Check enabled policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'products';

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index for filtering by archived status
CREATE INDEX IF NOT EXISTS idx_products_archived 
ON products(archived) 
WHERE archived = false;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products(category);

-- Index for featured products
CREATE INDEX IF NOT EXISTS idx_products_featured 
ON products(is_featured) 
WHERE is_featured = true;

-- ============================================
-- 5. ENABLE REALTIME (if needed)
-- ============================================

-- Enable realtime for products table
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- ============================================
-- 6. BACKUP CONFIGURATION
-- ============================================

-- Supabase Pro automatically backs up daily
-- For manual backup, go to:
-- Dashboard → Database → Backups

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test: Can anonymous users see active products?
-- (Run this as anon user - should return active products only)
-- SELECT * FROM products WHERE archived = false;

-- Test: Can anonymous users see archived products?
-- (Run this as anon user - should return 0 rows)
-- SELECT * FROM products WHERE archived = true;

-- Test: Can authenticated users see all products?
-- (Run this as authenticated user - should return all products)
-- SELECT * FROM products;

-- ============================================
-- NOTES
-- ============================================
-- 1. RLS policies protect your data even if API keys are compromised
-- 2. Service role key bypasses RLS (keep it secret!)
-- 3. Anon key respects RLS policies
-- 4. Test policies thoroughly before going live
-- 5. Monitor query performance after adding indexes
