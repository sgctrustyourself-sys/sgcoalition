// services/adminShipments.ts
//
// Admin-panel client for GET /api/admin-shipments — the read-only shipment
// feed behind the Shipment column in Admin → Orders. Same bearer/session
// conventions as services/buyLabel.ts; a 401 clears the stale session so the
// login gate takes over.

import { API_BASE_URL } from './apiBase.js';
import { getAdminAuthHeaders, ADMIN_SESSION_EXPIRED_ERROR } from './adminSession.js';

export interface ShipmentStatusRow {
    order_id: string;
    status: 'pending' | 'buying' | 'purchased' | 'failed' | string;
    carrier: string | null;
    service: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    rate_cents: number | null;
    error_reason: string | null;
    shipped_email_sent_at: string | null;
    delivered_email_sent_at: string | null;
    updated_at: string | null;
}

export async function fetchShipmentStatuses(): Promise<ShipmentStatusRow[]> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}/api/admin-shipments`, {
            method: 'GET',
            headers: { ...getAdminAuthHeaders() },
        });
    } catch (e) {
        throw new Error((e as Error)?.message || 'Network error while reading shipments.');
    }

    if (res.status === 401) {
        const { clearAdminSession } = await import('./adminSession.js');
        clearAdminSession();
        throw new Error(ADMIN_SESSION_EXPIRED_ERROR);
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${(body as { error?: string })?.error || 'Shipment read failed.'}`);
    }
    const rows = (body as { shipments?: ShipmentStatusRow[] }).shipments;
    return Array.isArray(rows) ? rows : [];
}
