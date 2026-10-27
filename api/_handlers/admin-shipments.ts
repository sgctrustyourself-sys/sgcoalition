// api/_handlers/admin-shipments.ts
//
// GET /api/admin-shipments — read-only shipment feed for Admin → Orders.
//
// The shipments table is RLS-locked (service-role writes only, no policies),
// so the browser cannot read it with the anon key. This endpoint is the
// admin-view's read door: the same withAdminAuth 'shared' gate as the Buy
// Label action, and READ-ONLY — a report of label/tracking/milestone state,
// never a writer. The security invariants suite keys on that classification.
//
// Response: { shipments: [...] } — most recent first, capped at 1000, joined
// to orders client-side by order_id (no FK exists by design).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApiRequest, ApiResponse } from '../_types.js';
import { createHttpError, setCorsHeaders } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

function getSupabaseAdmin(): SupabaseClient {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) throw createHttpError(503, 'Supabase is not configured.');
    return createClient(url, key);
}

const adminShipments = withAdminAuth(async (req: ApiRequest, res: ApiResponse) => {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
    const { data, error } = await getSupabaseAdmin()
        .from('shipments')
        .select('order_id,status,carrier,service,tracking_number,tracking_url,rate_cents,error_reason,shipped_email_sent_at,delivered_email_sent_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(1000);
    if (error) throw createHttpError(500, error.message || 'Failed to read shipments.');
    res.status(200).json({ shipments: data || [] });
}, { policy: 'shared' });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    try {
        await adminShipments(req, res);
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[admin-shipments]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Shipment read failed.' });
    }
}
