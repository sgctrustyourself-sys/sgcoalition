import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { resolvePricing, type PricingItem, HttpError } from '../../services/orderIntake.js';
import { loadPaymentSettings } from '../../services/paymentSettings.js';
import { CHECKOUT_PAYMENT_METHOD_TYPES } from '../_helpers.js';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted to use default
});

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { items, shippingCost, userId, useStoreCredit, orderId, email, shipping, paymentMethodTypes } = req.body;

        // Pricing authority lives in orderIntake.resolvePricing().
        // Accept raw items + shipping choice; the server computes the
        // real amount including set bonuses, add-ons, and validation.
        const pricingItems: PricingItem[] = Array.isArray(items) ? items.map((i: any) => ({
            productId: String(i.productId || ''),
            selectedSize: String(i.selectedSize || 'One Size'),
            quantity: Math.max(1, Number(i.quantity || 1)),
            keychainClipOn: Boolean(i.keychainClipOn),
        })) : [];

        if (!pricingItems.length) {
            res.status(400).json({ error: 'At least one item required.' });
            return;
        }

        // Optional per-intent method allow-list, used by the checkout UI to
        // offer a card-only primary path (['card']) and Klarna as a separate
        // secondary path (['klarna']). Must be a non-empty subset of the
        // checkout allow-list — an unknown method is rejected, never silently
        // expanded (that is exactly how Link/Cash App/Amazon Pay leaked back
        // in before the allow-list existed).
        const clientRequestedMethods = paymentMethodTypes !== undefined;
        let methodTypes: string[] = [...CHECKOUT_PAYMENT_METHOD_TYPES];
        if (clientRequestedMethods) {
            const requested = Array.isArray(paymentMethodTypes) ? paymentMethodTypes : [];
            const allowed = new Set<string>(CHECKOUT_PAYMENT_METHOD_TYPES);
            const valid = requested.length > 0
                && requested.every((m: unknown) => typeof m === 'string' && allowed.has(m as string));
            if (!valid) {
                res.status(400).json({ error: 'Invalid payment method types.' });
                return;
            }
            methodTypes = [...new Set(requested as string[])];
        }

        // Owner-controlled visibility (admin Command Center toggles): a
        // method the owner turned off must not be payable even if a stale
        // client page requests it. This is the server-side backstop — the
        // checkout already hides disabled options. Any read failure defaults
        // to all-enabled (never lock checkout).
        const paymentSettings = await loadPaymentSettings(supabaseAdmin);
        const enabledStripe = new Set<string>();
        if (paymentSettings.card) enabledStripe.add('card');
        if (paymentSettings.klarna) enabledStripe.add('klarna');

        const filtered = methodTypes.filter(m => enabledStripe.has(m));
        // An explicitly-requested method that the owner disabled means the
        // client is stale — tell it to refresh. The default allow-list is
        // filtered silently instead (a client that didn't specify methods
        // just gets whatever the owner left on).
        if (clientRequestedMethods && filtered.length !== methodTypes.length) {
            res.status(409).json({ error: 'One of the selected payment options is currently unavailable. Please refresh and choose another.' });
            return;
        }
        if (filtered.length === 0) {
            res.status(409).json({ error: 'No payment options are currently available. Please try again later.' });
            return;
        }
        methodTypes = filtered;

        // Fetch store credit before pricing so resolvePricing() owns
        // every dollar on the order — the module applies the credit
        // internally and returns the post-credit total.
        let storeCreditCents = 0;
        if (useStoreCredit && userId) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('store_credit')
                .eq('id', userId)
                .single();
            if (profile) {
                storeCreditCents = Math.round(Number(profile.store_credit || 0) * 100);
            }
        }

        let pricing;
        try {
            pricing = await resolvePricing(
                pricingItems,
                Number(shippingCost || 0),
                0, // client discount — crypto/other discounts, no store credit
                'stripe',
                storeCreditCents,
            );
        } catch (e: unknown) {
            const he = e as HttpError;
            const status = he?.status || 500;
            const message = he?.message || 'Pricing failed.';
            console.error('[Stripe Intent] resolvePricing error:', message);
            res.status(status).json({ error: message });
            return;
        }

        // pricing.totalCents is already post-store-credit.
        // pricing.storeCreditCents is capped to the actual amount used.
        const finalAmount = pricing.totalCents / 100;
        const creditApplied = pricing.storeCreditCents / 100;

        if (finalAmount <= 0.50 && finalAmount > 0) {
            // Stripe minimum is often $0.50. If remaining is tiny, just absorb it or force min?
            // For now, let's assume if it's > 0 it must be valid, or we handle error.
        }

        if (finalAmount === 0) {
            // No payment needed via Stripe
            res.status(200).json({
                clientSecret: null,
                zeroAmount: true,
                creditApplied,
                pricing,
            });
            return;
        }

        // Build the PaymentIntent. payment_method_types is an explicit
        // allow-list (CHECKOUT_PAYMENT_METHOD_TYPES in ../_helpers, further
        // narrowed per-intent by the validated paymentMethodTypes body param)
        // — the PaymentElement renders exactly these methods, and nothing else.
        // automatic_payment_methods would surface EVERY method enabled in the
        // Stripe dashboard (currently also Link, Cash App, and Amazon Pay),
        // which the owner chose to hide. Klarna is a redirect method that
        // needs the customer's email and shipping before it can be offered,
        // so we forward the checkout form's shipping block + email to the
        // intent. See the FOOTGUN WARNING on the constant before adding a
        // method: it must be enabled in the Stripe dashboard FIRST or the
        // entire PaymentIntent fails. (automatic_payment_methods and
        // payment_method_types are mutually exclusive on one intent.)
        // Server-side guard on the same contract the client enforces: only
        // attach shipping when the country is a valid 2-letter ISO-3166 code.
        // Sending a malformed country (e.g. "United States" truncated to
        // "UN") makes Stripe reject the whole PaymentIntent.
        const rawCountry = shipping?.address?.country ? String(shipping.address.country).trim() : '';
        const countryCode = /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : '';
        const shippingAddr = (shipping && typeof shipping === 'object' && shipping.address && countryCode)
            ? {
                name: String(shipping.name || 'Customer').slice(0, 500) || 'Customer',
                address: {
                    line1: String(shipping.address.line1 || '').slice(0, 500),
                    line2: shipping.address.line2 ? String(shipping.address.line2).slice(0, 500) : undefined,
                    city: String(shipping.address.city || '').slice(0, 120),
                    state: shipping.address.state ? String(shipping.address.state).slice(0, 120) : undefined,
                    postal_code: shipping.address.postal_code ? String(shipping.address.postal_code).slice(0, 60) : undefined,
                    country: countryCode,
                },
            }
            : undefined;

        // Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount * 100), // Convert to cents
            currency: 'usd',
            payment_method_types: methodTypes,
            ...(email && String(email).includes('@') ? { receipt_email: String(email) } : {}),
            ...(shippingAddr ? { shipping: shippingAddr } : {}),
            metadata: {
                userId: userId ? String(userId) : '',
                creditApplied: creditApplied.toFixed(2),
                originalAmount: (pricing.totalCents / 100).toFixed(2),
                ...(orderId ? { order_id: String(orderId) } : {}),
            }
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            creditApplied,
            finalAmount,
            pricing, // server-computed breakdown for display
        });

    } catch (err: any) {
        console.error('Stripe error:', err);
        // Never surface raw Stripe internals (e.g. "Expired API Key provided:
        // sk_live_***") to a customer — the checkout shows this string.
        const message = String(err?.message || '');
        const isStripeAuthFailure = err?.type === 'StripeAuthenticationError'
            || /expired api key|invalid api key/i.test(message);
        res.status(500).json({
            error: isStripeAuthFailure
                ? 'Card, Klarna, and Afterpay are temporarily unavailable. Please try PayPal or contact support.'
                : (message || 'Internal server error'),
        });
    }
}
