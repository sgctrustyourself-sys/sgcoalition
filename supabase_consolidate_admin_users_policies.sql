-- ============================================
-- CONSOLIDATE admin_users POLICIES
-- ============================================
-- Combines two permissive policies into one for better performance
-- Reduces policy evaluation overhead on SELECT queries

-- Drop the two separate policies
DROP POLICY IF EXISTS "Admins can view all admins" ON admin_users;
DROP POLICY IF EXISTS "Users can view own admin status" ON admin_users;

-- Create single consolidated policy
CREATE POLICY "authenticated_can_view_admin_users" ON admin_users
FOR SELECT
TO authenticated
USING (
    -- Admins can see all admin users
    EXISTS (
        SELECT 1 FROM admin_users admin_check
        WHERE admin_check.id = (SELECT auth.uid())
    )
    -- OR users can see their own admin status
    OR id = (SELECT auth.uid())
);

-- Verify the new policy
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'admin_users'
ORDER BY policyname;

-- Expected: Only one SELECT policy for authenticated role
