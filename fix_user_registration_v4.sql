-- Fix User Registration V4: Self-Healing Columns & Triggers
-- This script ensures ALL columns exist before triggers try to use them.

-- ==========================================
-- Part 1: Self-Heal Profiles Table (Missing Columns?)
-- ==========================================

-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Safely ADD Missing Columns (Defensive Check)
DO $$
BEGIN
    -- Add 'full_name'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;

    -- Add 'is_vip'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_vip') THEN
        ALTER TABLE public.profiles ADD COLUMN is_vip BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add 'store_credit'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'store_credit') THEN
        ALTER TABLE public.profiles ADD COLUMN store_credit NUMERIC(10, 2) DEFAULT 0.00;
    END IF;
END $$;


-- ==========================================
-- Part 2: Robust Profile Trigger
-- ==========================================

-- 3. Update 'handle_new_user' (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  -- Safe Metadata Extraction
  BEGIN
    user_full_name := new.raw_user_meta_data->>'full_name';
  EXCEPTION WHEN OTHERS THEN
    user_full_name := NULL;
  END;

  IF user_full_name IS NULL OR user_full_name = '' THEN
    user_full_name := split_part(new.email, '@', 1);
  END IF;

  -- Insert with explicit columns (now verified to exist)
  INSERT INTO public.profiles (id, email, full_name, is_vip, store_credit)
  VALUES (new.id, new.email, user_full_name, false, 0.00)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach Profile Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Fix RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- ==========================================
-- Part 3: Robust Referral Trigger
-- ==========================================

-- 6. Ensure referral_stats exists
CREATE TABLE IF NOT EXISTS referral_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) UNIQUE NOT NULL
  -- Minimal schema to ensure insert works, other columns added by migration if needed
);

-- 7. Update 'initialize_referral_stats' (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION initialize_referral_stats()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(20);
BEGIN
  new_code := 'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Simple collision check
  BEGIN
    INSERT INTO referral_stats (user_id, referral_code)
    VALUES (NEW.id, new_code);
  EXCEPTION WHEN unique_violation THEN
    -- If code exists, try one more time
    new_code := 'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    INSERT INTO referral_stats (user_id, referral_code)
    VALUES (NEW.id, new_code)
    ON CONFLICT (user_id) DO NOTHING;
  WHEN OTHERS THEN
    -- Ignore other errors to prevent blocking signup
    NULL;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Re-attach Referral Trigger
DROP TRIGGER IF EXISTS create_referral_stats_on_signup ON auth.users;
CREATE TRIGGER create_referral_stats_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_referral_stats();

-- 9. Fix Referral RLS
ALTER TABLE referral_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own stats" ON referral_stats;
CREATE POLICY "Users can view own stats" ON referral_stats FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can manage stats" ON referral_stats;
CREATE POLICY "System can manage stats" ON referral_stats FOR ALL USING (true) WITH CHECK (true);
