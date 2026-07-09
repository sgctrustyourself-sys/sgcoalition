// /api/place-order-credits
// Atomic store-credit-only checkout endpoint. Reads the user's profile,
// verifies they can cover the order with stored credit, and deducts the
// spend in one row update. There is no Stripe/PayPal flow here — the cart
// still gets reconciled client-side and the orders row lives elsewhere.

import { createClient } from '@supabase/supabase-js';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, setCorsHeaders, type HttpError } from './_helpers';
import type {
    ApiRequest,
    ApiResponse,
    PlaceOrderCreditsBody,
    PlaceOrderCreditsResponse,
    ProfileRow,
    SupabaseClient,
} from './_types';

// Lazy Supabase admin client. Previously eager `createClient(...)` crashed
// the Lambda at cold start when VITE_SUPABASE_URL was unset (SDK validates
// URL format immediately). Lazy-init matches paypal-order.ts + complete-order.ts
// + create-payment-intent.ts + verify-subscription.ts convention. The
// `cachedAdminClient` cache variable name matches paypal-order.ts exactly
// so future operators reading both files land on the same mental model —
// and so any future bulk-rename search tools don't accidentally hit a
// substring collision with the eager-init identifier we used to have
// here (supabaseAdmin). Callers hit this once and get a 503 from the inner
// handler if env is unset.
let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
    if (cachedAdminClient) return cachedAdminClient;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase is not configured on this server.');
    }
    cachedAdminClient = createClient(supabaseUrl, serviceRoleKey);
    return cachedAdminClient;
}

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
    const { data: profileRow, error: fetchError } = await getSupabaseAdmin()
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
    const { error: updateError } = await getSupabaseAdmin()
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
