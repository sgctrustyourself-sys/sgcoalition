// api/_handlers/health.ts
//
// GET /api/health — lightweight liveness + Stripe readiness probe.
//
// Why this exists: an expired/revoked STRIPE_SECRET_KEY fails silently at the
// payment layer — checkout surfaces "Card, Klarna, and Afterpay are
// temporarily unavailable" while every /api Stripe handler still LOADS fine
// (the module-level guard only catches a MISSING key, not a dead one). An
// uptime monitor pointed at GET /api/health now turns that silent outage into
// a loud 503 with a machine-readable reason.
//
// What it reports:
//   - configured  — is STRIPE_SECRET_KEY set at all?
//   - keyValid    — does Stripe accept it? (balance.retrieve() is the cheapest
//                   auth round-trip; it 401s with code api_key_expired for a
//                   dead key)
//   - methodFlags — payment-method on/off from paymentMethodConfigurations
//                   (populated when the key can read them)
//   - paymentMethods — the ACTUAL method list Stripe would offer checkout.
//                   Resolved from the configurations when flags are readable;
//                   otherwise (restricted keys hide the flag fields) via a
//                   cancelled $5 draft PaymentIntent with automatic_payment_methods,
//                   which is exactly what create-payment-intent does.
//
// Always 200 when healthy, 503 when degraded. Never echoes the key; Stripe
// errors are reduced to code + message with any key-shaped token redacted.
//
// NOTE: this module deliberately does NOT read env vars at import time, so it
// can report "not configured" instead of throwing like the payment handlers do.

const KEY_LIKE_PATTERN = /[sr]k_live_[A-Za-z0-9*]+/g;

function sanitizeStripeError(e: unknown): string {
    const err = (e ?? {}) as { code?: string; type?: string; message?: string };
    const code = err.code || err.type || 'unknown';
    const rawMessage = String(err.message || 'Stripe error').slice(0, 200);
    const message = rawMessage.replace(KEY_LIKE_PATTERN, '[REDACTED]');
    return `${code}: ${message}`;
}

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    const stripe: {
        configured: boolean;
        keyValid: boolean;
        error: string | null;
        methodFlags: Record<string, boolean>;
        paymentMethods: string[];
    } = {
        configured: Boolean(stripeKey),
        keyValid: false,
        error: null,
        methodFlags: {},
        paymentMethods: [],
    };

    if (!stripeKey) {
        res.status(503).json({
            status: 'degraded',
            checkoutWorking: false,
            stripe,
            timestamp: new Date().toISOString(),
        });
        return;
    }

    // Lazy require so a missing key never crashes the handler.
    const { default: Stripe } = await import('stripe');
    const client = new Stripe(stripeKey, { apiVersion: undefined });

    // 1) Key validity — cheapest authenticated round-trip.
    try {
        await client.balance.retrieve();
        stripe.keyValid = true;
    } catch (e: unknown) {
        stripe.keyValid = false;
        stripe.error = sanitizeStripeError(e);
        res.status(503).json({
            status: 'degraded',
            checkoutWorking: false,
            stripe,
            timestamp: new Date().toISOString(),
        });
        return;
    }

    // 2) Payment-method flags from the account configuration (full keys only —
    //    restricted keys return these fields stripped).
    const KNOWN_METHODS = [
        'card', 'klarna', 'afterpay_clearpay', 'link', 'cashapp',
        'amazon_pay', 'us_bank_account', 'affirm', 'grabpay',
    ] as const;
    try {
        const configs = await client.paymentMethodConfigurations.list({ limit: 100 });
        for (const config of configs.data) {
            for (const method of KNOWN_METHODS) {
                const section = (config as Record<string, any>)[method];
                if (section && typeof section.enabled === 'boolean') {
                    stripe.methodFlags[method] = stripe.methodFlags[method] || section.enabled;
                }
            }
        }
    } catch {
        // Restricted key without the read — the draft-intent probe below is
        // the fallback that answers the same question.
    }

    // 3) If the flags didn't materialize (restricted key) or the caller asked
    //    for a forced probe, create a cancelled draft PaymentIntent and read
    //    back payment_method_types — the same answer automatic_payment_methods
    //    gives the real checkout. Forced with ?probe=1 for operator use.
    const probeRequested = String(req.query?.probe || '') === '1';
    // A probe is REQUIRED when the configurations gave no flags (restricted
    // key) — then the draft intent is the ONLY way to confirm checkout works.
    const probeRequired = Object.keys(stripe.methodFlags).length === 0;
    if (probeRequested || probeRequired) {
        try {
            const pi = await client.paymentIntents.create({
                amount: 500, // $5.00 draft — never charged, cancelled below
                currency: 'usd',
                automatic_payment_methods: { enabled: true },
                shipping: {
                    name: 'Health Check',
                    address: {
                        line1: '1 Health St',
                        city: 'Baltimore',
                        state: 'MD',
                        postal_code: '21201',
                        country: 'US',
                    },
                },
                metadata: { health_check: 'true' },
            });
            stripe.paymentMethods = (pi.payment_method_types as string[]) || [];
            try {
                await client.paymentIntents.cancel(pi.id);
            } catch {
                // Cancel is best-effort; a stuck draft expires in 7 days.
            }
        } catch (e: unknown) {
            stripe.error = sanitizeStripeError(e);
            // A failed REQUIRED probe means the real create-payment-intent
            // would fail for customers too — that IS the silent checkout
            // outage this endpoint exists to catch.
            if (probeRequired) {
                res.status(503).json({
                    status: 'degraded',
                    checkoutWorking: false,
                    stripe,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
        }
    } else {
        // Flags are readable — the enabled methods ARE the offered methods.
        stripe.paymentMethods = Object.entries(stripe.methodFlags)
            .filter(([, enabled]) => enabled)
            .map(([method]) => method);
    }

    res.status(200).json({
        status: 'ok',
        checkoutWorking: true,
        stripe,
        timestamp: new Date().toISOString(),
    });
}
