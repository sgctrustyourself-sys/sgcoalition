import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, setCorsHeaders, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    CreatePaymentIntentBody,
    PaymentIntentResponse,
    ProfileRow,
    SupabaseClient,
} from '../_types';

const CURRENCY = 'usd';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted to use default
});

// Admin Supabase client (service role, bypasses RLS) — eager init matches the
// existing create-subscription-session / place-order-credits convention. If a
// caller hits this endpoint without SUPABASE credentials they get a 503 from
// the request handler instead of a silent profile-less credit path.
const supabaseAdmin: SupabaseClient = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function loadStoreCredit(userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('store_credit')
        .eq('id', userId)
        .single();

    if (error || !data) return 0;
    return Number((data as Pick<ProfileRow, 'store_credit'>).store_credit || 0);
}

async function createPaymentIntent(req: ApiRequest): Promise<PaymentIntentResponse> {
    const rawBody = parseBody(req);
    const body = rawBody as CreatePaymentIntentBody;
    const originalAmount = Number(body.amount || 0);
    const userId = body.userId ? String(body.userId) : undefined;
    const useStoreCredit = Boolean(body.useStoreCredit);

    let finalAmount = originalAmount;
    let creditApplied = 0;

    if (useStoreCredit && userId) {
        const availableCredit = await loadStoreCredit(userId);
        creditApplied = Math.min(availableCredit, originalAmount);
        finalAmount = Math.max(0, originalAmount - creditApplied);
    }

    if (finalAmount <= 0) {
        // No payment needed via Stripe (store credit covered it).
        return {
            clientSecret: null,
            zeroAmount: true,
            creditApplied,
        };
    }

    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(finalAmount * 100),
        currency: CURRENCY,
        automatic_payment_methods: {
            enabled: true,
        },
        metadata: {
            userId: userId || '',
            creditApplied: creditApplied.toFixed(2),
            originalAmount: originalAmount.toFixed(2),
        },
    });

    return {
        clientSecret: paymentIntent.client_secret,
        creditApplied,
        finalAmount,
    };
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
        res.status(200).json(await createPaymentIntent(req));
    } catch (error: unknown) {
        const message = (error as { message?: string } | null)?.message;
        const httpError = error as HttpError | null;
        const status = Number(httpError?.status || 500);
        console.error('Stripe error:', error);
        res.status(status).json({ error: message || 'Internal server error' });
    }
}
