-- ============================================
-- FINAL FIX - Only 1 policy needs updating!
-- ============================================

-- Fix social_accounts UPDATE policy
DROP POLICY IF EXISTS "Users can update own serial accounts" ON social_accounts;

CREATE POLICY "Users can update own social accounts" ON social_accounts
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Verify it's fixed
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%(SELECT auth.uid())%' THEN '✓ FIXED'
        WHEN qual LIKE '%auth.uid()%' THEN '✗ NEEDS FIX'
        ELSE 'N/A'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'social_accounts'
AND policyname = 'Users can update own social accounts';
