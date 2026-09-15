/**
 * Sentry bootstrap + React 19 root error reporting.
 *
 * WHY IT IS LAZY AND DSN-GATED
 * ----------------------------
 * `@sentry/react` is only worth its bundle weight once a project exists to
 * report to. index.tsx therefore guards the dynamic import with
 * `import.meta.env.VITE_SENTRY_DSN`, which Vite inlines at build time: with no
 * DSN configured, Rollup drops the branch and @sentry/react never enters the
 * bundle. Configuring the DSN later is a pure env-var change plus a redeploy
 * with the build cache off (it is a `[build]` var).
 *
 * Everything here is a silent no-op until initSentry() succeeds, so the
 * reporting calls in index.tsx need no further guarding.
 *
 * OPERATOR RUNBOOK (also in FOLLOWUPS.md #1):
 *   1. Create a Sentry project (platform "JavaScript / React").
 *   2. Set VITE_SENTRY_DSN in Vercel for Production.
 *   3. Redeploy with Build Cache OFF.
 *   4. Add ONE alert rule filtered to `tags.source = react19-root-uncaught`, so
 *      the default "any error-level event" rule does not page on-call for
 *      errors the user already saw handled.
 */

import * as Sentry from '@sentry/react';

export type RootErrorKind = 'uncaught' | 'caught';

let initialized = false;

/**
 * The configured DSN, or ''.
 *
 * Reads `import.meta.env` (inlined by Vite, the real path in the browser) and
 * falls back to `process.env` for the Node/vitest process, where import.meta.env
 * is only populated from the shell at startup and cannot be toggled per test.
 * The `typeof process` guard keeps the fallback inert in the browser build.
 */
export function getDsn(): string {
    const fromMeta = (import.meta as { env?: Record<string, string | undefined> })?.env?.VITE_SENTRY_DSN;
    const fromProcess = typeof process !== 'undefined' ? process.env?.VITE_SENTRY_DSN : '';
    return String(fromMeta || fromProcess || '').trim();
}

export function isSentryEnabled(): boolean {
    return getDsn().length > 0;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const BEARER_RE = /\b(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const KEY_PREFIX_RE = /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{6,}/g;
const WEBHOOK_RE = /\bwhsec_[A-Za-z0-9]{6,}/g;
const RESEND_RE = /\bre_[A-Za-z0-9]{8,}/g;

/**
 * Redact customer emails and API secrets from a string before it leaves the
 * browser. Order ids, Stripe payment-intent ids and status codes are left
 * intact on purpose — they are what makes an incident triageable.
 */
export function scrubText(value: string): string {
    return value
        .replace(EMAIL_RE, '[email]')
        .replace(BEARER_RE, '$1[redacted]')
        .replace(KEY_PREFIX_RE, '$1_$2_[redacted]')
        .replace(WEBHOOK_RE, 'whsec_[redacted]')
        .replace(RESEND_RE, 're_[redacted]');
}

const SENSITIVE_KEY_RE = /token|secret|password|passphrase|authorization|cookie|card|cvc|api[_-]?key/i;

/** Recursively redact sensitive keys/values in an event payload. */
function scrubDeep(value: unknown, depth = 0): unknown {
    if (depth > 5) return '[truncated]';
    if (typeof value === 'string') return scrubText(value);
    if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = SENSITIVE_KEY_RE.test(k) ? '[redacted]' : scrubDeep(v, depth + 1);
        }
        return out;
    }
    return value;
}

/** Sentry `beforeSend`: last gate before an event leaves the browser. */
export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
    if (typeof event.message === 'string') event.message = scrubText(event.message);

    const values = event.exception?.values;
    if (values) {
        for (const v of values) {
            if (typeof v.value === 'string') v.value = scrubText(v.value);
        }
    }

    if (event.request) {
        if (typeof event.request.url === 'string') event.request.url = scrubText(event.request.url);
        if (event.request.data !== undefined) event.request.data = scrubDeep(event.request.data);
        // Never ship cookie jars or auth headers.
        delete event.request.cookies;
        const headers = event.request.headers;
        if (headers && typeof headers === 'object') {
            for (const key of Object.keys(headers)) {
                if (SENSITIVE_KEY_RE.test(key)) headers[key] = '[redacted]';
            }
        }
    }

    if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
            if (typeof b.message === 'string') b.message = scrubText(b.message);
            if (b.data !== undefined) b.data = scrubDeep(b.data) as Record<string, any>;
        }
    }

    if (event.extra) event.extra = scrubDeep(event.extra) as Record<string, any>;

    return event;
}

/**
 * Initialise the SDK. Returns false (without touching the network) when no DSN
 * is configured, which is the current production state until the operator
 * provisions a project.
 *
 * `dsnOverride` exists for tests; application code calls it with no argument.
 */
export function initSentry(dsnOverride?: string): boolean {
    if (initialized) return true;

    const dsn = (dsnOverride ?? getDsn()).trim();
    if (!dsn) return false;

    Sentry.init({
        dsn,
        environment: import.meta.env?.MODE,
        // No performance tracing: the latency that matters is Stripe/Supabase
        // round-trips, already visible in the Vercel function logs, and traces
        // would add bundle weight for no triage benefit.
        tracesSampleRate: 0,
        // Session replay is DELIBERATELY absent. The SDK silently drops
        // replaysSessionSampleRate when no replay integration is registered, so
        // if replay is ever wanted, replayIntegration() AND a matching sample
        // rate must be added together. Pinned by tests/sentryWiring.test.ts.
        integrations: [],
        beforeSend: scrubEvent,
    });

    initialized = true;
    return true;
}

/**
 * Report a React 19 root error. Tags are the contract the Sentry alert rule
 * filters on (`tags.source = react19-root-uncaught`).
 */
export function reportRootError(
    error: unknown,
    info: { componentStack?: string | null } | undefined,
    kind: RootErrorKind,
): void {
    if (!initialized) return;

    Sentry.captureException(error, {
        tags: { source: kind === 'uncaught' ? 'react19-root-uncaught' : 'react19-root-caught' },
        ...(info?.componentStack ? { contexts: { react: { componentStack: info.componentStack } } } : {}),
    });
}

/** Test-only: drop the initialised flag so a test can re-run the DSN gate. */
export function __resetSentryForTests(): void {
    initialized = false;
}
