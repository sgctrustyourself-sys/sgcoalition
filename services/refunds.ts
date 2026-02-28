import { supabase } from './supabase';
import { ConsentData } from './consentTracking';

export interface RefundException {
    id: string;
    orderId: string;
    adminId: string;
    adminWalletAddress?: string;
    reason: string;
    refundAmount: number;
    processed: boolean;
    processedAt?: string;
    createdAt: string;
}

export interface RefundValidationResult {
    allowed: boolean;
    reason: string;
}

/**
 * Validate if a refund can be processed for an order
 */
export async function validateRefundRequest(orderId: string): Promise<RefundValidationResult> {
    try {
        // Call the database function to check refund eligibility
        const { data, error } = await supabase
            .rpc('can_process_refund', { p_order_id: orderId });

        if (error) {
            console.error('Error validating refund:', error);
            return {
                allowed: false,
                reason: 'Error validating refund request'
            };
        }

        if (data && data.length > 0) {
            return {
                allowed: data[0].allowed,
                reason: data[0].reason
            };
        }

        return {
            allowed: true,
            reason: 'No consent on record'
        };
    } catch (error) {
        console.error('Exception validating refund:', error);
        return {
            allowed: false,
            reason: 'System error validating refund'
        };
    }
}

/**
 * Create a refund exception (admin override)
 */
export async function createRefundException(
    orderId: string,
    adminId: string,
    adminWalletAddress: string,
    reason: string,
    refundAmount: number
): Promise<RefundException> {
    const { data, error } = await supabase
        .from('refund_exceptions')
        .insert([{
            order_id: orderId,
            admin_id: adminId,
            admin_wallet_address: adminWalletAddress,
            reason,
            refund_amount: refundAmount,
            processed: false
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating refund exception:', error);
        throw new Error('Failed to create refund exception');
    }

    return {
        id: data.id,
        orderId: data.order_id,
        adminId: data.admin_id,
        adminWalletAddress: data.admin_wallet_address,
        reason: data.reason,
        refundAmount: data.refund_amount,
        processed: data.processed,
        processedAt: data.processed_at,
        createdAt: data.created_at
    };
}

/**
 * Get all refund exceptions for an order
 */
export async function getRefundExceptions(orderId: string): Promise<RefundException[]> {
    const { data, error } = await supabase
        .from('refund_exceptions')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching refund exceptions:', error);
        return [];
    }

    return data.map(item => ({
        id: item.id,
        orderId: item.order_id,
        adminId: item.admin_id,
        adminWalletAddress: item.admin_wallet_address,
        reason: item.reason,
        refundAmount: item.refund_amount,
        processed: item.processed,
        processedAt: item.processed_at,
        createdAt: item.created_at
    }));
}

/**
 * Mark refund exception as processed
 */
export async function markExceptionProcessed(exceptionId: string): Promise<void> {
    const { error } = await supabase
        .from('refund_exceptions')
        .update({
            processed: true,
            processed_at: new Date().toISOString()
        })
        .eq('id', exceptionId);

    if (error) {
        console.error('Error marking exception as processed:', error);
        throw new Error('Failed to mark exception as processed');
    }
}

/**
 * Block refund with reason
 */
export function blockRefund(reason: string): never {
    throw new Error(`Refund Blocked: ${reason}`);
}

/**
 * Process refund (placeholder - integrate with actual payment processor)
 */
export async function processRefund(orderId: string, amount: number): Promise<void> {
    // Validate refund first
    const validation = await validateRefundRequest(orderId);

    if (!validation.allowed) {
        blockRefund(validation.reason);
    }

    // TODO: Integrate with Stripe or payment processor
    console.log(`Processing refund for order ${orderId}: $${amount}`);

    // This would call Stripe refund API:
    // const refund = await stripe.refunds.create({
    //     payment_intent: paymentIntentId,
    //     amount: Math.round(amount * 100)
    // });
}
