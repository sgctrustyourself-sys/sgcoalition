-- ============================================
-- FIX RLS POLICY PERFORMANCE ISSUES
-- ============================================
-- Wraps auth function calls in SELECT subqueries for better performance
-- This prevents per-row re-evaluation and enables efficient query planning

-- ============================================
-- Step 1: Create stable helper function (recommended approach)
-- ============================================

CREATE OR REPLACE FUNCTION get_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid();
$$;

-- Restrict execute permissions for security
REVOKE EXECUTE ON FUNCTION get_auth_uid() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION get_auth_uid() TO authenticated;

-- Add search_path for security (addressing previous warnings)
ALTER FUNCTION get_auth_uid() SET search_path = public;

-- ============================================
-- Step 2: Recreate admin_users RLS policies with optimized calls
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can add new admins" ON admin_users;

-- Recreate with optimized SELECT-wrapped calls
CREATE POLICY "Admins can add new admins"
ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM admin_users 
        WHERE id = (SELECT auth.uid())
    )
);

-- Also optimize other admin_users policies if they exist
DROP POLICY IF EXISTS "Admins can view all admins" ON admin_users;
CREATE POLICY "Admins can view all admins"
ON admin_users
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM admin_users 
        WHERE id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Admins can update admin list" ON admin_users;
CREATE POLICY "Admins can update admin list"
ON admin_users
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM admin_users 
        WHERE id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Admins can delete admins" ON admin_users;
CREATE POLICY "Admins can delete admins"
ON admin_users
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM admin_users 
        WHERE id = (SELECT auth.uid())
    )
);

-- ============================================
-- Step 3: Add index for performance (if not exists)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_admin_users_id ON admin_users(id);

-- ============================================
-- Verification
-- ============================================

-- Check that policies are correctly set
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'admin_users'
ORDER BY policyname;

-- Verify helper function exists
SELECT 
    routine_name,
    routine_type,
    security_type,
    is_deterministic
FROM information_schema.routines
WHERE routine_name = 'get_auth_uid';
