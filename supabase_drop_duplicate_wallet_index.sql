-- ============================================
-- DROP DUPLICATE INDEX on wallet_accounts
-- ============================================
-- Fixes duplicate index warning
-- Keeps idx_wallet_accounts_user_id (follows naming convention)
-- Removes idx_wallet_accounts_user (duplicate)

-- Drop the duplicate index
DROP INDEX IF EXISTS public.idx_wallet_accounts_user;

-- Verify - should show only idx_wallet_accounts_user_id remains
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'wallet_accounts'
ORDER BY indexname;
