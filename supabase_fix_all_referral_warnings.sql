-- ============================================
-- FIX ALL REMAINING REFERRAL FUNCTION SECURITY WARNINGS
-- ============================================
-- Adds SET search_path to all referral-related DEFINER functions
-- Run this AFTER supabase_fix_search_path_warnings.sql

-- ============================================
-- Fix initialize_referral_stats function
-- ============================================

CREATE OR REPLACE FUNCTION initialize_referral_stats()
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
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM referral_stats WHERE referral_code = new_referral_code) LOOP
        new_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::text || NOW()::text) FROM 1 FOR 6));
    END LOOP;
    
    -- Create referral stats record
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
        5,
        0.0,
        0.0,
        0.0
    ) ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- Fix track_referral_event function
-- ============================================

CREATE OR REPLACE FUNCTION track_referral_event()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the updated_at timestamp whenever a referral event occurs
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================
-- Verification
-- ============================================

-- Check all referral functions now have proper security settings
SELECT 
    routine_name,
    routine_type,
    security_type,
    CASE 
        WHEN routine_definition LIKE '%SET search_path%' THEN 'HAS search_path'
        ELSE 'MISSING search_path'
    END as search_path_status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%referral%'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Expected result: All DEFINER functions should show 'HAS search_path'
