import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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
    res.setHeader('Access-Control-Allow-Origin', '*');
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
        const { amount: originalAmount, userId, useStoreCredit } = req.body;
        let finalAmount = originalAmount;
        let creditApplied = 0;

        if (useStoreCredit && userId) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('store_credit')
                .eq('id', userId)
                .single();

            if (profile) {
                const availableCredit = Number(profile.store_credit || 0);
                creditApplied = Math.min(availableCredit, originalAmount);
                finalAmount = Math.max(0, originalAmount - creditApplied);
            }
        }

        if (finalAmount <= 0.50 && finalAmount > 0) {
            // Stripe minimum is often $0.50. If remaining is tiny, just absorb it or force min?
            // For now, let's assume if it's > 0 it must be valid, or we handle error.
        }

        if (finalAmount === 0) {
            // No payment needed via Stripe
            res.status(200).json({
                clientSecret: null,
                zeroAmount: true,
                creditApplied
            });
            return;
        }

        // Create Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount * 100), // Convert to cents
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId,
                creditApplied: creditApplied.toFixed(2),
                originalAmount: originalAmount.toFixed(2)
            }
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            creditApplied,
            finalAmount
        });

    } catch (err: any) {
        console.error('Stripe error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
