-- Fix User Registration V3: Comprehensive Trigger Fix
-- This script fixes BOTH the Profile trigger and the Referral trigger.
-- Run this in Supabase SQL Editor.

-- ==========================================
-- Part 1: Fix Profile Creation (from V2)
-- ==========================================

-- 1. Ensure 'full_name' column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
END $$;

-- 2. Update 'handle_new_user' to be SECURITY DEFINER and robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  user_full_name := new.raw_user_meta_data->>'full_name';
  IF user_full_name IS NULL OR user_full_name = '' THEN
    user_full_name := split_part(new.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, is_vip, store_credit)
  VALUES (new.id, new.email, user_full_name, false, 0.00)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-attach Profile Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Fix Profile RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- ==========================================
-- Part 2: Fix Referral System Trigger
-- ==========================================

-- 1. Ensure referral_stats table exists (idempotent)
CREATE TABLE IF NOT EXISTS referral_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  current_tier INTEGER DEFAULT 1,
  current_commission_rate DECIMAL(5,2) DEFAULT 5.00,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  pending_earnings DECIMAL(10,2) DEFAULT 0.00,
  paid_earnings DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Update 'initialize_referral_stats' to be SECURITY DEFINER
-- IMPORTANT prevent errors if function doesn't exist yet, create it fresh
CREATE OR REPLACE FUNCTION initialize_referral_stats()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(20);
BEGIN
  -- Generate unique referral code
  new_code := 'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM referral_stats WHERE referral_code = new_code) LOOP
    new_code := 'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  END LOOP;
  
  -- Insert initial stats
  INSERT INTO referral_stats (user_id, referral_code)
  VALUES (NEW.id, new_code)
  ON CONFLICT (user_id) DO NOTHING; -- Handle duplicate calls gracefully
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Marked SECURITY DEFINER to bypass RLS

-- 3. Re-attach Referral Trigger
DROP TRIGGER IF EXISTS create_referral_stats_on_signup ON auth.users;
CREATE TRIGGER create_referral_stats_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_referral_stats();

-- 4. Fix Referral Stats RLS
ALTER TABLE referral_stats ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own stats
DROP POLICY IF EXISTS "Users can view own stats" ON referral_stats;
CREATE POLICY "Users can view own stats" ON referral_stats FOR SELECT USING (auth.uid() = user_id);

-- Allow system (SECURITY DEFINER functions) to manage stats
-- Note: SECURITY DEFINER functions bypass RLS, so this is mostly for other access patterns
DROP POLICY IF EXISTS "System can manage stats" ON referral_stats;
CREATE POLICY "System can manage stats" ON referral_stats FOR ALL USING (true) WITH CHECK (true);
