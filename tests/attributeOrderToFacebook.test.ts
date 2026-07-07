import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFromChain } = vi.hoisted(() => {
    const chain: any = {};
    chain.update = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    return { mockFromChain: chain };
});

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: () => mockFromChain }),
}));

import handler from '../api/_handlers/attribute-order-to-facebook';

type StubRes = {
    statusCode: number;
    body: any;
    status: (code: number) => StubRes;
    json: (data: unknown) => void;
    send: (data: string | Buffer) => void;
    setHeader: (name: string, value: string | string[]) => void;
    end: () => void;
};

function makeRes(): StubRes {
    const res: StubRes = {
        statusCode: 0,
        body: undefined,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(data) { this.body = data; },
        send(data) { this.body = data; },
        setHeader() { return; },
        end() { return; },
    };
    return res;
}

function makeReq(body: unknown, method = 'POST'): any {
    return { method, body, headers: {}, query: {} };
}

beforeEach(() => {
    mockFromChain.update.mockReset().mockImplementation(() => mockFromChain);
    mockFromChain.select.mockReset().mockImplementation(() => mockFromChain);
    mockFromChain.eq.mockReset().mockImplementation(() => mockFromChain);
    // See creditCustomerReward.test.ts for the rationale — no fallback so the
    // .single() queue isn't shadow-ed when only one of the calls is queued.
    mockFromChain.single.mockReset();
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('/api/attribute-order-to-facebook handler', () => {
    it('normalizes a URL-form to the bare handle and stamps orders.facebook_username', async () => {
        mockFromChain.single.mockResolvedValueOnce({ data: { id: 'order-1', notes: 'existing operator note' }, error: null });
        mockFromChain.update.mockReturnValueOnce({ error: null, eq: () => ({ error: null }) });

        const res = makeRes();
        await handler(
            makeReq({
                orderId: 'order-1',
                facebookUsername: 'facebook.com/starrboii067',
                note: 'Confirmed purchase via DM 2026-07-02',
            }),
            res as any
        );

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ success: true, orderId: 'order-1', facebookUsername: 'starrboii067' });
        expect(mockFromChain.update).toHaveBeenCalledTimes(1);
        const updateArg = mockFromChain.update.mock.calls[0][0] as Record<string, unknown>;
        expect(updateArg.facebook_username).toBe('starrboii067');
        const mergedNotes = String(updateArg.notes || '');
        expect(mergedNotes).toMatch(/existing operator note/);
        expect(mergedNotes).toMatch(/starrboii067/);
        expect(mergedNotes).toMatch(/Confirmed purchase via DM/);
    });

    it('accepts a leading @ and writes the handle without it', async () => {
        mockFromChain.single.mockResolvedValueOnce({ data: { id: 'order-2', notes: null }, error: null });
        mockFromChain.update.mockReturnValueOnce({ error: null, eq: () => ({ error: null }) });

        const res = makeRes();
        await handler(makeReq({ orderId: 'order-2', facebookUsername: '@starrboii067' }), res as any);

        expect(res.statusCode).toBe(200);
        expect(res.body.facebookUsername).toBe('starrboii067');
    });

    it('returns 400 when the username fails Facebook handle rules', async () => {
        const res = makeRes();
        await handler(makeReq({ orderId: 'order-3', facebookUsername: '@@bad handle!!!' }), res as any);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/facebookUsername/);
        expect(mockFromChain.update).not.toHaveBeenCalled();
    });

    it('returns 400 when orderId is missing', async () => {
        const res = makeRes();
        await handler(makeReq({ facebookUsername: 'starrboii067' }), res as any);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/orderId/);
    });

    it('returns 404 when the order does not exist', async () => {
        mockFromChain.single.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });

        const res = makeRes();
        await handler(makeReq({ orderId: 'missing-order', facebookUsername: 'starrboii067' }), res as any);

        expect(res.statusCode).toBe(404);
    });

    it('returns 405 on non-POST methods', async () => {
        const res = makeRes();
        await handler(makeReq({}, 'PUT'), res as any);

        expect(res.statusCode).toBe(405);
    });
});
