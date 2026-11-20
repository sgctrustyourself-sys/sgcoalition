// api/_handlers/admin-sgcoin-members.ts
//
// GET /api/admin-sgcoin-members — the member list the SGCoin Distribution tab
// picks a recipient from.
//
// The tab used to build this list from `localStorage.getItem('users')`, a key
// nothing in the app ever wrote: in a real browser the picker was empty, so
// there was nothing to send SGCoin to even before the fake write. The real
// roster is public.profiles, the table every other SGCoin surface reads
// (context/useAuth.ts reads sg_coin_balance from it; the payout RPCs decrement
// it).
//
// Service-role read, because profiles is RLS-gated and the admin session is a
// shared secret rather than a Supabase user. The admin gate runs first, so no
// unauthenticated caller can reach the query.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, type HttpError } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

/** Cap on one page of the picker. Well above the current roster. */
const MAX_MEMBERS = 1000;

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

interface ProfileRow {
    id: string;
    full_name: string | null;
    email: string | null;
    sg_coin_balance: number | string | null;
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const supabase = getSupabaseAdmin();

        // Named columns, not `*`: profiles carries customer_notes and other
        // operator-only fields this picker has no reason to ship to a browser.
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, sg_coin_balance')
            .order('created_at', { ascending: false })
            .limit(MAX_MEMBERS);

        if (error) {
            throw createHttpError(500, error.message || 'Failed to load members.');
        }

        const members = ((data || []) as ProfileRow[]).map((row) => ({
            userId: row.id,
            name: row.full_name || null,
            email: row.email || null,
            // numeric columns can arrive as strings; the UI does arithmetic and
            // `.toLocaleString()` on this value.
            sgCoinBalance: Number(row.sg_coin_balance) || 0,
        }));

        res.status(200).json({ members, limit: MAX_MEMBERS });
    } catch (error: unknown) {
        const httpError = error as Partial<HttpError>;
        const status = Number(httpError?.status || 500);
        console.error('[admin-sgcoin-members]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Failed to load members.' });
    }
}

export default withAdminAuth(handler);
