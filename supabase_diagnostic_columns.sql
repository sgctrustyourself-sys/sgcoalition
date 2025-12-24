-- ============================================
-- DIAGNOSTIC: Find correct column names for each table
-- ============================================
-- Run this first to see what columns exist

-- Check referrals table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'referrals'
ORDER BY ordinal_position;

-- Check referral_stats table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'referral_stats'
ORDER BY ordinal_position;

-- Check referral_analytics table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'referral_analytics'
ORDER BY ordinal_position;

-- Check profiles table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check wallet_accounts table columns (if exists)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'wallet_accounts'
ORDER BY ordinal_position;

-- Check social_accounts table columns (if exists)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'social_accounts'
ORDER BY ordinal_position;
