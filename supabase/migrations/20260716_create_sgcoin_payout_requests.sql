-- ============================================
-- SGCOIN PAYOUT REQUESTS
-- Customer-initiated withdrawal of earned SGCoin as Polygon-network crypto.
-- Default flow: SGCoin stays on the SGCoalition server for store discounts.
-- This table records when a customer requests a manual payout instead.
-- ============================================

CREATE TABLE IF NOT EXISTS sgcoin_payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    email TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    amount NUMERIC(20, 0) NOT NULL CHECK (amount >= 5000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
    tx_hash TEXT,
    rejection_reason TEXT,
    admin_id UUID,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sgcoin_payout_requests_user_id
    ON sgcoin_payout_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_sgcoin_payout_requests_status
    ON sgcoin_payout_requests (status);
CREATE INDEX IF NOT EXISTS idx_sgcoin_payout_requests_created_at
    ON sgcoin_payout_requests (created_at DESC);

-- Defense-in-depth: a customer CANNOT have more than one pending payout request.
-- Enforced at the DB level so concurrent submit attempts can't both pass an
-- EXISTS check before either INSERT lands (the TOCTOU gap a pure application-
-- level check leaves open). Any second-pending INSERT fails with a Postgres
-- unique-violation error that the service wrapper surfaces as 23505 to the UI.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sgcoin_payout_requests_one_pending_per_user
    ON sgcoin_payout_requests (user_id) WHERE status = 'pending';

-- ============================================
-- LOCK ACQUISITION ORDER (do not invert)
-- ============================================
-- Every admin RPC in this migration MUST acquire FOR UPDATE locks in this
-- order:
--   1. sgcoin_payout_requests row  (the request being acted on)
--   2. profiles row                (the balance being decremented/refunded)
-- Inverting the order risks a deadlock between concurrent admin actions on
-- different payout requests against the same user. Postgres will detect the
-- deadlock and abort the lower-priority transaction, but failing loudly is
-- worse than serializing cleanly.
-- ============================================

-- ============================================
-- RLS POLICIES (mirror sgcoin_purchase_requests)
-- ============================================

ALTER TABLE sgcoin_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payout requests" ON sgcoin_payout_requests;
CREATE POLICY "Users can view own payout requests"
    ON sgcoin_payout_requests FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    );

-- Customers are the only legitimate INSERT source -- they self-submit
-- their own pending request. Withdrawn amounts do not get balance-decremented
-- here; that happens at the admin-approval transition (approve_payout_request).
DROP POLICY IF EXISTS "Users can submit own payout requests" ON sgcoin_payout_requests;
CREATE POLICY "Users can submit own payout requests"
    ON sgcoin_payout_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Direct row UPDATE only via admin RPC functions (which bypass RLS via SECURITY DEFINER).
DROP POLICY IF EXISTS "Admins can update payout requests" ON sgcoin_payout_requests;
CREATE POLICY "Admins can update payout requests"
    ON sgcoin_payout_requests FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Only admins can delete payout requests" ON sgcoin_payout_requests;
CREATE POLICY "Only admins can delete payout requests"
    ON sgcoin_payout_requests FOR DELETE
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- ============================================
-- RPC: submit_payout_request
-- Customer-initiated. Validates balance and inserts a new pending request.
-- Does NOT decrement sg_coin_balance yet (that happens at approval so the
-- customer can keep using SGCOIN for store discounts while Pending).
-- ============================================
CREATE OR REPLACE FUNCTION submit_payout_request(
    p_email TEXT,
    p_wallet_address TEXT,
    p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
-- Lock search_path to prevent schema-injection attacks: SECURITY DEFINER
-- must not implicitly resolve unqualified identifiers to attacker-controlled schemas.
AS $$
DECLARE
    v_user_id UUID;
    v_current_balance NUMERIC;
    v_new_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    -- Stack-limit guard: one pending request per user at a time. Prevents the
    -- confusing 'I have 50 Pending rows but only one can fulfill' UX. The
    -- customer can submit a new request once the existing one moves out of
    -- pending (approved / completed / rejected).
    IF EXISTS (SELECT 1 FROM sgcoin_payout_requests WHERE user_id = v_user_id AND status = 'pending') THEN
        RAISE EXCEPTION 'You already have a pending payout request';
    END IF;

    SELECT sg_coin_balance INTO v_current_balance FROM profiles WHERE id = v_user_id;
    IF v_current_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
    IF p_amount < 5000 THEN RAISE EXCEPTION 'Minimum payout amount is 5000 SGCoin'; END IF;
    IF p_amount > v_current_balance THEN RAISE EXCEPTION 'Requested amount (%) exceeds current balance (%)', p_amount, v_current_balance; END IF;

    INSERT INTO sgcoin_payout_requests (user_id, email, wallet_address, amount, status)
    VALUES (v_user_id, p_email, p_wallet_address, p_amount, 'pending')
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_payout_request TO authenticated;

-- ============================================
-- RPC: approve_payout_request
-- Admin Pending -> Approved. Atomically decrements sg_coin_balance if
-- funds remain (defends against concurrent double-requests). Once Approved,
-- the customer can no longer use this amount for store discounts.
-- ============================================
CREATE OR REPLACE FUNCTION approve_payout_request(
    p_request_id UUID, p_admin_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
-- Lock search_path to prevent schema-injection attacks: SECURITY DEFINER
-- must not implicitly resolve unqualified identifiers to attacker-controlled schemas.
AS $$
DECLARE
    v_request sgcoin_payout_requests%ROWTYPE;
    v_current_balance NUMERIC;
BEGIN
    SELECT * INTO v_request FROM sgcoin_payout_requests WHERE id = p_request_id FOR UPDATE;
    IF v_request.id IS NULL THEN RAISE EXCEPTION 'Payout request not found'; END IF;
    IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be approved (current: %)', v_request.status; END IF;
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF auth.uid() <> p_admin_id THEN RAISE EXCEPTION 'Only the referenced admin may perform this action'; END IF;
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = p_admin_id) THEN RAISE EXCEPTION 'Only admins may approve payout requests'; END IF;

    -- CRITICAL: acquire row-level lock on the profile row BEFORE reading its balance.
    -- Without FOR UPDATE here, two parallel approvals of DIFFERENT pending requests
    -- for the SAME user can both pass the balance check, both decrement, and drive
    -- sg_coin_balance below zero. With FOR UPDATE, Postgres serializes the two
    -- calls: the second waits for the first's decrement to commit, then reads the
    -- new lower balance and raises 'Insufficient balance at approval'.
    SELECT sg_coin_balance INTO v_current_balance FROM profiles WHERE id = v_request.user_id FOR UPDATE;
    IF v_current_balance IS NULL OR v_current_balance < v_request.amount THEN
        RAISE EXCEPTION 'Insufficient balance at approval (have %, need %)', v_current_balance, v_request.amount;
    END IF;

    UPDATE profiles SET sg_coin_balance = sg_coin_balance - v_request.amount, updated_at = now() WHERE id = v_request.user_id;
    UPDATE sgcoin_payout_requests SET status = 'approved', admin_id = p_admin_id, updated_at = now() WHERE id = p_request_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_payout_request TO authenticated;

-- ============================================
-- RPC: complete_payout_request
-- Admin Approved -> Completed. Records on-chain tx_hash + processed_at.
-- Balance already decremented at approval (no change here).
-- ============================================
CREATE OR REPLACE FUNCTION complete_payout_request(
    p_request_id UUID, p_admin_id UUID, p_tx_hash TEXT, p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
-- Lock search_path to prevent schema-injection attacks: SECURITY DEFINER
-- must not implicitly resolve unqualified identifiers to attacker-controlled schemas.
AS $$
DECLARE v_request sgcoin_payout_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_request FROM sgcoin_payout_requests WHERE id = p_request_id FOR UPDATE;
    IF v_request.id IS NULL THEN RAISE EXCEPTION 'Payout request not found'; END IF;
    IF v_request.status <> 'approved' THEN RAISE EXCEPTION 'Only approved requests can be completed (current: %)', v_request.status; END IF;
    -- Validate tx_hash shape: must be a Polygon-format Ethereum tx hash
    -- ('0x' prefix + 40+ hex chars). The length>=10 check was too lenient and
    -- would accept garbage like '0xabc'. The regex catches paste-to-wrong-field
    -- admin errors before the on-chain ledger is updated.
    -- Validate tx_hash shape: must be a Polygon mainnet-format Ethereum tx hash
    -- ('0x' + EXACTLY 64 hex chars). The length>=10 check was too lenient and
    -- would accept garbage like '0xabc'. The 64-char floor pins Polygon mainnet
    -- (testnet Amoy hashes are also 64 hex so they pass too).
    IF p_tx_hash IS NULL OR TRIM(p_tx_hash) !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Polygon tx hash required (expected: 0x + 64 hex chars; other chains like Ethereum L1 rejected)'; END IF;
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF auth.uid() <> p_admin_id THEN RAISE EXCEPTION 'Only the referenced admin may perform this action'; END IF;
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = p_admin_id) THEN RAISE EXCEPTION 'Only admins may complete payout requests'; END IF;

    UPDATE sgcoin_payout_requests
       SET status = 'completed', tx_hash = p_tx_hash,
           admin_notes = COALESCE(p_admin_notes, admin_notes),
           processed_at = now(), updated_at = now()
     WHERE id = p_request_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_payout_request TO authenticated;

-- ============================================
-- RPC: reject_payout_request
-- Admin Pending|Approved -> Rejected with reason.
--   - From Pending: no refund needed (decrement happened at approval).
--   - From Approved: refunds the previously-decremented amount.
-- ============================================
CREATE OR REPLACE FUNCTION reject_payout_request(
    p_request_id UUID, p_admin_id UUID, p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
-- Lock search_path to prevent schema-injection attacks: SECURITY DEFINER
-- must not implicitly resolve unqualified identifiers to attacker-controlled schemas.
AS $$
DECLARE v_request sgcoin_payout_requests%ROWTYPE; v_was_approved BOOLEAN;
BEGIN
    SELECT * INTO v_request FROM sgcoin_payout_requests WHERE id = p_request_id FOR UPDATE;
    IF v_request.id IS NULL THEN RAISE EXCEPTION 'Payout request not found'; END IF;
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF auth.uid() <> p_admin_id THEN RAISE EXCEPTION 'Only the referenced admin may perform this action'; END IF;
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = p_admin_id) THEN RAISE EXCEPTION 'Only admins may reject payout requests'; END IF;
    v_was_approved := v_request.status = 'approved';
    IF v_was_approved THEN
        UPDATE profiles SET sg_coin_balance = sg_coin_balance + v_request.amount, updated_at = now() WHERE id = v_request.user_id;
    END IF;
    UPDATE sgcoin_payout_requests
       SET status = 'rejected', admin_id = p_admin_id, rejection_reason = p_reason, updated_at = now()
     WHERE id = p_request_id;
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION reject_payout_request TO authenticated;

-- ============================================
-- RPC: get_payout_request_stats
-- Admin aggregate: one-row status summary + totals for the dashboard
-- stat cards. Called from services/payoutRequest.ts > getPayoutRequestStats().
-- Reads every row (status-filtered aggregates) — no writes.
-- ============================================
CREATE OR REPLACE FUNCTION get_payout_request_stats()
RETURNS TABLE (
    total_requests BIGINT,
    pending_requests BIGINT,
    approved_requests BIGINT,
    completed_requests BIGINT,
    rejected_requests BIGINT,
    total_amount_requested NUMERIC,
    total_amount_completed NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_requests,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_requests,
        COUNT(*) FILTER (WHERE status = 'approved')::BIGINT AS approved_requests,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS completed_requests,
        COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT AS rejected_requests,
        COALESCE(SUM(amount), 0) AS total_amount_requested,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS total_amount_completed
    FROM sgcoin_payout_requests;
END;
$$;

GRANT EXECUTE ON FUNCTION get_payout_request_stats TO authenticated;

-- ============================================
-- DEFENSE-IN-DEPTH: profiles.sg_coin_balance >= 0 CHECK
-- ============================================
-- Belt-and-suspenders against any future admin RPC or migration that bypasses
-- the FOR UPDATE row lock inside approve_payout_request. Idempotent: silently
-- skips if the constraint already exists. Will fail loudly if any existing row
-- has a negative sg_coin_balance (operator must clean up before retrying).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_sg_coin_balance_nonneg') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_sg_coin_balance_nonneg CHECK (sg_coin_balance >= 0);
    END IF;
END;
$$;
