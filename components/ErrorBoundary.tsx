/**
 * Error boundary: renders a recoverable screen instead of a blank page when a
 * child throws during render.
 *
 * Reporting is deliberately NOT done in this file. index.tsx installs React
 * 19's root `onCaughtError`, which React calls for every error a boundary
 * catches, and forwards it to services/sentryInit.ts (tag `react19-root-caught`
 * — the tag the Sentry alert rule filters on). Routing it that way keeps
 * @sentry/react out of this module, so an unconfigured build still ships no
 * SDK. tests/errorBoundary.test.tsx pins both halves: the fallback renders AND
 * the root handler is invoked.
 *
 * Used twice in the app, each with a different job:
 *   - App.tsx wraps <Routes> with `resetKey={location.key}`, so a broken page
 *     leaves the nav and footer usable and navigating away clears the error.
 *   - index.tsx wraps <App/> inside BootMarker, so a failure in the shell
 *     itself (providers, navbar, widgets) still lands on this screen instead
 *     of unmounting the whole tree.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /**
     * Changing this clears a caught error. App passes the router location key,
     * so the boundary does not stay stuck showing a failure for a page the user
     * has already navigated away from.
     */
    resetKey?: string;
}

interface ErrorBoundaryState {
    error: Error | null;
}

const buttonBase =
    'px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border';

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(_error: Error, _info: ErrorInfo): void {
        // No reporting or logging here by design — see the file header. React's
        // root onCaughtError (index.tsx) owns reporting, and React itself logs
        // the component stack in development.
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps): void {
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    private readonly retry = (): void => {
        this.setState({ error: null });
    };

    render(): ReactNode {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div
                role="alert"
                className="min-h-[60vh] flex items-center justify-center px-6 py-20 font-sans text-white"
            >
                <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                    <h1 className="font-display text-2xl font-black uppercase tracking-tight">
                        This page hit an error
                    </h1>
                    <p className="mt-3 text-sm text-gray-400">
                        The rest of the site still works. Try again, or reload the page if it keeps happening.
                    </p>
                    {error.message && (
                        <p className="mt-4 font-mono text-[11px] break-words text-gray-500">{error.message}</p>
                    )}
                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={this.retry}
                            className={`${buttonBase} border-transparent bg-orange-500 text-black hover:bg-orange-400`}
                        >
                            Try again
                        </button>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className={`${buttonBase} border-white/15 bg-white/5 text-white hover:bg-white/10`}
                        >
                            Reload page
                        </button>
                        <a
                            href="/"
                            className={`${buttonBase} border-white/15 bg-white/5 text-white hover:bg-white/10`}
                        >
                            Back to home
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
