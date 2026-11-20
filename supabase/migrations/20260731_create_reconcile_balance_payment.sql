-- supabase/migrations/20260730_create_reconcile_balance_payment.sql
--
-- Creates the reconcile_balance_payment RPC function so admins can
-- atomically close a partial-deposit order.

CREATE OR REPLACE FUNCTION reconcile_balance_payment(p_order_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order          orders%ROWTYPE;
    v_balance_paid   numeric;
    v_user_id        uuid;
BEGIN
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found: ' || p_order_id
        );
    END IF;

    IF v_order.balance_due IS NULL OR v_order.balance_due <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No balance due on this order - already fully paid or not a partial-deposit order.',
            'current_paid_amount', v_order.paid_amount,
            'current_balance_due', COALESCE(v_order.balance_due, 0)
        );
    END IF;

    IF v_order.payment_status IS DISTINCT FROM 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order is not in pending status (current: ' || COALESCE(v_order.payment_status, 'null') || '). Manual review required.',
            'current_paid_amount', v_order.paid_amount,
            'current_balance_due', COALESCE(v_order.balance_due, 0)
        );
    END IF;

    v_balance_paid := v_order.balance_due;
    v_user_id := v_order.user_id;

    UPDATE orders
    SET
        paid_amount    = total,
        balance_due    = 0,
        payment_status = 'paid',
        paid_at        = now()
    WHERE id = p_order_id;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO profiles (id, lifetime_spend_usd)
        VALUES (v_user_id, v_balance_paid)
        ON CONFLICT (id)
        DO UPDATE SET lifetime_spend_usd = profiles.lifetime_spend_usd + v_balance_paid;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'balance_paid', v_balance_paid,
        'new_total_paid', v_order.total,
        'user_id', v_user_id,
        'order_id', p_order_id
    );
END;
$$;

COMMENT ON FUNCTION reconcile_balance_payment(TEXT) IS
    'Atomically reconciles a partial-deposit order: flips paid_amount->total, balance_due->0, payment_status->paid, paid_at->now, AND increments profiles.lifetime_spend_usd by the balance_due amount. SECURITY DEFINER - requires service_role.';

-- Grant execute to authenticated role so the admin panel (which uses the
-- anon-key Supabase client) can call this SECURITY DEFINER function.
-- The SECURITY DEFINER attribute means the function executes with the
-- owner's privileges regardless of caller identity, but the caller still
-- needs EXECUTE permission to invoke it in the first place.
GRANT EXECUTE ON FUNCTION reconcile_balance_payment(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reconcile_balance_payment(TEXT) TO anon;
