-- ============================================
-- CONSOLIDATE profiles POLICIES
-- ============================================
-- Combines two SELECT policies into one for better performance

-- Drop the separate SELECT policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create single consolidated SELECT policy
CREATE POLICY "anyone_can_view_profiles" ON profiles
FOR SELECT
TO anon, authenticated
USING (
    -- Everyone can view all public profiles
    true
    -- Note: If you want to restrict to own profile only for authenticated users:
    -- auth.role() = 'anon' OR id = (SELECT auth.uid())
);

-- Verify
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'SELECT'
ORDER BY policyname;
