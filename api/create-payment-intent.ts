import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, setCorsHeaders, type HttpError } from './_helpers';
import type {
    ApiRequest,
    ApiResponse,
    CreatePaymentIntentBody,
    PaymentIntentResponse,
    ProfileRow,
    SupabaseClient,
} from './_types';

const CURRENCY = 'usd';

// Lazy Stripe getter. See api/_handlers/create-checkout-session.ts for the
// full rationale. A missing STRIPE_SECRET_KEY env at cold start would throw
// `function_invocation_failed` for every /api/* route, so we lazy-init.
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
// top, but `createClient('', '')` throws synchronously when VITE_SUPABASE_URL
// is missing (the SDK validates URL format immediately), crashing the Lambda
// at cold start. Lazy-init here matches paypal-order.ts + complete-order.ts
// pattern. Callers hit this once and get a 503 from the inner handler.
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

async function loadStoreCredit(userId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
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

    const paymentIntent = await getStripe().paymentIntents.create({
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
