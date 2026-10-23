// services/payoutRequest.ts
//
// SGCoin PAYOUT (withdrawal) request service.
//
// Customer-initiated: opt-in withdrawal of earned SGCoin as Polygon-network
// crypto (admin sends on-chain after review). DEFAULT behavior is for SGCoin
// to stay on the SGCoalition server as a store-discount credit; this
// service handles only the rare manual-payout path.
//
// Lifecycle: Pending -> Approved -> Completed, with a Rejected fork from
// Pending or Approved. The on-chain balance decrement happens AT APPROVAL
// (not at submit) so the customer keeps earning discount credit on the
// amount while Pending. If the request is Rejected after Approval, the
// decrement is automatically refunded via the reject_payout_request RPC.
//
// All state transitions go through SECURITY DEFINER Postgres RPCs so the
// balance decrement + status update happen in a single transaction and
// can't be split by the client. Customer-side RLS still allows the user
// to SELECT their own requests + INSERT a new pending request.

import { supabase } from './supabase.js';

export interface PayoutRequest {
    id: string;
    userId?: string;
    email: string;
    walletAddress: string;
    amount: number;
    status: 'pending' | 'approved' | 'completed' | 'rejected';
    txHash?: string;
    rejectionReason?: string;
    adminId?: string;
    adminNotes?: string;
    createdAt: string;
    updatedAt: string;
    processedAt?: string;
}

export interface PayoutRequestStats {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    completedRequests: number;
    rejectedRequests: number;
    totalAmountRequested: number;
    totalAmountCompleted: number;
}

/** Minimum payout expressed as SGCoin (whole-number units). */
export const MIN_PAYOUT_SGC = 5000;

/**
 * Submit a new payout request (customer-initiated).
 *
 * Validates the minimum + that the customer is authenticated. The RPC
 * does NOT decrement sg_coin_balance yet -- that happens at admin approval.
 */
export async function submitPayoutRequest(data: {
    email: string;
    walletAddress: string;
    amount: number;
}): Promise<PayoutRequest> {
    if (data.amount < MIN_PAYOUT_SGC) {
        throw new Error(`Minimum payout is ${MIN_PAYOUT_SGC.toLocaleString()} SGCoin.`);
    }
    const { data: newId, error } = await supabase.rpc('submit_payout_request', {
        p_email: data.email,
        p_wallet_address: data.walletAddress,
        p_amount: data.amount,
    });

    if (error) {
        console.error('Error submitting payout request:', error);
        throw new Error(error.message || 'Failed to submit payout request');
    }

    const created = await getPayoutRequestById(newId as string);
    if (!created) throw new Error('Payout request submitted but could not be re-fetched');
    return created;
}

/** Admin: get every payout request (optional status filter). */
export async function getAllPayoutRequests(
    status?: PayoutRequest['status'],
): Promise<PayoutRequest[]> {
    let query = supabase
        .from('sgcoin_payout_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching payout requests:', error);
        return [];
    }
    return (data || []).map(mapToRequest);
}

/** Customer: get own payout requests. */
export async function getUserPayoutRequests(userId: string): Promise<PayoutRequest[]> {
    const { data, error } = await supabase
        .from('sgcoin_payout_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user payout requests:', error);
        return [];
    }
    return (data || []).map(mapToRequest);
}

/** Single payout request by ID. */
export async function getPayoutRequestById(id: string): Promise<PayoutRequest | null> {
    const { data, error } = await supabase
        .from('sgcoin_payout_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return null;
    return data ? mapToRequest(data) : null;
}

/** Admin: Pending -> Approved (atomic balance decrement via RPC). */
export async function approvePayoutRequest(
    requestId: string, adminId: string,
): Promise<boolean> {
    const { data, error } = await supabase.rpc('approve_payout_request', {
        p_request_id: requestId, p_admin_id: adminId,
    });
    if (error) throw new Error(error.message || 'Failed to approve payout request');
    return Boolean(data);
}

/** Admin: Approved -> Completed (records on-chain tx_hash). */
export async function completePayoutRequest(
    requestId: string, adminId: string, txHash: string, adminNotes?: string,
): Promise<boolean> {
    const { data, error } = await supabase.rpc('complete_payout_request', {
        p_request_id: requestId,
        p_admin_id: adminId,
        p_tx_hash: txHash,
        p_admin_notes: adminNotes ?? null,
    });
    if (error) throw new Error(error.message || 'Failed to complete payout request');
    return Boolean(data);
}

/** Admin: Pending|Approved -> Rejected (auto-refund from Approved). */
export async function rejectPayoutRequest(
    requestId: string, adminId: string, reason: string,
): Promise<boolean> {
    const { data, error } = await supabase.rpc('reject_payout_request', {
        p_request_id: requestId, p_admin_id: adminId, p_reason: reason,
    });
    if (error) throw new Error(error.message || 'Failed to reject payout request');
    return Boolean(data);
}

/** Admin: dashboard stats via Postgres aggregate. */
export async function getPayoutRequestStats(): Promise<PayoutRequestStats> {
    const { data, error } = await supabase.rpc('get_payout_request_stats');
    if (error) {
        return {
            totalRequests: 0, pendingRequests: 0, approvedRequests: 0,
            completedRequests: 0, rejectedRequests: 0,
            totalAmountRequested: 0, totalAmountCompleted: 0,
        };
    }
    if (data && Array.isArray(data) && data.length > 0) {
        const s = data[0];
        return {
            totalRequests: Number(s.total_requests ?? 0),
            pendingRequests: Number(s.pending_requests ?? 0),
            approvedRequests: Number(s.approved_requests ?? 0),
            completedRequests: Number(s.completed_requests ?? 0),
            rejectedRequests: Number(s.rejected_requests ?? 0),
            totalAmountRequested: Number(s.total_amount_requested ?? 0),
            totalAmountCompleted: Number(s.total_amount_completed ?? 0),
        };
    }
    return {
        totalRequests: 0, pendingRequests: 0, approvedRequests: 0,
        completedRequests: 0, rejectedRequests: 0,
        totalAmountRequested: 0, totalAmountCompleted: 0,
    };
}

/** Admin: hard delete (test cleanup). */
export async function deletePayoutRequest(requestId: string): Promise<void> {
    const { error } = await supabase
        .from('sgcoin_payout_requests')
        .delete()
        .eq('id', requestId);
    if (error) throw new Error('Failed to delete payout request');
}

/** snake_case DB row -> camelCase TS. Exported (not private) so other admin
 *  tooling (e.g. utils/customerProfile.ts buildCustomerProfile enrichment)
 *  can map without duplicating this 12-field block — single source of
 *  truth for the snake→camel mapping if the DB schema grows new columns. */
export function mapToRequest(row: any): PayoutRequest {
    return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        walletAddress: row.wallet_address,
        amount: Number(row.amount),
        status: row.status,
        txHash: row.tx_hash,
        rejectionReason: row.rejection_reason,
        adminId: row.admin_id,
        adminNotes: row.admin_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        processedAt: row.processed_at,
    };
}
