-- ============================================
-- DROP DUPLICATE INDEX on referrals
-- ============================================
-- Fixes duplicate index warning
-- Keeps idx_referrals_referrer_id (follows naming convention)
-- Removes idx_referrals_referrer (duplicate)

-- Drop the duplicate index
DROP INDEX IF EXISTS public.idx_referrals_referrer;

-- Verify - should show only idx_referrals_referrer_id remains for that column
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'referrals'
ORDER BY indexname;
