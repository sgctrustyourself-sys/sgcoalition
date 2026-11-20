// api/_handlers/admin-refund.ts
//
// POST /api/admin-refund — issue a Stripe refund from Admin → Orders.
//
// Body: { orderId, amount (dollars), reason, adminId? }
// The refund is an admin override of the customer's no-refunds consent, so the
// audit row, the Stripe refund and the order update all happen in
// services/refundPayments.ts. This endpoint only gates, validates the body, and
// maps errors onto HTTP.
//
// Admin-only through withAdminAuth ('shared'): it moves real money.

import type { ApiRequest, ApiResponse } from '../_types.js';
import { createHttpError, parseBody, setCorsHeaders } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';
import { issueOrderRefund } from '../../services/refundPayments.js';

const adminRefund = withAdminAuth(async (req: ApiRequest, res: ApiResponse) => {
    const body = parseBody(req) as { orderId?: string; amount?: number | string; reason?: string; adminId?: string };

    const orderId = String(body.orderId || '').trim();
    if (!orderId) throw createHttpError(400, 'orderId is required.');

    const reason = String(body.reason || '').trim();
    if (!reason) throw createHttpError(400, 'A reason is required for every refund.');

    const amountDollars = Number(body.amount);
    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
        throw createHttpError(400, 'amount must be a positive dollar value.');
    }

    const adminId = String(body.adminId || 'admin').trim().slice(0, 200) || 'admin';

    const result = await issueOrderRefund({
        orderId,
        amountCents: Math.round(amountDollars * 100),
        reason: reason.slice(0, 500),
        adminId,
    });

    res.status(200).json({ ok: true, ...result });
}, { policy: 'shared' });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    try {
        await adminRefund(req, res);
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[admin-refund]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Refund failed.' });
    }
}
