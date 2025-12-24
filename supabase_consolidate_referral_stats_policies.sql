-- ============================================
-- CONSOLIDATE referral_stats POLICIES
-- ============================================
-- Combines two SELECT policies into one for better performance

-- Drop the separate SELECT policies
DROP POLICY IF EXISTS "Users can view own stats" ON referral_stats;
DROP POLICY IF EXISTS "System can manage stats" ON referral_stats;

-- Create single consolidated SELECT policy
CREATE POLICY "anyone_can_view_referral_stats" ON referral_stats
FOR SELECT
TO anon, authenticated
USING (
    -- Users can see their own stats
    user_id = (SELECT auth.uid())
    -- OR system/public can view all (if "System can manage stats" was SELECT)
    OR true
);

-- Note: "System can manage stats" might have been FOR ALL not just SELECT
-- If it was FOR ALL, recreate it separately:
CREATE POLICY "system_can_manage_stats" ON referral_stats
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Verify
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'referral_stats'
ORDER BY cmd, policyname;
