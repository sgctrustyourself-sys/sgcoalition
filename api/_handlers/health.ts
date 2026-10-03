// api/_handlers/health.ts
import { CHECKOUT_PAYMENT_METHOD_TYPES } from '../_helpers.js';
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
//   - methodFlags — payment-method on/off read from the account's
//                   paymentMethodConfigurations (populated when the key can
//                   read them; a restricted key strips these fields, so they
//                   stay empty rather than being guessed at)
//   - paymentMethods — which of those the account enables for checkout: the
//                   configuration Stripe resolves automatic_payment_methods
//                   through, so checkoutMethodsMissing can still answer "is a
//                   method this code sends actually enabled on the account?"
//
// READ-ONLY BY CONSTRUCTION: nothing in this handler may create, confirm or
// cancel a Stripe object. An earlier version resolved the method list by
// creating and cancelling a $5 draft PaymentIntent and reading back
// payment_method_types — a real object written to the LIVE account on every
// call, from an uptime monitor's polling and every admin card load. It also
// never did what it claimed: the section shape it tested for
// (`card: { enabled: true }`) is not the shape Stripe returns, so for a full
// production key the flags came back empty, the "restricted key" fallback
// fired, and the write happened on every single request. What is given up by
// removing it is one signal: a key that authenticates but is not permitted to
// create PaymentIntents can no longer be detected, because no read-only Stripe
// call exposes that permission.
//
// The configured list is a superset — Stripe filters it per intent by currency
// and region, so a method can be 'on' here and still not appear for a given
// order. That cannot produce a false warning: checkoutMethodsMissing only ever
// under-reports a mismatch, which is the safe direction for a check that gates
// a method on the checkout allow-list.
//
// Always 200 when healthy, 503 when degraded. Never echoes the key; Stripe
// errors are reduced to code + message with any key-shaped token redacted.
//
// NOTE: this module deliberately does NOT read env vars at import time, so it
// can report "not configured" instead of throwing like the payment handlers do.

const KEY_LIKE_PATTERN = /[sr]k_live_[A-Za-z0-9*]+/g;

/**
 * Whether a configuration enables one payment method, across the two shapes
 * Stripe has returned for these sections:
 *   legacy  { enabled: boolean }
 *   current { available: boolean, display_preference: { value: 'on' | 'off' } }
 *
 * `available` is part of the rule because it is the field that says the account
 * can actually use the method: on the production account `affirm` is
 * display_preference 'on' with available:false, and checkout does not offer it.
 * Undefined means the section is absent or stripped, so nothing is recorded —
 * an unreadable configuration must not look like an all-disabled one.
 */
function sectionEnabled(section: unknown): boolean | undefined {
    const s = section as
        | { enabled?: unknown; available?: unknown; display_preference?: { value?: unknown } }
        | null
        | undefined;
    if (!s || typeof s !== 'object') return undefined;
    if (typeof s.enabled === 'boolean') return s.enabled;
    if (typeof s.available !== 'boolean') return undefined;
    return s.available === true && s.display_preference?.value === 'on';
}

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
        // What checkout is CONFIGURED to offer (the allow-list) vs what the
        // account actually has enabled. A non-empty checkoutMethodsMissing
        // means a method is configured in code but disabled on the Stripe
        // dashboard — which would fail the ENTIRE PaymentIntent (card too).
        checkoutMethods: string[];
        checkoutMethodsMissing: string[];
    } = {
        configured: Boolean(stripeKey),
        keyValid: false,
        error: null,
        methodFlags: {},
        paymentMethods: [],
        checkoutMethods: [...CHECKOUT_PAYMENT_METHOD_TYPES],
        checkoutMethodsMissing: [],
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

    // 1) Key validity — cheapest authenticated round-trip, and a pure read.
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
                const enabled = sectionEnabled((config as Record<string, any>)[method]);
                if (typeof enabled === 'boolean') {
                    stripe.methodFlags[method] = stripe.methodFlags[method] || enabled;
                }
            }
        }
    } catch {
        // Restricted key without the read. The flags stay empty and the
        // response says so — the previous version wrote a PaymentIntent to
        // find out, which this endpoint must never do.
    }

    // 3) The enabled flags ARE the methods this account offers checkout. No
    //    PaymentIntent is created to confirm it: the draft-intent probe that
    //    used to live here wrote a real object on every call, and Stripe has
    //    no read-only equivalent because the currency/region filtering happens
    //    at intent creation.
    stripe.paymentMethods = Object.entries(stripe.methodFlags)
        .filter(([, enabled]) => enabled)
        .map(([method]) => method);

    // A configured-but-disabled checkout method is a live outage risk (the
    // footgun documented on CHECKOUT_PAYMENT_METHOD_TYPES): flag it so the
    // admin card can surface it instead of discovering it via failed orders.
    if (stripe.paymentMethods.length > 0) {
        stripe.checkoutMethodsMissing = CHECKOUT_PAYMENT_METHOD_TYPES.filter(
            (method) => !stripe.paymentMethods.includes(method),
        );
    }

    res.status(200).json({
        status: 'ok',
        checkoutWorking: true,
        stripe,
        timestamp: new Date().toISOString(),
    });
}
