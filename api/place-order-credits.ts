import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

    const { userId, total, items } = req.body;

    if (!userId || !total) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    try {
        // 1. Fetch user profile to verify credit
        const { data: profile, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('store_credit')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) {
            throw new Error('User profile not found');
        }

        const currentCredit = Number(profile.store_credit || 0);

        if (currentCredit < total) {
            res.status(400).json({ error: 'Insufficient store credit' });
            return;
        }

        // 2. Deduct credit
        const newCredit = currentCredit - total;
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ store_credit: newCredit, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (updateError) {
            throw new Error('Failed to deduct credit');
        }

        // 3. (Optional) Create Order Record in DB if you had an orders table
        // For now, we just return success and let client handle localStorage order

        res.status(200).json({ success: true, newBalance: newCredit });

    } catch (error: any) {
        console.error('Credit Order Error:', error);
        res.status(500).json({ error: error.message });
    }
}
