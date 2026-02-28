import { supabase } from './supabase';

export interface PurchaseRequest {
    id: string;
    userId?: string;
    email: string;
    walletAddress: string;
    amount: number;
    paymentMethod: string;
    proofUrl?: string;
    notes?: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    adminId?: string;
    adminWalletAddress?: string;
    createdAt: string;
    updatedAt: string;
    processedAt?: string;
}

export interface PurchaseRequestStats {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    totalAmountRequested: number;
    totalAmountApproved: number;
}

/**
 * Submit a new SGCoin purchase request
 */
export async function submitPurchaseRequest(data: {
    email: string;
    walletAddress: string;
    amount: number;
    paymentMethod: string;
    proofUrl?: string;
    notes?: string;
    userId?: string;
}): Promise<PurchaseRequest> {
    const { data: request, error } = await supabase
        .from('sgcoin_purchase_requests')
        .insert([{
            user_id: data.userId,
            email: data.email,
            wallet_address: data.walletAddress,
            amount: data.amount,
            payment_method: data.paymentMethod,
            proof_url: data.proofUrl,
            notes: data.notes,
            status: 'pending'
        }])
        .select()
        .single();

    if (error) {
        console.error('Error submitting purchase request:', error);
        throw new Error('Failed to submit purchase request');
    }

    return mapToRequest(request);
}

/**
 * Get all purchase requests (admin)
 */
export async function getAllPurchaseRequests(status?: 'pending' | 'approved' | 'rejected'): Promise<PurchaseRequest[]> {
    let query = supabase
        .from('sgcoin_purchase_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching purchase requests:', error);
        return [];
    }

    return data.map(mapToRequest);
}

/**
 * Get user's purchase requests
 */
export async function getUserPurchaseRequests(userId: string): Promise<PurchaseRequest[]> {
    const { data, error } = await supabase
        .from('sgcoin_purchase_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user purchase requests:', error);
        return [];
    }

    return data.map(mapToRequest);
}

/**
 * Get purchase request by ID
 */
export async function getPurchaseRequestById(id: string): Promise<PurchaseRequest | null> {
    const { data, error } = await supabase
        .from('sgcoin_purchase_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching purchase request:', error);
        return null;
    }

    return mapToRequest(data);
}

/**
 * Approve purchase request
 */
export async function approvePurchaseRequest(
    requestId: string,
    adminId: string,
    adminWalletAddress: string
): Promise<boolean> {
    const { data, error } = await supabase
        .rpc('approve_sgcoin_request', {
            p_request_id: requestId,
            p_admin_id: adminId,
            p_admin_wallet: adminWalletAddress
        });

    if (error) {
        console.error('Error approving request:', error);
        throw new Error('Failed to approve request');
    }

    return data;
}

/**
 * Reject purchase request
 */
export async function rejectPurchaseRequest(
    requestId: string,
    adminId: string,
    adminWalletAddress: string,
    reason: string
): Promise<boolean> {
    const { data, error } = await supabase
        .rpc('reject_sgcoin_request', {
            p_request_id: requestId,
            p_admin_id: adminId,
            p_admin_wallet: adminWalletAddress,
            p_reason: reason
        });

    if (error) {
        console.error('Error rejecting request:', error);
        throw new Error('Failed to reject request');
    }

    return data;
}

/**
 * Get purchase request statistics
 */
export async function getPurchaseRequestStats(): Promise<PurchaseRequestStats> {
    const { data, error } = await supabase
        .rpc('get_sgcoin_request_stats');

    if (error) {
        console.error('Error fetching stats:', error);
        return {
            totalRequests: 0,
            pendingRequests: 0,
            approvedRequests: 0,
            rejectedRequests: 0,
            totalAmountRequested: 0,
            totalAmountApproved: 0
        };
    }

    if (data && data.length > 0) {
        const stats = data[0];
        return {
            totalRequests: stats.total_requests || 0,
            pendingRequests: stats.pending_requests || 0,
            approvedRequests: stats.approved_requests || 0,
            rejectedRequests: stats.rejected_requests || 0,
            totalAmountRequested: parseFloat(stats.total_amount_requested) || 0,
            totalAmountApproved: parseFloat(stats.total_amount_approved) || 0
        };
    }

    return {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
        totalAmountRequested: 0,
        totalAmountApproved: 0
    };
}

/**
 * Delete purchase request (admin only)
 */
export async function deletePurchaseRequest(requestId: string): Promise<void> {
    const { error } = await supabase
        .from('sgcoin_purchase_requests')
        .delete()
        .eq('id', requestId);

    if (error) {
        console.error('Error deleting request:', error);
        throw new Error('Failed to delete request');
    }
}

/**
 * Map database record to PurchaseRequest
 */
function mapToRequest(data: any): PurchaseRequest {
    return {
        id: data.id,
        userId: data.user_id,
        email: data.email,
        walletAddress: data.wallet_address,
        amount: parseFloat(data.amount),
        paymentMethod: data.payment_method,
        proofUrl: data.proof_url,
        notes: data.notes,
        status: data.status,
        rejectionReason: data.rejection_reason,
        adminId: data.admin_id,
        adminWalletAddress: data.admin_wallet_address,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        processedAt: data.processed_at
    };
}
