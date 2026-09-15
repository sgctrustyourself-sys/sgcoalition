// tests/sentryWiring.test.ts
//
// Pins the error-reporting path: services/sentryInit.ts + the React 19 root
// handlers in index.tsx.
//
// The three things worth locking here:
//   1. The DSN gate. With no VITE_SENTRY_DSN the SDK must never be initialised
//      -- and, because index.tsx guards the dynamic import with that same var,
//      @sentry/react must not reach the bundle at all. The source assertion at
//      the bottom is what keeps that true.
//   2. Redaction. Error events leave the browser to a third party, so customer
//      emails and API secrets must be scrubbed by beforeSend.
//   3. Tag contract. FOLLOWUPS documents an alert rule filtered on
//      `tags.source = react19-root-uncaught`; these tests pin the tag strings.
//
// @sentry/react is mocked -- no test talks to Sentry.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as Sentry from '@sentry/react';
import {
    initSentry,
    reportRootError,
    scrubEvent,
    scrubText,
    getDsn,
    isSentryEnabled,
    __resetSentryForTests,
} from '../services/sentryInit';

vi.mock('@sentry/react', () => ({
    init: vi.fn(),
    captureException: vi.fn(),
}));

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const ENV_BACKUP = { ...process.env };
const metaEnv = (import.meta as { env: Record<string, string | undefined> }).env;

beforeEach(() => {
    __resetSentryForTests();
    vi.clearAllMocks();
    delete process.env.VITE_SENTRY_DSN;
    delete metaEnv.VITE_SENTRY_DSN;
});

afterEach(() => {
    process.env = { ...ENV_BACKUP };
    __resetSentryForTests();
});

describe('sentry DSN gate', () => {
    it('reports nothing and never inits when no DSN is configured', () => {
        expect(getDsn()).toBe('');
        expect(isSentryEnabled()).toBe(false);
        expect(initSentry()).toBe(false);

        reportRootError(new Error('boom'), { componentStack: 'at <App>' }, 'uncaught');
        expect(Sentry.init).not.toHaveBeenCalled();
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('inits with no tracing and no integrations once a DSN exists', () => {
        expect(initSentry('https://public@o0.ingest.sentry.io/1')).toBe(true);

        expect(Sentry.init).toHaveBeenCalledTimes(1);
        const options = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(options.dsn).toBe('https://public@o0.ingest.sentry.io/1');
        expect(options.tracesSampleRate).toBe(0);
        expect(options.integrations).toEqual([]);
        expect(typeof options.beforeSend).toBe('function');
    });

    it('is idempotent: a second init is a no-op', () => {
        initSentry('https://public@o0.ingest.sentry.io/1');
        initSentry('https://public@o0.ingest.sentry.io/1');
        expect(Sentry.init).toHaveBeenCalledTimes(1);
    });

    it('reads the DSN from the process env when import.meta.env is unset (test path)', () => {
        process.env.VITE_SENTRY_DSN = 'https://public@o0.ingest.sentry.io/2';
        expect(getDsn()).toBe('https://public@o0.ingest.sentry.io/2');
        expect(isSentryEnabled()).toBe(true);
        expect(initSentry()).toBe(true);
    });
});

describe('sentry root error tags', () => {
    beforeEach(() => {
        initSentry('https://public@o0.ingest.sentry.io/1');
    });

    it('tags uncaught errors with the documented alert-rule source', () => {
        reportRootError(new Error('render blew up'), { componentStack: 'at <Checkout>' }, 'uncaught');

        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        const [error, ctx] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0];
        expect((error as Error).message).toBe('render blew up');
        expect(ctx.tags).toEqual({ source: 'react19-root-uncaught' });
        expect(ctx.contexts.react.componentStack).toBe('at <Checkout>');
    });

    it('tags boundary-caught errors distinctly so caught errors cannot page on-call', () => {
        reportRootError(new Error('caught'), undefined, 'caught');

        const [, ctx] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(ctx.tags).toEqual({ source: 'react19-root-caught' });
        expect(ctx.contexts).toBeUndefined();
    });
});

describe('beforeSend redaction', () => {
    it('scrubs emails and secrets from messages and exception values', () => {
        expect(scrubText('failed for buyer@example.com')).toBe('failed for [email]');
        expect(scrubText('Authorization: Bearer sk_live_abcdef123456')).not.toContain('sk_live_abcdef123456');
        expect(scrubText('whsec_abcdef123456 rejected')).toContain('whsec_[redacted]');
        expect(scrubText('key re_abcdefgh12345678')).toContain('re_[redacted]');
    });

    it('keeps triageable identifiers intact (order + payment ids are not secrets)', () => {
        const text = 'order order_1784012446238 intent pi_3QabcXYZ failed with status 402';
        expect(scrubText(text)).toBe(text);
    });

    it('strips cookies and auth headers, and redacts sensitive keys deeply', () => {
        const event = scrubEvent({
            message: 'payer member@example.com',
            exception: { values: [{ value: 'auth failed for member@example.com with Bearer sk_live_abcdef123456' }] },
            request: {
                url: 'https://sgcoalition.xyz/api/complete-order?id=1',
                data: { email: 'member@example.com', orderId: 'order_1784012446238' },
                cookies: { session: 'abc' },
                headers: { authorization: 'Bearer xyz', 'content-type': 'application/json' },
            },
            extra: { adminToken: 'tok', nested: { apiKey: 'k', orderId: 'order_1784012446238' } },
            breadcrumbs: [{ message: 'sent to member@example.com', data: { page: '/checkout' } }],
        } as never);

        expect(event.message).toBe('payer [email]');
        // Note: scrubText deliberately does NOT redact a bare "token <x>" --
        // that would mangle the extremely common "Unexpected token <" JS error
        // message. Payload *keys* named token/secret are covered by scrubDeep.
        expect(event.exception!.values![0].value).not.toContain('sk_live_abcdef123456');
        expect(event.exception!.values![0].value).toContain('[email]');
        expect(event.request!.cookies).toBeUndefined();
        expect(event.request!.headers!.authorization).toBe('[redacted]');
        expect(event.request!.headers!['content-type']).toBe('application/json');
        expect((event.request!.data as Record<string, unknown>).email).toBe('[email]');
        // order ids survive redaction on purpose
        expect((event.request!.data as Record<string, unknown>).orderId).toBe('order_1784012446238');
        expect((event.extra as Record<string, unknown>).adminToken).toBe('[redacted]');
        expect(((event.extra as Record<string, unknown>).nested as Record<string, unknown>).apiKey).toBe('[redacted]');
        expect(event.breadcrumbs![0].message).toBe('sent to [email]');
    });
});

describe('source invariants: bundle cost + deliberate deferrals', () => {
    const indexSrc = read('index.tsx');
    const initSrc = read('services/sentryInit.ts');

    it('index.tsx guards the sentry import behind VITE_SENTRY_DSN', () => {
        // The whole point: no DSN at build time => Rollup drops the branch and
        // @sentry/react never enters the bundle.
        expect(indexSrc).toMatch(/import\.meta\.env\.VITE_SENTRY_DSN\s*\?/);
        expect(indexSrc).toMatch(/import\(['"]\.\/services\/sentryInit['"]\)/);
    });

    it('index.tsx never statically imports @sentry/react', () => {
        expect(indexSrc).not.toMatch(/from\s*['"]@sentry\/react['"]/);
    });

    it('index.tsx wires both React 19 root handlers', () => {
        expect(indexSrc).toMatch(/onUncaughtError:\s*reportRootError\('uncaught'\)/);
        expect(indexSrc).toMatch(/onCaughtError:\s*reportRootError\('caught'\)/);
    });

    it('session replay stays deliberately deferred (integration AND rate together, or neither)', () => {
        // The SDK silently drops replaysSessionSampleRate when no replay
        // integration is registered. Adding one without the other is the
        // documented footgun, so the deferral is pinned here.
        //
        // Comments are stripped first: sentryInit.ts *documents* the footgun in
        // prose, and only real code should satisfy this assertion.
        const code = initSrc
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        expect(code).not.toMatch(/replaysSessionSampleRate/);
        expect(code).not.toMatch(/replayIntegration/);
    });
});
