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

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted
});

// Admin Supabase client to bypass RLS for the profile upsert/update.
const supabaseAdmin: SupabaseClient = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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
    await supabaseAdmin
        .from('profiles')
        .upsert({ id: userId, is_vip: true })
        .select();

    const { data: currentProfile, error: readError } = await supabaseAdmin
        .from('profiles')
        .select('store_credit')
        .eq('id', userId)
        .single();

    if (readError || !currentProfile) {
        throw createHttpError(500, 'Failed to load VIP profile.');
    }

    const currentCredit = Number((currentProfile as Pick<ProfileRow, 'store_credit'>).store_credit || 0);
    const newCredit = currentCredit + MONTHLY_VIP_CREDIT_USD;

    const { error: updateError } = await supabaseAdmin
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

    const session = await stripe.checkout.sessions.retrieve(sessionId);
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
