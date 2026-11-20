// api/_handlers/admin-sgcoin-reverse.ts
//
// POST /api/admin-sgcoin-reverse — take a grant back when it went to the wrong
// member.
//
// The ledger is append-only: this does not edit or delete the original grant.
// It calls public.reverse_sgcoin_grant (see
// supabase/migrations/20261024_sgcoin_grant_reversals.sql), which decrements
// the balance and inserts a negative 'reversal' row in one transaction, so the
// mistake and its correction both stay on the record.
//
// The RPC refuses rather than forcing a reversal: if the member already spent
// the SGCoin, their balance would go negative, and a ledger that says someone
// holds -40 SGCoin is a worse outcome than an operator seeing "balance too
// low". That check is inside the UPDATE's WHERE clause, not a read-then-write
// here.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, parseBody, type HttpError } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

/** Matches the UUID shape sgcoin_admin_grants.id uses. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same ceiling the grant endpoint enforces on its audit note. */
const MAX_NOTE_LENGTH = 280;

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

function validate(body: Record<string, unknown>): { grantId: string; note: string } {
    const grantId = String(body.grantId ?? '').trim();
    if (!UUID_RE.test(grantId)) {
        throw createHttpError(400, 'grantId must be a grant UUID.');
    }

    const rawNote = body.note;
    const note = typeof rawNote === 'string' ? rawNote.trim() : '';
    if (note.length > MAX_NOTE_LENGTH) {
        throw createHttpError(400, `note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
    }

    return { grantId, note };
}

/**
 * PostgREST reports a plpgsql exception as a 400 whose message is the RAISE
 * text. Each of these is something the operator can act on, so they get their
 * own status instead of a blanket 400: "already reversed" and "balance too low"
 * are conflicts with the current state, not malformed input.
 */
function mapRpcError(message: string): never {
    if (/could not find the function|function .*reverse_sgcoin_grant.* does not exist|schema cache/i.test(message)) {
        throw createHttpError(
            503,
            'reverse_sgcoin_grant is unavailable — apply supabase/migrations/20261024_sgcoin_grant_reversals.sql.',
        );
    }
    if (/Grant not found/i.test(message)) {
        throw createHttpError(404, 'Grant not found.');
    }
    if (/already reversed/i.test(message)) {
        throw createHttpError(409, 'This grant was already reversed.');
    }
    if (/Only a grant can be reversed/i.test(message)) {
        throw createHttpError(409, 'Only a grant can be reversed.');
    }
    if (/balance is too low/i.test(message)) {
        throw createHttpError(409, message);
    }
    if (/Member profile not found/i.test(message)) {
        throw createHttpError(404, 'Member profile not found.');
    }
    if (/grant id is required/i.test(message)) {
        throw createHttpError(400, message);
    }
    throw createHttpError(500, message || 'Failed to reverse the grant.');
}

interface ReversalRow {
    reversal_id: string;
    new_balance: number | string;
    reversed_amount: number | string;
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { grantId, note } = validate(parseBody(req));
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('reverse_sgcoin_grant', {
            p_grant_id: grantId,
            p_note: note || null,
        });

        if (error) {
            mapRpcError(error.message || '');
        }

        // RETURNS TABLE arrives as an array of one row.
        const row = Array.isArray(data) ? (data[0] as ReversalRow | undefined) : undefined;
        if (!row) {
            throw createHttpError(500, 'The reversal did not return a balance.');
        }

        res.status(200).json({
            grantId,
            reversalId: row.reversal_id,
            reversedAmount: Number(row.reversed_amount) || 0,
            balanceAfter: Number(row.new_balance) || 0,
        });
    } catch (error: unknown) {
        const httpError = error as Partial<HttpError>;
        const status = Number(httpError?.status || 500);
        console.error('[admin-sgcoin-reverse]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Failed to reverse the grant.' });
    }
}

export default withAdminAuth(handler);
