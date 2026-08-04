-- supabase/migrations/20260730_create_payments_table.sql
--
-- Creates the payments audit table AND the record_partial_payment RPC.
-- The table tracks every cash/deposit/partial payment against an order,
-- providing a full audit trail independent of the orders.notes text field.
--
-- TABLE: payments
--   One row per recorded payment. Links to orders.id. Supports both
--   full-reconciliation payments (amount = balance_due) and incremental
--   partial payments (amount < balance_due). proof_url is optional --
--   the admin can upload a receipt screenshot or skip it.
--
-- RPC: record_partial_payment
--   Atomically:
--     1. Validates the order is pending with balance_due > 0
--     2. Validates p_amount > 0 AND p_amount <= balance_due
--     3. If p_amount = balance_due: full reconciliation (paid_amount=total,
--        balance_due=0, payment_status='paid', paid_at=now(),
--        profiles.lifetime_spend_usd += balance_due)
--     4. If p_amount < balance_due: partial reconciliation (paid_amount += p_amount,
--        balance_due -= p_amount, order stays pending)
--     5. INSERTS a row into payments table
--     6. Returns jsonb with success + new state
--
-- GRANTS: SECURITY DEFINER + GRANT EXECUTE to authenticated, anon
--   (same pattern as reconcile_balance_payment)

-- -------------------------------------------------------------------------
-- Payments audit table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount        NUMERIC NOT NULL CHECK (amount > 0),
    proof_url     TEXT,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes         TEXT,
    admin_id      UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE payments IS
    'Audit log of every partial or full balance payment recorded against an order. One row per payment. Linked to orders.id.';

COMMENT ON COLUMN payments.order_id IS 'The orders.id this payment was applied to.';
COMMENT ON COLUMN payments.amount IS 'Dollar amount of this payment (must be > 0 and <= the order balance_due at time of recording).';
COMMENT ON COLUMN payments.proof_url IS 'Optional URL to a receipt screenshot or proof image (Supabase Storage or Imgur).';
COMMENT ON COLUMN payments.payment_method IS 'How the payment was made. Default cash for in-person payments.';
COMMENT ON COLUMN payments.admin_id IS 'UUID of the admin who recorded the payment (from auth.users).';

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Enable RLS — only service_role can write (via SECURITY DEFINER RPC)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- RPC: record_partial_payment
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_partial_payment(
    p_order_id     TEXT,
    p_amount       NUMERIC,
    p_proof_url    TEXT DEFAULT NULL,
    p_notes        TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'cash',
    p_admin_id     UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order          orders%ROWTYPE;
    v_new_paid       numeric;
    v_new_balance    numeric;
    v_is_full        boolean;
    v_payment_id     uuid;
    v_user_id        uuid;
BEGIN
    -- Lock the order row
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found: ' || p_order_id);
    END IF;

    -- Guards
    IF v_order.balance_due IS NULL OR v_order.balance_due <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No balance due on this order.',
            'current_paid_amount', v_order.paid_amount,
            'current_balance_due', COALESCE(v_order.balance_due, 0)
        );
    END IF;

    IF v_order.payment_status IS DISTINCT FROM 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order is not pending (current: ' || COALESCE(v_order.payment_status, 'null') || ').',
            'current_paid_amount', v_order.paid_amount,
            'current_balance_due', COALESCE(v_order.balance_due, 0)
        );
    END IF;

    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be greater than zero.');
    END IF;

    IF p_amount > v_order.balance_due THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Payment amount ($' || p_amount || ') exceeds balance due ($' || v_order.balance_due || ').',
            'current_balance_due', v_order.balance_due
        );
    END IF;

    -- Compute new state
    v_new_paid    := COALESCE(v_order.paid_amount, 0) + p_amount;
    v_new_balance := v_order.balance_due - p_amount;
    v_is_full     := (v_new_balance <= 0);
    v_user_id     := v_order.user_id;

    -- Update the order row
    IF v_is_full THEN
        UPDATE orders
        SET
            paid_amount    = total,
            balance_due    = 0,
            payment_status = 'paid',
            paid_at        = now()
        WHERE id = p_order_id;

        -- Increment profile lifetime spend (only the newly-paid portion)
        IF v_user_id IS NOT NULL THEN
            INSERT INTO profiles (id, user_id, lifetime_spend_usd)
            VALUES (v_user_id, v_user_id, p_amount)
            ON CONFLICT (id)
            DO UPDATE SET lifetime_spend_usd = profiles.lifetime_spend_usd + p_amount;
        END IF;
    ELSE
        UPDATE orders
        SET
            paid_amount = v_new_paid,
            balance_due = v_new_balance
        WHERE id = p_order_id;
    END IF;

    -- Write audit row
    INSERT INTO payments (order_id, amount, proof_url, payment_method, notes, admin_id)
    VALUES (p_order_id, p_amount, p_proof_url, p_payment_method, p_notes, COALESCE(p_admin_id, auth.uid()))
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'amount_recorded', p_amount,
        'new_paid_amount', CASE WHEN v_is_full THEN v_order.total ELSE v_new_paid END,
        'new_balance_due', CASE WHEN v_is_full THEN 0 ELSE v_new_balance END,
        'fully_reconciled', v_is_full,
        'order_id', p_order_id
    );
END;
$$;

COMMENT ON FUNCTION record_partial_payment(TEXT, NUMERIC, TEXT, TEXT, TEXT) IS
    'Records a payment against a pending partial-deposit order. Supports incremental payments (p_amount < balance_due) and final payments (p_amount = balance_due, which flips the order to paid + updates profiles.lifetime_spend_usd). Writes an audit row to the payments table. SECURITY DEFINER.';

GRANT EXECUTE ON FUNCTION record_partial_payment(TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_partial_payment(TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID) TO anon;
