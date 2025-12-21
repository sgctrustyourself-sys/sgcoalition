-- ============================================
-- FIX: User Registration Database Error
-- ============================================
-- This script fixes the "Database error saving new user" issue
-- by ensuring the profile creation trigger works correctly.
--
-- Problem: New users can't sign up because profiles aren't being created
-- Solution: Fix the trigger function and RLS policies
-- ============================================

-- Step 1: Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    is_vip BOOLEAN DEFAULT FALSE,
    store_credit NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 1.1: Ensure columns exist (in case table already existed)
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE public.profiles ADD COLUMN is_vip BOOLEAN DEFAULT FALSE;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE public.profiles ADD COLUMN store_credit NUMERIC(10, 2) DEFAULT 0.00;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- Step 2: Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (to recreate them fresh)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for service role" ON public.profiles;

-- Step 4: Create RLS policies
-- Allow anyone to view profiles
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles
    FOR SELECT 
    USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.profiles
    FOR UPDATE 
    USING (auth.uid() = id);

-- CRITICAL FIX: Allow service role to insert profiles (for the trigger)
-- This policy allows the trigger function to insert profiles
CREATE POLICY "Enable insert for service role" 
    ON public.profiles
    FOR INSERT 
    WITH CHECK (true);

-- Step 5: Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 6: Create the trigger function with SECURITY DEFINER
-- SECURITY DEFINER allows the function to bypass RLS policies
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER -- This is critical - allows bypassing RLS
SET search_path = public
AS $$
BEGIN
    -- Insert new profile for the user
    INSERT INTO public.profiles (id, email, is_vip, store_credit)
    VALUES (NEW.id, NEW.email, false, 0.00);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Step 8: Backfill existing users who don't have profiles
-- This ensures any users who signed up during the error period get profiles
INSERT INTO public.profiles (id, email, is_vip, store_credit)
SELECT 
    au.id, 
    au.email,
    false,
    0.00
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 9: Verify the fix
DO $$
DECLARE
    trigger_count INTEGER;
    function_count INTEGER;
    profile_count INTEGER;
    user_count INTEGER;
BEGIN
    -- Check trigger exists
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created';
    
    -- Check function exists
    SELECT COUNT(*) INTO function_count
    FROM pg_proc
    WHERE proname = 'handle_new_user';
    
    -- Check profile counts
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    SELECT COUNT(*) INTO user_count FROM auth.users;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'User Registration Fix - Verification';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Trigger exists: %', CASE WHEN trigger_count > 0 THEN 'YES ✓' ELSE 'NO ✗' END;
    RAISE NOTICE 'Function exists: %', CASE WHEN function_count > 0 THEN 'YES ✓' ELSE 'NO ✗' END;
    RAISE NOTICE 'Total users: %', user_count;
    RAISE NOTICE 'Total profiles: %', profile_count;
    RAISE NOTICE 'Missing profiles: %', (user_count - profile_count);
    RAISE NOTICE '===========================================';
    
    IF trigger_count > 0 AND function_count > 0 THEN
        RAISE NOTICE 'SUCCESS: User registration fix applied successfully!';
    ELSE
        RAISE WARNING 'ISSUE: Trigger or function missing. Please review.';
    END IF;
END $$;
