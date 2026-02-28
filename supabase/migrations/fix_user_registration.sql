-- Fix: Database error saving new user
-- Root Cause: handle_new_user trigger likely failing due to RLS or permissions, or missing profiles for some users.

-- 1. Ensure function is SECURITY DEFINER to bypass RLS and robustly handle duplicates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_vip, store_credit)
  VALUES (new.id, new.email, false, 0.00)
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if profile already exists
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop and Recreate Trigger to ensure it uses the updated function and is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Update RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles; -- Potential duplicate naming

-- Create correct policies
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Note: We do NOT need an INSERT policy for users because the trigger (SECURITY DEFINER) handles creation.

-- 4. Backfill missing profiles for existing users
DO $$
DECLARE
  missing_user RECORD;
BEGIN
  FOR missing_user IN 
    SELECT u.id, u.email 
    FROM auth.users u 
    LEFT JOIN public.profiles p ON u.id = p.id 
    WHERE p.id IS NULL
  LOOP
    -- Insert missing profile
    INSERT INTO public.profiles (id, email, is_vip, store_credit)
    VALUES (missing_user.id, missing_user.email, false, 0.00)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;
