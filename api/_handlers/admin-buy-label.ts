// api/_handlers/admin-buy-label.ts
//
// POST /api/admin-buy-label — one-click label purchase from Admin → Orders.
//
// The Stripe webhook buys labels automatically for paid Stripe intents (card,
// Klarna, Cash App Pay). Manual methods — crypto, Cash App cashtag, cash,
// Venmo — have no webhook: the operator verifies the payment, flips the order
// to paid, and NOW buys the label with one click instead of opening Shippo and
// retyping the address. The same service (services/shipping.ts) powers both
// paths, so the claim-row idempotency, the Ground Advantage rate cap, the
// gates, and both notification emails are identical whichever door is used.
//
// Admin-only through withAdminAuth ('shared' — the operator tooling policy).
// Returns the outcome contract verbatim so the UI can react to skipped/
// retryable/failed distinctly: 'skipped' (already claimed or not paid) is a
// 200 with skipped:true, permanent 'failed' a 422 with the reason, transient
// 'retryable' a 503 (the operator can just click again).

import type { ApiRequest, ApiResponse } from '../_types.js';
import { createHttpError, parseBody, setCorsHeaders } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';
import { purchaseLabelForOrder } from '../../services/shipping.js';

const adminBuyLabel = withAdminAuth(async (req: ApiRequest, res: ApiResponse) => {
    const body = parseBody(req) as { orderId?: string };
    const orderId = String(body.orderId || '').trim();
    if (!orderId) throw createHttpError(400, 'orderId is required.');

    // Never throws: every path inside resolves to a LabelResult.
    const result = await purchaseLabelForOrder(orderId);

    if (result.outcome === 'purchased') {
        res.status(200).json({ ok: true, outcome: result.outcome, shipment: result.shipment });
        return;
    }
    if (result.outcome === 'skipped') {
        // Not an error for the operator: already bought (claim row held by the
        // webhook path) or the order is not in a paid state yet.
        res.status(200).json({ ok: false, outcome: result.outcome, reason: result.reason });
        return;
    }
    if (result.outcome === 'failed') {
        // Permanent (bad address, non-US, rate cap) — the reason is also
        // recorded on the shipments row and emailed to the owner by the
        // service when it originates from the webhook path.
        res.status(422).json({ ok: false, outcome: result.outcome, reason: result.reason });
        return;
    }
    // retryable (Shippo/DB transient) — clicking again is the correct move.
    res.status(503).json({ ok: false, outcome: result.outcome, reason: result.reason });
}, { policy: 'shared' });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    try {
        await adminBuyLabel(req, res);
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[admin-buy-label]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Label purchase failed.' });
    }
}
