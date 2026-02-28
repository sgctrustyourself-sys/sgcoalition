-- ============================================
-- ADMIN SECURITY SETUP
-- ============================================
-- Run this SQL in Supabase SQL Editor to set up admin authentication
-- Dashboard: https://supabase.com/dashboard → SQL Editor

-- ============================================
-- 1. CREATE ADMIN USERS TABLE
-- ============================================

-- Create admin_users table to track who has admin access
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- ============================================
-- 2. ENABLE RLS ON ADMIN_USERS
-- ============================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view their own admin status
CREATE POLICY "Users can view own admin status"
ON admin_users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: Only existing admins can insert new admins
CREATE POLICY "Admins can add new admins"
ON admin_users FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = auth.uid()
    )
);

-- ============================================
-- 3. CREATE ADMIN CHECK FUNCTION
-- ============================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = check_user_id
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. UPDATE PRODUCTS TABLE RLS POLICIES
-- ============================================

-- Drop old service role policies
DROP POLICY IF EXISTS "Service role can insert products" ON products;
DROP POLICY IF EXISTS "Service role can update products" ON products;
DROP POLICY IF EXISTS "Service role can delete products" ON products;

-- New policies: Only authenticated admins can write
CREATE POLICY "Admins can insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update products"
ON products FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete products"
ON products FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- ============================================
-- 5. ADD YOUR ADMIN EMAIL
-- ============================================

-- IMPORTANT: This will grant admin access to bird.derron@gmail.com
-- First, create a user account at https://sgcoalition.xyz/#/signup
-- Then run this to grant admin access:

INSERT INTO admin_users (user_id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'bird.derron@gmail.com'
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 6. VERIFICATION QUERIES
-- ============================================

-- Check if admin_users table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_users'
) AS admin_table_exists;

-- View all admin users
SELECT 
    au.email,
    au.role,
    au.created_at,
    u.email_confirmed_at
FROM admin_users au
LEFT JOIN auth.users u ON au.user_id = u.id;

-- Test admin check function
-- SELECT is_admin(auth.uid());

-- ============================================
-- NOTES
-- ============================================
-- 1. After running this script, create a Supabase Auth account
-- 2. Use the INSERT statement above to grant yourself admin access
-- 3. Only authenticated admins can modify products
-- 4. Public users can still view active products (read-only)
-- 5. Keep your admin credentials secure!
