// services/adminPointClaims.ts
//
// Admin-panel client for /api/admin-point-claims — the review queue behind the
// "Point Claims" panel in Admin → SGCoin Distribution.
//
// Why an API route rather than reading point_claims from here: the admin session
// is a shared secret (services/adminSession.ts), not a Supabase user, so the
// table's admin RLS policy (admin_users.user_id = auth.uid()) never fires for
// this panel. The same bearer/session conventions as services/adminShipments.ts
// apply: a 401 clears the stale session so the login gate takes over.

import { API_BASE_URL } from './apiBase.js';
import { getAdminAuthHeaders, clearAdminSession, ADMIN_SESSION_EXPIRED_ERROR } from './adminSession.js';

export type PointClaimStatus = 'pending' | 'approved' | 'rejected';

export interface PointClaimRow {
    id: string;
    userId: string;
    /** Name/email on the member the points will land on, when a profile exists. */
    memberName: string | null;
    memberEmail: string | null;
    /** Email on the account that filed the claim. */
    claimantEmail: string;
    orderId: string | null;
    orderNumber: string;
    /** Email typed as "used on the order" — the one the matcher was given. */
    orderEmail: string;
    matched: boolean;
    points: number;
    proofUrl: string | null;
    note: string | null;
    status: PointClaimStatus;
    grantedAmount: number | null;
    reviewNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, init);
    } catch (e) {
        throw new Error((e as Error)?.message || 'Network error while reading point claims.');
    }

    if (res.status === 401) {
        clearAdminSession();
        throw new Error(ADMIN_SESSION_EXPIRED_ERROR);
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${(body as { error?: string })?.error || 'Point claim request failed.'}`);
    }
    return body;
}

/** The queue: pending first (oldest first), then everything already reviewed. */
export async function fetchPointClaims(status?: PointClaimStatus): Promise<PointClaimRow[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const body = (await request(`/api/admin-point-claims${query}`, {
        method: 'GET',
        headers: { ...getAdminAuthHeaders() },
    })) as { claims?: PointClaimRow[] };
    return Array.isArray(body.claims) ? body.claims : [];
}

/**
 * Pay a claim.
 *
 * `amount` is optional and only sent when the operator overrides what the order
 * says — the RPC falls back to the claim's own points, so the review UI never
 * has to restate a number it did not change. Whole SGCoin only.
 */
export async function approvePointClaim(
    claimId: string,
    amount?: number | null,
    note?: string,
): Promise<{ granted: number; balanceAfter: number }> {
    const body = (await request('/api/admin-point-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({
            action: 'approve',
            claimId,
            ...(amount == null ? {} : { amount }),
            ...(note ? { note } : {}),
        }),
    })) as { granted?: number; balanceAfter?: number };

    return { granted: Number(body.granted) || 0, balanceAfter: Number(body.balanceAfter) || 0 };
}

/** Close a claim without paying it. Nothing is refunded: a rejected claim never moved SGCoin. */
export async function rejectPointClaim(claimId: string, reason?: string): Promise<void> {
    await request('/api/admin-point-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ action: 'reject', claimId, ...(reason ? { note: reason } : {}) }),
    });
}
