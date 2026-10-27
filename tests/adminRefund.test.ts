// tests/adminRefund.test.ts
//
// Tests for POST /api/admin-refund — the admin-only Stripe refund endpoint.
//
// The contract under test:
//   - admin-only ('shared' policy): anonymous/wrong token -> 401, no refund
//   - body validation: orderId, reason and a positive amount are required
//   - the amount is converted to cents before it reaches the service
//   - service errors keep their HTTP status
//
// services/refundPayments is mocked at the module boundary; its own behaviour
// is covered in tests/refundPayments.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockIssueRefund = vi.hoisted(() => vi.fn());
vi.mock('../services/refundPayments', () => ({
    issueOrderRefund: (...args: unknown[]) => mockIssueRefund(...args),
}));

// The shared-secret policy never reaches Supabase; mocked so the import is inert.
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({})),
}));

import adminRefundHandler from '../api/_handlers/admin-refund';

const ADMIN_TOKEN = 'admin-token-refund-12345';

function makeReq(opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
    return {
        method: opts.method ?? 'POST',
        headers: opts.headers ?? {},
        query: {},
        url: '/api/admin-refund',
        body: opts.body ?? null,
    } as any;
}

function makeRes() {
    const res: any = {
        statusCode: 0,
        body: undefined,
        setHeader: vi.fn(),
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(b: unknown) {
            res.body = b;
            return res;
        },
        end() {
            return res;
        },
    };
    return res;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('POST /api/admin-refund', () => {
    beforeEach(() => {
        mockIssueRefund.mockReset();
        process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
    });

    afterEach(() => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
    });

    it('OPTIONS preflight -> 200 and no refund attempt', async () => {
        const res = makeRes();
        await adminRefundHandler(makeReq({ method: 'OPTIONS' }), res);

        expect(res.statusCode).toBe(200);
        expect(mockIssueRefund).not.toHaveBeenCalled();
    });

    it('anonymous -> 401, no refund attempt', async () => {
        const res = makeRes();
        await adminRefundHandler(makeReq({ body: { orderId: 'o1', amount: 10, reason: 'damaged' } }), res);

        expect(res.statusCode).toBe(401);
        expect(mockIssueRefund).not.toHaveBeenCalled();
    });

    it('wrong token -> 401, no refund attempt', async () => {
        const res = makeRes();
        await adminRefundHandler(
            makeReq({ headers: bearer('not-the-token'), body: { orderId: 'o1', amount: 10, reason: 'damaged' } }),
            res,
        );

        expect(res.statusCode).toBe(401);
        expect(mockIssueRefund).not.toHaveBeenCalled();
    });

    it('non-POST -> 405', async () => {
        const res = makeRes();
        await adminRefundHandler(makeReq({ method: 'GET', headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(405);
        expect(mockIssueRefund).not.toHaveBeenCalled();
    });

    it('missing orderId -> 400', async () => {
        const res = makeRes();
        await adminRefundHandler(makeReq({ headers: bearer(ADMIN_TOKEN), body: { amount: 10, reason: 'x' } }), res);

        expect(res.statusCode).toBe(400);
        expect(mockIssueRefund).not.toHaveBeenCalled();
    });

    it('missing reason -> 400: every refund must say why', async () => {
        const res = makeRes();
        await adminRefundHandler(
            makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'o1', amount: 10, reason: '   ' } }),
            res,
        );

        expect(res.statusCode).toBe(400);
        expect(mockIssueRefund).not.toHaveBeenCalled();
    });

    it.each([
        ['zero', 0],
        ['negative', -5],
        ['non-numeric', 'abc'],
    ])('rejects a %s amount with 400', async (_label, amount) => {
        const res = makeRes();
        await adminRefundHandler(
            makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'o1', amount, reason: 'x' } }),
            res,
        );

        expect(res.statusCode).toBe(400);
        expect(mockIssueRefund).not.toHaveBeenCalled();
    });

    it('converts dollars to cents and forwards the trimmed reason to the service', async () => {
        mockIssueRefund.mockResolvedValue({
            refundId: 're_1',
            exceptionId: 'exc_1',
            amountCents: 1999,
            fullyRefunded: false,
        });

        const res = makeRes();
        await adminRefundHandler(
            makeReq({
                headers: bearer(ADMIN_TOKEN),
                body: { orderId: 'order_1', amount: 19.99, reason: '  shipping error  ', adminId: 'ops' },
            }),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            ok: true,
            refundId: 're_1',
            exceptionId: 'exc_1',
            amountCents: 1999,
            fullyRefunded: false,
        });
        expect(mockIssueRefund).toHaveBeenCalledWith({
            orderId: 'order_1',
            amountCents: 1999,
            reason: 'shipping error',
            adminId: 'ops',
        });
    });

    it('defaults adminId when the caller omits it', async () => {
        mockIssueRefund.mockResolvedValue({ refundId: 're_2', exceptionId: 'exc_2', amountCents: 500, fullyRefunded: true });

        await adminRefundHandler(
            makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'order_2', amount: 5, reason: 'gesture' } }),
            makeRes(),
        );

        expect(mockIssueRefund).toHaveBeenCalledWith(expect.objectContaining({ adminId: 'admin' }));
    });

    it('keeps the service error status (e.g. a non-Stripe order -> 422)', async () => {
        mockIssueRefund.mockRejectedValue(
            Object.assign(new Error('Only orders paid by Stripe card can be refunded automatically.'), { status: 422 }),
        );

        const res = makeRes();
        await adminRefundHandler(
            makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'order_3', amount: 10, reason: 'x' } }),
            res,
        );

        expect(res.statusCode).toBe(422);
        expect(res.body).toEqual({ error: 'Only orders paid by Stripe card can be refunded automatically.' });
    });

    it('an unexpected failure with no status surfaces as 500', async () => {
        mockIssueRefund.mockRejectedValue(new Error('boom'));

        const res = makeRes();
        await adminRefundHandler(
            makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'order_4', amount: 10, reason: 'x' } }),
            res,
        );

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'boom' });
    });
});
