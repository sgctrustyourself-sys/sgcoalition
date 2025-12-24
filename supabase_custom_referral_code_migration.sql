-- ============================================
-- ADD CUSTOM REFERRAL CODE FEATURE
-- ============================================
-- Allows users to customize their referral code once
-- Run this AFTER the initial referral_fix_migration.sql

-- Add column to track if code has been customized
ALTER TABLE referral_stats
ADD COLUMN IF NOT EXISTS code_customized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS code_customized_at TIMESTAMPTZ;

-- Add comment explaining the feature
COMMENT ON COLUMN referral_stats.code_customized IS 'True if user has customized their referral code (can only do once)';
COMMENT ON COLUMN referral_stats.code_customized_at IS 'Timestamp when user customized their code';

-- Verification query
SELECT 
    user_id,
    referral_code,
    code_customized,
    code_customized_at
FROM referral_stats
LIMIT 5;
