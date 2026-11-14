// components/admin/CspReportCard.tsx
//
// "CSP Violations" card for the Admin Command Center. Reads
// GET /api/admin-csp-reports (admin auth) and shows how many reports the browser
// sent in the last 24h / 7d / 30d, plus which directives fired.
//
// Before this card existed the reports went to a console.warn() nobody reads —
// which is the same as not collecting them. The number here is the whole point:
// a policy change that starts blocking a font or a third-party frame shows up as
// a spike, and a quiet month shows up as zero.
//
// Failure states are rendered, not thrown: no admin session, an endpoint outage,
// and "table not migrated yet" each have their own line, because the dashboard
// must not break when the collection pipeline needs an operator step.

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader, RefreshCw, ShieldAlert } from 'lucide-react';
import { getAdminToken } from '../../services/adminSession';

interface CspSummary {
    available: boolean;
    reason?: string;
    generatedAt?: string;
    windows?: { last24h: number; last7d: number; last30d: number };
    topDirectives?: Array<{ directive: string; count: number }>;
    recent?: Array<{ createdAt: string; documentUri: string; directive: string }>;
}

type State =
    | { phase: 'loading' }
    | { phase: 'no-session' }
    | { phase: 'unavailable'; reason: string }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; summary: CspSummary };

const formatCount = (value: number): string => value.toLocaleString();

const relativeTime = (iso: string): string => {
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return 'unknown';
    const minutes = Math.round((Date.now() - then) / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
};

const CspReportCard: React.FC = () => {
    const [state, setState] = useState<State>({ phase: 'loading' });

    const load = useCallback(async () => {
        const token = getAdminToken();
        if (!token) {
            setState({ phase: 'no-session' });
            return;
        }

        setState({ phase: 'loading' });
        try {
            const response = await fetch('/api/admin-csp-reports', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = (await response.json().catch(() => null)) as
                | (CspSummary & { error?: string })
                | null;

            if (!response.ok) {
                setState({
                    phase: 'error',
                    message: payload?.error || `Request failed (${response.status}).`,
                });
                return;
            }
            if (!payload) {
                setState({ phase: 'error', message: 'Empty response from /api/admin-csp-reports.' });
                return;
            }
            if (!payload.available) {
                setState({ phase: 'unavailable', reason: payload.reason || 'CSP reports are unavailable.' });
                return;
            }
            setState({ phase: 'ready', summary: payload });
        } catch (error) {
            setState({
                phase: 'error',
                message: error instanceof Error ? error.message : 'Could not reach /api/admin-csp-reports.',
            });
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const windows = state.phase === 'ready' ? state.summary.windows : undefined;
    const top = state.phase === 'ready' ? (state.summary.topDirectives || []) : [];
    const latest = state.phase === 'ready' ? (state.summary.recent || [])[0] : undefined;
    const last24h = windows?.last24h ?? 0;
    const tone = last24h > 0 ? 'text-amber-400' : 'text-emerald-400';

    return (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-brand-accent" />
                        CSP violations
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Reports browsers POSTed to <code className="text-gray-400">/api/csp-report</code>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition"
                    aria-label="Refresh CSP violation counts"
                >
                    {state.phase === 'loading'
                        ? <Loader className="w-4 h-4 animate-spin" />
                        : <RefreshCw className="w-4 h-4" />}
                </button>
            </div>

            {state.phase === 'loading' && (
                <p className="text-sm text-gray-500 mt-6">Loading violation counts…</p>
            )}

            {state.phase === 'no-session' && (
                <p className="text-sm text-gray-500 mt-6">Admin session required to read CSP reports.</p>
            )}

            {state.phase === 'unavailable' && (
                <div className="mt-6 flex items-start gap-2 text-sm text-amber-400">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{state.reason}</span>
                </div>
            )}

            {state.phase === 'error' && (
                <div className="mt-6 flex items-start gap-2 text-sm text-red-400">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{state.message}</span>
                </div>
            )}

            {state.phase === 'ready' && (
                <>
                    <div className="mt-6 flex items-end gap-6">
                        <div>
                            <div className={`text-4xl font-black tabular-nums ${tone}`}>
                                {formatCount(last24h)}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mt-1">
                                last 24h
                            </div>
                        </div>
                        <div className="pb-1 text-sm text-gray-400 space-y-1">
                            <div><span className="text-gray-500">7d</span> {formatCount(windows?.last7d ?? 0)}</div>
                            <div><span className="text-gray-500">30d</span> {formatCount(windows?.last30d ?? 0)}</div>
                        </div>
                    </div>

                    {top.length > 0 && (
                        <ul className="mt-5 space-y-1.5">
                            {top.slice(0, 3).map((entry) => (
                                <li key={entry.directive} className="flex items-center justify-between text-xs">
                                    <code className="text-gray-400 truncate mr-3">{entry.directive}</code>
                                    <span className="text-gray-500 tabular-nums">{formatCount(entry.count)}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {top.length === 0 && (
                        <p className="mt-5 text-xs text-emerald-400">No violations in the last 24 hours.</p>
                    )}

                    {latest && (
                        <p className="mt-4 text-[11px] text-gray-500 truncate">
                            Latest: <span className="text-gray-400">{latest.directive}</span>
                            {' on '}
                            <span className="text-gray-400">{latest.documentUri.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                            {` · ${relativeTime(latest.createdAt)}`}
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default CspReportCard;
