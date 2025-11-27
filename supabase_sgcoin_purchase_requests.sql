-- SGCoin Purchase Requests - Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE PURCHASE REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS sgcoin_purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    email TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    proof_url TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    admin_id TEXT,
    admin_wallet_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sgcoin_requests_user_id 
ON sgcoin_purchase_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_sgcoin_requests_email 
ON sgcoin_purchase_requests(email);

CREATE INDEX IF NOT EXISTS idx_sgcoin_requests_status 
ON sgcoin_purchase_requests(status);

CREATE INDEX IF NOT EXISTS idx_sgcoin_requests_created_at 
ON sgcoin_purchase_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sgcoin_requests_wallet 
ON sgcoin_purchase_requests(wallet_address);

-- ============================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_sgcoin_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sgcoin_requests_updated_at
    BEFORE UPDATE ON sgcoin_purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_sgcoin_requests_updated_at();

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE sgcoin_purchase_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own requests"
ON sgcoin_purchase_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Anyone can insert (for non-logged-in users)
CREATE POLICY "Anyone can create requests"
ON sgcoin_purchase_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Authenticated users (admins) can view all
CREATE POLICY "Authenticated users can view all requests"
ON sgcoin_purchase_requests
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users (admins) can update
CREATE POLICY "Authenticated users can update requests"
ON sgcoin_purchase_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users (admins) can delete
CREATE POLICY "Authenticated users can delete requests"
ON sgcoin_purchase_requests
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- 5. CREATE STORAGE BUCKET (Manual Step)
-- ============================================

-- MANUAL STEP: Create storage bucket in Supabase Dashboard
-- Bucket name: sgcoin-payment-proofs
-- Public: false (private)
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf

-- Storage policies (run after bucket is created):
-- INSERT policy: Allow authenticated and anon users to upload
-- SELECT policy: Allow authenticated users to view
-- DELETE policy: Allow authenticated users to delete

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get request statistics
CREATE OR REPLACE FUNCTION get_sgcoin_request_stats()
RETURNS TABLE(
    total_requests BIGINT,
    pending_requests BIGINT,
    approved_requests BIGINT,
    rejected_requests BIGINT,
    total_amount_requested NUMERIC,
    total_amount_approved NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_requests,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_requests,
        COUNT(*) FILTER (WHERE status = 'approved')::BIGINT as approved_requests,
        COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_requests,
        COALESCE(SUM(amount), 0) as total_amount_requested,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as total_amount_approved
    FROM sgcoin_purchase_requests;
END;
$$ LANGUAGE plpgsql;

-- Function to approve request
CREATE OR REPLACE FUNCTION approve_sgcoin_request(
    p_request_id UUID,
    p_admin_id TEXT,
    p_admin_wallet TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sgcoin_purchase_requests
    SET 
        status = 'approved',
        admin_id = p_admin_id,
        admin_wallet_address = p_admin_wallet,
        processed_at = NOW()
    WHERE id = p_request_id
    AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to reject request
CREATE OR REPLACE FUNCTION reject_sgcoin_request(
    p_request_id UUID,
    p_admin_id TEXT,
    p_admin_wallet TEXT,
    p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sgcoin_purchase_requests
    SET 
        status = 'rejected',
        rejection_reason = p_reason,
        admin_id = p_admin_id,
        admin_wallet_address = p_admin_wallet,
        processed_at = NOW()
    WHERE id = p_request_id
    AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. VERIFY SETUP
-- ============================================

-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'sgcoin_purchase_requests';

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sgcoin_purchase_requests'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'sgcoin_purchase_requests';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'sgcoin_purchase_requests';

-- Check policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'sgcoin_purchase_requests';

-- Test stats function
SELECT * FROM get_sgcoin_request_stats();

-- ============================================
-- NOTES
-- ============================================
-- 1. Storage bucket must be created manually in Supabase Dashboard
-- 2. Admins approve/reject requests manually
-- 3. Email notifications handled by application code
-- 4. No automatic SGCoin transfers - admin fulfills manually
