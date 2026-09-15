// tests/securityInfrastructureReadiness.test.ts
//
// Pins the shared API infrastructure in api/_helpers.ts. The file's own
// comments claimed for a long time that this suite existed ("Locked by
// tests/securityInfrastructureReadiness.test.ts") while the path did not exist
// -- so the rate limiter, the CORS allow-list, and the admin-auth wrapper were
// the least-verified code in the app. This is that suite.
//
// Four surfaces:
//   1. withRateLimit      -- per-IP / per-slug budgets, 429 shape, GET bypass
//   2. setCorsHeaders     -- origin echoing + allow-list fallback
//   3. withAdminAuth      -- fail-closed gate, both credential families
//   4. source invariants  -- ONE shared admin check; gate ordering

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
    withRateLimit,
    __forceRateLimitForTests,
    __resetRateLimitForTests,
    setCorsHeaders,
    LOCAL_DEV_ORIGINS,
} from '../api/_helpers';
// Admin authorization has its own module (single owner of the credential set,
// both policies, and the gates). api/_helpers.ts deliberately no longer
// exports any of it.
import {
    withAdminAuth,
    isSharedSecretAdmin,
    extractBearerToken,
    ADMIN_UNAUTHORIZED_ERROR,
} from '../api/_adminAuth';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const ENV_BACKUP = { ...process.env };

beforeEach(() => {
    __forceRateLimitForTests(true);
    __resetRateLimitForTests();
    delete process.env.DISABLE_RATE_LIMIT;
    delete process.env.ADMIN_API_TOKEN;
    delete process.env.ADMIN_PASSPHRASE;
    delete process.env.ADMIN_SESSION_TOKEN;
    delete process.env.FULL_AI_PASSWORD;
    delete process.env.AI_SESSION_SECRET;
});

afterEach(() => {
    __forceRateLimitForTests(false);
    __resetRateLimitForTests();
    process.env = { ...ENV_BACKUP };
});

// --- stubs -----------------------------------------------------------------

function makeReq(opts: { method?: string; ip?: string; headers?: Record<string, unknown> } = {}) {
    const headers: Record<string, unknown> = { ...(opts.headers || {}) };
    if (opts.ip) headers['x-forwarded-for'] = opts.ip;
    return { method: opts.method || 'POST', headers, query: {} } as never;
}

function makeRes() {
    const headers: Record<string, string> = {};
    const state: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
    const res = {
        headers,
        get statusCode() {
            return state.statusCode;
        },
        get body() {
            return state.body;
        },
        setHeader(key: string, value: string) {
            headers[key] = value;
        },
        status(code: number) {
            state.statusCode = code;
            return {
                json(body: unknown) {
                    state.body = body;
                },
                end() {
                    /* OPTIONS short-circuit responses end() without a body */
                },
            };
        },
    };
    return res;
}

// --- 1. rate limiter -------------------------------------------------------

describe('withRateLimit', () => {
    it('allows exactly the slug budget, then 429s with the standard headers', () => {
        // send-email is budgeted at 10/min in SLUG_LIMITS_PER_MINUTE.
        const allowed: boolean[] = [];
        let last: ReturnType<typeof makeRes> | null = null;
        for (let i = 0; i < 11; i++) {
            const res = makeRes();
            allowed.push(withRateLimit('send-email', makeReq({ ip: '203.0.113.7' }), res).allowed);
            last = res;
        }

        expect(allowed.slice(0, 10).every(Boolean)).toBe(true);
        expect(allowed[10]).toBe(false);
        expect(last!.statusCode).toBe(429);
        expect(last!.body).toMatchObject({ error: 'Too Many Requests' });
        expect(last!.headers['Retry-After']).toBeDefined();
    });

    it('sets the rate-limit headers on allowed requests so clients can back off', () => {
        const res = makeRes();
        const result = withRateLimit('send-email', makeReq({ ip: '203.0.113.8' }), res);

        expect(result.allowed).toBe(true);
        expect(res.headers['X-RateLimit-Limit']).toBe('10');
        expect(res.headers['X-RateLimit-Remaining']).toBe('9');
        expect(res.headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('budgets per IP: a second caller gets a fresh window', () => {
        for (let i = 0; i < 11; i++) {
            withRateLimit('send-email', makeReq({ ip: '198.51.100.1' }), makeRes());
        }

        expect(withRateLimit('send-email', makeReq({ ip: '198.51.100.2' }), makeRes()).allowed).toBe(true);
    });

    it('budgets per slug: exhausting one endpoint does not lock out another', () => {
        for (let i = 0; i < 11; i++) {
            withRateLimit('send-email', makeReq({ ip: '198.51.100.9' }), makeRes());
        }

        expect(withRateLimit('send-email', makeReq({ ip: '198.51.100.9' }), makeRes()).allowed).toBe(false);
        expect(withRateLimit('complete-order', makeReq({ ip: '198.51.100.9' }), makeRes()).allowed).toBe(true);
    });

    it('skips GET/HEAD entirely (no headers, no budget consumed)', () => {
        for (let i = 0; i < 11; i++) {
            withRateLimit('send-email', makeReq({ ip: '192.0.2.5' }), makeRes());
        }
        const res = makeRes();
        const result = withRateLimit('send-email', makeReq({ method: 'GET', ip: '192.0.2.5' }), res);

        expect(result.allowed).toBe(true);
        expect(res.headers).toEqual({});
    });

    it('fails open (with a warning) when no client IP can be derived', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            // A missing IP must NOT collapse every caller into one bucket.
            for (let i = 0; i < 30; i++) {
                expect(withRateLimit('send-email', makeReq(), makeRes()).allowed).toBe(true);
            }
            expect(warn).toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    it('the DISABLE_RATE_LIMIT escape hatch does not override the test force flag', () => {
        // Documented precedence: isRateLimitDisabled() || force -> skip only when
        // the force flag is off. Keeping the force flag authoritative is what
        // makes these assertions meaningful.
        process.env.DISABLE_RATE_LIMIT = '1';
        for (let i = 0; i < 11; i++) {
            withRateLimit('send-email', makeReq({ ip: '192.0.2.77' }), makeRes());
        }
        expect(withRateLimit('send-email', makeReq({ ip: '192.0.2.77' }), makeRes()).allowed).toBe(false);
    });
});

// --- 2. CORS ---------------------------------------------------------------

describe('setCorsHeaders', () => {
    it('falls back to the configured origin when no whitelist is supplied', () => {
        process.env.VITE_APP_URL = 'https://sgcoalition.xyz';
        const res = makeRes();
        setCorsHeaders(makeReq({ headers: { origin: 'https://evil.example.test' } }) as never, res as never);

        expect(res.headers['Access-Control-Allow-Origin']).toBe('https://sgcoalition.xyz');
        expect(res.headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('echoes a whitelisted origin verbatim and rejects anything else', () => {
        process.env.VITE_APP_URL = 'https://sgcoalition.xyz';

        const good = makeRes();
        setCorsHeaders(
            makeReq({ headers: { origin: 'http://localhost:3000' } }) as never,
            good as never,
            { originWhitelist: LOCAL_DEV_ORIGINS },
        );
        expect(good.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');

        const bad = makeRes();
        setCorsHeaders(
            makeReq({ headers: { origin: 'http://localhost:9999' } }) as never,
            bad as never,
            { originWhitelist: LOCAL_DEV_ORIGINS },
        );
        expect(bad.headers['Access-Control-Allow-Origin']).toBe('https://sgcoalition.xyz');
    });

    it('keeps the documented Vite dev origins on the allow-list', () => {
        expect([...LOCAL_DEV_ORIGINS]).toEqual([
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
        ]);
    });
});

// --- 3. withAdminAuth ------------------------------------------------------

describe('withAdminAuth', () => {
    it('answers OPTIONS preflight without requiring auth', async () => {
        const inner = vi.fn(async () => {});
        const res = makeRes();
        await withAdminAuth(inner)(makeReq({ method: 'OPTIONS' }) as never, res as never);

        expect(res.statusCode).toBe(200);
        expect(inner).not.toHaveBeenCalled();
    });

    it('is fail-closed: 401 and the inner handler never runs without a credential', async () => {
        process.env.ADMIN_API_TOKEN = 'the-admin-token';
        const inner = vi.fn(async () => {});
        const res = makeRes();
        await withAdminAuth(inner)(makeReq() as never, res as never);

        expect(res.statusCode).toBe(401);
        expect(inner).not.toHaveBeenCalled();
    });

    it('is fail-closed when NO admin secret is configured at all', async () => {
        const inner = vi.fn(async () => {});
        const res = makeRes();
        await withAdminAuth(inner)(
            makeReq({ headers: { authorization: 'Bearer anything-at-all' } }) as never,
            res as never,
        );

        expect(res.statusCode).toBe(401);
        expect(inner).not.toHaveBeenCalled();
    });

    it('accepts ADMIN_API_TOKEN (the contract admin-verify hands the browser)', async () => {
        process.env.ADMIN_API_TOKEN = 'the-admin-token';
        const inner = vi.fn(async () => {});
        const res = makeRes();
        await withAdminAuth(inner)(
            makeReq({ headers: { authorization: 'Bearer the-admin-token' } }) as never,
            res as never,
        );

        expect(inner).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(0);
    });

    it('accepts ADMIN_PASSPHRASE for passphrase-only deployments', async () => {
        process.env.ADMIN_PASSPHRASE = 'operator-passphrase';
        const inner = vi.fn(async () => {});
        await withAdminAuth(inner)(
            makeReq({ headers: { authorization: 'Bearer operator-passphrase' } }) as never,
            makeRes() as never,
        );

        expect(inner).toHaveBeenCalledTimes(1);
    });

    it('still accepts the legacy ADMIN_SESSION_TOKEN (back-compat)', async () => {
        process.env.ADMIN_SESSION_TOKEN = 'legacy-session-token';
        const inner = vi.fn(async () => {});
        await withAdminAuth(inner)(
            makeReq({ headers: { authorization: 'Bearer legacy-session-token' } }) as never,
            makeRes() as never,
        );

        expect(inner).toHaveBeenCalledTimes(1);
    });

    it('rejects a wrong bearer even when secrets are configured', async () => {
        process.env.ADMIN_API_TOKEN = 'the-admin-token';
        const inner = vi.fn(async () => {});
        const res = makeRes();
        await withAdminAuth(inner)(
            makeReq({ headers: { authorization: 'Bearer the-admin-toke' } }) as never,
            res as never,
        );

        expect(res.statusCode).toBe(401);
        expect(inner).not.toHaveBeenCalled();
    });
});

// --- 4. the shared check itself + source invariants -------------------------

describe('isSharedSecretAdmin / extractBearerToken', () => {
    it('accepts either server-side secret and trims, case-insensitively on the scheme', () => {
        process.env.ADMIN_API_TOKEN = 'token-a';
        process.env.ADMIN_PASSPHRASE = 'pass-b';

        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'Bearer token-a' } }) as never)).toBe(true);
        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'bearer  pass-b ' } }) as never)).toBe(true);
        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'Bearer nope' } }) as never)).toBe(false);
    });

    it('treats a non-Bearer scheme, an empty bearer, and an array header as unauthenticated', () => {
        process.env.ADMIN_API_TOKEN = 'token-a';

        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'Token token-a' } }) as never)).toBe(false);
        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'Bearer   ' } }) as never)).toBe(false);
        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: ['Bearer token-a'] } }) as never)).toBe(false);
        expect(extractBearerToken(makeReq() as never)).toBe('');
    });

    it('still honours the legacy shared secrets so old deployments keep working', () => {
        process.env.ADMIN_SESSION_TOKEN = 'legacy-a';
        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'Bearer legacy-a' } }) as never)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// The structural invariant this whole file exists for: admin authorization has
// exactly ONE implementation. Until 2026-09-15 it had six, and the endpoint
// with none of them (/api/git-operations) was an unauthenticated repo-write
// primitive. These assertions fail if anyone re-grows a local copy.
// ---------------------------------------------------------------------------
describe('source invariants: admin authorization has one owner', () => {
    const HANDLERS = [
        'api/_handlers/git-operations.ts',
        'api/_handlers/send-email.ts',
        'api/_handlers/admin-products.ts',
        'api/_handlers/payment-settings.ts',
        'api/_handlers/update-piece-metadata.ts',
        'api/_handlers/complete-order.ts',
        'api/_handlers/ai-chat.ts',
        'api/_handlers/marketing-stats.ts',
    ] as const;

    it('no handler implements its own bearer check', () => {
        for (const file of HANDLERS) {
            const src = read(file);
            expect(src, `${file} must not define getBearerToken`).not.toMatch(/function\s+getBearerToken\s*\(/);
            expect(src, `${file} must not define isAuthorized`).not.toMatch(/function\s+isAuthorized\s*\(/);
            expect(src, `${file} must not define isAdminRequest`).not.toMatch(/function\s+isAdminRequest\s*\(/);
        }
    });

    it('no handler reads the admin secrets directly', () => {
        for (const file of HANDLERS) {
            expect(read(file), `${file} must let api/_adminAuth.ts own the credential set`)
                .not.toMatch(/process\.env\.(ADMIN_API_TOKEN|ADMIN_PASSPHRASE|ADMIN_SESSION_TOKEN)/);
        }
    });

    it('git-operations is gated by the wrapper, so the gate cannot be forgotten', () => {
        const src = read('api/_handlers/git-operations.ts');
        expect(src).toMatch(/withAdminAuth\(handler/);
        expect(src).toMatch(/export default withAdminAuth/);
        // The dev-only guard must still exist inside the (already gated) body.
        expect(src).toMatch(/action !== 'sync-constants'/);
    });

    it('send-email uses the shared-secret predicate (its anonymous allowance is deliberate)', () => {
        const src = read('api/_handlers/send-email.ts');
        expect(src).toMatch(/isSharedSecretAdmin/);
        expect(src).toMatch(/403/);
    });
});
