-- ============================================
-- RLS POLICIES FOR UNPROTECTED TABLES
-- Run this migration in Supabase SQL Editor
-- ============================================

ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view products" ON products;
CREATE POLICY "Anyone can view products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only admins can insert products" ON products;
CREATE POLICY "Only admins can insert products" ON products FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can update products" ON products;
CREATE POLICY "Only admins can update products" ON products FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete products" ON products;
CREATE POLICY "Only admins can delete products" ON products FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Only admins can update orders" ON orders;
CREATE POLICY "Only admins can update orders" ON orders FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete orders" ON orders;
CREATE POLICY "Only admins can delete orders" ON orders FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE IF EXISTS giveaway_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view entries" ON giveaway_entries;
CREATE POLICY "Anyone can view entries" ON giveaway_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert entries" ON giveaway_entries;
CREATE POLICY "Anyone can insert entries" ON giveaway_entries FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only admins can update entries" ON giveaway_entries;
CREATE POLICY "Only admins can update entries" ON giveaway_entries FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete entries" ON giveaway_entries;
CREATE POLICY "Only admins can delete entries" ON giveaway_entries FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

ALTER TABLE IF EXISTS admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can check own admin status" ON admin_users;
CREATE POLICY "Users can check own admin status" ON admin_users FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS coalition_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view signals" ON coalition_signals;
CREATE POLICY "Anyone can view signals" ON coalition_signals FOR SELECT USING (true);

ALTER TABLE IF EXISTS social_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own social accounts" ON social_accounts;
CREATE POLICY "Users can view own social accounts" ON social_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own social accounts" ON social_accounts;
CREATE POLICY "Users can insert own social accounts" ON social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own social accounts" ON social_accounts;
CREATE POLICY "Users can delete own social accounts" ON social_accounts FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS custom_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own inquiries" ON custom_inquiries;
CREATE POLICY "Users can view own inquiries" ON custom_inquiries FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can insert inquiries" ON custom_inquiries;
CREATE POLICY "Anyone can insert inquiries" ON custom_inquiries FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only admins can update inquiries" ON custom_inquiries;
CREATE POLICY "Only admins can update inquiries" ON custom_inquiries FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete inquiries" ON custom_inquiries;
CREATE POLICY "Only admins can delete inquiries" ON custom_inquiries FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

ALTER TABLE IF EXISTS coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read coupons" ON coupons;
CREATE POLICY "Anyone can read coupons" ON coupons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only admins can insert coupons" ON coupons;
CREATE POLICY "Only admins can insert coupons" ON coupons FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can update coupons" ON coupons;
CREATE POLICY "Only admins can update coupons" ON coupons FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete coupons" ON coupons;
CREATE POLICY "Only admins can delete coupons" ON coupons FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

ALTER TABLE IF EXISTS sgcoin_purchase_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own requests" ON sgcoin_purchase_requests;
CREATE POLICY "Users can view own requests" ON sgcoin_purchase_requests FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert requests" ON sgcoin_purchase_requests;
CREATE POLICY "Users can insert requests" ON sgcoin_purchase_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Only admins can update requests" ON sgcoin_purchase_requests;
CREATE POLICY "Only admins can update requests" ON sgcoin_purchase_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete requests" ON sgcoin_purchase_requests;
CREATE POLICY "Only admins can delete requests" ON sgcoin_purchase_requests FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Add user_id column to custom_inquiries for future tracking (must come before policies referencing it)
ALTER TABLE IF EXISTS custom_inquiries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- ============================================
-- COALITION BRAIN - Knowledge Base Table
-- ============================================
CREATE TABLE IF NOT EXISTS brain_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source TEXT DEFAULT 'manual',
    importance INTEGER DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
    image_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE IF EXISTS brain_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view brain entries" ON brain_entries;
DROP POLICY IF EXISTS "Only admins can view brain entries" ON brain_entries;
CREATE POLICY "Only admins can view brain entries" ON brain_entries FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can insert brain entries" ON brain_entries;
CREATE POLICY "Only admins can insert brain entries" ON brain_entries FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can update brain entries" ON brain_entries;
CREATE POLICY "Only admins can update brain entries" ON brain_entries FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Only admins can delete brain entries" ON brain_entries;
CREATE POLICY "Only admins can delete brain entries" ON brain_entries FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

DO $$ BEGIN RAISE NOTICE '✅ RLS policies migration created'; END $$;
