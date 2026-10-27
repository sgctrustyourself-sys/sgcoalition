// services/pointClaim.ts
//
// The buyer-facing half of point claims: "I ordered, and I never got the SGCoin
// for it."
//
// WHY THIS EXISTS
//   SGCoin is minted per order (orders.sg_coin_reward) but credited to
//   public.profiles.sg_coin_balance, which is keyed on a member account. A
//   shopper who checked out as a guest, or who ordered before signing up, had an
//   order with a reward and no account to receive it — and no screen anywhere
//   could ask for it. The only path that paid SGCoin was the admin Distribution
//   tab, which needs a member UUID, so a guest could never be made whole.
//
// WHAT A CLAIM IS
//   A request, not a credit. Nothing here mints SGCoin: submit records the claim
//   and an operator approves it in the SGCoin admin area, which pays through
//   public.grant_sgcoin (same transactional grant + ledger row as a manual send).
//
// THE BROWSER DOES NOT DECIDE THE AMOUNT
//   lookup/submit pass only what the buyer typed (order number, email, note) plus
//   an uploaded proof URL. Points, `matched` and the order link are computed
//   server-side by the RPCs in
//   supabase/migrations/20261027_create_point_claims.sql — this file never sends
//   an amount, so a doctored request cannot assert its own reward.
//
// Sign-in is required for both calls: the RPCs key the claim on auth.uid() and
// the points have to land in a real balance. `lookup_order_points` is granted to
// authenticated (not anon) on purpose — it is an order-number/email oracle, and
// the claim flow always has an account by the time it is called.

import { supabase } from './supabase.js';

/** Longest note the RPC accepts; kept in step with submit_point_claim. */
export const MAX_CLAIM_NOTE_LENGTH = 1000;

export type PointClaimStatus = 'pending' | 'approved' | 'rejected';

/** What the order record says, before the buyer commits to a claim. */
export interface PointClaimLookup {
    matched: boolean;
    /** SGCoin the matched order is worth. 0 when nothing matched. */
    points: number;
    /** Order total in dollars, for "yes, this is my $84 order" confidence. */
    orderTotal: number | null;
    orderDate: string | null;
    /** True when this order already has a pending or approved claim. */
    alreadyClaimed: boolean;
}

/** The row the RPC created. `matched` false means it is queued for review. */
export interface SubmittedPointClaim {
    claimId: string;
    status: PointClaimStatus;
    points: number;
    matched: boolean;
}

/** RPC rows arrive as a one-element array, and numerics can arrive as strings. */
function firstRow<T>(data: unknown): T | null {
    if (Array.isArray(data)) return (data[0] as T) ?? null;
    return (data as T) ?? null;
}

function rpcMessage(error: { message?: string } | null, fallback: string): string {
    const message = error?.message?.trim();
    if (!message) return fallback;
    // PostgREST reports a missing function as "Could not find the function
    // public.<name>(...) in the schema cache" — an unapplied migration, not a bad
    // request, so say which file to run instead of echoing the plumbing.
    if (/could not find the function|does not exist|schema cache/i.test(message)) {
        return 'Point claims are not available yet — apply supabase/migrations/20261027_create_point_claims.sql.';
    }
    return message;
}

/**
 * Read the points an order is owed, without claiming anything.
 *
 * Refuses to answer for a signed-out visitor (the RPC raises), which is why the
 * claim page shows its sign-in step before the lookup form.
 */
export async function lookupOrderPoints(orderNumber: string, email: string): Promise<PointClaimLookup> {
    const { data, error } = await supabase.rpc('lookup_order_points', {
        p_order_number: orderNumber.trim(),
        p_email: email.trim(),
    });

    if (error) {
        console.error('Error looking up order points:', error);
        throw new Error(rpcMessage(error, 'Could not look that order up.'));
    }

    const row = firstRow<{
        matched: boolean;
        points: number | string | null;
        order_total: number | string | null;
        order_date: string | null;
        already_claimed: boolean | null;
    }>(data);

    if (!row) return { matched: false, points: 0, orderTotal: null, orderDate: null, alreadyClaimed: false };

    return {
        matched: Boolean(row.matched),
        points: Number(row.points) || 0,
        orderTotal: row.order_total == null ? null : Number(row.order_total),
        orderDate: row.order_date || null,
        alreadyClaimed: Boolean(row.already_claimed),
    };
}

/**
 * Submit a claim for the signed-in account.
 *
 * `proofUrl` is required by the RPC only when the order could not be matched —
 * a matched claim is already evidenced by the order plus the email match, so the
 * screenshot is for the case where the operator has to look at something.
 */
export async function submitPointClaim(input: {
    orderNumber: string;
    email: string;
    proofUrl?: string | null;
    note?: string | null;
}): Promise<SubmittedPointClaim> {
    const note = input.note?.trim() ?? '';
    if (note.length > MAX_CLAIM_NOTE_LENGTH) {
        throw new Error(`Keep the note under ${MAX_CLAIM_NOTE_LENGTH} characters.`);
    }

    const { data, error } = await supabase.rpc('submit_point_claim', {
        p_order_number: input.orderNumber.trim(),
        p_email: input.email.trim(),
        p_proof_url: input.proofUrl?.trim() || null,
        p_note: note || null,
    });

    if (error) {
        console.error('Error submitting point claim:', error);
        throw new Error(rpcMessage(error, 'Could not submit that claim.'));
    }

    const row = firstRow<{ claim_id: string; status: PointClaimStatus; points: number | string | null; matched: boolean }>(data);
    if (!row?.claim_id) {
        throw new Error('The claim was submitted but no claim id came back.');
    }

    return {
        claimId: row.claim_id,
        status: row.status,
        points: Number(row.points) || 0,
        matched: Boolean(row.matched),
    };
}

/** The buyer's own claims, newest first — what the page lists after submitting. */
export interface MyPointClaim {
    id: string;
    orderNumber: string;
    matched: boolean;
    points: number;
    status: PointClaimStatus;
    grantedAmount: number | null;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
}

/**
 * Read the signed-in account's own claims.
 *
 * A plain RLS-gated select rather than an RPC: the policy on point_claims is
 * `auth.uid() = user_id`, so the database decides which rows these are and a
 * caller cannot ask for anyone else's.
 */
export async function getMyPointClaims(): Promise<MyPointClaim[]> {
    const { data, error } = await supabase
        .from('point_claims')
        .select('id, order_number, matched, points, status, granted_amount, review_note, created_at, reviewed_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching point claims:', error);
        return [];
    }

    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        orderNumber: String(row.order_number ?? ''),
        matched: Boolean(row.matched),
        points: Number(row.points) || 0,
        status: (row.status as PointClaimStatus) || 'pending',
        grantedAmount: row.granted_amount == null ? null : Number(row.granted_amount),
        reviewNote: (row.review_note as string | null) || null,
        createdAt: String(row.created_at || ''),
        reviewedAt: (row.reviewed_at as string | null) || null,
    }));
}
