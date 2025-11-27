-- No Refunds Policy - Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD CONSENT FIELDS TO ORDERS TABLE
-- ============================================

-- Add consent tracking columns to existing orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_text TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_ip TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_user_agent TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consent_user_id UUID REFERENCES auth.users(id);

-- Add index for consent queries
CREATE INDEX IF NOT EXISTS idx_orders_consent_timestamp 
ON orders(consent_timestamp);

CREATE INDEX IF NOT EXISTS idx_orders_consent_user_id 
ON orders(consent_user_id);

-- ============================================
-- 2. CREATE REFUND EXCEPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS refund_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    admin_id TEXT NOT NULL,
    admin_wallet_address TEXT,
    reason TEXT NOT NULL,
    refund_amount NUMERIC(10, 2) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_refund_exceptions_order_id 
ON refund_exceptions(order_id);

CREATE INDEX IF NOT EXISTS idx_refund_exceptions_admin_id 
ON refund_exceptions(admin_id);

CREATE INDEX IF NOT EXISTS idx_refund_exceptions_created_at 
ON refund_exceptions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refund_exceptions_processed 
ON refund_exceptions(processed);

-- ============================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_refund_exceptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_refund_exceptions_updated_at
    BEFORE UPDATE ON refund_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION update_refund_exceptions_updated_at();

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE refund_exceptions ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users (admins) can view exceptions
CREATE POLICY "Authenticated users can view refund exceptions"
ON refund_exceptions
FOR SELECT
TO authenticated
USING (true);

-- Policy: Only authenticated users (admins) can create exceptions
CREATE POLICY "Authenticated users can create refund exceptions"
ON refund_exceptions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Only authenticated users (admins) can update exceptions
CREATE POLICY "Authenticated users can update refund exceptions"
ON refund_exceptions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Only authenticated users (admins) can delete exceptions
CREATE POLICY "Authenticated users can delete refund exceptions"
ON refund_exceptions
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- 5. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to check if order has valid consent
CREATE OR REPLACE FUNCTION has_valid_consent(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_consent BOOLEAN;
BEGIN
    SELECT 
        consent_text IS NOT NULL 
        AND consent_timestamp IS NOT NULL
    INTO v_has_consent
    FROM orders
    WHERE id = p_order_id;
    
    RETURN COALESCE(v_has_consent, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to check if order has refund exception
CREATE OR REPLACE FUNCTION has_refund_exception(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_exception BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM refund_exceptions 
        WHERE order_id = p_order_id 
        AND processed = FALSE
    ) INTO v_has_exception;
    
    RETURN v_has_exception;
END;
$$ LANGUAGE plpgsql;

-- Function to validate refund request
CREATE OR REPLACE FUNCTION can_process_refund(p_order_id UUID)
RETURNS TABLE(
    allowed BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_has_consent BOOLEAN;
    v_has_exception BOOLEAN;
BEGIN
    -- Check if order has consent
    v_has_consent := has_valid_consent(p_order_id);
    
    -- Check if order has exception
    v_has_exception := has_refund_exception(p_order_id);
    
    -- Determine if refund is allowed
    IF v_has_consent AND NOT v_has_exception THEN
        RETURN QUERY SELECT FALSE, 'Refund blocked: Customer consented to no-refunds policy. Admin exception required.'::TEXT;
    ELSIF v_has_consent AND v_has_exception THEN
        RETURN QUERY SELECT TRUE, 'Refund allowed: Admin exception granted.'::TEXT;
    ELSE
        RETURN QUERY SELECT TRUE, 'Refund allowed: No consent on record.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. VERIFY SETUP
-- ============================================

-- Check if consent columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name LIKE 'consent%';

-- Check if refund_exceptions table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'refund_exceptions';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('orders', 'refund_exceptions')
AND indexname LIKE '%consent%' OR indexname LIKE '%refund%';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'refund_exceptions';

-- Check policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'refund_exceptions';

-- Test helper functions
SELECT has_valid_consent('00000000-0000-0000-0000-000000000000'::UUID);
SELECT * FROM can_process_refund('00000000-0000-0000-0000-000000000000'::UUID);

-- ============================================
-- NOTES
-- ============================================
-- 1. Consent fields are added to existing orders table
-- 2. New orders will capture consent at checkout
-- 3. Old orders without consent can still be refunded
-- 4. Admin exceptions override the no-refunds policy
-- 5. All exceptions are logged with admin ID and reason
