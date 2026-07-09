// components/ErrorBoundary.tsx
//
// Global React error boundary. Wraps the entire <App> tree so any
// unhandled render error renders a recovery UI instead of
// white-screening the whole site. Without this, a single bad
// component (e.g. a malformed product prop, a missing translation
// key) kills the entire SPA -- the user sees a blank page and the
// founder finds out from a customer, not a Sentry alert.
//
// Class component (no hooks allowed in error boundaries -- the
// React docs explicitly call this out). componentDidCatch logs the
// error and would forward to Sentry.captureException once Sentry is
// installed (TODO). getDerivedStateFromError flips the state so the
// render() method shows the fallback instead of the children.
//
// Reset semantics: a parent can pass a `resetKey` prop (string |
// number) and componentDidUpdate will flip hasError back to false
// when the value changes. This lets the parent (e.g.
// ErrorBoundaryWithNavReset in App.tsx) use the current location
// pathname as the key, so navigating to a new route after a render
// error drops the recovery UI -- WITHOUT remounting the children.
// Remounting the children would reset local state in CartDrawer,
// AIChatWidget, and any in-flight forms, which is a real UX
// regression. componentDidUpdate is the correct reset hook because
// it runs after render but before the browser paints, so the user
// never sees the stale fallback.
//
// Fallback UI: a centered card with a "Reload Page" button
// (window.location.reload -- hard refresh to clear any stale state)
// and a "Go Home" link (plain <a href="/"> -- a class component
// can't use react-router's useNavigate, and using the navigate
// hook would require extracting a functional child wrapper, which
// is overkill for this fallback). The intent is to unblock the
// user with one click in 90% of cases.
//
// Locked by tests/securityInfrastructureReadiness.test.ts.

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /**
     * When this prop changes, the boundary resets its error state
     * and re-renders its children. Typical usage: pass
     * `location.pathname` from a `useLocation()` parent so route
     * changes drop the recovery UI.
     */
    resetKey?: string | number;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = { hasError: false };

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // Synchronously flip state so the next render shows the
        // fallback UI. Called during the render phase so side
        // effects (like logging) are NOT allowed here.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Side effects allowed here.
        //
        // Sentry.captureException is a documented no-op when
        // init did not run, which means we can call it
        // unconditionally: DEV, PREVIEW, and any environment
        // where VITE_SENTRY_DSN is unset will simply skip the
        // network call.
        //
        // We pass context in the second argument (extra / tags /
        // level) instead of using Sentry.withScope. The older
        // withScope pattern mutates shared global scope state
        // -- which under React 19's concurrent rendering races
        // with the next componentDidCatch fired in the same
        // commit. The capture-context form scopes the metadata
        // to this single event and never mutates global state.
        //
        // Labels in the Sentry dashboard: errorBoundary: 'global'
        // lets us filter this specific boundary; level: 'error'
        // so the alert rules treat it as page-impacting.
        Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack ?? null },
            tags: { errorBoundary: 'global' },
            level: 'error',
        });
        // Local backup: Vercel runtime logs AND browser
        // DevTools still see the error, so observability does
        // not depend solely on Sentry being healthy
        // (e.g. if a downstream ad-blocker or network policy
        // strips the SDK's POST to ingest.sentry.io).
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo);
    }

    public componentDidUpdate(prevProps: ErrorBoundaryProps): void {
        // Reset the error state when the parent bumps resetKey.
        // We compare against the previous prop, NOT the current
        // state, because the parent re-renders this boundary with
        // the new key on every navigation -- the prop change is
        // the source of truth. setState inside componentDidUpdate
        // is supported and triggers an extra render before the
        // browser paints, so the user never sees the stale
        // fallback.
        if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
            // eslint-disable-next-line no-console
            console.info('[ErrorBoundary] resetKey changed; clearing error state');
            this.setState({ hasError: false, error: undefined });
        }
    }

    public render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white font-sans text-center"
                >
                    <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">
                            Something went wrong
                        </h1>
                        <p className="text-zinc-400 mb-8">
                            We&apos;ve encountered an unexpected error. Reloading usually fixes it.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
                            >
                                Reload Page
                            </button>
                            <a
                                href="/"
                                className="w-full bg-zinc-800 text-white py-3 rounded-lg font-medium hover:bg-zinc-700 transition-colors inline-block"
                            >
                                Go Home
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
