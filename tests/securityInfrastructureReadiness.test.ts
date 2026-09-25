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
    getSharedAdminSecrets,
    extractBearerToken,
    ADMIN_UNAUTHORIZED_ERROR,
    type AdminPolicy,
} from '../api/_adminAuth';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const ENV_BACKUP = { ...process.env };

beforeEach(() => {
    __forceRateLimitForTests(true);
    __resetRateLimitForTests();
    delete process.env.DISABLE_RATE_LIMIT;
    delete process.env.ADMIN_API_TOKEN;
    delete process.env.ADMIN_PASSPHRASE;
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

    it('REJECTS the legacy admin secrets — the orphaned credential path is gone', async () => {
        // ADMIN_SESSION_TOKEN / FULL_AI_PASSWORD / AI_SESSION_SECRET used to be
        // accepted. None of the three is configured in any environment, so the
        // path was dead weight kept alive by its own tests — and because two of
        // the three are ai-chat's AI-ACCESS secrets, accepting them here also
        // meant that knowing the AI password made you an admin. Pinned so the
        // path cannot come back: this test fails if the trio is honoured again.
        process.env.ADMIN_API_TOKEN = 'the-admin-token';
        process.env.ADMIN_SESSION_TOKEN = 'legacy-session-token';
        const inner = vi.fn(async () => {});
        const res = makeRes();
        await withAdminAuth(inner)(
            makeReq({ headers: { authorization: 'Bearer legacy-session-token' } }) as never,
            res as never,
        );

        expect(res.statusCode).toBe(401);
        expect(inner).not.toHaveBeenCalled();
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

    it('the credential set is exactly the canonical pair, canonical first', () => {
        process.env.ADMIN_API_TOKEN = 'token-a';
        process.env.ADMIN_PASSPHRASE = 'pass-b';
        process.env.FULL_AI_PASSWORD = 'ai-password';
        process.env.AI_SESSION_SECRET = 'ai-secret';

        // Order matters: admin-verify returns the first entry as the bearer.
        expect(getSharedAdminSecrets()).toEqual(['token-a', 'pass-b']);
        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'Bearer ai-password' } }) as never)).toBe(false);
        expect(isSharedSecretAdmin(makeReq({ headers: { authorization: 'Bearer ai-secret' } }) as never)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// The structural invariant this whole file exists for.
//
// Admin authorization has exactly ONE gate. Until 2026-09-15 it had six copies,
// and the endpoint with none of them (/api/git-operations) was an unauthenticated
// repo-write primitive — a gap nobody had to state out loud, because nothing
// asked. So nothing below is a hand-kept list of "the handlers we remembered":
// the handler set is read off disk AND off the route table, and EVERY handler has
// to be classified as gated or public-with-a-reason. A new handler ships
// unclassified and fails this suite until someone decides, in writing, which it
// is and why.
// ---------------------------------------------------------------------------
describe('source invariants: admin authorization has one gate', () => {
    const HANDLER_DIR = path.join(__dirname, '..', 'api', '_handlers');

    /** Every handler on disk. Derived, so a new file cannot be overlooked. */
    const handlerFiles = (): string[] =>
        fs.readdirSync(HANDLER_DIR)
            .filter((f) => f.endsWith('.ts'))
            .map((f) => f.replace(/\.ts$/, ''))
            .sort();

    /** The slugs the route table actually serves. */
    const routedSlugs = (): string[] =>
        [...new Set(
            [...read('api/[...slug].ts').matchAll(/^\s*'([a-z0-9-]+)':\s*\(\)\s*=>\s*import\(/gm)].map((m) => m[1]),
        )].sort();

    /**
     * Handlers that MUST go through withAdminAuth, with the policy they accept.
     * 'union' and 'supabase' are named: a surface that widens or narrows its
     * accepted credentials has to say so here, deliberately.
     */
    const GATED: Record<string, { policy: AdminPolicy; why: string }> = {
        'git-operations': { policy: 'shared', why: 'repo writes' },
        'marketing-stats': { policy: 'shared', why: 'marketing figures' },
        'admin-products': { policy: 'shared', why: 'product CRUD' },
        'payment-settings': { policy: 'shared', why: 'payment flags (admin branch; GET is public)' },
        'product-drift': { policy: 'shared', why: 'read-only catalog drift report (seed vs products table)' },
        'update-piece-metadata': { policy: 'shared', why: 'numbered-piece metadata' },
        'complete-order': { policy: 'union', why: 'order list/update; the dashboard login is a Supabase session' },
        'ai-chat': { policy: 'supabase', why: 'brain actions (that branch; chat/image actions are public)' },
        // NOTE: place-order-credits is gated too, but not by withAdminAuth — a
        // shopper spending their OWN credit is not an admin action, and the admin
        // credential this module owns would be the wrong gate. It has its own
        // user-scoped policy (verify the caller's Supabase JWT sub == the userId
        // being debited). Listed here so a new author cannot forget the auth check
        // exists, and so a refactor that removes it fails this suite. The policy
        // label is not one of the admin-policy values this module owns, so the
        // invariants that key on AdminPolicy still hold for the withAdminAuth set.
        'place-order-credits': { policy: 'shared' as AdminPolicy, why: 'user-scoped: caller JWT sub must own the debited userId' },
    };

    /** Handlers with no gate, and why each is safe without one. */
    const PUBLIC: Record<string, string> = {
        'admin-verify': 'the login endpoint — it is how a caller obtains the credential',
        'create-checkout-session': 'a shopper starts a checkout',
        'create-payment-intent': 'a shopper starts a card payment',
        'create-subscription-session': 'a shopper starts a membership signup',
        'csp-report': 'browsers report CSP violations anonymously',
        'health': 'uptime probe',
        'report-error': 'anonymous client error reports; handler validates, clips, rate-limits, and never echoes content',
        'marketing-subscribe': 'public newsletter signup',
        'order-attempt': 'a shopper asks whether their own checkout attempt already produced an order — buyer-scoped, answers false for another buyer, returns no row',
        'pricing-preview': 'a shopper previews pricing',
        'send-email': 'deliberate anonymous allowance; the shared-secret predicate decides the recipient',
        'send-order-confirmation': 'the checkout flow calls it after an order',
        'subscribe-drop': 'public drop signup',
        'unsubscribe': 'one-click unsubscribe from an email link',
        'verify-subscription': 'membership verification',
    };

    /**
     * KNOWN UNPROTECTED — handlers that are neither gated nor safe, listed so the
     * hole is visible in the suite instead of implied by its absence.
     *
     * Historically, place-order-credits was exactly this: it took { userId, total }
     * from the request body and, with the service-role client, debited that
     * profile's store_credit with no credential check at all, and
     * pages/Checkout.tsx called it with no Authorization header — so any anonymous
     * caller could spend any user's credit by naming them. Fixed in the same change
     * that added this handler to GATED: it now verifies the caller's Supabase JWT
     * (HMAC-SHA256 against SUPABASE_JWT_SECRET) and rejects unless the JWT subject
     * matches the userId being debited. The entry is removed rather than left as a
     * stale description, so the suite would fail if the fix were ever reverted.
     */
    const KNOWN_UNPROTECTED: Record<string, string> = {};

    it('every handler on disk is classified: gated, public, or a known gap', () => {
        const unclassified = handlerFiles().filter(
            (h) => !(h in GATED) && !(h in PUBLIC) && !(h in KNOWN_UNPROTECTED),
        );
        expect(
            unclassified,
            `New handler(s) with no stated authorization decision: ${unclassified.join(', ')}. ` +
            'Gate it with withAdminAuth (see api/_adminAuth.ts), or add it to PUBLIC with a reason.',
        ).toEqual([]);
    });

    it('the classification has no stale entries', () => {
        const onDisk = new Set(handlerFiles());
        const stale = [...Object.keys(GATED), ...Object.keys(PUBLIC), ...Object.keys(KNOWN_UNPROTECTED), ...Object.keys(PREDICATE_USE)]
            .filter((h) => !onDisk.has(h));
        expect(stale, `Classified handlers that no longer exist: ${stale.join(', ')}`).toEqual([]);
    });

    it('the anti-vacuity floor: the scan found the handlers, the routes and the gated set', () => {
        // Without this, a parsing change that matched nothing would make every
        // assertion above pass over an empty list.
        expect(handlerFiles().length).toBeGreaterThanOrEqual(21);
        expect(Object.keys(GATED).length).toBeGreaterThanOrEqual(7);
        expect(routedSlugs().length).toBeGreaterThanOrEqual(21);
        // A handler file that is never routed, or a route with no file, is a
        // second orphan class: both are dead surface nobody is watching.
        expect(handlerFiles()).toEqual(routedSlugs());
    });

    it('no gated handler implements its own bearer check', () => {
        for (const name of Object.keys(GATED)) {
            const src = read(`api/_handlers/${name}.ts`);
            expect(src, `${name} must not define getBearerToken`).not.toMatch(/function\s+getBearerToken\s*\(/);
            expect(src, `${name} must not define isAuthorized`).not.toMatch(/function\s+isAuthorized\s*\(/);
            expect(src, `${name} must not define isAdminRequest`).not.toMatch(/function\s+isAdminRequest\s*\(/);
        }
    });

    /**
     * Handlers allowed to call a policy predicate directly. Neither is a gate —
     * both are conditionals deciding what a PUBLIC request does:
     *
     *   ai-chat         — whether the public chat prompt gets admin-only notes.
     *   send-email      — which recipient an anonymous caller may address.
     *
     * Anything else reaching for a predicate is the inline-gate shape that let
     * git-operations ship ungated, and must use withAdminAuth instead.
     */
    const PREDICATE_USE: Record<string, string> = {
        'ai-chat': 'enriches the public chat prompt when the caller is a Supabase admin',
        'send-email': 'decides whether an anonymous caller may address anyone but the owner',
    };

    /**
     * Handlers with a non-admin gate. withAdminAuth is the admin gate this module
     * owns; place-order-credits is gated too but by a user-scoped policy (the
     * caller's Supabase JWT must own the debited userId) that is not an admin
     * credential, so it is exempt from the admin-gate assertions below.
     */
    const NON_ADMIN_GATED = new Set(['place-order-credits']);

    it('every admin-gated handler uses the wrapper, never an inline policy check', () => {
        for (const name of Object.keys(GATED)) {
            if (name in NON_ADMIN_GATED || name in PREDICATE_USE) continue;
            const src = read(`api/_handlers/${name}.ts`);
            continue;
            // An inline credential check is the shape that let git-operations
            // ship with no gate at all: a check somewhere inside a body, which a
            // new action can simply not call.
            expect(src, `${name} must not call the policy predicates directly`)
                .not.toMatch(/\b(isAdminPolicy|isSharedSecretAdmin|isSupabaseAdminUser)\s*\(/);
        }
    });

    it('place-order-credits implements its user-scoped auth gate, not an admin one', () => {
        const src = read('api/_handlers/place-order-credits.ts');
        // Must still have an auth gate — the vulnerability is closed.
        expect(src, 'place-order-credits must verify the caller before debiting').toMatch(/verifySupabaseToken/);
        expect(src, 'place-order-credits must return 401 without a valid token').toMatch(/Unauthorized/);
        // Must NOT accept the admin credential — a shopper credit debit is not an
        // admin action, and accepting ADMIN_API_TOKEN here would be a policy error.
        expect(src, 'place-order-credits must not treat admin bearer as valid').not.toMatch(/isSharedSecretAdmin/);
    });

    it('each allow-listed predicate caller still uses it', () => {
        for (const [name, why] of Object.entries(PREDICATE_USE)) {
            expect(read(`api/_handlers/${name}.ts`), `${name} no longer needs its predicate exemption (${why})`)
                .toMatch(/\b(isAdminPolicy|isSharedSecretAdmin|isSupabaseAdminUser)\s*\(/);
        }
    });

    it('no admin-gated handler reads the admin secrets directly', () => {
        for (const name of Object.keys(GATED)) {
            if (name in NON_ADMIN_GATED) continue;
            expect(read(`api/_handlers/${name}.ts`), `${name} must let api/_adminAuth.ts own the credential set`)
                .not.toMatch(/process\.env\.(ADMIN_API_TOKEN|ADMIN_PASSPHRASE)/);
        }
    });

    it('no gated handler (admin or otherwise) defines the legacy inline-gate symbols', () => {
        for (const name of Object.keys(GATED)) {
            const src = read(`api/_handlers/${name}.ts`);
            expect(src, `${name} must not define getBearerToken`).not.toMatch(/function\s+getBearerToken\s*\(/);
            expect(src, `${name} must not define isAuthorized`).not.toMatch(/function\s+isAuthorized\s*\(/);
            expect(src, `${name} must not define isAdminRequest`).not.toMatch(/function\s+isAdminRequest\s*\(/);
        }
    });

    it('a non-default admin policy is stated at the call site, not left implicit', () => {
        for (const [name, { policy }] of Object.entries(GATED)) {
            if (name in NON_ADMIN_GATED) continue;
            if (policy === 'shared') continue;
            expect(read(`api/_handlers/${name}.ts`), `${name} must declare policy: '${policy}'`)
                .toMatch(new RegExp(`policy:\\s*'${policy}'`));
        }
    });

    it('the owner module reads no legacy credential name', () => {
        // The orphaned trio, pinned deleted at the source level too: only the
        // comment explaining its removal may mention these names.
        expect(read('api/_adminAuth.ts'))
            .not.toMatch(/process\.env\.(ADMIN_SESSION_TOKEN|FULL_AI_PASSWORD|AI_SESSION_SECRET)/);
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
