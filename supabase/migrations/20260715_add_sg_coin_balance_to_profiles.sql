-- Add sg_coin_balance column to profiles
-- Run this migration in Supabase SQL Editor

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS sg_coin_balance INTEGER DEFAULT 0;

COMMENT ON COLUMN public.profiles.sg_coin_balance IS 'SGCoin balance for the user';