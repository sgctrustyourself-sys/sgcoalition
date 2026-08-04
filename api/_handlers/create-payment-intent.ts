import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { resolvePricing, type PricingItem, HttpError } from '../../services/orderIntake.js';

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
        const { items, shippingCost, userId, useStoreCredit, orderId, email, shipping } = req.body;

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

        // Build the PaymentIntent. automatic_payment_methods surfaces every
        // method enabled in the Stripe dashboard that is eligible for the
        // buyer + order — card, Klarna, and Afterpay/Clearpay included.
        // Klarna and Afterpay are redirect methods that need the customer's
        // email and (for Afterpay, which is domestic-only underwriting) the
        // shipping address before they can be offered, so we forward the
        // checkout form's shipping block + email to the intent.
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
            automatic_payment_methods: {
                enabled: true,
            },
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
