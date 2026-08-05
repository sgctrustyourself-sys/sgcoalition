// Shared helpers for /api/_handlers/* — extracted during a post-typed-migration
// refactor so every handler reads from one place. 14 handler modules used to
// carry their own copies of these; behavior parity is preserved through the
// CorsOptions field bag and the LOCAL_DEV_ORIGINS / EXTENDED_CORS_HEADERS
// constants below.

import type { ApiRequest, ApiResponse } from './_types.js';

// The ONLY payment methods checkout is allowed to offer. Every Stripe
// PaymentIntent must be created with exactly this allow-list — the
// PaymentElement renders nothing else. Do NOT switch back to
// automatic_payment_methods (it silently surfaces every method enabled in the
// Stripe dashboard, including Link / Cash App / Amazon Pay, which the owner
// chose to hide).
//
// FOOTGUN WARNING: passing a method type that is NOT enabled on the Stripe
// account makes Stripe fail the ENTIRE PaymentIntent — card included. So a
// new method (e.g. 'afterpay_clearpay') may ONLY be added here AFTER it is
// toggled on in the Stripe dashboard (Settings → Payment methods). Code
// before dashboard = total Stripe checkout outage.
//
// The /api/health handler compares this list against what the account
// actually has enabled and reports the mismatch, so the admin card surfaces
// the outage instead of silently failing.
export const CHECKOUT_PAYMENT_METHOD_TYPES = ['card', 'klarna'] as const;

export interface HttpError extends Error {
    status?: number;
}

export function createHttpError(status: number, message: string): HttpError {
    const error = new Error(message) as HttpError;
    error.status = status;
    return error;
}

export function parseBody(req: ApiRequest): Record<string, unknown> {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            const parsed: unknown = JSON.parse(req.body);
            return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
        } catch {
            throw createHttpError(400, 'Invalid JSON request body.');
        }
    }
    return typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
}

// Admin auth gate. Wraps a mutating handler so only callers presenting a
// matching admin Bearer token can reach the inner body. Mirrors the
// prior-inline admin pattern from marketing-send.ts + marketing-stats.ts
// + api/admin/update-piece-metadata.ts so the env contract is the same
// across the surface area: ADMIN_SESSION_TOKEN (primary canonical) with
// FULL_AI_PASSWORD and AI_SESSION_SECRET run in parallel -- they're
// actively in use by the marketing-* endpoints (which use the same env
// contract in their inline bearer checks), so a future operator rotating
// only ADMIN_SESSION_TOKEN would quietly break the marketing gates
// while the wrapped handlers here still pass. Rotate all three on a
// coordinated cadence, OR migrate the marketing-* handlers to the
// wrapper first. If no admin env is set the gate returns 401 --
// fail-closed is the right default for a write surface.
//
// Usage:
//   export default withAdminAuth(async (req, res) => {
//     try { res.status(200).json(await innerLogic(req)); }
//     catch (err: any) { ... }
//   }, { cors: { methods: 'POST,OPTIONS', allowedHeaders: EXTENDED_CORS_HEADERS } });
//
// Order of operations inside the returned wrapper:
//   1. CORS headers (so the preflight + 401 response both echo Origin/Methods/Headers).
//   2. OPTIONS short-circuit (preflight never carries auth).
//   3. Admin Bearer check (returns 401 on mismatch, missing header, or empty env).
//   4. Forward to the inner handler.
export interface WithAdminAuthOptions {
    cors?: CorsOptions;
}

export function withAdminAuth(
    handler: (req: ApiRequest, res: ApiResponse) => Promise<unknown>,
    options: WithAdminAuthOptions = {}
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
    return async (req, res) => {
        setCorsHeaders(req, res, options.cors);
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        const expected = process.env.ADMIN_SESSION_TOKEN
            || process.env.FULL_AI_PASSWORD
            || process.env.AI_SESSION_SECRET
            || '';
        const headerRaw = req.headers?.authorization ?? req.headers?.Authorization;
        const authHeader = typeof headerRaw === 'string' ? headerRaw : '';
        const bearer = authHeader.toLowerCase().startsWith('bearer ')
            ? authHeader.slice(7).trim()
            : authHeader.trim();
        if (!expected || !bearer || bearer !== expected) {
            res.status(401).json({ error: 'Admin authorization required.' });
            return;
        }

        await handler(req, res);
    };
}

export interface CorsOptions {
    /**
     * When set and non-empty, the request's `Origin` header is echoed back
     * verbatim only when it appears in this list. Otherwise we fall back to
     * the configured single origin. Use this for handlers that need to serve
     * Vite dev (3000/3001 + 127.0.0.1) on top of the production host.
     */
    originWhitelist?: readonly string[];
    methods?: string;
    allowedHeaders?: string;
}

const DEFAULT_PUBLIC_ORIGIN = 'https://sgcoalition.xyz';

export const LOCAL_DEV_ORIGINS: readonly string[] = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];

export const EXTENDED_CORS_HEADERS =
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version';

const DEFAULT_METHODS = 'GET,OPTIONS,PATCH,POST';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization';

export function setCorsHeaders(req: ApiRequest, res: ApiResponse, options: CorsOptions = {}): void {
    const configuredOrigin = process.env.VITE_APP_URL || DEFAULT_PUBLIC_ORIGIN;
    let responseOrigin = configuredOrigin;

    if (options.originWhitelist && options.originWhitelist.length > 0) {
        const headerOrigin = req.headers?.origin;
        const requestOrigin = typeof headerOrigin === 'string' ? headerOrigin : undefined;
        if (requestOrigin && options.originWhitelist.includes(requestOrigin)) {
            responseOrigin = requestOrigin;
        }
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Methods', options.methods || DEFAULT_METHODS);
    res.setHeader('Access-Control-Allow-Headers', options.allowedHeaders || DEFAULT_ALLOWED_HEADERS);
}

export function resolvePublicOrigin(req: ApiRequest): string {
    let origin = process.env.VITE_APP_URL?.trim();

    if (!origin && process.env.VERCEL_URL) {
        origin = `https://${process.env.VERCEL_URL}`;
    }

    if (!origin) {
        const host = req.headers?.host;
        if (host) {
            const protocolRaw = req.headers?.['x-forwarded-proto'];
            const protocol = typeof protocolRaw === 'string' && protocolRaw ? protocolRaw : 'http';
            origin = `${protocol}://${host}`;
        }
    }

    if (!origin) {
        origin = DEFAULT_PUBLIC_ORIGIN;
    }

    origin = origin.replace(/\/$/, '');
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
        origin = `https://${origin}`;
    }
    return origin;
}

// ----------------------------------------------------------------------
// Rate limiter (in-memory, per-Lambda)
//
// Per-slug request budget. In-memory because Vercel Lambdas are
// short-lived and we don't have a Redis/Upstash layer yet; the
// per-instance counter is "good enough" for a single Lambda's
// window and combines with Vercel's own edge-rate limits to make
// abuse expensive. The trade-off: a determined attacker who can
// spawn many concurrent Lambdas gets N x limit hits. The realistic
// threat here is a single attacker driving a script, which this
// fully blocks.
//
// Disabled when NODE_ENV === 'test' (vitest sets this) OR when the
// operator sets DISABLE_RATE_LIMIT=1 (escape hatch for the
// load-test job or the manual operator run). Production should
// never set DISABLE_RATE_LIMIT.
//
// Per-slug budgets (req per 60s sliding window) are calibrated to
// the surface: payment endpoints are the tightest, marketing blast
// endpoints get medium (one campaign per few seconds is enough
// for a human operator), checkout funnel gets more headroom
// because the front-end legitimately retries on transient network
// errors.
//
// GET/HEAD skip the limiter entirely -- they are read-only and
// the product data they serve is the same data the browser
// already has cached, so a flood of GETs is harmless to the
// back-end budget.
//
// Locked by tests/securityInfrastructureReadiness.test.ts.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60_000;

type RateLimitEntry = { count: number; resetAt: number };

// Per-instance counters. Map keyed by `${slug}:${ip}` so each
// (endpoint, caller) pair gets its own bucket; sharing a key
// across slugs would let an attacker max out marketing-send to
// lock out paypal-order (a single global counter is a worse
// surface).
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default limit applied to any slug not explicitly listed. Sits
// at 60/min so a forgotten handler doesn't immediately become an
// open firehose; the explicit list below overrides it for the
// surfaces we've thought about.
const DEFAULT_LIMIT_PER_MINUTE = 60;

const SLUG_LIMITS_PER_MINUTE: Record<string, number> = {
    // Payment surface -- tightest. A legitimate buyer hits this
    // endpoint at most a handful of times per checkout.
    'paypal-order': 10,
    'create-checkout-session': 20,
    'create-payment-intent': 20,
    'complete-order': 20,
    'place-order-credits': 20,
    'credit-customer-reward': 20,
    // Marketing send -- abuse-prone (anyone can hit it if the
    // admin token leaks). 5/min is one campaign per 12s.
    'marketing-send': 5,
    'marketing-stats': 30,
    // Subscription funnel -- sign-up abuse.
    'marketing-subscribe': 10,
    'marketing-optout': 10,
    'subscribe-drop': 10,
    'unsubscribe': 10,
    'verify-subscription': 10,
    // Email resend surface -- abuse = bill spam.
    'send-email': 10,
    'send-order-confirmation': 10,
    // Order-attribution social-linking -- 20/min for legitimate
    // buyers.
    'attribute-order-to-facebook': 20,
    // Admin + dev surfaces -- generous because the operator is
    // the only legitimate caller and they're authenticated.
    'git-operations': 60,
    'ai-chat': 60,
    'create-subscription-session': 20,
    // Browser-driven CSP violation reports. Browsers POST here
    // when a page violates the policy in vercel.json. A
    // determined attacker can spam the endpoint with garbage
    // reports; 30/min caps the abuse without blocking legitimate
    // browsers (a single page-load triggers at most a handful of
    // reports in unusual circumstances).
    'csp-report': 30,
};

function getLimitForSlug(slug: string): number {
    return SLUG_LIMITS_PER_MINUTE[slug] ?? DEFAULT_LIMIT_PER_MINUTE;
}

function isReadMethod(method: string | undefined): boolean {
    if (!method) return false;
    const m = method.toUpperCase();
    // OPTIONS is treated as a read for rate-limit purposes: a
    // CORS preflight storm is not user abuse, it's a legitimate
    // browser behavior that fires before every cross-origin
    // request. Rate-limiting preflight would break the CORS
    // handshake for every origin on the allow-list.
    return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
}

function isRateLimitDisabled(): boolean {
    if (process.env.NODE_ENV === 'test') return true;
    if (process.env.DISABLE_RATE_LIMIT === '1') return true;
    return false;
}

// Test-only override. The behavior tests in
// tests/securityInfrastructureReadiness.test.ts need to exercise
// the real counter math (otherwise NODE_ENV=test would
// short-circuit the gate and the 429 / per-IP / per-slug
// behavior would be untestable). Production code never sets
// this; only the test setup does, via __forceRateLimitForTests.
let forceRateLimitEnabled = false;

function getClientIp(req: { headers?: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
    const headers = req.headers || {};
    const xffRaw = headers['x-forwarded-for'];
    if (typeof xffRaw === 'string' && xffRaw.trim()) {
        // x-forwarded-for is a comma list; the leftmost segment is
        // the original client when Vercel/Cloudflare appends one
        // segment per hop. Use the leftmost non-empty segment.
        const first = xffRaw.split(',')[0]?.trim();
        if (first) return first;
    }
    const xRealIpRaw = headers['x-real-ip'];
    if (typeof xRealIpRaw === 'string' && xRealIpRaw.trim()) {
        return xRealIpRaw.trim();
    }
    const socketIp = req.socket?.remoteAddress?.trim();
    // Return empty string (not 'unknown') when no IP is available.
    // An 'unknown' key would collapse every caller without a
    // forwarded header into a single bucket -- a single misrouted
    // caller would DoS the slug for everyone. withRateLimit treats
    // empty IP as fail-open + warning below.
    return socketIp || '';
}

function pruneExpiredEntries(now: number): void {
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt <= now) rateLimitStore.delete(key);
    }
}

// Single global interval ref. Vercel freezes the Lambda between
// invocations so the interval will pause + resume with the
// container lifecycle; on cold start Node re-evaluates the module
// and the first invocation re-arms it. unref() prevents the
// sweeper from keeping the Lambda alive on its own.
if (typeof globalThis !== 'undefined' && !(globalThis as { __sgRateLimitSweeper?: ReturnType<typeof setInterval> }).__sgRateLimitSweeper) {
    const sweeper = setInterval(() => pruneExpiredEntries(Date.now()), RATE_LIMIT_CLEANUP_INTERVAL_MS);
    if (typeof (sweeper as { unref?: () => void }).unref === 'function') {
        (sweeper as { unref: () => void }).unref();
    }
    (globalThis as { __sgRateLimitSweeper?: ReturnType<typeof setInterval> }).__sgRateLimitSweeper = sweeper;
}

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfterSeconds: number;
}

/**
 * Gate a mutating handler. Returns `allowed: true` if the request
 * is allowed, `false` if the caller has exceeded their per-minute
 * budget. On `false` the helper has already written the 429 +
 * standard rate-limit headers, so the caller can just `return`
 * without writing a body. On `true` the standard rate-limit
 * headers are set so well-behaved clients can back off
 * pre-emptively.
 *
 * Skips GET/HEAD (read-only) and when disabled via env. The skip
 * is silent -- we do NOT set rate-limit headers on GET so a
 * polite client doesn't waste budget-checking reads.
 */
export function withRateLimit(
    slug: string,
    req: { method?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } },
    res: {
        setHeader: (key: string, value: string) => void;
        status: (code: number) => { json: (body: unknown) => void };
    },
): RateLimitResult {
    if ((isRateLimitDisabled() && !forceRateLimitEnabled) || isReadMethod(req.method)) {
        const limit = getLimitForSlug(slug);
        return { allowed: true, limit, remaining: limit, resetAt: 0, retryAfterSeconds: 0 };
    }

    const limit = getLimitForSlug(slug);
    const ip = getClientIp(req);
    // Fail open when we cannot extract an IP. Otherwise every
    // caller without a forwarded header would share one bucket
    // and a single misrouted request would DoS the slug.
    if (!ip) {
        // eslint-disable-next-line no-console
        console.warn(`[rate-limit] no client IP for ${slug}; bypassing limit`);
        return { allowed: true, limit, remaining: limit, resetAt: 0, retryAfterSeconds: 0 };
    }
    const key = `${slug}:${ip}`;
    const now = Date.now();

    const existing = rateLimitStore.get(key);
    if (!existing || existing.resetAt <= now) {
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
        existing.count += 1;
    }
    const entry = rateLimitStore.get(key);
    if (!entry) {
        // Defensive: the set above should always populate, but if
        // something exotic happens (e.g. a TTL race during the
        // sweeper) we fail open and let the request through. The
        // alternative is failing closed on a transient memory bug.
        return { allowed: true, limit, remaining: limit, resetAt: now + RATE_LIMIT_WINDOW_MS, retryAfterSeconds: 0 };
    }

    const remaining = Math.max(0, limit - entry.count);
    const resetAtSeconds = Math.ceil(entry.resetAt / 1000);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetAtSeconds));

    if (entry.count > limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({ error: 'Too Many Requests', retryAfter: retryAfterSeconds });
        return { allowed: false, limit, remaining: 0, resetAt: entry.resetAt, retryAfterSeconds };
    }

    return { allowed: true, limit, remaining, resetAt: entry.resetAt, retryAfterSeconds: 0 };
}

// Test-only escape hatch. Clears the in-memory counter store
// so unit tests don't leak counters between cases. Does NOT
// reset `forceRateLimitEnabled` -- the test setup owns that
// flag's lifecycle (set in beforeEach, cleared in afterEach).
// Exported as a named helper rather than a side-effect of the
// module so it's loud at the call site that this is for tests.
export function __resetRateLimitForTests(): void {
    rateLimitStore.clear();
}

/**
 * Test-only override. Forces the rate limiter ON regardless of
 * NODE_ENV, so the behavior test block can exercise the real
 * counter math (429 after limit+1, per-IP bucket separation, the
 * unknown-IP fail-open path). Production code never calls this.
 * Pair every call with __resetRateLimitForTests() in afterEach
 * to restore the default.
 */
export function __forceRateLimitForTests(enabled: boolean): void {
    forceRateLimitEnabled = enabled;
}
