// tests/gitOperationsGate.test.ts
//
// Tests for the admin gate on /api/git-operations (api/_handlers/git-operations.ts).
//
// WHY: this endpoint used to accept ANY unauthenticated caller. The dev-only
// 501 guard exempts `sync-constants`, which commits to origin/main through the
// server's GITHUB_TOKEN via the GitHub Contents API with a caller-supplied
// commit message -- i.e. before the gate, an anonymous POST was a repo-write
// primitive. These tests pin that no GitHub write happens for a caller who
// cannot present an admin bearer.
//
// The Github Contents API boundary is mocked, so no test can touch the real
// repository. Both secret shapes are covered (ADMIN_API_TOKEN, and a
// passphrase-only deployment) plus the no-secrets-configured fail-closed case.
//
// DETERMINISM NOTE: the handler is imported ONCE, statically. It reads every
// env var at request time (isAdminRequest reads process.env inside the call),
// so per-test env changes take effect without re-importing. Do not reintroduce
// per-test vi.resetModules() + dynamic import -- see the same note in
// tests/sendEmailGate.test.ts for the timeout flake that caused.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mocks = vi.hoisted(() => ({
    syncFileOnGitHub: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
}));

vi.mock('../services/githubSync.cjs', () => ({ syncFileOnGitHub: mocks.syncFileOnGitHub }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: mocks.from,
    })),
}));

// Imported after the mocks are registered (vi.mock is hoisted above imports).
import gitOperationsHandler from '../api/_handlers/git-operations';

const ENV_BACKUP = { ...process.env };
const ADMIN_TOKEN = 'admin-token-e2e-12345';

beforeEach(() => {
    mocks.syncFileOnGitHub.mockReset();
    mocks.syncFileOnGitHub.mockResolvedValue({ noChanges: true, hash: 'blob-sha-abc' });
    mocks.order.mockReset();
    mocks.select.mockReset();
    mocks.from.mockReset();
    mocks.order.mockResolvedValue({
        data: [{ id: 'p1', name: 'Test Piece', price: 42, category: 'apparel', images: [] }],
        error: null,
    });
    mocks.select.mockReturnValue({ order: mocks.order });
    mocks.from.mockReturnValue({ select: mocks.select });

    // Vercel runtime shape: sync-constants is the one action that actually
    // performs work there, which is exactly why it needed the gate.
    process.env.VERCEL = '1';
    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
    delete process.env.ADMIN_PASSPHRASE; // deterministic baseline regardless of test order
    process.env.SUPABASE_URL = 'https://supabase.example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
});

afterEach(() => {
    process.env = { ...ENV_BACKUP };
});

function makeReq(opts: {
    action?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
} = {}) {
    return {
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
        query: opts.action === undefined ? {} : { action: opts.action },
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

describe('/api/git-operations admin gate', () => {
    it('OPTIONS preflight -> 200, no GitHub write attempted', async () => {
        const res = makeRes();
        await gitOperationsHandler(makeReq({ action: 'sync-constants', method: 'OPTIONS' }), res);

        expect(res.statusCode).toBe(200);
        expect(mocks.syncFileOnGitHub).not.toHaveBeenCalled();
    });

    it('anonymous + sync-constants -> 401 and the GitHub sync is never invoked', async () => {
        const res = makeRes();
        await gitOperationsHandler(
            makeReq({ action: 'sync-constants', method: 'POST', body: { message: 'pwned' } }),
            res,
        );

        expect(res.statusCode).toBe(401);
        // One 401 body for every admin surface, owned by api/_adminAuth.ts.
        expect(res.body).toMatchObject({ error: 'Admin authorization required.' });
        // The repo-write primitive: no auth means no Supabase read and no PUT.
        expect(mocks.syncFileOnGitHub).not.toHaveBeenCalled();
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('wrong token + sync-constants -> 401, no GitHub write', async () => {
        const res = makeRes();
        await gitOperationsHandler(
            makeReq({
                action: 'sync-constants',
                method: 'POST',
                headers: bearer('not-the-token'),
            }),
            res,
        );

        expect(res.statusCode).toBe(401);
        expect(mocks.syncFileOnGitHub).not.toHaveBeenCalled();
    });

    it('non-bearer Authorization header -> 401', async () => {
        const res = makeRes();
        await gitOperationsHandler(
            makeReq({
                action: 'sync-constants',
                method: 'POST',
                headers: { Authorization: ADMIN_TOKEN },
            }),
            res,
        );

        expect(res.statusCode).toBe(401);
        expect(mocks.syncFileOnGitHub).not.toHaveBeenCalled();
    });

    it('malformed Authorization header -> 401', async () => {
        const res = makeRes();
        await gitOperationsHandler(
            makeReq({
                action: 'sync-constants',
                method: 'POST',
                headers: { Authorization: 'Bearer    ' },
            }),
            res,
        );

        expect(res.statusCode).toBe(401);
    });

    it('valid admin token + sync-constants -> 200 and the real sync transform runs', async () => {
        const res = makeRes();
        await gitOperationsHandler(
            makeReq({
                action: 'sync-constants',
                method: 'POST',
                headers: bearer(ADMIN_TOKEN),
                body: { message: 'Sync from test' },
            }),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ noChanges: true, hash: 'blob-sha-abc' });
        expect(mocks.from).toHaveBeenCalledWith('products');
        expect(mocks.syncFileOnGitHub).toHaveBeenCalledTimes(1);

        // Target file + commit message come from the authenticated request.
        const [targetFile, transform, commitMessage] = mocks.syncFileOnGitHub.mock.calls[0];
        expect(targetFile).toBe('constants/products.ts');
        expect(commitMessage).toBe('Sync from test');

        // Prove the gate released the *real* path, not a stub: the transform
        // must inline the Supabase rows into INITIAL_PRODUCTS.
        const before = 'export const INITIAL_PRODUCTS: Product[] = [];\n// tail';
        const after = transform(before);
        expect(after).toContain('"id": "p1"');
        expect(after).toContain('"price": 42');
        expect(after).toContain('// tail');
    });

    it('sync-constants without a body message falls back to the default commit message', async () => {
        const res = makeRes();
        await gitOperationsHandler(
            makeReq({ action: 'sync-constants', method: 'POST', headers: bearer(ADMIN_TOKEN) }),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mocks.syncFileOnGitHub.mock.calls[0][2]).toBe('Sync products from Supabase');
    });

    it('passphrase-only deployment: ADMIN_PASSPHRASE as bearer -> 200', async () => {
        process.env.ADMIN_API_TOKEN = '';
        process.env.ADMIN_PASSPHRASE = 'operator-passphrase';

        const res = makeRes();
        await gitOperationsHandler(
            makeReq({ action: 'sync-constants', method: 'POST', headers: bearer('operator-passphrase') }),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mocks.syncFileOnGitHub).toHaveBeenCalledTimes(1);
    });

    it('passphrase-only deployment: the stale API token is rejected -> 401', async () => {
        process.env.ADMIN_API_TOKEN = '';
        process.env.ADMIN_PASSPHRASE = 'operator-passphrase';

        const res = makeRes();
        await gitOperationsHandler(
            makeReq({ action: 'sync-constants', method: 'POST', headers: bearer(ADMIN_TOKEN) }),
            res,
        );

        expect(res.statusCode).toBe(401);
        expect(mocks.syncFileOnGitHub).not.toHaveBeenCalled();
    });

    it('no admin secrets configured at all -> fail-closed 401', async () => {
        process.env.ADMIN_API_TOKEN = '';
        delete process.env.ADMIN_PASSPHRASE;

        const res = makeRes();
        await gitOperationsHandler(
            makeReq({ action: 'sync-constants', method: 'POST', headers: bearer('anything') }),
            res,
        );

        expect(res.statusCode).toBe(401);
        expect(mocks.syncFileOnGitHub).not.toHaveBeenCalled();
    });

    it('anonymous + missing action -> 401 (gate precedes the 400)', async () => {
        const res = makeRes();
        await gitOperationsHandler(makeReq({ method: 'POST' }), res);

        expect(res.statusCode).toBe(401);
    });

    it('authorized + a dev-only action on Vercel still returns the dev-only 501', async () => {
        const res = makeRes();
        await gitOperationsHandler(
            makeReq({ action: 'log', method: 'GET', headers: bearer(ADMIN_TOKEN) }),
            res,
        );

        // The gate must not have replaced the dev-only guard: an authenticated
        // operator still gets the structured hint instead of a 500.
        expect(res.statusCode).toBe(501);
        expect(res.body).toMatchObject({ action: 'log', devOnly: true });
    });

    it('unauthorized + a dev-only action -> 401, not 501 (no action-surface leak)', async () => {
        const res = makeRes();
        await gitOperationsHandler(makeReq({ action: 'log', method: 'GET' }), res);

        expect(res.statusCode).toBe(401);
    });

    it('blocked calls log a sanitized path, never the caller-supplied action', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const req = makeReq({ action: 'bad\naction-{}', method: 'POST' });
            req.url = '/api/git-operations?action=bad%0Aaction-{}';
            const res = makeRes();
            await gitOperationsHandler(req, res);

            expect(res.statusCode).toBe(401);
            // The rejection is now logged once by the gate in api/_adminAuth.ts.
            const logged = warn.mock.calls.find((c) => String(c[0]).includes('[admin-auth]'));
            expect(logged).toBeTruthy();
            const serialized = JSON.stringify(logged);
            expect(serialized).not.toContain('bad%0Aaction');
            expect(serialized).toContain('/api/git-operations');
        } finally {
            warn.mockRestore();
        }
    });
});

// The admin "Sync Code" button reaches this endpoint. The bug this pins is the one
// the drop publish hit: regenerating INITIAL_PRODUCTS from the products table alone
// DELETED entries the table has never held — the five seed-only wallets, which
// failed 21 tests — because "mirror the database" was implemented as "rebuild the
// array". A sync may add and correct; it may not remove.
describe('admin sync-constants obeys the same rule as the drop publish', () => {
    const SEED_ONLY_ID = 'prod_local_only';
    const ROW_ENTRY = {
        id: 'p1',
        name: 'Test Piece',
        price: 1,
        images: [],
        description: '',
        category: 'apparel',
        isFeatured: false,
        isLimitedEdition: false,
        sizes: [],
        sizeInventory: {},
        nft: null,
        archived: false,
        archivedAt: null,
        releasedAt: null,
        soldAt: null,
    };

    const block = (entry: unknown) =>
        JSON.stringify(entry, null, 2).split('\n').map((line) => '  ' + line);

    // p1 is also in the mocked table (price 42); the second entry is not.
    const seedText = [
        'export const INITIAL_PRODUCTS: Product[] = [',
        '  // hand-written note the sync must not destroy',
        ...block(ROW_ENTRY),
        '  ,',
        ...block({ ...ROW_ENTRY, id: SEED_ONLY_ID, name: 'Local Only', price: 7 }),
        '];',
        '',
    ].join('\n');

    /** Behave like services/githubSync.cjs: run the transform on the real file text. */
    const mockGithubSync = () => {
        mocks.syncFileOnGitHub.mockImplementation(
            async (_file: string, transform: (content: string) => string) => ({
                noChanges: transform(seedText) === seedText,
                hash: 'blob-sha-abc',
            }),
        );
    };

    const callSync = () =>
        gitOperationsHandler(
            makeReq({ action: 'sync-constants', method: 'POST', headers: bearer(ADMIN_TOKEN) }),
            makeRes(),
        );

    it('keeps a product the database has never held, and corrects the ones it does', async () => {
        mockGithubSync();
        await callSync();

        const transform = mocks.syncFileOnGitHub.mock.calls[0][1] as (content: string) => string;
        const after = transform(seedText);

        expect(after, 'a product with no DB row must survive the sync').toContain(SEED_ONLY_ID);
        expect(after, 'unchanged entries keep their value, not a blank').toContain('"price": 7');
        expect(after, 'comments inside the array must survive a sync').toContain(
            'hand-written note the sync must not destroy',
        );
        expect(after, 'the seed must still be a file the app can import').toContain(
            'export const INITIAL_PRODUCTS: Product[] = [',
        );
        expect(after, "the table's value wins for a row it holds — that is what Sync Code is for").toContain(
            '"price": 42',
        );
        expect(after, 'and the stale local value is gone').not.toContain('"price": 1\n');
    });

    it('returns what it wrote, so the button can label the outcome honestly', async () => {
        mockGithubSync();

        const res = makeRes();
        await gitOperationsHandler(
            makeReq({ action: 'sync-constants', method: 'POST', headers: bearer(ADMIN_TOKEN) }),
            res,
        );

        expect(res.body.report).toMatchObject({
            targeted: ['p1'],
            rewritten: ['p1'],
            seedOnly: [SEED_ONLY_ID],
            added: [],
        });
        expect(res.body.noChanges, 'the fixture differs, so this is a real write').toBe(false);
    });

    it('folds rows in through the shared rule instead of rebuilding the array', () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '..', 'api', '_handlers', 'git-operations.ts'),
            'utf8',
        );

        expect(
            source,
            'the rule has one owner; the handler must read it rather than restate it',
        ).toMatch(/from '\.\.\/\.\.\/scripts\/productSeed\.js'/);
        expect(source, 'a wholesale replacement is the bug this pins').not.toMatch(
            /INITIAL_PRODUCTS: Product\[\] = \$\{/,
        );
        expect(
            source,
            'an admin edit lands in the table, so every row it holds must be rewritten',
        ).toContain('targetedIds');
    });
});
