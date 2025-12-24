-- ============================================
-- MANUAL FIX - Step by Step (Run each section separately)
-- ============================================
-- Fix policies in small batches to avoid timeouts

-- ============================================
-- STEP 1: Remove TEMPORARY duplicate policies
-- ============================================

DROP POLICY IF EXISTS "Orders are viewable by everyone (TEMPORARY)" ON orders;
DROP POLICY IF EXISTS "Public products are editable by everyone (TEMPORARY)" ON products;
DROP POLICY IF EXISTS "Public products are viewable by everyone" ON products;

-- ============================================
-- STEP 2: Fix admin_users policies (if not already fixed)
-- ============================================

-- These should already be optimized from earlier, verify:
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'admin_users';

-- ============================================
-- STEP 3: Fix products policies
-- ============================================

DROP POLICY IF EXISTS "Admins can insert products" ON products;
CREATE POLICY "Admins can insert products" ON products
FOR INSERT TO authenticated
WITH CHECK (is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can update products" ON products;
CREATE POLICY "Admins can update products" ON products
FOR UPDATE TO authenticated
USING (is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete products" ON products;
CREATE POLICY "Admins can delete products" ON products
FOR DELETE TO authenticated
USING (is_admin((SELECT auth.uid())));

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'products';
