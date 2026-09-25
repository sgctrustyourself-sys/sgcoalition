// services/reconcilePayment.ts
//
// Calls the reconcile_balance_payment SECURITY DEFINER RPC on the Supabase
// orders table. Only works with service_role credentials (the admin panel
// uses the service_role client, or the call is routed through a /api handler).
//
// The RPC atomically:
//   1. Flips paid_amount = total, balance_due = 0
//   2. Sets payment_status = 'paid', paid_at = now()
//   3. Increments profiles.lifetime_spend_usd by the balance amount
//
// Returns the RPC response (success + metadata) or throws on error.

import { supabase } from './supabase.js';

export interface ReconcileBalanceResult {
    success: boolean;
    error?: string;
    balance_paid?: number;
    new_total_paid?: number;
    user_id?: string;
    order_id?: string;
    current_paid_amount?: number;
    current_balance_due?: number;
}

export async function reconcileBalancePayment(orderId: string): Promise<ReconcileBalanceResult> {
    const { data, error } = await supabase.rpc('reconcile_balance_payment', {
        p_order_id: orderId,
    });

    if (error) {
        console.error('[reconcilePayment] RPC error:', error);
        return {
            success: false,
            error: error.message || 'RPC call failed. The function may not be deployed yet — run the migration first.',
        };
    }

    // The RPC returns jsonb, which supabase-js deserializes to a plain object.
    const result = data as ReconcileBalanceResult;

    if (!result.success) {
        console.warn('[reconcilePayment] RPC returned failure:', result.error);
    }

    return result;
}

// ---------------------------------------------------------------------------
// recordPartialPayment — calls the record_partial_payment RPC
// ---------------------------------------------------------------------------

export interface RecordPartialPaymentResult {
    success: boolean;
    error?: string;
    payment_id?: string;
    amount_recorded?: number;
    new_paid_amount?: number;
    new_balance_due?: number;
    fully_reconciled?: boolean;
    order_id?: string;
    current_paid_amount?: number;
    current_balance_due?: number;
}

/**
 * Record a partial or full-balance payment against a pending deposit order.
 * Supports incremental payments (amount < balance_due) and final payments
 * (amount = balance_due, which flips the order to paid + updates profile).
 * Writes an audit row to the payments table.
 */
export async function recordPartialPayment(
    orderId: string,
    amount: number,
    proofUrl: string | null = null,
    notes: string | null = null,
    paymentMethod: string = 'cash',
): Promise<RecordPartialPaymentResult> {
    const { data, error } = await supabase.rpc('record_partial_payment', {
        p_order_id: orderId,
        p_amount: amount,
        p_proof_url: proofUrl,
        p_notes: notes,
        p_payment_method: paymentMethod,
    });

    if (error) {
        console.error('[reconcilePayment] record_partial_payment RPC error:', error);
        return {
            success: false,
            error: error.message || 'RPC call failed. The function may not be deployed yet.',
        };
    }

    const result = data as RecordPartialPaymentResult;

    if (!result.success) {
        console.warn('[reconcilePayment] record_partial_payment returned failure:', result.error);
    }

    return result;
}
