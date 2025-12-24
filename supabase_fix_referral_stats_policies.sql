-- ============================================
-- FIX referral_stats policies - remove redundancy
-- ============================================
-- Fixes the duplicate permissive policies warning

-- Drop the redundant policies
DROP POLICY IF EXISTS "anyone_can_view_referral_stats" ON referral_stats;
DROP POLICY IF EXISTS "system_can_manage_stats" ON referral_stats;

-- Create owner-only SELECT policy (no OR true)
CREATE POLICY "users_can_view_own_stats" ON referral_stats
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Create system management policy (for service role only)
-- This allows backend/system operations without exposing to all users
CREATE POLICY "system_can_manage_stats" ON referral_stats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify - should show 2 policies with no overlap
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'referral_stats'
ORDER BY cmd, policyname;
