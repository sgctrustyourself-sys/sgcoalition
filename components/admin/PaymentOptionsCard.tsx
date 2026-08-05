// components/admin/PaymentOptionsCard.tsx
//
// Live on/off switches for which payment options customers see at checkout.
// Reads GET /api/payment-settings, writes PATCH /api/payment-settings with
// the admin Bearer token (coalition_admin_token, the same session the
// admin-verify flow stores). Optimistic toggle with revert on failure — the
// change applies to the live checkout immediately, no redeploy.
//
// Endpoint contract (api/_handlers/payment-settings.ts):
//   GET  -> { card_enabled, paypal_enabled, klarna_enabled, crypto_enabled }
//   PATCH { <flag>_enabled: boolean } (admin) -> updated row

import React, { useEffect, useState, useCallback } from 'react';
import { CreditCard, Wallet, Loader, Landmark } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface PaymentFlags {
    card: boolean;
    paypal: boolean;
    klarna: boolean;
    crypto: boolean;
}

const DEFAULT_FLAGS: PaymentFlags = { card: true, paypal: true, klarna: true, crypto: true };

const ROWS: { key: keyof PaymentFlags; label: string; detail: string; icon: React.ReactNode; accent: string }[] = [
    {
        key: 'card',
        label: 'Card payments',
        detail: 'Visa, Mastercard, Amex via Stripe — the primary checkout path',
        icon: <CreditCard className="w-4 h-4" />,
        accent: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    },
    {
        key: 'paypal',
        label: 'PayPal',
        detail: 'PayPal wallet, Apple Pay, and Pay in 4',
        icon: <Wallet className="w-4 h-4" />,
        accent: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    },
    {
        key: 'klarna',
        label: 'Klarna',
        detail: 'Pay in 4 — behind “More payment options” at checkout',
        icon: <Landmark className="w-4 h-4" />,
        accent: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    },
    {
        key: 'crypto',
        label: 'Crypto (USDC)',
        detail: 'USDC on Polygon — behind “More payment options” at checkout',
        icon: <Wallet className="w-4 h-4" />,
        accent: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    },
];

function getAdminToken(): string | null {
    try {
        return sessionStorage.getItem('coalition_admin_token');
    } catch {
        return null;
    }
}

const PaymentOptionsCard: React.FC = () => {
    const { addToast } = useToast();
    const [flags, setFlags] = useState<PaymentFlags>(DEFAULT_FLAGS);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<keyof PaymentFlags | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/payment-settings', { method: 'GET' });
            const body = await response.json().catch(() => ({}));
            if (response.ok && typeof body.card_enabled === 'boolean') {
                setFlags({
                    card: !!body.card_enabled,
                    paypal: !!body.paypal_enabled,
                    klarna: !!body.klarna_enabled,
                    crypto: !!body.crypto_enabled,
                });
            }
            // On failure keep the current (default = all enabled) state — the
            // checkout does the same, so the card never shows a state the
            // live site doesn't match.
        } catch {
            // keep defaults
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const toggle = async (key: keyof PaymentFlags) => {
        const token = getAdminToken();
        if (!token) {
            addToast('Admin session expired — log in again to change payment options.', 'error');
            return;
        }

        const next = !flags[key];
        const flagName = `${key}_enabled`;

        // Optimistic flip — the toggle feels instant; revert on failure below.
        setFlags(prev => ({ ...prev, [key]: next }));
        setSavingKey(key);
        try {
            const response = await fetch('/api/payment-settings', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ [flagName]: next }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.error || 'Failed to save payment settings.');
            }
            // Apply the server's returned row so the card can't drift from
            // the truth when two admin sessions toggle concurrently.
            if (typeof body.card_enabled === 'boolean') {
                setFlags({
                    card: !!body.card_enabled,
                    paypal: !!body.paypal_enabled,
                    klarna: !!body.klarna_enabled,
                    crypto: !!body.crypto_enabled,
                });
            }
            addToast(
                next
                    ? `${ROWS.find(r => r.key === key)?.label} is now ON for customers.`
                    : `${ROWS.find(r => r.key === key)?.label} is now OFF for customers.`,
                'success',
            );
        } catch (error: any) {
            console.error('Payment settings save failed:', error);
            setFlags(prev => ({ ...prev, [key]: !next }));
            addToast(error?.message || 'Failed to save payment settings.', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div
            data-testid="payment-options-card"
            className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm hover:border-white/20 transition-all duration-300"
        >
            <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300">
                        <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">
                            Payment Options
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                            What customers see at checkout — live
                        </p>
                    </div>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Live
                </span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading payment options...
                </div>
            ) : (
                <div className="space-y-2">
                    {ROWS.map(row => (
                        <div
                            key={row.key}
                            data-testid={`payment-option-row-${row.key}`}
                            className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-black/20"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2 rounded-lg border flex-shrink-0 ${row.accent}`}>
                                    {row.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-white">{row.label}</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">{row.detail}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={flags[row.key]}
                                aria-label={`Toggle ${row.label}`}
                                data-testid={`payment-option-toggle-${row.key}`}
                                onClick={() => void toggle(row.key)}
                                disabled={savingKey === row.key}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-60 ${
                                    flags[row.key]
                                        ? 'bg-emerald-500/80'
                                        : 'bg-white/10'
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                                        flags[row.key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                                    }`}
                                />
                            </button>
                        </div>
                    ))}

                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest pt-1">
                        Changes apply to the live checkout immediately. Card + PayPal are the primary options;
                        Klarna and Crypto sit behind “More payment options”.
                    </p>
                </div>
            )}
        </div>
    );
};

export default PaymentOptionsCard;
