-- ============================================
-- REFERRAL SYSTEM FIX - AUTO-INITIALIZE REFERRAL STATS
-- ============================================
-- This migration creates:
-- 1. Auto-trigger to generate referral stats for new users
-- 2. Backfill script for existing users
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE AUTO-INIT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION create_referral_stats_for_user()
RETURNS TRIGGER AS $$
DECLARE
    new_referral_code TEXT;
BEGIN
    -- Generate unique 6-character referral code
    new_referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 6));
    
    -- Ensure uniqueness (loop until we find unused code)
    WHILE EXISTS (SELECT 1 FROM referral_stats WHERE referral_code = new_referral_code) LOOP
        new_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::text || NOW()::text) FROM 1 FOR 6));
    END LOOP;
    
    -- Create referral stats record with default values
    INSERT INTO referral_stats (
        user_id,
        referral_code,
        total_referrals,
        successful_referrals,
        current_tier,
        current_commission_rate,
        total_earnings,
        pending_earnings,
        paid_earnings
    ) VALUES (
        NEW.id,
        new_referral_code,
        0,
        0,
        1,
        5,  -- Tier 1 starts at 5% commission
        0.0,
        0.0,
        0.0
    ) ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. CREATE TRIGGER FOR NEW USERS
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_referral ON auth.users;

-- Create trigger that fires when new user signs up
CREATE TRIGGER on_auth_user_created_referral
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_referral_stats_for_user();

-- ============================================
-- 3. BACKFILL EXISTING USERS
-- ============================================

-- Create referral stats for any users who don't have them yet
INSERT INTO referral_stats (
    user_id,
    referral_code,
    total_referrals,
    successful_referrals,
    current_tier,
    current_commission_rate,
    total_earnings,
    pending_earnings,
    paid_earnings
)
SELECT 
    u.id as user_id,
    UPPER(SUBSTRING(MD5(u.id::text || u.created_at::text || RANDOM()::text) FROM 1 FOR 6)) as referral_code,
    0 as total_referrals,
    0 as successful_referrals,
    1 as current_tier,
    5 as current_commission_rate,
    0.0 as total_earnings,
    0.0 as pending_earnings,
    0.0 as paid_earnings
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM referral_stats WHERE user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 4. VERIFICATION QUERIES
-- ============================================

-- Check how many users now have referral stats
SELECT 
    COUNT(*) as total_users_with_referral_stats
FROM referral_stats;

-- Show sample of generated codes
SELECT 
    user_id,
    referral_code,
    current_tier,
    current_commission_rate
FROM referral_stats
ORDER BY created_at DESC
LIMIT 10;

-- Verify no duplicate codes
SELECT 
    referral_code,
    COUNT(*) as count
FROM referral_stats
GROUP BY referral_code
HAVING COUNT(*) > 1;
