-- ═══════════════════════════════════════════════════════════════════════════
-- record_partial_payment — fix + proof, one paste, nothing persists
--
-- Supabase Dashboard → SQL Editor → paste this ENTIRE file → Run (⌘/Ctrl+Enter).
--
-- Part A re-creates the function with the broken profiles upsert fixed:
--   INSERT INTO profiles (id, user_id, ...)  →  INSERT INTO profiles (id, lifetime_spend_usd)
-- (the live profiles table is keyed by id alone and has NO user_id column;
--  the old form failed with `column "user_id" of relation "profiles" does not
--  exist` the moment an admin recorded a partial payment).
-- It is CREATE OR REPLACE — idempotent, preserves existing grants, and the
-- function body is byte-identical to supabase/migrations/20260730_create_payments_table.sql.
--
-- Part B proves it: a synthetic pending deposit order inside BEGIN…ROLLBACK
-- exercises the exact profiles upsert that used to fail, flips the order to
-- paid, credits the profile and writes the payments ledger row — then rolls
-- ALL of it back. Nothing in Part B survives the run.
-- Expected: steps 1–6 all report as labeled, step 6 shows everything undone.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── PART A: the fixed function ────────────────────
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

        -- Increment profile lifetime spend (only the newly-paid portion).
        -- Columns mirror reconcile_balance_payment exactly: the live
        -- profiles table is keyed by id alone and has NO user_id column —
        -- this INSERT originally carried (id, user_id, lifetime_spend_usd)
        -- and failed at runtime with `column "user_id" of relation
        -- "profiles" does not exist`, which silently broke every admin
        -- partial-payment record until it was caught on 2026-10-03.
        IF v_user_id IS NOT NULL THEN
            INSERT INTO profiles (id, lifetime_spend_usd)
            VALUES (v_user_id, p_amount)
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

-- ─────────────────────── PART B: proof, then rollback ──────────────────────
BEGIN;

SELECT '1 before — profile lifetime_spend (expect 10)' AS step,
       lifetime_spend_usd AS value
  FROM profiles
 WHERE id = 'fb078e4d-3aae-4efc-8999-7c8625427459';

-- Synthetic pending deposit: $30 in, $10 balance owed — the exact shape the
-- admin partial-payment modal records against.
INSERT INTO orders (
    id, order_number, user_id, is_guest,
    customer_name, customer_email, customer_phone,
    items, subtotal, tax, discount, total, total_amount,
    payment_method, payment_status, order_type,
    shipping_address, shipping_info, notes,
    created_at, sg_coin_reward, paid_amount, balance_due
) VALUES (
    'rpc-selftest-rollback-20261003', 'RPC-SELFTEST-ROLLBACK',
    'fb078e4d-3aae-4efc-8999-7c8625427459', false,
    'RPC Self-Test', 'rpc-selftest@example.test', '',
    '[{"productId":"rpc-selftest","productName":"RPC Self-Test","productImage":"","selectedSize":"One Size","quantity":1,"price":40,"total":40,"name":"RPC Self-Test","size":"One Size"}]',
    40, 0, 0, 40, 40,
    'cash', 'pending', 'online',
    '{"name":"RPC Self-Test","line1":"1 Self-Test St","city":"York","state":"PA","zip":"17404"}',
    '{"name":"RPC Self-Test","line1":"1 Self-Test St","city":"York","state":"PA","zip":"17404"}',
    'Rollback self-test for record_partial_payment — never a real order.',
    now(), 0, 30, 10
);

SELECT '2 rpc (expect success=true, fully_reconciled=true — this is the line that used to throw)' AS step,
       record_partial_payment('rpc-selftest-rollback-20261003', 10, null, 'rollback self-test', 'cash') AS result;

SELECT '3 order after (expect paid / 40 / 0 / paid_at set)' AS step,
       payment_status, paid_amount, balance_due, (paid_at IS NOT NULL) AS paid_at_set
  FROM orders
 WHERE id = 'rpc-selftest-rollback-20261003';

SELECT '4 profile after (expect 10 more than step 1)' AS step,
       lifetime_spend_usd AS value
  FROM profiles
 WHERE id = 'fb078e4d-3aae-4efc-8999-7c8625427459';

SELECT '5 payments ledger (expect 1)' AS step,
       count(*) AS rows
  FROM payments
 WHERE order_id = 'rpc-selftest-rollback-20261003';

ROLLBACK;

SELECT '6 after rollback (expect order 0, ledger 0, spend back to step 1)' AS step,
       (SELECT count(*) FROM orders WHERE id = 'rpc-selftest-rollback-20261003') AS order_rows,
       (SELECT count(*) FROM payments WHERE order_id = 'rpc-selftest-rollback-20261003') AS ledger_rows,
       (SELECT lifetime_spend_usd FROM profiles WHERE id = 'fb078e4d-3aae-4efc-8999-7c8625427459') AS lifetime_spend;
