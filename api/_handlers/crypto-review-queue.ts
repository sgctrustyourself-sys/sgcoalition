// api/_handlers/crypto-review-queue.ts
// Server-side endpoint to list orders with pending crypto (USDC) status.
// Returns underpaid and awaiting orders for the admin review queue.
// GET /api/crypto-review-queue?status=underpaid|awaited (optional)
// Returns: order id, order_number, total, crypto_status, crypto_tx_hash,
// crypto_expected_usdc, received amount (from notes), and Polygonscan link.
// Idempotent: safe to poll; only returns orders not yet paid.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, parseBody, setCorsHeaders } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }
    return createClient(supabaseUrl, serviceRoleKey);
}

async function loadOrder(supabase: SupabaseClient, orderRef: string): Promise<any> {
    const ref = String(orderRef || '').trim();
    if (!ref) return null;
    // Try by id first, then by order_number
    const byId = await supabase.from('orders').select('*').eq('id', ref).maybeSingle();
    if (byId.error) throw createHttpError(500, byId.error.message || 'Order lookup failed.');
    if (byId.data) return byId.data as any;
    const byNumber = await supabase.from('orders').select('*').eq('order_number', ref).maybeSingle();
    if (byNumber.error) throw createHttpError(500, byNumber.error.message || 'Order lookup failed.');
    return (byNumber.data as any) || null;
}

function formatTxHash(txHash: string | null): string {
    if (!txHash) return '—';
    if (txHash.length === 66 && txHash.startsWith('0x')) {
        return txHash;
    }
    return '0x' + txHash.padStart(64, '0');
}

function extractReceivedUsdcFromNotes(notes: string | null): string {
    if (!notes) return '—';
    // Look for pattern: "Crypto confirmed: X.XX USDC" or "Crypto underpaid: ..."
    const confirmedMatch = notes.match(/Crypto confirmed: ([0-9.]+) USDC/);
    if (confirmedMatch) return confirmedMatch[1];
    const underpaidMatch = notes.match(/Crypto underpaid: received ([0-9.]+) of/);
    if (underpaidMatch) return underpaidMatch[1];
    // Try any number followed by USDC
    const anyMatch = notes.match(/([0-9.]+)\s+USDC/);
    if (anyMatch) return anyMatch[1];
    return '—';
}

function polygonscanLink(txHash: string | null): string {
    if (!txHash) return '—';
    // PolygonScan link for native USDC on Polygon (contract: 0x...)
    return `https://polygonscan.com/tx/${txHash}`;
}

export default withAdminAuth(async (req: ApiRequest, res: ApiResponse): Promise<void> => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const supabase = getSupabaseAdmin();
        const { status } = req.query;

        // Build query to find orders with crypto status that is not 'paid'
        // We need to check both crypto_status column and notes for markers
        let query = supabase.from('orders').select(`
            id,
            order_number,
            total,
            payment_method,
            payment_status,
            crypto_status,
            crypto_tx_hash,
            crypto_expected_usdc,
            notes
        `).not('payment_status', 'eq', 'paid');

        // Filter by requested status if provided
        if (status === 'underpaid') {
            // Check crypto_status column = 'underpaid'
            query = query.eq('crypto_status', 'underpaid');
        } else if (status === 'awaiting') {
            // Orders with crypto submitted status - either crypto_status = 'submitted'
            // or notes contain 'crypto submitted' pattern
            // We'll fetch all non-paid crypto orders and filter client-side,
            // or we can check notes for 'submitted' pattern
            query = query.or('crypto_status.eq.submitted,notes.contains.crypto_submitted');
        } else {
            // No status filter - return all non-paid crypto orders
        }

        const { data, error } = await query;
        if (error) throw createHttpError(500, error.message || 'Failed to load crypto review queue.');

        if (!data || data.length === 0) {
            res.status(200).json({ orders: [] });
            return;
        }

        // Transform orders for the review queue UI
        const orders = data.map((order: any) => {
            const receivedUsdc = extractReceivedUsdcFromNotes(order.notes || '');
            return {
                id: order.id,
                orderNumber: order.order_number,
                total: Number(order.total || 0).toFixed(2),
                cryptoStatus: order.crypto_status || 'submitted',
                txHash: formatTxHash(order.crypto_tx_hash),
                expectedUsdc: order.crypto_expected_usdc ? Number(order.crypto_expected_usdc).toFixed(2) : '—',
                receivedUsdc,
                merchantAddress: order.crypto_merchant_address || '—',
                polygonscanLink: polygonscanLink(order.crypto_tx_hash),
                notes: order.notes ? order.notes.substring(0, 100) + (order.notes.length > 100 ? '...' : '') : '—',
                // Determine display status
                displayStatus: order.crypto_status === 'underpaid' ? 'Underpaid' :
                              order.crypto_status === 'confirmed' ? 'Confirmed' :
                              order.crypto_status === 'submitted' ? 'Awaiting' :
                              'Awaiting',
                // Check if there's a tx hash for Polygonscan link
                hasTxHash: !!order.crypto_tx_hash,
            };
        });

        res.status(200).json({ orders });
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[crypto-review-queue]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Crypto review queue request failed.' });
    }
});