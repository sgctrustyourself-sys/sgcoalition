-- ============================================
-- STEP 4: Fix referrals policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals" ON referrals
FOR SELECT TO authenticated
USING (referrer_id = (SELECT auth.uid()));

-- ============================================
-- STEP 5: Fix referral_stats policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own stats" ON referral_stats;
CREATE POLICY "Users can view own stats" ON referral_stats
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- STEP 6: Fix referral_analytics policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own analytics" ON referral_analytics;
CREATE POLICY "Users can view own analytics" ON referral_analytics
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- STEP 7: Fix profiles policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()));

-- Verify
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('referrals', 'referral_stats', 'referral_analytics', 'profiles')
ORDER BY tablename;
