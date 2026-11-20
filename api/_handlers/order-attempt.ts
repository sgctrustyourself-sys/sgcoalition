// POST /api/order-attempt — "has the checkout attempt I already sent produced
// an order?"
//
// One question, one owner: the read itself lives in services/orderIntake.ts
// (findRecordedOrderNumber) so the SAME buyer-scoping rule guards it and the
// write path. This file is only transport plus input normalisation, which is
// why it needs no Supabase client of its own.
//
// It is public because its caller is a shopper mid-checkout, and it is
// buyer-scoped because the attempt id is unauthenticated client input: an
// attempt recorded for someone else answers `recorded: false`, so the id can
// never be used to confirm — let alone read — another customer's order.
//
// The client needs the answer to decide whether to re-send the attempt it
// already has or to leave the settled order alone (pages/Checkout.tsx). Before
// this, it guessed from a 30-minute clock, which could place a second order and
// debit store credit twice for one purchase once the window had passed.
//
// POST rather than GET: the buyer identity travels in the body (no email in a
// URL or an access log), and api/_helpers.ts budgets POSTs per slug while
// skipping GETs as cacheable reads — this one is neither cacheable nor free.

import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, parseBody, setCorsHeaders } from '../_helpers.js';
import { findRecordedOrderNumber } from '../../services/orderIntake.js';

// The same bound the write path applies to an id it accepts as a row key.
const ORDER_ID_MAX = 100;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const body = parseBody(req);
        const id = String(body.id ?? '').trim();
        if (!id || id.length > ORDER_ID_MAX) throw createHttpError(400, 'A checkout attempt id is required.');

        const orderNumber = await findRecordedOrderNumber(id, {
            user_id: typeof body.userId === 'string' ? body.userId : null,
            customer_email: typeof body.customerEmail === 'string' ? body.customerEmail : null,
        });

        res.status(200).json({ recorded: orderNumber !== null, orderNumber });
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[Order Attempt API]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Attempt lookup failed.' });
    }
}
