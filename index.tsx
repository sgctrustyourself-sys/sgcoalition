import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { removePrerenderedArticle } from './utils/prerenderedArticle.mjs';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// ---------------------------------------------------------------------------
// The prerendered copy of this page's text.
//
// scripts/generateSeoArtifacts.mjs writes a post's article inside #root so a
// crawler or an AI reader gets the words without executing JavaScript (see
// postArticleHtml). This app renders that same post from the live table, so the
// static copy is dropped before mounting rather than left in the DOM as a second
// copy behind the app. It is removed here, not left to the root render: React
// owns only what it renders.
//
// The node's id lives in utils/prerenderedArticle.mjs, which the generator imports
// too — spelling it out here as well is how a rename on one side would ship the
// article twice with every check still green. On a route with no prerendered
// article this is a no-op.
// ---------------------------------------------------------------------------
removePrerenderedArticle();

// ---------------------------------------------------------------------------
// Error reporting (Sentry). OPTIONAL and lazy by design:
// `import.meta.env.VITE_SENTRY_DSN` is inlined by Vite at build time, so with no
// DSN configured Rollup drops this entire branch and @sentry/react never enters
// the bundle. The guard is pinned by tests/sentryWiring.test.ts — do not turn
// this into an unconditional static import.
//
// The import is kicked off before render so the SDK is ready if the first paint
// throws; anything that fails earlier is still caught by the out-of-React
// recovery path in index.html.
// ---------------------------------------------------------------------------
const sentryModule = import.meta.env.VITE_SENTRY_DSN
  ? import('./services/sentryInit').then((mod) => {
      mod.initSentry();
      return mod;
    })
  : Promise.resolve(null);

const reportRootError =
  (kind: 'uncaught' | 'caught') =>
  (error: unknown, info: { componentStack?: string | null }) => {
    void sentryModule.then((mod) => mod?.reportRootError(error, info, kind));
  };

// ---------------------------------------------------------------------------
// Lazy-chunk load failure recovery.
//
// A deploy can leave a visitor holding a stale entry bundle that tries to fetch
// a chunk that no longer exists (or exists at a different hash). The browser
// fires an `error` event on the failed <script type="module">, and any then()-
// rejection from a dynamic import surfaces as an `unhandledrejection`.
//
// This layer treats those as a *version-skew* event, not a render error:
// instead of surfacing the generic slow-boot recovery screen (which implies the
// site is down), it shows a transient "refreshing to load the latest version"
// overlay and reloads once. The existing 8s BOOT_TIMEOUT_MS recovery screen in
// index.html stays the backstop for a true boot failure.
//
// One-shot by design: the reload sets the armed flag to false on the next boot,
// so a second failure is a second chance, not a refresh loop. We do NOT retry
// chunk loads in place (React.lazy/Suspense retry is unreliable across a broken
// chunk graph and would strand Suspense fallbacks), and we do NOT auto-retry more
// than once (an infinite reload loop on a genuinely broken deploy is worse than a
// recovery screen the user can act on).
// ---------------------------------------------------------------------------
declare global {
    interface Window {
        /** Armed state for the one-shot skew reload; cleared on each boot so a
         * reload that still fails does not loop. */
        __coalitionSkewReloadArmed: boolean;
    }
}

const SKEW_RECOVERY_FLAG = '__coalitionSkewReloadArmed' as const;

function isModuleLoadError(event: Event): boolean {
    // Vite emits its dynamic-import failures on the window error channel with a
    // module-shaped filename. A failed <script type="module"> load also reaches
    // the window error event.
    const filename = 'filename' in event && typeof (event as Record<string, unknown>).filename === 'string'
        ? (event as { filename?: string }).filename
        : undefined;
    if (filename) {
        // Vite chunk URLs carry the hash in the path; any .js module from this
        // origin that fails to load is the skew signature we care about.
        if (
            filename.endsWith('.js') ||
            /\/assets\/[a-zA-Z0-9-]+\.js/i.test(filename)
        ) {
            return true;
        }
    }
    return false;
}

function showSkewRecovery(): void {
    const recovery =
        document.querySelector<HTMLElement>('[data-load-recovery]');
    if (!recovery) return;

    // Transient skew message replaces the generic slow-boot copy for this cycle.
    const card = recovery.querySelector<HTMLElement>('.recovery-card');
    if (card) {
        card.innerHTML = `
          <h1>Loading a newer version</h1>
          <p>The site updated while you were here. Refreshing once should fix it.</p>
          <div class="skew-spinner" aria-hidden="true"></div>
        `;
    }
    recovery.classList.add('visible');
}

function armSkewReload(): void {
    if (window.__coalitionSkewReloadArmed) return; // already reloading this cycle
    window.__coalitionSkewReloadArmed = true;
    showSkewRecovery();
    window.location.reload();
}

function installSkewRecovery(): void {
    window.addEventListener('error', (event: Event) => {
        // Only act on module-load failures. Render errors the ErrorBoundary
        // already handles must not redirect here.
        if (!isModuleLoadError(event)) return;
        if (event.defaultPrevented) return;
        event.preventDefault();
        // Defer so the browser has a chance to log its own console output.
        queueMicrotask(armSkewReload);
    }, true);

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        // A failed dynamic import (React.lazy chunk, etc.) surfaces as an
        // unhandled rejection with a module-shaped reason URL on some browsers.
        // Treat it as skew too, but only when the rejection is plausibly a module
        // load failure and the app has not already attached a handler for it.
        const reason = event.reason;
        if (reason && typeof reason === 'object') {
            const r = reason as Record<string, unknown>;
            const url =
                (r.url && typeof r.url === 'string' ? r.url : undefined) ||
                (r.message && typeof r.message === 'string' ? r.message : undefined);
            if (url && /\.js$/i.test(url)) {
                event.preventDefault();
                queueMicrotask(armSkewReload);
            }
        }
    }, true);
}

// Install after the root is created, so a chunk-load skew during first paint
// is caught by the same root cycle that already has the Sentry handlers wired.
// Also clear any stale armed flag from a previous cycle so a reload that still
// fails does not loop.
if (window.__coalitionSkewReloadArmed) {
    window.__coalitionSkewReloadArmed = false;
}
installSkewRecovery();

// React 19 root error handlers. `onCaughtError` only ever fires for errors a
// boundary caught (this app has no boundary yet — wiring it here is free and
// means adding one later needs no change in this file).
const root = ReactDOM.createRoot(rootElement, {
  onUncaughtError: reportRootError('uncaught'),
  onCaughtError: reportRootError('caught'),
});

const BootMarker: React.FC = () => {
  useEffect(() => {
    // This runs after React commits, unlike root.render() which only schedules
    // work. A render failure therefore leaves the outside-React recovery path
    // available instead of hiding it behind a blank screen.
    window.__coalitionBooted = true;
    document.querySelector('[data-load-recovery]')?.classList.remove('visible');
  }, []);

  // The boundary sits INSIDE BootMarker, not around it: if it wrapped this
  // component, a failed App render would stop the effect below from ever
  // running, and the index.html load-recovery overlay would then appear on top
  // of this screen with a second, more alarming failure UI.
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
};

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <BootMarker />
    </React.StrictMode>
  );
};

// Fade out the inline loader (defined in index.html) before mounting React,
// so the loader doesn't get instantly replaced and cause a visual flash.
const loader = document.getElementById('initial-loader');
if (loader) {
  // Guard so the transitionend listener and the safety-net timeout
  // can't both call renderApp().
  let mounted = false;
  const mount = () => {
    if (mounted) return;
    mounted = true;
    renderApp();
  };

  // Attach the listener BEFORE toggling opacity so we can't miss
  // the event if the browser ever starts transitions synchronously.
  loader.addEventListener('transitionend', mount, { once: true });

  // Kick off the CSS opacity transition defined on #initial-loader.
  loader.style.opacity = '0';

  // Safety net: if `transitionend` never fires (e.g. reduced-motion
  // preference, hot reload, or element already at opacity 0), still
  // mount. The 600ms must stay > the 0.5s CSS transition in index.html.
  setTimeout(mount, 600);
} else {
  renderApp();
}