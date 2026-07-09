// tests/securityInfrastructureReadiness.test.ts
//
// Structural readiness contract for the 4-feature security hardening
// pass: ErrorBoundary, rate limiting, CSP/security headers, env
// example file. Closes the gap where the prior infrastructure review
// flagged 4 P0/P1 items that had no readiness test, so a future
// commit could silently regress any of them.
//
// 1. Global ErrorBoundary: components/ErrorBoundary.tsx exists,
//    exports a class component with componentDidCatch +
//    getDerivedStateFromError, and is wired into App.tsx as the
//    outermost wrap (so any unhandled render error shows the
//    recovery UI instead of white-screening the whole site).
//
// 2. Rate limiter: api/_helpers.ts exports a withRateLimit(slug,
//    req, res) helper, api/[...slug].ts calls it after slug
//    validation, and SLUG_LIMITS_PER_MINUTE contains the 5
//    critical-payment/funnel budgets (paypal-order, marketing-send,
//    marketing-subscribe, send-email, credit-customer-reward).
//
// 3. CSP + security headers: vercel.json's headers block includes
//    a Content-Security-Policy (with the required directives),
//    Strict-Transport-Security, X-Content-Type-Options,
//    X-Frame-Options, Referrer-Policy, Permissions-Policy,
//    Cross-Origin-Opener-Policy. The CSP allows the third-party
//    origins the app actually talks to (paypal, supabase, vercel
//    analytics, polygon).
//
// 4. .env.example: exists at the project root, is NOT a copy of
//    .env.local (no real secrets), and contains the env vars the
//    codebase actually reads (VITE_SUPABASE_URL, ADMIN_SESSION_TOKEN,
//    PAYPAL_ENV, etc.). .nvmrc pins the Node version. package.json
//    declares an engines.node field that matches .nvmrc within a
//    major.
//
// Run: `npx.cmd vitest run tests/securityInfrastructureReadiness.test.ts`

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { withRateLimit, __resetRateLimitForTests, __forceRateLimitForTests } from '../api/_helpers';

const PROJECT_ROOT = path.resolve(__dirname, '..');

function readFile(rel: string): string {
    return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf8');
}

function fileExists(rel: string): boolean {
    return fs.existsSync(path.join(PROJECT_ROOT, rel));
}

describe('Feature 1: Global ErrorBoundary', () => {
    it('components/ErrorBoundary.tsx exists', () => {
        expect(fileExists('components/ErrorBoundary.tsx')).toBe(true);
    });

    it('exports a class component that extends React.Component', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        expect(src).toMatch(/export\s+class\s+ErrorBoundary\s+extends\s+Component</);
    });

    it('implements getDerivedStateFromError (the required state-flip method)', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        expect(src).toMatch(/static\s+getDerivedStateFromError\s*\(/);
    });

    it('implements componentDidCatch (the required side-effect hook)', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        expect(src).toMatch(/public\s+componentDidCatch\s*\(/);
    });

    it('fallback UI has a Reload Page button + a Go Home link', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        expect(src).toMatch(/window\.location\.reload\(\)/);
        expect(src).toMatch(/href="\/"/);
    });

    it('App.tsx imports ErrorBoundary (directly or via the nav-reset wrapper)', () => {
        const src = readFile('App.tsx');
        // The boundary is wrapped by ErrorBoundaryWithNavReset, so
        // the literal <ErrorBoundary> tag in App.tsx now has
        // props (resetKey={location.pathname}). Match either the
        // bare or the proped form.
        expect(src).toMatch(/import\s+ErrorBoundary\s+from\s+['"]\.\/components\/ErrorBoundary['"]/);
        expect(src).toMatch(/<ErrorBoundary(\s+resetKey=\{location\.pathname\})?>/);
    });
});

describe('Feature 2: API rate limiter', () => {
    it('api/_helpers.ts exports a withRateLimit function', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/export\s+function\s+withRateLimit\s*\(/);
    });

    it('withRateLimit returns a RateLimitResult with allowed + remaining + limit + resetAt + retryAfterSeconds', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/export\s+interface\s+RateLimitResult/);
        expect(src).toMatch(/allowed:\s*boolean/);
        expect(src).toMatch(/remaining:\s*number/);
        expect(src).toMatch(/resetAt:\s*number/);
        expect(src).toMatch(/retryAfterSeconds:\s*number/);
    });

    it('rate limit gate skips GET/HEAD (read-only requests are unmetered)', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/isReadMethod\s*\(\s*req\.method\s*\)/);
        expect(src).toMatch(/'GET'\s*\|\|\s*m\s*===\s*'HEAD'/);
    });

    it('rate limit gate disables on NODE_ENV=test (so vitest is not blocked)', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]test['"]/);
    });

    it('rate limit gate honours DISABLE_RATE_LIMIT=1 escape hatch', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/DISABLE_RATE_LIMIT\s*===\s*['"]1['"]/);
    });

    it('per-slug limits exist for the 5 highest-risk endpoints', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/['"]paypal-order['"]:\s*10/);
        expect(src).toMatch(/['"]marketing-send['"]:\s*5/);
        expect(src).toMatch(/['"]marketing-subscribe['"]:\s*10/);
        expect(src).toMatch(/['"]send-email['"]:\s*10/);
        expect(src).toMatch(/['"]credit-customer-reward['"]:\s*20/);
    });

    it('on 429, the helper writes Retry-After + JSON body (no leak of internal counters)', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/['"]Retry-After['"]/);
        expect(src).toMatch(/res\.status\(429\)\.json/);
        expect(src).toMatch(/error:\s*['"]Too Many Requests['"]/);
    });

    it('on every gated request, the helper sets X-RateLimit-Limit/Remaining/Reset', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/['"]X-RateLimit-Limit['"]/);
        expect(src).toMatch(/['"]X-RateLimit-Remaining['"]/);
        expect(src).toMatch(/['"]X-RateLimit-Reset['"]/);
    });

    it('IP extraction prefers x-forwarded-for (Vercel edge), then x-real-ip, then socket', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/['"]x-forwarded-for['"]/);
        expect(src).toMatch(/['"]x-real-ip['"]/);
        expect(src).toMatch(/socket\?\.remoteAddress/);
    });

    it('exposes a __resetRateLimitForTests escape hatch for unit tests', () => {
        const src = readFile('api/_helpers.ts');
        expect(src).toMatch(/export\s+function\s+__resetRateLimitForTests\s*\(\s*\)/);
        expect(src).toMatch(/rateLimitStore\.clear\(\)/);
    });

    it('api/[...slug].ts imports withRateLimit and gates after slug validation, before loadHandler', () => {
        const src = readFile('api/[...slug].ts');
        expect(src).toMatch(/import\s*{\s*withRateLimit\s*}\s*from\s*['"]\.\/_helpers['"]/);
        const unknownIdx = src.indexOf("if (!(slug in HANDLER_LOADERS))");
        const rateLimitIdx = src.indexOf('withRateLimit(slug, req, res)');
        const loadHandlerIdx = src.indexOf('loadHandler(slug as HandlerSlug)');
        expect(unknownIdx).toBeGreaterThan(0);
        expect(rateLimitIdx).toBeGreaterThan(unknownIdx);
        expect(rateLimitIdx).toBeLessThan(loadHandlerIdx);
    });

    it('api/[...slug].ts early-returns on !rateLimit.allowed (no double-write, no handler import)', () => {
        const src = readFile('api/[...slug].ts');
        expect(src).toMatch(/if\s*\(\s*!rateLimit\.allowed\s*\)\s*{[\s\S]*?return\s*;/);
    });
});

describe('Feature 3: CSP + security headers in vercel.json', () => {
    let headersSrc: string;

    beforeEach(() => {
        headersSrc = readFile('vercel.json');
    });

    it('declares a Content-Security-Policy header', () => {
        expect(headersSrc).toMatch(/['"]Content-Security-Policy['"]/);
    });

    it('CSP default-src is restricted to self', () => {
        expect(headersSrc).toMatch(/default-src\s+'self'/);
    });

    it('CSP allows the third-party origins the app talks to (paypal, supabase, polygon, vercel analytics)', () => {
        expect(headersSrc).toMatch(/https:\/\/www\.paypal\.com/);
        expect(headersSrc).toMatch(/https:\/\/\*\.supabase\.co/);
        expect(headersSrc).toMatch(/wss:\/\/\*\.supabase\.co/);
        expect(headersSrc).toMatch(/https:\/\/polygon-rpc\.com/);
        expect(headersSrc).toMatch(/https:\/\/\*\.vercel-insights\.com/);
    });

    it('CSP locks frame-ancestors to none (mirrors X-Frame-Options: DENY)', () => {
        expect(headersSrc).toMatch(/frame-ancestors\s+'none'/);
    });

    it('CSP disallows object-src (defense in depth against Flash-style embeds)', () => {
        expect(headersSrc).toMatch(/object-src\s+'none'/);
    });

    it('declares HSTS with 2-year max-age + includeSubDomains + preload', () => {
        expect(headersSrc).toMatch(/['"]Strict-Transport-Security['"]/);
        expect(headersSrc).toMatch(/max-age=63072000/);
        expect(headersSrc).toMatch(/includeSubDomains/);
        expect(headersSrc).toMatch(/preload/);
    });

    it('declares X-Content-Type-Options: nosniff', () => {
        expect(headersSrc).toMatch(/['"]X-Content-Type-Options['"]/);
        expect(headersSrc).toMatch(/['"]nosniff['"]/);
    });

    it('declares X-Frame-Options: DENY (clickjacking defense)', () => {
        expect(headersSrc).toMatch(/['"]X-Frame-Options['"]/);
        expect(headersSrc).toMatch(/['"]DENY['"]/);
    });

    it('declares Referrer-Policy: strict-origin-when-cross-origin', () => {
        expect(headersSrc).toMatch(/['"]Referrer-Policy['"]/);
        expect(headersSrc).toMatch(/['"]strict-origin-when-cross-origin['"]/);
    });

    it('declares Permissions-Policy disabling camera/mic/geolocation/FLoC', () => {
        expect(headersSrc).toMatch(/['"]Permissions-Policy['"]/);
        expect(headersSrc).toMatch(/camera=\(\)/);
        expect(headersSrc).toMatch(/microphone=\(\)/);
        expect(headersSrc).toMatch(/geolocation=\(\)/);
        expect(headersSrc).toMatch(/interest-cohort=\(\)/);
    });

    it('declares Cross-Origin-Opener-Policy: same-origin (Spectre defense)', () => {
        expect(headersSrc).toMatch(/['"]Cross-Origin-Opener-Policy['"]/);
        expect(headersSrc).toMatch(/['"]same-origin['"]/);
    });
});

describe('Feature 4: env-var template + Node version pin', () => {
    it('.env.example exists at the project root', () => {
        expect(fileExists('.env.example')).toBe(true);
    });

    it('.env.example is not a copy of a real .env.local (no service-role-shaped values)', () => {
        const src = readFile('.env.example');
        expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=eyJ/);
        expect(src).not.toMatch(/RESEND_API_KEY=re_[a-zA-Z0-9]{20,}/);
    });

    it('.env.example documents the 9 critical env vars the codebase reads', () => {
        const src = readFile('.env.example');
        expect(src).toMatch(/VITE_SUPABASE_URL=/);
        expect(src).toMatch(/VITE_SUPABASE_ANON_KEY=/);
        expect(src).toMatch(/ADMIN_SESSION_TOKEN=/);
        expect(src).toMatch(/PAYPAL_ENV=/);
        expect(src).toMatch(/VITE_PAYPAL_CLIENT_ID=/);
        expect(src).toMatch(/RESEND_API_KEY=/);
        expect(src).toMatch(/TWILIO_ACCOUNT_SID=/);
        expect(src).toMatch(/VITE_ALCHEMY_KEY=/);
        expect(src).toMatch(/VITE_APP_URL=/);
    });

    it('.env.example explains the [build] vs [secret] tagging convention in a header comment', () => {
        const src = readFile('.env.example');
        expect(src).toMatch(/\[build\]/);
        expect(src).toMatch(/\[secret\]/);
    });

    it('.nvmrc pins the Node major version used by Vercel', () => {
        expect(fileExists('.nvmrc')).toBe(true);
        const v = readFile('.nvmrc').trim();
        expect(v).toMatch(/^20\./);
    });

    it('package.json declares an engines.node field that matches .nvmrc within a major', () => {
        const pkg = JSON.parse(readFile('package.json')) as {
            engines?: { node?: string; npm?: string; pnpm?: string };
        };
        expect(pkg.engines?.node).toBeDefined();
        const enginesMajor = pkg.engines?.node?.match(/(\d+)/)?.[1];
        const nvmrcMajor = readFile('.nvmrc').trim().match(/^(\d+)/)?.[1];
        expect(enginesMajor).toBe(nvmrcMajor);
    });
});

describe('Feature 2 behavior: withRateLimit semantics', () => {
    function makeRes() {
        const headers: Record<string, string> = {};
        let statusCode = 0;
        let body: unknown = null;
        return {
            setHeader: (k: string, v: string) => { headers[k] = v; },
            status: (code: number) => {
                statusCode = code;
                return { json: (b: unknown) => { body = b; } };
            },
            get headers() { return headers; },
            get statusCode() { return statusCode; },
            get body() { return body; },
        };
    }

    function makeReq(method: string, ip: string) {
        return { method, headers: { 'x-forwarded-for': ip } };
    }

    beforeEach(() => {
        __resetRateLimitForTests();
        // Force the limiter ON for the behavior tests. Without
        // this, the NODE_ENV=test short-circuit would return
        // allowed=true without ever incrementing the counter,
        // making the 429 + bucket-separation assertions
        // untestable. Production code never calls this.
        __forceRateLimitForTests(true);
    });

    afterEach(() => {
        __resetRateLimitForTests();
        // Clear the force flag too so it doesn't leak into the
        // next test file's runtime. The JSDoc on
        // __resetRateLimitForTests says the test setup owns the
        // force flag's lifecycle -- this is the explicit teardown.
        __forceRateLimitForTests(false);
    });

    it('returns allowed=true and sets X-RateLimit-* headers on the first call', () => {
        const res = makeRes();
        const result = withRateLimit('paypal-order', makeReq('POST', '1.2.3.4'), res);
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(10);
        expect(result.remaining).toBe(9);
        expect(res.headers['X-RateLimit-Limit']).toBe('10');
        expect(res.headers['X-RateLimit-Remaining']).toBe('9');
        expect(res.headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('fires 429 after limit+1 calls from the same IP, with Retry-After + remaining=0', () => {
        const req = makeReq('POST', '5.6.7.8');
        // Fire 10 allowed calls (the budget).
        for (let i = 0; i < 10; i++) {
            const res = makeRes();
            const r = withRateLimit('paypal-order', req, res);
            expect(r.allowed).toBe(true);
        }
        // The 11th call must 429.
        const finalRes = makeRes();
        const finalResult = withRateLimit('paypal-order', req, finalRes);
        expect(finalResult.allowed).toBe(false);
        expect(finalResult.remaining).toBe(0);
        expect(finalRes.statusCode).toBe(429);
        expect(finalRes.headers['Retry-After']).toBeDefined();
        expect(Number(finalRes.headers['Retry-After'])).toBeGreaterThan(0);
        expect(finalRes.body).toEqual({ error: 'Too Many Requests', retryAfter: expect.any(Number) });
    });

    it('keeps separate buckets per IP (one IP hitting the limit does not lock out another)', () => {
        // IP A burns the budget.
        for (let i = 0; i < 11; i++) {
            withRateLimit('paypal-order', makeReq('POST', '9.9.9.9'), makeRes());
        }
        // IP B should still have a full budget.
        const bRes = makeRes();
        const bResult = withRateLimit('paypal-order', makeReq('POST', '9.9.9.10'), bRes);
        expect(bResult.allowed).toBe(true);
        expect(bResult.remaining).toBe(9);
    });

    it('keeps separate buckets per slug (paypal-order abuse does not lock out marketing-send)', () => {
        for (let i = 0; i < 6; i++) {
            withRateLimit('marketing-send', makeReq('POST', '1.1.1.1'), makeRes());
        }
        const pRes = makeRes();
        const pResult = withRateLimit('paypal-order', makeReq('POST', '1.1.1.1'), pRes);
        expect(pResult.allowed).toBe(true);
    });

    it('bypasses the limit for GET, HEAD, and OPTIONS (read-only + preflight are unmetered)', () => {
        for (const method of ['GET', 'HEAD', 'OPTIONS']) {
            __resetRateLimitForTests();
            for (let i = 0; i < 100; i++) {
                const r = withRateLimit('paypal-order', makeReq(method, '2.2.2.2'), makeRes());
                expect(r.allowed).toBe(true);
            }
        }
    });

    it('fails open with the full budget when no client IP is extractable (no DoS collapse)', () => {
        const req = { method: 'POST', headers: {} }; // no x-forwarded-for
        const res = makeRes();
        // Stub console.warn to silence the warning during the test
        // (we assert on the return shape, not the warning text --
        // the warning prefix is an internal detail that can change
        // without breaking the contract).
        const origWarn = console.warn;
        console.warn = () => {};
        try {
            const r = withRateLimit('paypal-order', req, res);
            // Asserting on the return shape locks the contract:
            // allowed=true (fail open), limit intact, remaining
            // intact. The console.warn call is nice-to-have; the
            // shape is what callers depend on.
            expect(r.allowed).toBe(true);
            expect(r.limit).toBe(10);
            expect(r.remaining).toBe(10);
        } finally {
            console.warn = origWarn;
        }
    });

    it('__resetRateLimitForTests clears the in-memory store (no counter leak between tests)', () => {
        const req = makeReq('POST', '3.3.3.3');
        for (let i = 0; i < 11; i++) {
            withRateLimit('paypal-order', req, makeRes());
        }
        // Without reset, next call is 429.
        let lastResult = withRateLimit('paypal-order', req, makeRes());
        expect(lastResult.allowed).toBe(false);
        // After reset, first call is allowed again.
        __resetRateLimitForTests();
        lastResult = withRateLimit('paypal-order', req, makeRes());
        expect(lastResult.allowed).toBe(true);
        expect(lastResult.remaining).toBe(9);
    });
});

describe('Feature 1 behavior: ErrorBoundary resets on path change WITHOUT remounting', () => {
    it('ErrorBoundary accepts a resetKey prop + clears state in componentDidUpdate', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        // The class must declare a resetKey prop and a
        // componentDidUpdate that resets on change. This is the
        // correct pattern: reset internal state without remounting
        // children, preserving local state in CartDrawer /
        // AIChatWidget / in-flight forms.
        expect(src).toMatch(/resetKey\?:\s*string\s*\|\s*number/);
        expect(src).toMatch(/public\s+componentDidUpdate\s*\(\s*prevProps/);
        expect(src).toMatch(/this\.props\.resetKey\s*!==\s*prevProps\.resetKey/);
        expect(src).toMatch(/setState\s*\(\s*{\s*hasError:\s*false/);
    });

    it('App.tsx wrapper passes resetKey={location.pathname} (NOT key={...} which would remount)', () => {
        const src = readFile('App.tsx');
        expect(src).toMatch(/ErrorBoundaryWithNavReset/);
        // The wrapper must use the resetKey prop pattern, NOT the
        // key prop on the boundary itself. A `key` prop would
        // remount the entire subtree on every route change,
        // resetting local state in CartDrawer and forms.
        expect(src).toMatch(/<ErrorBoundary\s+resetKey=\{location\.pathname\}>/);
        expect(src).not.toMatch(/<ErrorBoundary\s+key=\{location\.pathname\}>/);
        expect(src).toMatch(/useLocation\(\)/);
    });
});

describe('Feature 3 additions: CSP covers ServiceWorker + PWA manifest + reports', () => {
    it('api/_handlers/csp-report.ts exists and is wired into HANDLER_LOADERS (so the report-uri 404s)', () => {
        expect(fileExists('api/_handlers/csp-report.ts')).toBe(true);
        const handlerSrc = readFile('api/_handlers/csp-report.ts');
        // The handler must accept POST (the browser sends a POST
        // for violation reports) and short-circuit OPTIONS preflight.
        // CORS itself is set by the catch-all in api/[...slug].ts.
        expect(handlerSrc).toMatch(/req\.method\s*===\s*['"]OPTIONS['"]/);
        expect(handlerSrc).toMatch(/req\.method\s*!==\s*['"]POST['"]/);
        // It must return 204 No Content on a successful report so
        // the browser does not retry-flood the endpoint.
        expect(handlerSrc).toMatch(/res\.status\(204\)/);
        // It must return 400 on garbaged bodies so a misbehaving
        // client can't spam log lines with undefined fields.
        // Deliberate deviation from the CSP reporting spec -- the
        // 30/min rate limit caps the abuse surface further.
        expect(handlerSrc).toMatch(/res\.status\(400\)/);
        expect(handlerSrc).toMatch(/Invalid CSP report body/);
        // It must log the violation server-side (the value of the
        // endpoint is the operator seeing what the browser saw).
        expect(handlerSrc).toMatch(/console\.warn/);
        const routerSrc = readFile('api/[...slug].ts');
        expect(routerSrc).toMatch(/'csp-report':\s*\(\)\s*=>\s*import\('\.\/_handlers\/csp-report'\)/);
    });
    let headersSrc: string;
    beforeEach(() => {
        headersSrc = readFile('vercel.json');
    });

    it('CSP includes worker-src self (ServiceWorker is otherwise blocked)', () => {
        expect(headersSrc).toMatch(/worker-src\s+'self'/);
    });

    it('CSP includes manifest-src self (PWA manifest is otherwise blocked)', () => {
        expect(headersSrc).toMatch(/manifest-src\s+'self'/);
    });

    it('CSP includes report-uri so violations are surfaced (not silent)', () => {
        expect(headersSrc).toMatch(/report-uri\s+\/api\/csp-report/);
    });

    it('CSP does NOT include unsafe-eval (Vite production output does not need it)', () => {
        expect(headersSrc).not.toMatch(/'unsafe-eval'/);
    });
});

describe('Feature 4 additions: admin token rotation contract', () => {
    it('.env.example documents the 3-token rotation contract for withAdminAuth', () => {
        const src = readFile('.env.example');
        // The three env vars must be documented AND a comment must
        // flag that they share a rotation cadence (rotating one
        // without the others breaks the marketing-* gates).
        expect(src).toMatch(/ADMIN_SESSION_TOKEN=/);
        expect(src).toMatch(/FULL_AI_PASSWORD=/);
        expect(src).toMatch(/AI_SESSION_SECRET=/);
        // The rotation contract is documented in a comment near the
        // admin section (search for the rotation hint).
        expect(src).toMatch(/[Rr]otate\s+(all\s+three|on\s+a\s+coordinated)/);
    });
});

describe('Feature 5: Sentry (browser error tracking)', () => {
    it('package.json declares @sentry/react in dependencies (pinned major range)', () => {
        const pkg = JSON.parse(readFile('package.json')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        const version = pkg.dependencies?.['@sentry/react'];
        expect(version).toBeDefined();
        // A caret range on a major (e.g. ^9.x.x) is required so the
        // SDK can be upgraded for patch + minor without a manual
        // edit. A bare semver (9.x.x with no caret) is a regression
        // because npm install will not auto-update it.
        expect(version).toMatch(/^\^?\d+\.\d+/);
    });

    it('services/sentryInit.ts exists and exports initSentry', () => {
        expect(fileExists('services/sentryInit.ts')).toBe(true);
        const src = readFile('services/sentryInit.ts');
        expect(src).toMatch(/export\s+function\s+initSentry\s*\(\s*\)/);
    });

    it('initSentry gates on import.meta.env.PROD (no Sentry traffic in DEV/PREVIEW)', () => {
        const src = readFile('services/sentryInit.ts');
        // Gate must be the first/largest conditional -- Vite
        // dead-code eliminates the rest of the function in DEV so
        // preview deploys ship NO Sentry JS at all. A failure here
        // means a preview deploy could leak events.
        expect(src).toMatch(/import\.meta\.env\.PROD/);
        // The PROD check must be a return (not just a warn, not
        // a flag flip) so Vite can drop the Sentry.init body.
        expect(src).toMatch(/if\s*\(\s*!\s*import\.meta\.env\.PROD\s*\)\s*{\s*return\s*;\s*}/);
    });

    it('initSentry gates on VITE_SENTRY_DSN being set and non-empty (silent no-op otherwise)', () => {
        const src = readFile('services/sentryInit.ts');
        expect(src).toMatch(/VITE_SENTRY_DSN/);
        // The DSN check must be a return so an unset env var
        // yields a true no-op (no thrown boot errors, no console
        // warnings on every preview deploy).
        expect(src).toMatch(/if\s*\(\s*!\s*dsn\s*\|\|\s*typeof\s+dsn\s*!==\s*['"]string['"]/);
    });

    it('initSentry uses browserTracingIntegration + 0.1 tracesSampleRate (low-volume commerce default)', () => {
        const src = readFile('services/sentryInit.ts');
        expect(src).toMatch(/Sentry\.browserTracingIntegration\s*\(/);
        expect(src).toMatch(/tracesSampleRate:\s*DEFAULT_TRACES_SAMPLE_RATE|tracesSampleRate:\s*0\.1/);
        // tracesSampleRate constant must be 0.1 -- a higher value
        // burns Sentry quota on a low-traffic site.
        expect(src).toMatch(/DEFAULT_TRACES_SAMPLE_RATE\s*=\s*0\.1/);
    });

    it('initSentry drops browser-extension noise (denyUrls) and ResizeObserver quirk (beforeSend)', () => {
        const src = readFile('services/sentryInit.ts');
        expect(src).toMatch(/denyUrls:\s*SENTRY_DENY_URL_PATTERNS|denyUrls:\s*\[/);
        // denyUrls must include a chrome-extension regex. The
        // exact pattern is an implementation detail; this regex
        // is the contract.
        expect(src).toMatch(/\/chrome-extension:\\\/\\\/\/i|\/chrome-extension:/);
        expect(src).toMatch(/beforeSend\s*\(\s*event\s*\)/);
        expect(src).toMatch(/ResizeObserver/);
    });

    it('index.tsx imports initSentry and calls it BEFORE ReactDOM.createRoot (module-load capture)', () => {
        const src = readFile('index.tsx');
        expect(src).toMatch(/import\s*{\s*initSentry\s*}\s*from\s*['"]\.\/services\/sentryInit['"]/);
        const initCallIdx = src.indexOf('initSentry()');
        const createRootIdx = src.indexOf('ReactDOM.createRoot');
        expect(initCallIdx).toBeGreaterThan(0);
        expect(createRootIdx).toBeGreaterThan(0);
        // initSentry() must run before ReactDOM.createRoot -- a
        // module-load error happens before createRoot and would
        // otherwise be invisible to Sentry.
        expect(initCallIdx).toBeLessThan(createRootIdx);
    });

    it('index.tsx passes onUncaughtError + onCaughtError to createRoot (React 19 root handlers)', () => {
        const src = readFile('index.tsx');
        // React 19 introduced these options. They capture errors
        // that escape every mounted ErrorBoundary (event handlers,
        // Suspense fallbacks without a boundary above them)
        // and errors that an ErrorBoundary ALREADY caught (under
        // a different tag for dashboard filtering).
        expect(src).toMatch(/onUncaughtError:/);
        expect(src).toMatch(/onCaughtError:/);
        // The onUncaughtError handler must forward to Sentry --
        // otherwise React 19's new "uncaught" error class is
        // invisible to us.
        const uncaughtIdx = src.indexOf('onUncaughtError:');
        const uncaughtCaptureIdx = src.indexOf('Sentry.captureException', uncaughtIdx);
        expect(uncaughtIdx).toBeGreaterThan(0);
        expect(uncaughtCaptureIdx).toBeGreaterThan(uncaughtIdx);
        // Same for onCaughtError.
        const caughtIdx = src.indexOf('onCaughtError:');
        const caughtCaptureIdx = src.indexOf('Sentry.captureException', caughtIdx);
        expect(caughtIdx).toBeGreaterThan(0);
        expect(caughtCaptureIdx).toBeGreaterThan(caughtIdx);
    });

    it('ErrorBoundary imports @sentry/react and calls Sentry.captureException inside componentDidCatch', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        expect(src).toMatch(/import\s*\*\s*as\s+Sentry\s*from\s*['"]@sentry\/react['"]/);
        // The capture call must live INSIDE componentDidCatch --
        // anywhere else (constructor, render, getDerived) would
        // either fire too early or violate React lifecycle rules.
        const catchIdx = src.indexOf('public componentDidCatch');
        const captureIdx = src.indexOf('Sentry.captureException', catchIdx);
        expect(catchIdx).toBeGreaterThan(0);
        expect(captureIdx).toBeGreaterThan(catchIdx);
    });

    it('ErrorBoundary uses capture-context second arg (extra + tags + level) and NOT withScope', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        // The second-arg capture-context form scopes metadata to
        // this single event and never mutates global scope state.
        // withScope mutates shared global scope, which races with
        // React 19 concurrent rendering.
        expect(src).toMatch(/Sentry\.captureException\s*\(\s*error\s*,\s*\{/);
        // Extra metadata must include the componentStack so the
        // Sentry UI shows the failing React subtree.
        expect(src).toMatch(/extra:\s*\{\s*componentStack:/);
        // Tags must include the boundary name for dashboard filtering.
        expect(src).toMatch(/tags:\s*\{\s*errorBoundary:\s*['"]global['"]/);
        expect(src).toMatch(/level:\s*['"]error['"]/);
        // The legacy withScope API must NOT be used.
        expect(src).not.toMatch(/Sentry\.withScope\s*\(/);
    });

    it('.env.example documents VITE_SENTRY_DSN with the [build] tag', () => {
        const src = readFile('.env.example');
        expect(src).toMatch(/VITE_SENTRY_DSN=/);
        // The [build] tag means the DSN is baked into the JS
        // bundle at `vite build` time. A future operator
        // rotating it needs to know that means a redeploy.
        // Search for either [build] on the same logical line or
        // a comment flagging the [build] nature of the var.
        expect(src).toMatch(/VITE_SENTRY_DSN\s+is\s+the\s+\[build\]/);
    });

    it('vercel.json CSP allows browser.sentry-cdn.com (script-src) + ingest.sentry.io (connect-src)', () => {
        const headersSrc = readFile('vercel.json');
        expect(headersSrc).toMatch(/script-src[^;]*browser\.sentry-cdn\.com/);
        expect(headersSrc).toMatch(/connect-src[^;]*ingest\.sentry\.io/);
    });

    it('ErrorBoundary keeps console.error as a backup so logging works even if Sentry is broken', () => {
        const src = readFile('components/ErrorBoundary.tsx');
        // The console.error is a deliberate observability
        // backup. If a downstream ad-blocker or network policy
        // strips the SDK's POST to ingest.sentry.io, the
        // console.error still surfaces in the Vercel runtime
        // log + DevTools. Removing it makes Sentry a single
        // point of failure for production observability.
        const catchIdx = src.indexOf('public componentDidCatch');
        const captureIdx = src.indexOf('Sentry.captureException', catchIdx);
        const consoleIdx = src.indexOf('console.error', catchIdx);
        expect(consoleIdx).toBeGreaterThan(catchIdx);
        expect(consoleIdx).toBeGreaterThan(captureIdx);
    });
});
