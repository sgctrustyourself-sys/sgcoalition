import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted
});

// Admin Supabase client to bypass RLS for updates
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

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'Missing sessionId' });
            return;
        }

        // 1. Retrieve the Checkout Session
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            res.status(400).json({ error: 'Payment not paid' });
            return;
        }

        const userId = session.metadata?.userId;
        const type = session.metadata?.type || ((session as any).subscription_data?.metadata as any)?.type;

        console.log(`Verifying subscription for User: ${userId}, Type: ${type}`);

        if (userId && userId !== 'guest' && type === 'coalition_vip') {
            // 2. Update User Profile in Supabase
            const { error } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userId,
                    is_vip: true,
                    // Increment logic is hard with basic upsert, so we fetch first or use a stored procedure.
                    // For MVP simplicity, we just set the credit to 15 if it's 0, or add 15.
                    // Ideally: store_credit = profiles.store_credit + 15
                })
                .select();

            // Using RPC for atomic increment is better, but let's try a simple read-modify-write for now
            // Or just assume first month:

            // First, get current credit
            const { data: currentProfile } = await supabaseAdmin
                .from('profiles')
                .select('store_credit')
                .eq('id', userId)
                .single();

            const currentCredit = currentProfile?.store_credit || 0;
            const newCredit = Number(currentCredit) + 15.00;

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({
                    is_vip: true,
                    store_credit: newCredit,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                console.error('Failed to update profile:', updateError);
                throw updateError;
            }
        }

        res.status(200).json({ success: true, userId });

    } catch (err: any) {
        console.error('Verification Error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
