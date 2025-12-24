-- ============================================
-- FINAL COMPREHENSIVE FIX - ALL REMAINING WARNINGS
-- ============================================
-- This fixes ALL remaining RLS performance issues:
-- 1. Wraps ALL auth.uid() calls with SELECT
-- 2. Removes duplicate TEMPORARY policies
-- Run this to get to ZERO warnings!

-- ============================================
-- STEP 1: Remove all TEMPORARY duplicate policies
-- ============================================

-- Products - remove temporary policies
DROP POLICY IF EXISTS "Public products are editable by everyone (TEMPORARY)" ON products;
DROP POLICY IF EXISTS "Public products are viewable by everyone" ON products;

-- Orders - remove temporary policy
DROP POLICY IF EXISTS "Orders are viewable by everyone (TEMPORARY)" ON orders;

-- Profiles - keep consolidated policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Referral stats - keep optimized policies
DROP POLICY IF EXISTS "System can manage stats" ON referral_stats;

-- ============================================
-- STEP 2: Fix ALL remaining auth.uid() calls with SELECT
-- ============================================

-- PRODUCTS policies (3 warnings)
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

CREATE POLICY "Admins can insert products" ON products
FOR INSERT TO authenticated
WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can update products" ON products
FOR UPDATE TO authenticated  
USING (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can delete products" ON products
FOR DELETE TO authenticated
USING (is_admin((SELECT auth.uid())));

-- REFERRALS policies (1 warning)
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;

CREATE POLICY "Users can view own referrals" ON referrals
FOR SELECT TO authenticated
USING (referrer_id = (SELECT auth.uid()));

-- REFERRAL_ANALYTICS policies (1 warning)
DROP POLICY IF EXISTS "Users can view own analytics" ON referral_analytics;

CREATE POLICY "Users can view own analytics" ON referral_analytics
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- WALLET_ACCOUNTS policies (3 warnings)
DROP POLICY IF EXISTS "Users can view own wallet links" ON wallet_accounts;
DROP POLICY IF EXISTS "Users can link their own wallets" ON wallet_accounts;
DROP POLICY IF EXISTS "Users can unlink their own wallets" ON wallet_accounts;

CREATE POLICY "Users can view own wallet links" ON wallet_accounts
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can link their own wallets" ON wallet_accounts
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can unlink their own wallets" ON wallet_accounts
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- SOCIAL_ACCOUNTS policies (3 warnings)
DROP POLICY IF EXISTS "Users can view own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Users can insert own social accounts" ON social_accounts;
DROP POLICY IF EXISTS "Users can update own social accounts" ON social_accounts;

CREATE POLICY "Users can view own social accounts" ON social_accounts
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own social accounts" ON social_accounts
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own social accounts" ON social_accounts
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- AI_CHAT_SESSIONS policies (4 warnings)
DROP POLICY IF EXISTS "Users can view own sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON ai_chat_sessions;

CREATE POLICY "Users can view own sessions" ON ai_chat_sessions
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own sessions" ON ai_chat_sessions
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own sessions" ON ai_chat_sessions
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own sessions" ON ai_chat_sessions
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- AI_CHAT_MESSAGES policies (2 warnings)
DROP POLICY IF EXISTS "Users can view own messages" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON ai_chat_messages;

CREATE POLICY "Users can view own messages" ON ai_chat_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM ai_chat_sessions 
        WHERE ai_chat_sessions.id = ai_chat_messages.session_id 
        AND ai_chat_sessions.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can insert own messages" ON ai_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM ai_chat_sessions 
        WHERE ai_chat_sessions.id = ai_chat_messages.session_id 
        AND ai_chat_sessions.user_id = (SELECT auth.uid())
    )
);

-- PROFILES policies (2 warnings)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()));

-- REFERRAL_STATS policies (1 warning)
DROP POLICY IF EXISTS "Users can view own stats" ON referral_stats;

CREATE POLICY "Users can view own stats" ON referral_stats
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- COALITION_SIGNAL_SUBSCRIBERS policies (1 warning)
DROP POLICY IF EXISTS "Admin full access" ON coalition_signal_subscribers;

CREATE POLICY "Admin full access" ON coalition_signal_subscribers
FOR ALL TO authenticated
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));

-- ============================================
-- VERIFICATION
-- ============================================

-- Count remaining auth RLS initplan issues
SELECT COUNT(*) as remaining_auth_uid_warnings
FROM pg_policies
WHERE schemaname = 'public'
AND (
    (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%')
    OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%')
);
-- Expected: 0

-- List any remaining duplicate policies
SELECT 
    tablename,
    cmd,
    COUNT(*) as policy_count,
    array_agg(policyname) as policies
FROM pg_policies  
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY policy_count DESC;
-- Expected: Only intentional combinations (admin + user policies, not duplicates)

-- List all policies for review
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%(SELECT auth.uid())%' OR with_check LIKE '%(SELECT auth.uid())%' THEN '✓ OPTIMIZED'
        WHEN qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%' THEN '✗ NEEDS FIX'
        ELSE 'OK'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
