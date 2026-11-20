/**
 * Sentry lifecycle: DSN gate, init, and React 19 root error reporting.
 *
 * Two companion pieces live elsewhere on purpose:
 *   - services/sentryRedact.ts — the pure privacy boundary (what leaves the
 *     browser). No SDK state, so it can be read and tested alone.
 *   - index.tsx — the only call site. It imports this module LAZILY behind
 *     `import.meta.env.VITE_SENTRY_DSN`, which Vite inlines, so an
 *     unconfigured build never emits @sentry/react at all.
 *
 * Everything here is a silent no-op until initSentry() succeeds, so the root
 * handlers in index.tsx need no further guarding.
 *
 * OPERATOR RUNBOOK (also in FOLLOWUPS.md #1):
 *   1. Create a Sentry project (platform "JavaScript / React").
 *   2. Set VITE_SENTRY_DSN in Vercel for Production.
 *   3. Redeploy with Build Cache OFF (it is a `[build]` var).
 *   4. Add ONE alert rule filtered on `tags.source = react19-root-uncaught`, so
 *      the default "any error-level event" rule does not page on-call for
 *      errors the user already saw handled.
 */

import * as Sentry from '@sentry/react';
import { scrubEvent } from './sentryRedact.js';

export type RootErrorKind = 'uncaught' | 'caught';

let initialized = false;

/** The configured DSN, or ''. Inlined by Vite at build time. */
export function getDsn(): string {
    const fromMeta = (import.meta as { env?: Record<string, string | undefined> })?.env?.VITE_SENTRY_DSN;
    return String(fromMeta || '').trim();
}

export function isSentryEnabled(): boolean {
    return getDsn().length > 0;
}

/**
 * Initialise the SDK. Returns false (without touching the network) when no DSN
 * is configured — the state production is in until the operator provisions a
 * project.
 *
 * `dsnOverride` is the test seam: passing a DSN explicitly exercises the
 * configured path without depending on ambient env, which is why this module
 * does not need to sniff process.env as well.
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
 * Report a React 19 root error. The tags are the contract the Sentry alert rule
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
