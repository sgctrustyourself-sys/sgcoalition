import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { initSentry } from './services/sentryInit';

// Initialize Sentry at module-load so module-load errors that
// happen before React mounts (e.g. an unexpected require()
// throw, a syntactically broken module evaluation) are still
// captured. The function is a no-op in DEV, PREVIEW, and any
// environment where VITE_SENTRY_DSN is unset (see
// services/sentryInit.ts for the gate details).
initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// React 19 introduced root-level error options on createRoot.
// These catch errors that escape every mounted ErrorBoundary:
//   - onUncaughtError: errors thrown in event handlers,
//     Suspense fallbacks without a boundary above them, and
//     any other path that the React tree cannot catch.
//   - onCaughtError: errors that an ErrorBoundary ALREADY
//     caught. We forward them under a different tag so the
//     Sentry dashboard can filter "shown the recovery UI"
//     from "escaped the boundary".
// Both mirror the boundary's capture so a Sentry-listed site
// surfaces every unhandled error, not just the boundary's.
const root = ReactDOM.createRoot(rootElement, {
    onUncaughtError: (error, errorInfo) => {
        // Forward to Sentry (no-op if init did not run -- which
        // includes every DEV + PREVIEW build).
        Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack ?? null },
            tags: { source: 'react19-root-uncaught' },
            level: 'error',
        });
        // Local backup: the Vercel runtime log and browser
        // DevTools still see the error, so observability does
        // not depend solely on Sentry.
        // eslint-disable-next-line no-console
        console.error('[react19:onUncaughtError]', error, errorInfo);
    },
    onCaughtError: (error, errorInfo) => {
        Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack ?? null },
            tags: { source: 'react19-root-caught' },
            // Both React 19 root handlers report at level 'error'.
            // The source tag above (react19-root-uncaught vs
            // react19-root-caught) does the caught/uncaught
            // differentiation in the Sentry dashboard; downgrading
            // caught to 'warning' would mask the signal from
            // paging rules that fire on any error-level event.
            level: 'error',
        });
    },
});
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);