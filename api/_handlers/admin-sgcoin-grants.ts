// api/_handlers/admin-sgcoin-grants.ts
//
// GET /api/admin-sgcoin-grants — the grant ledger behind the Distribution tab's
// history panel: what was minted, to whom, with what note, and the balance the
// grant produced.
//
// The rows come from public.sgcoin_admin_grants, which grant_sgcoin() writes in
// the same transaction as the balance increment (see
// supabase/migrations/20261023_sgcoin_admin_grants.sql). A clawback is a second
// row — kind = 'reversal', negative amount, reverses_grant_id pointing at the
// grant — rather than an edit, so `kind` and `reversesGrantId` travel to the UI
// and it can show both sides of the correction.
//
// TWO QUERIES, ON PURPOSE. The ledger's foreign key is auth.users(id), not
// profiles(id), so PostgREST cannot embed the member's name — there is no
// relation to embed through. The second query resolves the names for the
// distinct ids on the page. A profiles read that fails is logged and does not
// fail the request: the grant row is the money record, the name is a label.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, type HttpError } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

/** Newest N grants. Enough to audit a distribution run without paginating. */
const GRANT_HISTORY_LIMIT = 50;

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

interface GrantLedgerRow {
    id: string;
    user_id: string;
    amount: number | string;
    note: string | null;
    balance_after: number | string;
    created_at: string;
    kind: string | null;
    reverses_grant_id: string | null;
}

interface ProfileLabelRow {
    id: string;
    full_name: string | null;
    email: string | null;
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('sgcoin_admin_grants')
            .select('id, user_id, amount, note, balance_after, created_at, kind, reverses_grant_id')
            .order('created_at', { ascending: false })
            .limit(GRANT_HISTORY_LIMIT);

        if (error) {
            throw createHttpError(500, error.message || 'Failed to load grant history.');
        }

        const rows = (data || []) as GrantLedgerRow[];
        const memberIds = [...new Set(rows.map((row) => row.user_id))];

        const labels = new Map<string, ProfileLabelRow>();
        if (memberIds.length > 0) {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', memberIds);

            if (profileError) {
                // The ledger is the answer; a missing label must not hide it.
                console.warn('[admin-sgcoin-grants] member labels unavailable:', profileError.message);
            } else {
                for (const profile of (profiles || []) as ProfileLabelRow[]) {
                    labels.set(profile.id, profile);
                }
            }
        }

        const grants = rows.map((row) => {
            const label = labels.get(row.user_id);
            return {
                id: row.id,
                userId: row.user_id,
                memberName: label?.full_name || null,
                memberEmail: label?.email || null,
                amount: Number(row.amount) || 0,
                note: row.note || null,
                balanceAfter: Number(row.balance_after) || 0,
                createdAt: row.created_at,
                // A pre-reversal row predates the column, and NULL reads as a
                // plain grant — which is what every such row is.
                kind: row.kind === 'reversal' ? ('reversal' as const) : ('grant' as const),
                reversesGrantId: row.reverses_grant_id || null,
            };
        });

        res.status(200).json({ grants, limit: GRANT_HISTORY_LIMIT });
    } catch (error: unknown) {
        const httpError = error as Partial<HttpError>;
        const status = Number(httpError?.status || 500);
        console.error('[admin-sgcoin-grants]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Failed to load grant history.' });
    }
}

export default withAdminAuth(handler);
