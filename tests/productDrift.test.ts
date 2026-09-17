// tests/productDrift.test.ts
//
// Guards /api/product-drift — the surface that makes seed-vs-database drift
// visible on the admin Products tab instead of only in a CLI's stdout.
//
// Three things must stay true, in this order of importance:
//   1. it is admin-only (it reports the state of the operator's catalog)
//   2. it classifies differences through scripts/productSeed.ts, so "what counts
//      as drift" has one owner and the panel cannot disagree with the CLI
//   3. it never writes — a report that can mutate the catalog is a different and
//      much more dangerous endpoint than the one that was asked for
//
// The Supabase boundary is mocked, so no test touches the real table; the seed it
// compares against is the real one, because that is the half the endpoint owns.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_PRODUCTS } from '../constants/products';
import { fetchProductDrift } from '../services/productDrift';
import {
    ADMIN_MODE_KEY,
    ADMIN_SESSION_EXPIRED_ERROR,
    ADMIN_TOKEN_KEY,
} from '../services/adminSession';

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: mocks.from })),
}));

// Imported after the mock is registered (vi.mock is hoisted above imports).
import productDriftHandler from '../api/_handlers/product-drift';

const ENV_BACKUP = { ...process.env };
const ADMIN_TOKEN = 'admin-token-drift-12345';

/** A real seed entry, so the comparison is against production data, not a fixture. */
const DRIFTED = INITIAL_PRODUCTS.find((p) => p.id === 'Coalition_Grey_Wave_Wallet_2_2')!;

const SEED_ONLY_IDS = [
    'prod_wallet_chrome_hearts',
    'Coalition_Parts_Wallet_1_4',
    'Coalition_Parts_Wallet_2_4',
    'Coalition_Parts_Wallet_3_4',
    'Coalition_Parts_Wallet_4_4',
];

const rows = [
    // Same id as a seed entry, different price -> one drift line.
    { id: DRIFTED.id, name: DRIFTED.name, price: Number(DRIFTED.price) + 14, images: [], sizes: [] },
    // No seed entry -> appended, not drift.
    { id: 'prod_only_in_table', name: 'Table Only', price: 10, images: [], sizes: [] },
];

beforeEach(() => {
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.order.mockReset();
    mocks.order.mockResolvedValue({ data: rows, error: null });
    mocks.select.mockReturnValue({ order: mocks.order });
    mocks.from.mockReturnValue({ select: mocks.select });

    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
    delete process.env.ADMIN_PASSPHRASE;
    process.env.SUPABASE_URL = 'https://supabase.example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
});

afterEach(() => {
    process.env = { ...ENV_BACKUP };
});

function makeReq(opts: { method?: string; headers?: Record<string, string> } = {}) {
    return {
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
        query: { slug: ['product-drift'] },
        url: '/api/product-drift',
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
const authorised = () => makeReq({ headers: bearer(ADMIN_TOKEN) });

describe('/api/product-drift is admin-only', () => {
    it('OPTIONS preflight -> 200 and no database read', async () => {
        const res = makeRes();
        await productDriftHandler(makeReq({ method: 'OPTIONS' }), res);

        expect(res.statusCode).toBe(200);
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('anonymous -> 401 and the catalog is never read', async () => {
        const res = makeRes();
        await productDriftHandler(makeReq(), res);

        expect(res.statusCode).toBe(401);
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('wrong token -> 401', async () => {
        const res = makeRes();
        await productDriftHandler(makeReq({ headers: bearer('not-the-token') }), res);

        expect(res.statusCode).toBe(401);
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('passphrase-only deployment: the passphrase is accepted', async () => {
        process.env.ADMIN_API_TOKEN = '';
        process.env.ADMIN_PASSPHRASE = 'operator-passphrase';

        const res = makeRes();
        await productDriftHandler(makeReq({ headers: bearer('operator-passphrase') }), res);

        expect(res.statusCode).toBe(200);
    });
});

describe('the report it produces', () => {
    it('reports a difference on an entry the seed also has, summarized', async () => {
        const res = makeRes();
        await productDriftHandler(authorised(), res);

        expect(res.statusCode, JSON.stringify(res.body)).toBe(200);
        expect(res.body.drift).toContainEqual({
            id: DRIFTED.id,
            field: 'price',
            seed: String(DRIFTED.price),
            db: String(Number(DRIFTED.price) + 14),
        });
    });

    it('counts the seed and the table, so the figures can be sanity-checked', async () => {
        const res = makeRes();
        await productDriftHandler(authorised(), res);

        expect(res.body.seedEntries).toBe(INITIAL_PRODUCTS.length);
        expect(res.body.dbRows).toBe(rows.length);
        expect(res.body.checkedAt, 'the panel shows when this was measured').toBeTruthy();
    });

    it('names the rows the seed has never seen instead of calling them drift', async () => {
        const res = makeRes();
        await productDriftHandler(authorised(), res);

        expect(res.body.missingFromSeed).toEqual(['prod_only_in_table']);
        expect(res.body.drift.map((d: { id: string }) => d.id)).not.toContain('prod_only_in_table');
    });

    it('keeps every product with no database row, and does not call that drift', async () => {
        const res = makeRes();
        await productDriftHandler(authorised(), res);

        const driftedIds = res.body.drift.map((d: { id: string }) => d.id);
        for (const id of SEED_ONLY_IDS) {
            expect(res.body.seedOnly, `${id} has no row and must be reported as kept`).toContain(id);
            expect(driftedIds, `${id} has nothing to drift against`).not.toContain(id);
        }
    });

    it('summarizes a value that would otherwise flood the line', async () => {
        mocks.order.mockResolvedValue({
            data: [{
                id: DRIFTED.id,
                name: DRIFTED.name,
                price: DRIFTED.price,
                images: ['a.jpg', 'b.jpg', 'c.jpg'],
                sizes: ['One Size'],
            }],
            error: null,
        });

        const res = makeRes();
        await productDriftHandler(authorised(), res);

        const line = res.body.drift.find((d: { field: string }) => d.field === 'images');
        expect(line, 'the seed entry has images and the row does not, or vice versa').toBeTruthy();
        expect(line.seed.length).toBeLessThan(40);
        expect(line.db.length).toBeLessThan(40);
    });

    it('degrades to an error body when the table read fails, rather than reporting zero drift', async () => {
        mocks.order.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

        const res = makeRes();
        await productDriftHandler(authorised(), res);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toContain('connection reset');
        expect(res.body.drift, 'a failed read must never look like a clean catalog').toBeUndefined();
    });
});

// The panel mocks this service in its render tests, so nothing else would catch a
// wrong URL, a missing bearer, or a 401 that fails to clear the session — the three
// ways this line goes permanently quiet in production without any test noticing.
describe('the client that fetches it', () => {
    const originalFetch = globalThis.fetch;

    const respond = (init: { ok: boolean; status: number; body?: unknown }) => {
        globalThis.fetch = vi.fn(async () => ({
            ok: init.ok,
            status: init.status,
            json: async () => init.body ?? {},
        })) as unknown as typeof fetch;
    };

    afterEach(() => {
        globalThis.fetch = originalFetch;
        sessionStorage.clear();
    });

    it('asks /api/product-drift with the stashed admin bearer and parses the report', async () => {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, 'session-token');
        const report = {
            checkedAt: '2026-09-17T00:00:00.000Z',
            seedEntries: 31,
            dbRows: 26,
            drift: [{ id: 'p', field: 'price', seed: '60', db: '40' }],
            seedOnly: ['prod_local_only'],
            missingFromSeed: [],
        };
        respond({ ok: true, status: 200, body: report });

        expect(await fetchProductDrift()).toEqual(report);

        const [url, init] = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
        expect(String(url)).toContain('/api/product-drift');
        expect((init as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer session-token');
    });

    it('clears the stale session on 401, so the login gate takes over', async () => {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, 'stale-token');
        sessionStorage.setItem(ADMIN_MODE_KEY, 'true');
        respond({ ok: false, status: 401 });

        await expect(fetchProductDrift()).rejects.toThrow(ADMIN_SESSION_EXPIRED_ERROR);
        expect(sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
        expect(sessionStorage.getItem(ADMIN_MODE_KEY)).toBeNull();
    });

    it('surfaces the server message on any other failure', async () => {
        respond({ ok: false, status: 500, body: { error: 'connection reset' } });

        await expect(fetchProductDrift()).rejects.toThrow('connection reset');
    });

    it('decodes a failed check that returns no JSON body', async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: false,
            status: 502,
            json: async () => { throw new Error('not json'); },
        })) as unknown as typeof fetch;

        await expect(fetchProductDrift()).rejects.toThrow('HTTP 502');
    });
});

describe('what keeps this endpoint honest', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'api', '_handlers', 'product-drift.ts'),
        'utf8',
    );

    it('classifies differences through the shared rule rather than its own', () => {
        expect(source, 'the rule has one owner').toMatch(
            /from '\.\.\/\.\.\/scripts\/productSeed\.js'/,
        );
        expect(source).toContain('mergeSeedProducts');
    });

    it('never writes: no update, insert, upsert, delete or repo sync on this path', () => {
        for (const write of ['.update(', '.insert(', '.upsert(', '.delete(', 'syncFileOnGitHub']) {
            expect(source, `a read-only report must not call ${write}`).not.toContain(write);
        }
        expect(source, 'and nothing may be targeted for rewrite').not.toMatch(/mergeSeedProducts\([^)]*\[[^\]]+\]/);
    });
});
