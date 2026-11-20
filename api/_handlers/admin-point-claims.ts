// api/_handlers/admin-point-claims.ts
//
// GET  /api/admin-point-claims — the review queue behind the "Point Claims"
//      panel in Admin → SGCoin Distribution.
// POST /api/admin-point-claims — approve or reject one claim.
//
// WHY THIS IS AN API ROUTE AND NOT A CLIENT QUERY
//   point_claims carries an admin SELECT policy keyed on
//   `admin_users.user_id = auth.uid()`, and that policy cannot fire from this
//   panel: the admin session is a shared secret minted by /api/admin-verify
//   (api/_adminAuth.ts), not a Supabase user, so auth.uid() is null. The same
//   reason admin-sgcoin-members and admin-sgcoin-grants exist. Reads and writes
//   therefore go through the service-role client, behind withAdminAuth.
//
// WHY THE WRITE IS ONE RPC CALL
//   Approval both mints SGCoin and closes the claim. approve_point_claim does
//   both in one transaction (supabase/migrations/20261027_create_point_claims.sql)
//   so there is no window where points exist without a closed claim, or a claim
//   says "approved" with no balance moved. This handler only validates and
//   forwards — it never writes a balance itself.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, parseBody, type HttpError } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

/** Matches the UUID shape point_claims.id uses. Not strict about the version nibble. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Longest review note the admin column is expected to hold. */
const MAX_NOTE_LENGTH = 280;

/** One page of the queue. Well above the number of claims a human reviews at once. */
const MAX_CLAIMS = 500;

/** Ceiling on an override amount, same guard as the manual grant route. */
const MAX_GRANT = 1_000_000_000;

const STATUSES = ['pending', 'approved', 'rejected'] as const;
type ClaimStatus = (typeof STATUSES)[number];

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

interface ClaimRow {
    id: string;
    user_id: string;
    claimant_email: string;
    order_id: string | null;
    order_number: string;
    order_email: string;
    matched: boolean;
    points: number | string;
    proof_url: string | null;
    note: string | null;
    status: ClaimStatus;
    granted_amount: number | string | null;
    review_note: string | null;
    reviewed_at: string | null;
    created_at: string;
}

/**
 * The RPCs raise plain exceptions and PostgREST reports them as a 400 carrying
 * the message. Map the ones an operator can act on; anything else stays a 500 so
 * an outage is not disguised as bad input.
 */
function mapRpcError(message: string): never {
    if (/could not find the function|does not exist|schema cache/i.test(message)) {
        throw createHttpError(
            503,
            'Point claim functions are unavailable — apply supabase/migrations/20261027_create_point_claims.sql.',
        );
    }
    if (/Claim not found/i.test(message)) {
        throw createHttpError(404, 'Claim not found.');
    }
    if (/already (approved|rejected|pending)|is already/i.test(message)) {
        // Two operators reviewing the same claim: the second one is told, not
        // silently double-credited.
        throw createHttpError(409, message);
    }
    if (/positive whole number|too long|required|under \d+ characters/i.test(message)) {
        throw createHttpError(400, message);
    }
    throw createHttpError(500, message || 'Point claim review failed.');
}

/**
 * Who the points will land on.
 *
 * Fetched separately from the claims because the claim carries the ACCOUNT id
 * while the operator wants to see a human: the reviewer is comparing three
 * addresses (account, what the buyer typed, what the order says) and a member
 * name makes a mismatch obvious. A failure here degrades to ids rather than
 * failing the whole queue — the name is a convenience, the claim is the work.
 */
async function loadMemberLabels(
    supabase: SupabaseClient,
    userIds: string[],
): Promise<Map<string, { name: string | null; email: string | null }>> {
    const labels = new Map<string, { name: string | null; email: string | null }>();
    if (userIds.length === 0) return labels;

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

    if (error) {
        console.error('[admin-point-claims] member label read failed:', error.message);
        return labels;
    }

    for (const row of (data || []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        labels.set(row.id, { name: row.full_name || null, email: row.email || null });
    }
    return labels;
}

async function listClaims(supabase: SupabaseClient, status: ClaimStatus | null): Promise<unknown[]> {
    let query = supabase
        .from('point_claims')
        .select(
            'id, user_id, claimant_email, order_id, order_number, order_email, matched, points, proof_url, note, status, granted_amount, review_note, reviewed_at, created_at',
        )
        .limit(MAX_CLAIMS);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
            throw createHttpError(
                503,
                'point_claims is missing — apply supabase/migrations/20261027_create_point_claims.sql.',
            );
        }
        throw createHttpError(500, error.message || 'Failed to load point claims.');
    }

    const rows = ((data || []) as unknown as ClaimRow[]).slice();
    // The queue reads top-down, so pending comes first, oldest first (first in,
    // first reviewed) and everything already reviewed sits below it, newest
    // first. Sorting here rather than in SQL keeps the two orderings off one
    // query; a claim count that needs pagination would move this into the RPC.
    rows.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        const aTime = Date.parse(a.created_at) || 0;
        const bTime = Date.parse(b.created_at) || 0;
        return a.status === 'pending' ? aTime - bTime : bTime - aTime;
    });

    const labels = await loadMemberLabels(supabase, [...new Set(rows.map((row) => row.user_id))]);

    return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        memberName: labels.get(row.user_id)?.name || null,
        memberEmail: labels.get(row.user_id)?.email || null,
        claimantEmail: row.claimant_email,
        orderId: row.order_id,
        orderNumber: row.order_number,
        orderEmail: row.order_email,
        matched: Boolean(row.matched),
        points: Number(row.points) || 0,
        proofUrl: row.proof_url,
        note: row.note,
        status: row.status,
        grantedAmount: row.granted_amount == null ? null : Number(row.granted_amount),
        reviewNote: row.review_note,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
    }));
}

interface ReviewInput {
    claimId: string;
    action: 'approve' | 'reject';
    amount: number | null;
    note: string;
}

function validateReview(body: Record<string, unknown>): ReviewInput {
    const claimId = String(body.claimId ?? body.id ?? '').trim();
    if (!UUID_RE.test(claimId)) {
        throw createHttpError(400, 'claimId must be a claim UUID.');
    }

    const action = String(body.action ?? '').trim().toLowerCase();
    if (action !== 'approve' && action !== 'reject') {
        throw createHttpError(400, "action must be 'approve' or 'reject'.");
    }

    // The amount is optional and only meaningful on approval: absent means "pay
    // what the order says", which is what the RPC falls back to. A string is
    // rejected rather than coerced, matching the manual grant route — Number('12')
    // is 12, and accepting that invites "12.5" to mean something later.
    let amount: number | null = null;
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
        if (typeof body.amount !== 'number' && typeof body.amount !== 'string') {
            throw createHttpError(400, 'amount must be a whole number of SGCoin.');
        }
        const parsed = Number(body.amount);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
            throw createHttpError(400, 'amount must be a positive whole number of SGCoin.');
        }
        if (parsed > MAX_GRANT) {
            throw createHttpError(400, `amount must be at most ${MAX_GRANT.toLocaleString()} SGCoin.`);
        }
        amount = parsed;
    }

    const rawNote = body.note ?? body.reason;
    const note = typeof rawNote === 'string' ? rawNote.trim() : '';
    if (note.length > MAX_NOTE_LENGTH) {
        throw createHttpError(400, `note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
    }

    return { claimId, action, amount, note };
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    try {
        const supabase = getSupabaseAdmin();
        const method = (req.method || 'GET').toUpperCase();

        if (method === 'GET') {
            const rawStatus = req.query?.status;
            const requested = (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus)?.trim() ?? '';
            if (requested && !(STATUSES as readonly string[]).includes(requested)) {
                throw createHttpError(400, `status must be one of ${STATUSES.join(', ')}.`);
            }
            const claims = await listClaims(supabase, (requested || null) as ClaimStatus | null);
            res.status(200).json({ claims, limit: MAX_CLAIMS });
            return;
        }

        if (method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        const { claimId, action, amount, note } = validateReview(parseBody(req));

        if (action === 'reject') {
            const { data, error } = await supabase.rpc('reject_point_claim', {
                p_claim_id: claimId,
                p_reason: note || null,
            });
            if (error) mapRpcError(error.message || '');

            const row = Array.isArray(data) ? (data[0] as { claim_id: string; status: string } | undefined) : undefined;
            res.status(200).json({ claimId: row?.claim_id || claimId, status: row?.status || 'rejected', granted: 0 });
            return;
        }

        const { data, error } = await supabase.rpc('approve_point_claim', {
            p_claim_id: claimId,
            // null means "whatever the order is worth" — the RPC decides, so an
            // override is always an explicit operator number.
            p_amount: amount,
            p_note: note || null,
        });
        if (error) mapRpcError(error.message || '');

        const row = Array.isArray(data)
            ? (data[0] as { claim_id: string; granted: number | string; balance: number | string } | undefined)
            : undefined;
        if (!row) {
            throw createHttpError(500, 'The approval did not return a granted amount.');
        }

        res.status(200).json({
            claimId: row.claim_id || claimId,
            status: 'approved',
            granted: Number(row.granted) || 0,
            balanceAfter: Number(row.balance) || 0,
        });
    } catch (error: unknown) {
        const httpError = error as Partial<HttpError>;
        const status = Number(httpError?.status || 500);
        console.error('[admin-point-claims]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Point claim review failed.' });
    }
}

export default withAdminAuth(handler);
