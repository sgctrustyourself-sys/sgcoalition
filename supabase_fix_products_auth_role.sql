-- ============================================
-- FIX products policy - wrap auth.role() call
-- ============================================
-- Fixes the remaining RLS initplan warning on products

DROP POLICY IF EXISTS "anyone_can_view_products" ON products;

CREATE POLICY "anyone_can_view_products" ON products
FOR SELECT
TO anon, authenticated
USING (
    -- Active products visible to all
    (archived = false OR archived IS NULL)
    -- OR authenticated users can see all products
    OR ((SELECT auth.role()) = 'authenticated')
);

-- Verify
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'products' AND cmd = 'SELECT';
