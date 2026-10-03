import { stripeClient } from '../../api/_services.js';
import { createClient } from '@supabase/supabase-js';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = stripeClient();

// Admin Supabase client to bypass RLS for updates
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
            // 2. Grant the VIP welcome credit exactly once per join.
            //
            // The claim is a compare-and-set on the membership transition
            // (is_vip false/null -> true), observed with .select(). This
            // endpoint is re-entered with the same paid session on every reload
            // of the membership return URL (pages/OrderSuccess posts here on
            // mount whenever the URL carries session_id + type=membership), and
            // before this guard every visit added another $15 of store credit.
            // Only the call that wins the transition writes the credit; the
            // losers match 0 rows and fall through to the same 200, so a
            // reload, second tab or replayed POST stays harmless.
            //
            // Known limits (deliberate, smallest-change): the marker is shared
            // with the admin VIP toggle, so demoting then re-promoting a member
            // re-arms the grant, and a second paid session for an already-VIP
            // profile is not credited. The exact fix would be a session-keyed
            // grants table claimed with this same CAS shape.
            const { error: ensureError } = await supabaseAdmin
                .from('profiles')
                .upsert({ id: userId }, { ignoreDuplicates: true })
                .select();

            if (ensureError) {
                // Without a row the claim below would match 0 rows and read as
                // "already granted" — fail loudly instead of dropping the credit.
                console.error('Failed to ensure profile:', ensureError);
                throw ensureError;
            }

            // First, get current credit
            const { data: currentProfile } = await supabaseAdmin
                .from('profiles')
                .select('store_credit')
                .eq('id', userId)
                .single();

            const currentCredit = currentProfile?.store_credit || 0;
            const newCredit = Number(currentCredit) + 15.00;

            const { data: granted, error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({
                    is_vip: true,
                    store_credit: newCredit,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .or('is_vip.eq.false,is_vip.is.null')
                .select();

            if (updateError) {
                console.error('Failed to update profile:', updateError);
                throw updateError;
            }

            if (!granted || granted.length === 0) {
                console.log(`Membership welcome credit already granted for User: ${userId}`);
            }
        }

        res.status(200).json({ success: true, userId });

    } catch (err: any) {
        console.error('Verification Error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
