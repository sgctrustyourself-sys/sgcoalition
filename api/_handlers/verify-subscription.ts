// /api/verify-subscription
// Called from /order/success after the client returns from Stripe Checkout in
// "membership" mode. Verifies payment_status with Stripe, then promotes the
// matching Supabase profile to VIP and bumps store_credit by $15 (the monthly
// credit grant).

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, setCorsHeaders, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    ProfileRow,
    SupabaseClient,
    VerifySubscriptionBody,
    VerifySubscriptionResponse,
} from '../_types';

const VIP_METADATA_TYPE = 'coalition_vip';
const MONTHLY_VIP_CREDIT_USD = 15;

// Lazy Stripe getter. See api/_handlers/create-checkout-session.ts for the
// full rationale. A missing STRIPE_SECRET_KEY env at cold start would throw
// FUNCTION_INVOCATION_FAILED for every /api/* route, so we lazy-init.
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
    if (stripeInstance) return stripeInstance;
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        throw createHttpError(
            503,
            'Stripe is not configured on this server. PayPal is the live checkout flow; Stripe handlers are retained as backup infrastructure.',
        );
    }
    stripeInstance = new Stripe(apiKey, {});
    return stripeInstance;
}

// Lazy Supabase admin client. Was previously eagerly instantiated at module
// top — `createClient('', '')` throws synchronously when VITE_SUPABASE_URL is
// missing (SDK validates URL format immediately), crashing the Lambda at
// cold start. Lazy-init matches the paypal-order.ts + complete-order.ts
// convention. Callers hit this once and get a 503 from the inner handler.
let supabaseAdminInstance: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
    if (supabaseAdminInstance) return supabaseAdminInstance;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase is not configured on this server.');
    }
    supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey);
    return supabaseAdminInstance;
}

function readSubscriptionType(session: Stripe.Checkout.Session): string | undefined {
    // The create-subscription-session handler always writes `metadata.type`
    // on the Stripe Checkout Session itself. Older builds of this handler
    // also peeked at the legacy `subscription_data` field as a defensive
    // fallback, but that field is not present on Stripe.Checkout.Session in
    // the SDK — it lives on the Subscription object addressed by
    // session.subscription — so that branch was unreachable in practice. The
    // simple metadata lookup matches what create-subscription-session writes
    // today and avoids the dead cast.
    const sessionMetadata = session.metadata?.type;
    return typeof sessionMetadata === 'string' && sessionMetadata
        ? sessionMetadata
        : undefined;
}

async function promoteUserToVip(userId: string): Promise<void> {
    // Best-effort create-if-missing then a fresh fetch-then-update on
    // store_credit so the monthly credit grant doesn't clobber an existing
    // balance. A true atomic increment belongs in a Postgres function, but
    // this read-modify-write is good enough for the MVP.
    await getSupabaseAdmin()
        .from('profiles')
        .upsert({ id: userId, is_vip: true })
        .select();

    const { data: currentProfile, error: readError } = await getSupabaseAdmin()
        .from('profiles')
        .select('store_credit')
        .eq('id', userId)
        .single();

    if (readError || !currentProfile) {
        throw createHttpError(500, 'Failed to load VIP profile.');
    }

    const currentCredit = Number((currentProfile as Pick<ProfileRow, 'store_credit'>).store_credit || 0);
    const newCredit = currentCredit + MONTHLY_VIP_CREDIT_USD;

    const { error: updateError } = await getSupabaseAdmin()
        .from('profiles')
        .update({
            is_vip: true,
            store_credit: newCredit,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (updateError) {
        console.error('Failed to update profile:', updateError);
        throw createHttpError(500, 'Failed to grant monthly VIP store credit.');
    }
}

async function verifySubscription(req: ApiRequest): Promise<VerifySubscriptionResponse> {
    const rawBody = parseBody(req);
    const body = rawBody as VerifySubscriptionBody;
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
        throw createHttpError(400, 'Missing sessionId');
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
        throw createHttpError(400, 'Payment not paid');
    }

    const userId = session.metadata?.userId;
    const type = readSubscriptionType(session);

    console.log(`Verifying subscription for User: ${userId}, Type: ${type}`);

    if (userId && userId !== 'guest' && type === VIP_METADATA_TYPE) {
        await promoteUserToVip(userId);
    }

    return { success: true, userId };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { methods: 'GET,OPTIONS,PATCH,DELETE,POST,PUT', allowedHeaders: EXTENDED_CORS_HEADERS });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        res.status(200).json(await verifySubscription(req));
    } catch (error: unknown) {
        const httpError = error as HttpError | null;
        const status = Number(httpError?.status || 500);
        const message = (error as { message?: string } | null)?.message;
        console.error('Verification Error:', error);
        res.status(status).json({ error: message || 'Internal server error' });
    }
}
