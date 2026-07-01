// /api/place-order-credits
// Atomic store-credit-only checkout endpoint. Reads the user's profile,
// verifies they can cover the order with stored credit, and deducts the
// spend in one row update. There is no Stripe/PayPal flow here — the cart
// still gets reconciled client-side and the orders row lives elsewhere.

import { createClient } from '@supabase/supabase-js';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, setCorsHeaders, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    PlaceOrderCreditsBody,
    PlaceOrderCreditsResponse,
    ProfileRow,
    SupabaseClient,
} from '../_types';

// Eager match to the previous behavior — crashing on cold start if env vars
// are unset matches the existing fail-fast convention for adjacent handlers
// (verify-subscription, create-payment-intent).
const supabaseAdmin: SupabaseClient = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function placeOrder(req: ApiRequest): Promise<PlaceOrderCreditsResponse> {
    const rawBody = parseBody(req);
    const body = rawBody as PlaceOrderCreditsBody;

    const userId = body.userId ? String(body.userId) : '';
    const total = Number(body.total || 0);
    if (!userId || !Number.isFinite(total) || total <= 0) {
        throw createHttpError(400, 'Missing required fields');
    }

    // 1. Fetch the profile; non-existent rows fail closed so a forged user
    // can't drain credit at random.
    const { data: profileRow, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('store_credit')
        .eq('id', userId)
        .single();

    if (fetchError || !profileRow) {
        throw createHttpError(404, 'User profile not found');
    }

    const currentCredit = Number((profileRow as Pick<ProfileRow, 'store_credit'>).store_credit || 0);
    if (currentCredit < total) {
        throw createHttpError(400, 'Insufficient store credit');
    }

    // 2. Deduct. updated_at is bumped so any downstream tooling that watches
    // the profile can react to balance changes.
    const newCredit = currentCredit - total;
    const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ store_credit: newCredit, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (updateError) {
        throw createHttpError(500, 'Failed to deduct credit');
    }

    return { success: true, newBalance: newCredit };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { methods: 'POST,OPTIONS', allowedHeaders: EXTENDED_CORS_HEADERS });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        res.status(200).json(await placeOrder(req));
    } catch (error: unknown) {
        const httpError = error as HttpError | null;
        const message = (error as { message?: string } | null)?.message;
        const status = Number(httpError?.status || 500);
        console.error('Credit Order Error:', error);
        res.status(status).json({ error: message || 'Credit order failed' });
    }
}
