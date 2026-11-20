// tests/adminShipments.test.ts
//
// Tests for GET /api/admin-shipments — the read-only shipment feed behind the
// Shipment column in Admin → Orders. The contract under test:
//   - admin-only ('shared'): anonymous/wrong token -> 401, no DB read
//   - GET serves the feed; POST answers 405 (read-only surface)
//   - the response is { shipments: [...] } with the tracking/milestone fields
//   - a DB failure degrades to 500 with the message, never an empty 200
//
// Supabase is mocked at the module boundary.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSupabaseFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: mockSupabaseFrom })),
}));

import adminShipmentsHandler from '../api/_handlers/admin-shipments';

const ADMIN_TOKEN = 'admin-token-shipments-12345';

const ROW = {
    order_id: 'order_1',
    status: 'purchased',
    carrier: 'USPS',
    service: 'USPS Ground Advantage',
    tracking_number: '9400111899560000000000',
    tracking_url: 'https://tools.usps.com/track?t=9400111899560000000000',
    rate_cents: 568,
    error_reason: null,
    shipped_email_sent_at: null,
    delivered_email_sent_at: null,
    updated_at: '2026-09-30T10:05:00Z',
};

function makeReq(opts: { method?: string; headers?: Record<string, string> } = {}) {
    return {
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
        query: {},
        url: '/api/admin-shipments',
        body: null,
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

describe('GET /api/admin-shipments', () => {
    beforeEach(() => {
        mockSupabaseFrom.mockReset();
        process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
        mockSupabaseFrom.mockReturnValue(({
            select: () => ({
                order: () => ({
                    limit: () => Promise.resolve({ data: [ROW], error: null }),
                }),
            }),
        }) as any);
    });

    afterEach(() => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('OPTIONS preflight -> 200 and no DB read', async () => {
        const res = makeRes();
        await adminShipmentsHandler(makeReq({ method: 'OPTIONS' }), res);

        expect(res.statusCode).toBe(200);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('anonymous -> 401 and the table is never read', async () => {
        const res = makeRes();
        await adminShipmentsHandler(makeReq(), res);

        expect(res.statusCode).toBe(401);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('wrong token -> 401', async () => {
        const res = makeRes();
        await adminShipmentsHandler(makeReq({ headers: bearer('not-it') }), res);

        expect(res.statusCode).toBe(401);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('POST -> 405 (read-only surface)', async () => {
        const res = makeRes();
        await adminShipmentsHandler(makeReq({ method: 'POST', headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(405);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('serves the feed with tracking and milestone fields', async () => {
        const res = makeRes();
        await adminShipmentsHandler(makeReq({ headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body.shipments).toHaveLength(1);
        expect(res.body.shipments[0]).toEqual(expect.objectContaining({
            order_id: 'order_1',
            status: 'purchased',
            tracking_number: '9400111899560000000000',
            shipped_email_sent_at: null,
            delivered_email_sent_at: null,
        }));
    });

    it('a DB failure -> 500 with the message, never an empty 200', async () => {
        mockSupabaseFrom.mockReturnValue(({
            select: () => ({
                order: () => ({
                    limit: () => Promise.resolve({ data: null, error: { message: 'connection reset' } }),
                }),
            }),
        }) as any);

        const res = makeRes();
        await adminShipmentsHandler(makeReq({ headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toContain('connection reset');
    });
});
