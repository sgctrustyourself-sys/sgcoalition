import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    type ApiRequest,
    type ApiResponse,
    type CreateOrderBody,
    type UpdateOrderBody,
    type OrderRow,
    type PayPalVerification,
} from '../_types.js';
import {
    createHttpError,
    parseBody,
    setCorsHeaders,
} from '../_helpers.js';
import {
    acceptCheckout,
    type CheckoutAttempt,
    type PaymentEvidence,
    HttpError,
} from '../../services/orderIntake.js';

// ---------------------------------------------------------------------------
// Admin helpers (unchanged — GET/PATCH for admin dashboard)
// ---------------------------------------------------------------------------

function getSupabaseAdmin(): SupabaseClient {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) throw createHttpError(503, 'Supabase order service is not configured.');
    return createClient(url, key);
}

async function isAdminRequest(req: ApiRequest): Promise<boolean> {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    const token = match?.[1] || null;
    if (!token) return false;
    const staticToken = process.env.ADMIN_API_TOKEN;
    if (staticToken && token === staticToken) return true;
    try {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
        if (!url || !anonKey) return false;
        const authClient = createClient(url, anonKey);
        const adminClient = getSupabaseAdmin();
        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        const userId = userData?.user?.id;
        if (userError || !userId) return false;
        const { data, error } = await adminClient.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
        return !error && Boolean(data);
    } catch { return false; }
}

// ---------------------------------------------------------------------------
// Thin createOrder adapter — delegates to Order intake module
// ---------------------------------------------------------------------------

function buildPaymentEvidence(order: Record<string, unknown>, verification: PayPalVerification | undefined): PaymentEvidence {
    const method = String(order.paymentMethod || order.payment_method || '').toLowerCase();
    if (method === 'paypal') {
        const pid = String(verification?.paypalOrderId || order.paypalOrderId || '').trim();
        const cid = String(verification?.paypalCaptureId || order.paymentReference || '').trim();
        const refId = String(order.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
        return { method: 'paypal', paypalOrderId: pid, paypalCaptureId: cid, referenceId: refId };
    }
    if (method === 'stripe') {
        const pi = String(order.paymentReference || order.payment_reference || '').trim();
        return { method: 'stripe', paymentIntentId: pi };
    }
    return { method: method as 'crypto' | 'store_credit' };
}

async function createOrder(req: ApiRequest): Promise<OrderRow | null> {
    const body = parseBody(req) as CreateOrderBody;
    const orderInput = body.order;
    if (!orderInput) throw createHttpError(400, 'Order is required.');

    const method = String(orderInput.paymentMethod || orderInput.payment_method || '').toLowerCase();
    const items = (orderInput.items || []).map((i: any) => ({
        productId: i.productId || i.product_id || i.name || '',
        selectedSize: i.selectedSize || i.size || 'One Size',
        quantity: Math.max(1, Number(i.quantity || 1)),
        keychainClipOn: Boolean(i.keychainClipOn || i.keychain_clip_on),
    }));

    const shippingAddr = orderInput.shippingAddress || orderInput.shipping_address || orderInput.shippingInfo || {};

    const attempt: CheckoutAttempt = {
        items,
        clientSubtotal: Number(orderInput.subtotal || 0),
        clientDiscount: Number(orderInput.discount || 0),
        clientTotal: Number(orderInput.total || 0),
        shippingDollars: (shippingAddr as any)?.shippingCost || orderInput.shippingCost || 0,
        shippingMethod: (shippingAddr as any)?.shippingMethod || orderInput.shippingMethod || 'standard',
        paymentEvidence: buildPaymentEvidence(orderInput as Record<string, unknown>, body.verification),
        orderId: (orderInput.id || orderInput.order_id) as string | undefined,
        orderNumber: (orderInput.orderNumber || orderInput.order_number) as string | undefined,
        userId: orderInput.userId || orderInput.user_id || null,
        customerName: String(orderInput.customerName || orderInput.customer_name || 'Customer'),
        customerEmail: String(orderInput.customerEmail || orderInput.customer_email || ''),
        customerPhone: String(orderInput.customerPhone || orderInput.customer_phone || ''),
        isGuest: Boolean(orderInput.isGuest ?? orderInput.is_guest ?? !orderInput.userId),
        shippingAddress: shippingAddr as Record<string, unknown> | null,
        sgCoinReward: Number(orderInput.sgCoinReward || orderInput.sg_coin_reward || 0),
        notes: orderInput.notes || '',
        facebookUsername: (orderInput as any).facebookUsername || (orderInput as any).facebook_username || null,
    };

    // For crypto/store_credit: shipping address needs Method + Cost
    if (method === 'crypto' || method === 'store_credit') {
        (attempt.shippingAddress as any) = {
            ...(attempt.shippingAddress as any || {}),
            shippingMethod: attempt.shippingMethod,
            shippingCost: attempt.shippingDollars,
        };
    }

    try {
        const result = await acceptCheckout(attempt);
        return result.order;
    } catch (error: unknown) {
        if (error instanceof HttpError) throw createHttpError(error.status, error.message);
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Admin list / update (unchanged)
// ---------------------------------------------------------------------------

async function listOrders(req: ApiRequest) {
    if (!(await isAdminRequest(req))) throw createHttpError(401, 'Admin authorization required.');
    const { data, error } = await getSupabaseAdmin().from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw createHttpError(500, error.message || 'Failed to fetch orders.');
    return (data as OrderRow[] | null) || [];
}

async function updateOrder(req: ApiRequest) {
    if (!(await isAdminRequest(req))) throw createHttpError(401, 'Admin authorization required.');
    const body = parseBody(req) as UpdateOrderBody;
    const id = String(body.id || '').trim();
    if (!id || !body.updates) throw createHttpError(400, 'Order ID and updates are required.');
    const { data, error } = await getSupabaseAdmin().from('orders').update(body.updates).eq('id', id).select().single();
    if (error) throw createHttpError(500, error.message || 'Failed to update order.');
    return data;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    try {
        if (req.method === 'POST') { res.status(200).json(await createOrder(req)); return; }
        if (req.method === 'GET') { res.status(200).json(await listOrders(req)); return; }
        if (req.method === 'PATCH') { res.status(200).json(await updateOrder(req)); return; }
        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[Order API]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Order request failed.' });
    }
}
