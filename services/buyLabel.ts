// services/buyLabel.ts
//
// Admin-panel client for POST /api/admin-buy-label — the one-click
// "Buy shipping label" action in Admin → Orders. Same bearer/session
// conventions as services/productDrift.ts: getAdminAuthHeaders echoes the
// stashed admin token, a 401 clears the stale session so the login gate
// takes over, and any other failure surfaces the server's message.

import { API_BASE_URL } from './apiBase.js';
import { getAdminAuthHeaders, ADMIN_SESSION_EXPIRED_ERROR } from './adminSession.js';

export interface BoughtShipment {
    trackingNumber: string;
    trackingUrl: string;
    labelUrl: string;
    rateCents: number;
    carrier: string;
    service: string;
}

export interface BuyLabelResult {
    outcome: 'purchased' | 'skipped' | 'retryable' | 'failed';
    reason?: string;
    shipment?: BoughtShipment;
}

export async function buyLabelForOrder(orderId: string): Promise<BuyLabelResult> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}/api/admin-buy-label`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
            body: JSON.stringify({ orderId }),
        });
    } catch (e) {
        throw new Error((e as Error)?.message || 'Network error while buying the label.');
    }

    if (res.status === 401) {
        // Stale admin session — clear both keys (imports lazily to keep this
        // module import-light; the session module owns the clear policy).
        const { clearAdminSession } = await import('./adminSession.js');
        clearAdminSession();
        throw new Error(ADMIN_SESSION_EXPIRED_ERROR);
    }

    const body = await res.json().catch(() => ({}));

    // The endpoint maps outcomes onto HTTP deliberately (200 purchased/skipped,
    // 422 permanent, 503 retryable) — decode the outcome contract from the body
    // when present, fall back to the status code otherwise.
    if (body && typeof body === 'object' && body.outcome) {
        return body as BuyLabelResult;
    }
    throw new Error(`HTTP ${res.status} — ${(body as { error?: string })?.error || 'Label purchase failed.'}`);
}
