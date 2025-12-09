-- Initialize referral stats for existing users
-- This creates referral codes for users who signed up before the referral system was implemented

INSERT INTO referral_stats (user_id, referral_code)
SELECT 
  id,
  'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 6))
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM referral_stats)
ON CONFLICT (user_id) DO NOTHING;

-- Verify the insert
SELECT COUNT(*) as users_initialized FROM referral_stats;
