-- ============================================
-- FIX PRODUCTS RLS POLICIES - WRAP auth.uid() CALLS
-- ============================================
-- Wraps auth.uid() in SELECT for better query performance
-- This prevents per-row re-evaluation in RLS policies

-- ============================================
-- Products Table Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;
DROP POLICY IF EXISTS "Anyone can view products" ON products;

-- Recreate with optimized SELECT-wrapped auth.uid() calls

-- Insert policy
CREATE POLICY "Admins can insert products"
ON products
FOR INSERT
TO authenticated
WITH CHECK (is_admin((SELECT auth.uid())));

-- Update policy
CREATE POLICY "Admins can update products"
ON products
FOR UPDATE
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- Delete policy
CREATE POLICY "Admins can delete products"
ON products
FOR DELETE
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- Select policy (public access)
CREATE POLICY "Anyone can view products"
ON products
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================
-- Orders Table Policies (if applicable)
-- ============================================

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;

CREATE POLICY "Users can view own orders"
ON orders
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all orders"
ON orders
FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- ============================================
-- Profiles Table Policies (if applicable)
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()));

-- ============================================
-- Referral Stats Policies (if applicable)
-- ============================================

DROP POLICY IF EXISTS "Users can view own referral stats" ON referral_stats;
DROP POLICY IF EXISTS "Users can update own referral stats" ON referral_stats;

CREATE POLICY "Users can view own referral stats"
ON referral_stats
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own referral stats"
ON referral_stats
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- Giveaway Entries Policies (if applicable)
-- ============================================

DROP POLICY IF EXISTS "Users can view own entries" ON giveaway_entries;
DROP POLICY IF EXISTS "Users can insert own entries" ON giveaway_entries;

CREATE POLICY "Users can view own entries"
ON giveaway_entries
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own entries"
ON giveaway_entries
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- VERIFICATION
-- ============================================

-- Check all policies are properly configured
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%SELECT auth.uid()%' OR with_check LIKE '%SELECT auth.uid()%' THEN 'OPTIMIZED ✓'
        WHEN qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%' THEN 'NEEDS FIX ✗'
        ELSE 'OK'
    END as optimization_status
FROM pg_policies
WHERE schemaname = 'public'
AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
ORDER BY tablename, policyname;

-- Expected: All policies should show "OPTIMIZED ✓"
