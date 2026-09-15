import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

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