// components/admin/PaymentStatusCard.tsx
//
// Payment-processing health card for the admin Command Center. Polls the
// serverless /api/health probe (added as a watchdog after an expired Stripe
// key silently took down card/Klarna/Afterpay checkout) and renders the
// Stripe key status + the payment methods customers can ACTUALLY use at a
// glance — the checkout allow-list (checkoutMethods), not every method
// enabled in the Stripe dashboard (paymentMethods).
//
// The endpoint contract (api/_handlers/health.ts):
//   200 { status: 'ok', checkoutWorking: true, stripe: { configured, keyValid,
//        paymentMethods: string[], checkoutMethods: string[],
//        checkoutMethodsMissing: string[], error } }
//   503 { status: 'degraded', checkoutWorking: false, stripe: { ... , error } }

import React, { useEffect, useState, useCallback } from 'react';
import { CreditCard, RefreshCw, CheckCircle2, AlertTriangle, WifiOff, Loader } from 'lucide-react';

type HealthState =
    | { phase: 'loading' }
    | {
        phase: 'ok';
        checkoutWorking: boolean;
        keyValid: boolean;
        paymentMethods: string[];
        checkoutMethods: string[];
        checkoutMethodsMissing: string[];
    }
    | {
        phase: 'degraded';
        checkoutWorking: boolean;
        keyValid: boolean;
        error: string;
        paymentMethods: string[];
        checkoutMethods: string[];
        checkoutMethodsMissing: string[];
    }
    | { phase: 'unreachable' };

const POLL_MS = 60_000;

const METHOD_LABELS: Record<string, string> = {
    card: 'Card',
    klarna: 'Klarna',
    afterpay_clearpay: 'Afterpay',
    link: 'Link',
    cashapp: 'Cash App',
    amazon_pay: 'Amazon Pay',
    us_bank_account: 'ACH / Bank',
    affirm: 'Affirm',
    grabpay: 'GrabPay',
};

const METHOD_CHIP_STYLES: Record<string, string> = {
    card: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    klarna: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    afterpay_clearpay: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    link: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    cashapp: 'border-green-500/30 bg-green-500/10 text-green-400',
    amazon_pay: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    us_bank_account: 'border-gray-500/30 bg-gray-500/10 text-gray-300',
    affirm: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
    grabpay: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
};

async function fetchHealth(): Promise<HealthState> {
    try {
        const response = await fetch('/api/health', { method: 'GET' });
        const body = await response.json().catch(() => ({}));
        const stripe = body.stripe || {};
        const paymentMethods: string[] = Array.isArray(stripe.paymentMethods)
            ? stripe.paymentMethods
            : [];
        // What checkout actually offers (server-owned allow-list). Falls back
        // to the dashboard list if the probe didn't report it.
        const checkoutMethods: string[] = Array.isArray(stripe.checkoutMethods)
            ? stripe.checkoutMethods
            : paymentMethods;
        const checkoutMethodsMissing: string[] = Array.isArray(stripe.checkoutMethodsMissing)
            ? stripe.checkoutMethodsMissing
            : [];

        if (response.ok && body.status === 'ok') {
            return {
                phase: 'ok',
                checkoutWorking: body.checkoutWorking !== false,
                keyValid: stripe.keyValid !== false,
                paymentMethods,
                checkoutMethods,
                checkoutMethodsMissing,
            };
        }
        if (response.status === 503 || body.status === 'degraded') {
            return {
                phase: 'degraded',
                checkoutWorking: body.checkoutWorking === true,
                keyValid: stripe.keyValid === true,
                error: String(stripe.error || 'Payment processing is unavailable.'),
                paymentMethods,
                checkoutMethods,
                checkoutMethodsMissing,
            };
        }
        // A 5xx from the probe itself is a server-side failure — degraded,
        // not a client/network problem.
        if (response.status >= 500) {
            return {
                phase: 'degraded',
                checkoutWorking: false,
                keyValid: false,
                error: `Health probe failed (HTTP ${response.status}).`,
                paymentMethods,
                checkoutMethods,
                checkoutMethodsMissing,
            };
        }
        return { phase: 'unreachable' };
    } catch {
        return { phase: 'unreachable' };
    }
}

const PaymentStatusCard: React.FC = () => {
    const [health, setHealth] = useState<HealthState>({ phase: 'loading' });
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const refresh = useCallback(async () => {
        setHealth(await fetchHealth());
        setLastChecked(new Date());
    }, []);

    useEffect(() => {
        void refresh();
        const interval = window.setInterval(() => { void refresh(); }, POLL_MS);
        return () => window.clearInterval(interval);
    }, [refresh]);

    const degraded = health.phase === 'degraded';
    const unreachable = health.phase === 'unreachable';

    return (
        <div
            data-testid="payment-status-card"
            className={`bg-white/5 border rounded-3xl p-6 backdrop-blur-sm transition-all duration-300 ${
                degraded
                    ? 'border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.08)]'
                    : unreachable
                        ? 'border-amber-500/40'
                        : 'border-white/10 hover:border-white/20'
            }`}
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                        degraded
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : unreachable
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                        {degraded ? <AlertTriangle className="w-5 h-5" /> : unreachable ? <WifiOff className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Payment Processing</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                            Stripe · Card, Klarna & Afterpay
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {lastChecked && (
                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                            Checked {Math.max(0, Math.round((Date.now() - lastChecked.getTime()) / 1000))}s ago
                        </span>
                    )}
                    <button
                        type="button"
                        data-testid="payment-status-refresh"
                        aria-label="Refresh payment status"
                        onClick={() => void refresh()}
                        title="Refresh payment status"
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${health.phase === 'loading' ? 'animate-spin' : ''}`} />
                    </button>
                    <span
                        data-testid="payment-status-badge"
                        className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                            degraded
                                ? 'text-red-400 bg-red-500/10 border-red-500/30'
                                : unreachable
                                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                                    : health.phase === 'loading'
                                        ? 'text-gray-400 bg-white/5 border-white/10'
                                        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        }`}
                    >
                        {health.phase === 'loading' ? (
                            <>
                                <Loader className="w-3 h-3 animate-spin" /> Checking
                            </>
                        ) : degraded ? (
                            'Degraded'
                        ) : unreachable ? (
                            'Unreachable'
                        ) : (
                            <>
                                <CheckCircle2 className="w-3 h-3" /> Healthy
                            </>
                        )}
                    </span>
                </div>
            </div>

            {degraded && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">
                        Checkout at risk — action required
                    </p>
                    <p className="text-xs text-red-300/90 leading-relaxed">{health.error}</p>
                    <p className="text-[10px] text-red-400/70 mt-2 leading-relaxed">
                        Card, Klarna, and Afterpay payments will fail for customers until the Stripe key is
                        renewed in the Vercel dashboard. PayPal checkout is unaffected.
                    </p>
                </div>
            )}

            {unreachable && (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <p className="text-xs text-amber-300/90 leading-relaxed">
                        The health probe could not be reached. Check the network or the /api/health endpoint.
                    </p>
                </div>
            )}

            {health.phase !== 'loading' && !unreachable && (
                <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {health.checkoutMethods.length > 0 ? (
                            health.checkoutMethods.map((method) => (
                                <span
                                    key={method}
                                    data-testid={`method-chip-${method}`}
                                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${METHOD_CHIP_STYLES[method] || 'border-white/10 bg-white/5 text-gray-300'}`}
                                >
                                    {METHOD_LABELS[method] || method}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                {degraded ? 'Payment methods unavailable' : 'No payment methods reported'}
                            </span>
                        )}
                        {health.phase === 'ok' && health.keyValid && (
                            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
                                Stripe key valid
                            </span>
                        )}
                    </div>

                    {/* Methods the dashboard has enabled but checkout intentionally hides. */}
                    {health.paymentMethods.length > health.checkoutMethods.length && (
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                            Hidden from checkout:{' '}
                            {health.paymentMethods
                                .filter((method) => !health.checkoutMethods.includes(method))
                                .map((method) => METHOD_LABELS[method] || method)
                                .join(', ')}
                        </p>
                    )}

                    {/* A configured checkout method that the account has disabled —
                        the code-before-dashboard footgun. The PaymentIntent fails
                        entirely (card included) until it is enabled. */}
                    {health.checkoutMethodsMissing.length > 0 && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">
                                Checkout outage risk —{' '}
                                {health.checkoutMethodsMissing
                                    .map((method) => METHOD_LABELS[method] || method)
                                    .join(', ')}{' '}
                                configured but disabled in Stripe
                            </p>
                            <p className="text-[10px] text-red-400/70 mt-1 leading-relaxed">
                                Card payments will fail until it is enabled in the Stripe dashboard
                                (Settings → Payment methods).
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PaymentStatusCard;
