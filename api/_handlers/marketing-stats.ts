// /api/marketing-stats
// Admin-only GET: returns per-campaign delivery counts + audience totals.
// Reads marketing_campaigns + marketing_sends (Supabase admin client).
//
// Response shape:
// {
//   audience: { total, email, sms, sources },
//   campaigns: [
//     {
//       id, name, channel, status, sent_at, created_at,
//       totals: { queued, sent, failed, delivery_pct },
//       by_channel: { email?: { sent, failed }, sms?: { sent, failed } }
//     },
//     ...
//   ]
// }

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
    if (cachedAdminClient) return cachedAdminClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    cachedAdminClient = createClient(url, key, { auth: { persistSession: false } });
    return cachedAdminClient;
}

function isAdminAuthorized(authHeader: string | undefined): boolean {
    const expected = process.env.ADMIN_SESSION_TOKEN ||
        process.env.FULL_AI_PASSWORD ||
        process.env.AI_SESSION_SECRET ||
        '';
    if (!expected) return false;
    if (!authHeader) return false;
    const lower = authHeader.toLowerCase();
    const token = lower.startsWith('bearer ') ? authHeader.slice(7) : authHeader;
    return token === expected;
}

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : undefined;
    if (!isAdminAuthorized(authHeader)) {
        res.status(401).json({ error: 'Admin authorization required.' });
        return;
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
        res.status(503).json({ error: 'Supabase admin credentials not configured.' });
        return;
    }

    try {
        const [{ data: contacts }, { data: campaigns }, { data: sends }] = await Promise.all([
            admin.from('marketing_contacts').select('id, email, phone_e164, channel, source, status').eq('status', 'active'),
            admin.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(50),
            admin.from('marketing_sends').select('id, campaign_id, channel, status'),
        ]);

        const audience = {
            total: (contacts || []).length,
            email: (contacts || []).filter((c: any) => c.email).length,
            sms: (contacts || []).filter((c: any) => c.phone_e164).length,
            sources: new Set((contacts || []).map((c: any) => c.source)).size,
        };

        const sendsByCampaign = new Map<string, any[]>();
        for (const s of sends || []) {
            const arr = sendsByCampaign.get(s.campaign_id) || [];
            arr.push(s);
            sendsByCampaign.set(s.campaign_id, arr);
        }

        const campaignsWithStats = (campaigns || []).map((c: any) => {
            const all = sendsByCampaign.get(c.id) || [];
            const byChannel: Record<string, { sent: number; failed: number }> = {};
            let queued = 0, sent = 0, failed = 0;
            for (const r of all) {
                if (r.status === 'sent' || r.status === 'delivered') sent += 1;
                else if (r.status === 'failed' || r.status === 'bounced') failed += 1;
                else queued += 1;
                const cb = byChannel[r.channel] || { sent: 0, failed: 0 };
                if (r.status === 'sent' || r.status === 'delivered') cb.sent += 1;
                else if (r.status === 'failed' || r.status === 'bounced') cb.failed += 1;
                byChannel[r.channel] = cb;
            }
            const attempted = sent + failed;
            const delivery_pct = attempted > 0 ? Math.round((sent / attempted) * 1000) / 10 : null;
            return {
                id: c.id,
                name: c.name,
                channel: c.channel,
                status: c.status,
                sent_at: c.sent_at,
                created_at: c.created_at,
                totals: { queued, sent, failed, delivery_pct },
                by_channel: byChannel,
            };
        });

        res.status(200).json({ audience, campaigns: campaignsWithStats });
    } catch (err: any) {
        console.error('[marketing-stats] error:', err);
        res.status(500).json({ error: err?.message || 'Failed to load marketing stats' });
    }
}
