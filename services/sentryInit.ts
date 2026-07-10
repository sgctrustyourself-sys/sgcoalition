// services/sentryInit.ts
//
// One-call Sentry.init wrapper for the browser bundle. The init
// is intentionally gated two ways:
//
// 1. import.meta.env.PROD: Vite sets this at build time. DEV and
//    PREVIEW builds never initialize, so:
//    - dev does not double-log (DevTools already shows the
//      error in the boundary fallback + onUncaughtError
//      console.error)
//    - preview deploys never burn Sentry quota on noise
//
// 2. VITE_SENTRY_DSN must be present and non-empty: silent no-op
//    if the env var is unset. The operator can deploy without a
//    DSN configured yet (no exceptions thrown at boot, no
//    warning spam in the console).
//
// Both Sentry.init AND the ErrorBoundary's captureException
// calls become no-ops in dev/preview/unconfigured.
// captureException is documented to return undefined when init
// did not run, so the call site does not need an initialized
// guard.
//
// Trace sample rate is 0.1 (ten percent) -- enough to surface
// regressions for low-volume commerce without exhausting
// small-tier Sentry quota. Bump upward in a follow-up if
// traffic grows.
//
// Locked by the readiness test in
// tests/securityInfrastructureReadiness.test.ts.

import * as Sentry from '@sentry/react';

const TRACES_SAMPLE_RATE = 0.1;
// Session replay is DEFERRED. To enable later, both (a) registering
// the replay integration in the integrations array below AND (b)
// a matching rate config field in this Sentry.init call are
// required -- the SDK silently drops the rate when no replay
// integration is registered, so leaving one without the other
// is a footgun. The current absence of both is intentional, not
// an oversight. The readiness test in
// tests/securityInfrastructureReadiness.test.ts makes the absence
// a regression-catch so a future developer cannot accidentally
// re-introduce just the rate without also wiring the integration.
// See the alert-rule note in .env.example for the matching
// Sentry dashboard setup that goes with the live wire-in.

// denyUrls runs BEFORE beforeSend and drops events whose stack
// frames reference any of these patterns. Browser extensions
// inject scripts into our pages that Sentry cannot trace back
// to user code; capturing them drowns the dashboard in noise.
const SENTRY_DENY_URL_PATTERNS: RegExp[] = [
    /chrome-extension:\/\//i,
    /extensions\//i,
    /moz-extension:\/\//i,
];

export function initSentry(): void {
    // Gate one: production only. import.meta.env.PROD evaluates
    // to false in DEV and PREVIEW builds. Vite dead-code
    // eliminates this whole branch from the shipped bundle, so
    // PREVIEW deploys ship zero Sentry JS -- which means zero
    // network egress to a Sentry ingest host. A preview deploy
    // cannot accidentally leak events.
    if (!import.meta.env.PROD) {
        return;
    }

    const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
    // Gate two: DSN must be present and non-empty. If unset the
    // operator has not provisioned Sentry yet -- silent no-op.
    // We deliberately do not warn here: in the boot path,
    // unconditional warnings would clutter every preview
    // deploy until the operator sets the var.
    if (!dsn || typeof dsn !== 'string' || dsn.trim() === '') {
        return;
    }

    try {
        Sentry.init({
            dsn,
            // production / preview / development shows up in the
            // Sentry dashboard so the operator can split real prod
            // traffic from preview noise.
            environment: import.meta.env.MODE,
            integrations: [
                // BrowserTracing captures page loads + navigations
                // as transactions. Combined with tracesSampleRate
                // equal to 0.1, a small-volume commerce site gets
                // roughly ten percent sample coverage which is
                // enough to surface regressions without burning
                // through Sentry quota.
                Sentry.browserTracingIntegration(),
            ],
            tracesSampleRate: TRACES_SAMPLE_RATE,
            // Drop browser-extension noise early in the pipeline.
            // denyUrls docs:
            // https://docs.sentry.io/platforms/javascript/configuration/options/#deny-urls
            denyUrls: SENTRY_DENY_URL_PATTERNS,
            // Run AFTER denyUrls. ResizeObserver loop limit
            // exceeded is a known browser quirk (it overflows on
            // benign resize cycles) and is not actionable; drop it
            // before the SDK ships it to the ingest server.
            beforeSend(event) {
                const message = event.exception?.values?.[0]?.value ?? '';
                if (message.includes('ResizeObserver loop')) {
                    return null;
                }
                return event;
            },
        });
    } catch (err) {
        // Sentry.init is an observability layer -- it must NEVER be
        // load-bearing for the React app. If init throws (bad DSN,
        // network failure during SDK handshake, a real SDK bug), we
        // log a warning and let React mount anyway. The
        // ErrorBoundary + React 19 root handlers will still call
        // Sentry.captureException, which is a documented no-op when
        // init didn't complete, so observability degrades gracefully
        // rather than the app going dark.
        // eslint-disable-next-line no-console
        console.warn('[sentryInit] Sentry.init failed; continuing without error tracking:', err);
    }
}
