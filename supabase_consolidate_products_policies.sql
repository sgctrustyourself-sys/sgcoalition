-- ============================================
-- CONSOLIDATE products POLICIES
-- ============================================
-- Combines multiple SELECT policies into one for better performance

-- Drop the separate SELECT policies
DROP POLICY IF EXISTS "Public can view active products" ON products;
DROP POLICY IF EXISTS "Authenticated users can view all products" ON products;
DROP POLICY IF EXISTS "Public products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Public products are editable by everyone (TEMPORARY)" ON products;

-- Drop separate INSERT/UPDATE/DELETE policies if they conflict
DROP POLICY IF EXISTS "Public products are editable by everyone (TEMPORARY)" ON products;

-- Create consolidated SELECT policy for all roles
CREATE POLICY "anyone_can_view_products" ON products
FOR SELECT
TO anon, authenticated
USING (
    -- Active products visible to all
    (archived = false OR archived IS NULL)
    -- OR authenticated users can see all products
    OR (auth.role() = 'authenticated')
);

-- Verify
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'products'
ORDER BY cmd, policyname;
