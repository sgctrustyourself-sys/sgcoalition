// tests/shippoWebhook.test.ts
//
// Tests for api/shippo-webhook.ts — the token-gated tracking-update route.
// The contract under test:
//   - token gate: missing/wrong/unconfigured token never reaches the service
//   - dispatch: a valid token with a tracking number reaches the milestone
//     service exactly once with the flattened fields
//   - malformed body -> 400 (Shippo retries)
//   - non-POST -> 405
//   - service result maps onto 200 with the action/reason
//
// The milestone service is mocked at the module boundary (its own contract in
// tests/shippingMilestones.test.ts).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockHandle = vi.fn();
vi.mock('../services/shippingMilestones', () => ({
    handleTrackingUpdate: (...args: unknown[]) => mockHandle(...args),
}));

import shippoWebhookHandler from '../api/shippo-webhook';

const TOKEN = 'abcd1234efgh5678ijkl9012mnop3456';

function makeReq(opts: { method?: string; token?: string; headerToken?: string; body?: unknown } = {}) {
    const query: Record<string, unknown> = {};
    if (opts.token !== undefined) query.token = opts.token;
    return {
        method: opts.method ?? 'POST',
        headers: opts.headerToken ? { 'x-shippo-token': opts.headerToken } : {},
        query,
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

const VALID_BODY = {
    carrier: 'usps',
    tracking_number: '9400111899560000000000',
    tracking_status: { status: 'IN_TRANSIT', status_details: 'Accepted at USPS facility' },
    eta: '2026-10-08',
};

describe('POST /api/shippo-webhook', () => {
    beforeEach(() => {
        mockHandle.mockReset();
        mockHandle.mockResolvedValue({ action: 'shipped_email', reason: 'in_transit' });
        process.env.SHIPPO_WEBHOOK_TOKEN = TOKEN;
    });

    afterEach(() => {
        delete process.env.SHIPPO_WEBHOOK_TOKEN;
    });

    it('OPTIONS -> 200 without touching the service', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ method: 'OPTIONS' }), res);
        expect(res.statusCode).toBe(200);
        expect(mockHandle).not.toHaveBeenCalled();
    });

    it('missing token -> 401 and the service never runs', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ body: VALID_BODY }), res);
        expect(res.statusCode).toBe(401);
        expect(mockHandle).not.toHaveBeenCalled();
    });

    it('wrong token -> 401', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ token: 'nope', body: VALID_BODY }), res);
        expect(res.statusCode).toBe(401);
        expect(mockHandle).not.toHaveBeenCalled();
    });

    it('token in the X-Shippo-Token header is accepted', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ headerToken: TOKEN, body: VALID_BODY }), res);
        expect(res.statusCode).toBe(200);
        expect(mockHandle).toHaveBeenCalledTimes(1);
    });

    it('unconfigured deployment -> 500 and accepts nothing', async () => {
        delete process.env.SHIPPO_WEBHOOK_TOKEN;
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ token: 'anything', body: VALID_BODY }), res);
        expect(res.statusCode).toBe(500);
        expect(mockHandle).not.toHaveBeenCalled();
    });

    it('non-POST -> 405', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ method: 'GET', token: TOKEN }), res);
        expect(res.statusCode).toBe(405);
    });

    it('body without a tracking number -> 400', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ token: TOKEN, body: { tracking_status: { status: 'IN_TRANSIT' } } }), res);
        expect(res.statusCode).toBe(400);
        expect(mockHandle).not.toHaveBeenCalled();
    });

    it('valid update dispatches with flattened fields and answers 200', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ token: TOKEN, body: VALID_BODY }), res);

        expect(res.statusCode).toBe(200);
        expect(mockHandle).toHaveBeenCalledTimes(1);
        const arg = mockHandle.mock.calls[0][0];
        expect(arg.trackingNumber).toBe('9400111899560000000000');
        expect(arg.status).toBe('IN_TRANSIT');
        expect(arg.statusDetails).toBe('Accepted at USPS facility');
        expect(arg.eta).toBe('2026-10-08');
        expect(res.body).toEqual({ received: true, action: 'shipped_email', reason: 'in_transit' });
    });

    it('event-envelope shape (fields under data) is handled', async () => {
        const res = makeRes();
        await shippoWebhookHandler(makeReq({
            token: TOKEN,
            body: { data: { ...VALID_BODY } },
        }), res);

        expect(res.statusCode).toBe(200);
        expect(mockHandle.mock.calls[0][0].trackingNumber).toBe('9400111899560000000000');
    });

    it('a service throw -> 500 so Shippo retries', async () => {
        mockHandle.mockRejectedValue(new Error('supabase down'));
        const res = makeRes();
        await shippoWebhookHandler(makeReq({ token: TOKEN, body: VALID_BODY }), res);
        expect(res.statusCode).toBe(500);
    });
});
