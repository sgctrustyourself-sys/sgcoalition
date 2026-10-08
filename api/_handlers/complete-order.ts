import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    type ApiRequest,
    type ApiResponse,
    type CreateOrderBody,
    type UpdateOrderBody,
    type OrderRow,
} from '../_types.js';
import {
    createHttpError,
    parseBody,
    setCorsHeaders,
} from '../_helpers.js';
// The admin gate for order listing/updating. api/_adminAuth.ts is the single
// owner of the credential policy (see its header). This used to be two inline
// `if (!(await isAdminRequest(req))) throw` checks inside the action functions;
// it is a wrapper now, so the gate cannot be skipped by a new action.
import { withAdminAuth } from '../_adminAuth.js';
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

// ---------------------------------------------------------------------------
// Thin createOrder adapter — delegates to Order intake module
// ---------------------------------------------------------------------------

const ORDER_ID_MAX = 100;

function normalizeOrderId(value: unknown): string | undefined {
    const id = String(value ?? '').trim();
    return id && id.length <= ORDER_ID_MAX ? id : undefined;
}

function buildPaymentEvidence(order: Record<string, unknown>): PaymentEvidence {
    const method = String(order.paymentMethod || order.payment_method || '').toLowerCase();
    if (method === 'stripe') {
        const pi = String(order.paymentReference || order.payment_reference || '').trim();
        return { method: 'stripe', paymentIntentId: pi };
    }
    return { method: method as 'crypto' | 'cashapp' | 'store_credit' };
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
        paymentEvidence: buildPaymentEvidence(orderInput as Record<string, unknown>),
        // The order id IS the checkout attempt id the server dedupes on, so it
        // arrives as unauthenticated client input: keep it a bounded trimmed
        // string and drop anything else (the server then mints its own id)
        // rather than letting a non-string become a row key and a query value.
        orderId: normalizeOrderId(orderInput.id ?? orderInput.order_id),
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
        couponCode: (orderInput as any).couponCode || (orderInput as any).coupon_code || null,
        // Store credit already applied + charged by create-payment-intent
        // (Stripe path). acceptCheckout re-verifies against the live profile
        // balance and debits the profile exactly once per order.
        serverCreditCents: Math.max(0, Math.round(Number((orderInput as any).storeCreditApplied || 0) * 100)),
    };

    // For crypto/cashapp/store_credit: shipping address needs Method + Cost
    if (method === 'crypto' || method === 'cashapp' || method === 'store_credit') {
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

// No auth check here: the only caller is adminOrders below, which is wrapped.
async function listOrders(req: ApiRequest) {
    const { data, error } = await getSupabaseAdmin().from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw createHttpError(500, error.message || 'Failed to fetch orders.');
    return (data as OrderRow[] | null) || [];
}

// No auth check here: the only caller is adminOrders below, which is wrapped.
async function updateOrder(req: ApiRequest) {
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

// The admin branch of this handler — order listing and updates. Union policy:
// the dashboard login is a Supabase session, so these accept one alongside the
// operator's shared secret.
const adminOrders = withAdminAuth(async (req: ApiRequest, res: ApiResponse) => {
    try {
        if (req.method === 'GET') { res.status(200).json(await listOrders(req)); return; }
        if (req.method === 'PATCH') { res.status(200).json(await updateOrder(req)); return; }
        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[Order API]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Order request failed.' });
    }
}, { policy: 'union' });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    // GET/PATCH are the admin branch; POST is the public checkout action and
    // dispatches around the gate. Anything else falls through to the admin
    // branch, which answers 405 — so an unlisted method can never reach code
    // that assumed a credential was checked.
    if (req.method !== 'POST') { await adminOrders(req, res); return; }

    try {
        res.status(200).json(await createOrder(req));
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[Order API]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Order request failed.' });
    }
}
