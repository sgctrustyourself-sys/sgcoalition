-- ============================================
-- CONSOLIDATE orders POLICIES
-- ============================================
-- Combines multiple SELECT policies into one for better performance

-- Drop the separate SELECT policies
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Orders are viewable by everyone (TEMPORARY)" ON orders;

-- Create single consolidated SELECT policy
CREATE POLICY "authenticated_can_view_orders" ON orders
FOR SELECT
TO authenticated
USING (
    -- Admins can see all orders
    is_admin((SELECT auth.uid()))
    -- OR users can see their own orders
    OR consent_user_id = (SELECT auth.uid())
    -- OR temporary: everyone can see all orders (remove when ready to lock down)
    OR true
);

-- Note: The "OR true" makes this effectively wide-open for authenticated users
-- Remove it when you're ready to restrict to admins + own orders only

-- Verify
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'orders' AND cmd = 'SELECT'
ORDER BY policyname;
