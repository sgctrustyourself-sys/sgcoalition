-- ============================================
-- FIX SUPABASE SECURITY WARNINGS
-- ============================================
-- Adds SET search_path to functions to fix PostgreSQL security warnings
-- This prevents search_path injection attacks and cleans up Supabase metrics

-- ============================================
-- Fix create_referral_stats_for_user function
-- ============================================

CREATE OR REPLACE FUNCTION create_referral_stats_for_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;

-- ============================================
-- Note: Add similar fixes for other functions
-- ============================================
-- If you have other custom functions showing warnings,
-- add them here following the same pattern:
-- 1. Add SECURITY DEFINER
-- 2. Add SET search_path = public (or appropriate schema)
-- 3. Keep LANGUAGE and function body the same

-- Verify the fix
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%referral%'
ORDER BY routine_name;
