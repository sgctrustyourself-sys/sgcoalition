// api/_handlers/admin-sgcoin-grant.ts
//
// POST /api/admin-sgcoin-grant — the operator-facing "Send SGCoin" action.
//
// This is the write behind a money-moving button, so it is deliberately thin:
// the handler validates its inputs, then calls public.grant_sgcoin (see
// supabase/migrations/20261023_sgcoin_admin_grants.sql), which increments
// profiles.sg_coin_balance and inserts the audit row in one transaction.
//
// WHY THE BALANCE ISN'T WRITTEN HERE
//   The API holds the service-role key and could update profiles directly, but
//   a read-modify-write from two concurrent grants loses one of them, and the
//   ledger insert could commit without the balance (or the reverse). One RPC
//   body is one transaction, and `UPDATE ... RETURNING` takes the row lock.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, parseBody, type HttpError } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

/** Matches the UUID shape profiles.id uses. Not strict about the version nibble. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Longest note the ledger column is expected to hold. */
const MAX_NOTE_LENGTH = 280;

/** One grant. Guards against `Number.MAX_SAFE_INTEGER`-shaped typos. */
const MAX_GRANT = 1_000_000_000;

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

interface GrantRow {
    grant_id: string;
    balance: number | string;
}

function validate(body: Record<string, unknown>): { userId: string; amount: number; note: string } {
    const userId = String(body.userId ?? '').trim();
    if (!UUID_RE.test(userId)) {
        throw createHttpError(400, 'userId must be a member UUID.');
    }

    // Reject a string amount early: Number('12abc') is NaN, but Number('12')
    // is 12, and accepting the latter invites "12.5" to mean something later.
    const rawAmount = body.amount;
    if (typeof rawAmount !== 'number' && typeof rawAmount !== 'string') {
        throw createHttpError(400, 'amount must be a whole number of SGCoin.');
    }
    const amount = Number(rawAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw createHttpError(400, 'amount must be a positive whole number of SGCoin.');
    }
    if (amount > MAX_GRANT) {
        throw createHttpError(400, `amount must be at most ${MAX_GRANT.toLocaleString()} SGCoin.`);
    }

    const rawNote = body.note;
    const note = typeof rawNote === 'string' ? rawNote.trim() : '';
    if (note.length > MAX_NOTE_LENGTH) {
        throw createHttpError(400, `note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
    }

    return { userId, amount, note };
}

/**
 * The RPC raises plain exceptions, and PostgREST reports them as a 400 with the
 * message text. Map the ones an operator can act on; everything else is a 500
 * so a real outage is not disguised as bad input.
 */
function mapRpcError(message: string): never {
    if (/could not find the function|function .*grant_sgcoin.* does not exist|schema cache/i.test(message)) {
        throw createHttpError(
            503,
            'grant_sgcoin is unavailable — apply supabase/migrations/20261023_sgcoin_admin_grants.sql.',
        );
    }
    if (/Member profile not found/i.test(message)) {
        throw createHttpError(404, 'Member profile not found.');
    }
    if (/positive whole number/i.test(message)) {
        throw createHttpError(400, message);
    }
    throw createHttpError(500, message || 'Failed to grant SGCoin.');
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { userId, amount, note } = validate(parseBody(req));
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('grant_sgcoin', {
            p_user_id: userId,
            p_amount: amount,
            p_note: note || null,
        });

        if (error) {
            mapRpcError(error.message || '');
        }

        // RETURNS TABLE arrives as an array of one row.
        const row = Array.isArray(data) ? (data[0] as GrantRow | undefined) : undefined;
        if (!row) {
            throw createHttpError(500, 'The grant did not return a balance.');
        }

        res.status(200).json({
            userId,
            amount,
            grantId: row.grant_id,
            balanceAfter: Number(row.balance) || 0,
        });
    } catch (error: unknown) {
        const httpError = error as Partial<HttpError>;
        const status = Number(httpError?.status || 500);
        console.error('[admin-sgcoin-grant]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Failed to grant SGCoin.' });
    }
}

export default withAdminAuth(handler);
