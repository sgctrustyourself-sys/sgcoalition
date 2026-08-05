// components/admin/CustomerLinkModal.tsx
//
// Inline customer-profile preview that opens when an admin clicks a
// customer name from the OrderManager row or detail modal. Stacked at
// z-[60] above the existing OrderManager detail modal (z-50) so the order
// detail context is preserved when the admin closes this overlay.
//
// Smart-fallback data flow:
//   1. If userId is present AND not a MetaMask 'user_eth_*' prefix, try
//      buildCustomerProfile(userId). MetaMask wallets have no profiles row;
//      treating their synthetic stub as a real profile would silently mask
//      the email fallback that knows the right lifetime stats.
//   2. Otherwise (or when buildCustomerProfile returns null / rejects),
//      fall through to buildCustomerProfileByEmail(customerEmail).
//   3. Error state when neither path returns data.
//
// READ-ONLY: admin actions live in components/admin/CustomerProfileAdmin.tsx.
//
// Test contract:
//   - tests/customerLinkModalRender.test.tsx locks the loading | profile |
//     guest | MetaMask-fallback | error | close contract in isolation.
//   - tests/orderManagerRender.test.tsx mocks this component to a stub.

import React, { useEffect, useState } from 'react';
import {
    X, Loader2, User, Mail, ShieldCheck, CheckCircle2, AlertCircle,
    ShoppingBag, TrendingUp,
} from 'lucide-react';
import {
    buildCustomerProfile, buildCustomerProfileByEmail, CustomerProfile,
} from '../../utils/customerProfile';

type State = 'loading' | 'profile' | 'guest' | 'error';

interface CustomerLinkModalProps {
    userId?: string;
    customerEmail: string;
    customerName: string;
    orderId: string;
    onClose: () => void;
}

const fmtUsd = (n: number | string | null | undefined): string =>
    `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (iso: string | null | undefined): string =>
    iso ? new Date(iso).toLocaleDateString() : '—';

const CustomerLinkModal: React.FC<CustomerLinkModalProps> = ({
    userId, customerEmail, customerName, orderId, onClose,
}) => {
    const [state, setState] = useState<State>('loading');
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [guest, setGuest] = useState<{
        email: string;
        orderCount: number;
        totalSpend: number;
        firstOrderDate: string | null;
        lastOrderDate: string | null;
        isVerifiedBuyer: boolean;
    } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const resolve = async (): Promise<void> => {
            setState('loading');
            setErrorMsg(null);
            setProfile(null);
            setGuest(null);

            const userIdIsResolvable = !!userId && !userId.startsWith('user_eth_');

            if (userIdIsResolvable) {
                try {
                    const result = await buildCustomerProfile(userId);
                    if (cancelled) return;
                    if (result) {
                        setProfile(result);
                        setState('profile');
                        return;
                    }
                } catch (e: any) {
                    console.warn('[CustomerLinkModal] profile lookup failed:', e?.message);
                }
            }

            if (customerEmail) {
                try {
                    const result = await buildCustomerProfileByEmail(customerEmail);
                    if (cancelled) return;
                    setGuest(result);
                    setState('guest');
                    return;
                } catch (e: any) {
                    if (!cancelled) {
                        setErrorMsg(e?.message || 'Lookup failed');
                        setState('error');
                    }
                    return;
                }
            }

            if (!cancelled) {
                setErrorMsg('No profile or email available to resolve this customer.');
                setState('error');
            }
        };
        resolve();
        return () => { cancelled = true; };
    }, [userId, customerEmail]);

    return (
        <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
            role="dialog"
            aria-label={`Customer details for ${customerName}`}
            data-testid="customer-link-modal"
        >
            <div
                className="bg-gray-900 border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                data-state={state}
            >
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2">
                        <User className="w-5 h-5 text-brand-accent" />
                        {customerName}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition"
                        aria-label="Close customer modal"
                        data-testid="customer-link-modal-close"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-gray-500 uppercase tracking-widest font-bold">From Order</span>
                        <span className="font-mono text-white">{orderId.slice(0, 14)}…</span>
                        {customerEmail && (
                            <span className="flex items-center gap-1 text-gray-400 ml-auto">
                                <Mail className="w-3 h-3" />
                                {customerEmail}
                            </span>
                        )}
                    </div>

                    {state === 'loading' && (
                        <div className="flex items-center justify-center p-12 gap-2" data-state="loading">
                            <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Resolving customer…</span>
                        </div>
                    )}

                    {state === 'error' && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3" data-state="error">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                            <div>
                                <p className="text-sm font-black text-red-400 uppercase tracking-widest">Lookup failed</p>
                                <p className="text-xs text-red-300/70 mt-1">{errorMsg || 'Unknown error'}</p>
                            </div>
                        </div>
                    )}

                    {state === 'profile' && profile && (
                        <div className="space-y-6" data-state="profile">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">LTV</p>
                                    <p className="text-lg md:text-xl font-black text-brand-accent mt-0.5">{fmtUsd(profile.lifetimeSpendUsd)}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Orders</p>
                                    <p className="text-lg md:text-xl font-black text-white mt-0.5">{profile.lifetimeOrders}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Store Credit</p>
                                    <p className="text-lg md:text-xl font-black text-cyan-400 mt-0.5">{fmtUsd(profile.storeCredit)}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">SGCoin</p>
                                    <p className="text-lg md:text-xl font-black text-yellow-400 mt-0.5">{Number(profile.sgCoinBalance || 0).toLocaleString()} SGC</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">First Order</p>
                                    <p className="text-sm font-bold text-white mt-0.5">{fmtDate(profile.firstOrderDate)}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Last Order</p>
                                    <p className="text-sm font-bold text-white mt-0.5">{fmtDate(profile.lastOrderDate)}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {profile.isVIP && (
                                    <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded uppercase font-black tracking-widest flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" /> VIP
                                    </span>
                                )}
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase font-black tracking-widest flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Verified Profile
                                </span>
                                <span className="text-[10px] font-mono text-gray-500 truncate" title={profile.userId}>
                                    id: {profile.userId.slice(0, 12)}…
                                </span>
                            </div>
                            {profile.favoriteCategories && profile.favoriteCategories.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 mb-2">
                                        <ShoppingBag className="w-3 h-3" /> Top Products (top 5 by purchase count)
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.favoriteCategories.slice(0, 5).map((pid, idx) => (
                                            <span key={pid} className="text-xs font-mono text-white bg-black/30 border border-white/10 px-2 py-1 rounded">
                                                {idx + 1}. {pid}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="border-t border-white/10 pt-4">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3" /> Drill Into
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                                    For VIP toggles, store-credit adjusts, and notes editing, open the dedicated
                                    <span className="text-white font-black mx-1">Customer Profile</span>
                                    panel under <span className="font-mono text-white">/admin/customers</span> and search by
                                    <span className="font-mono text-white ml-1">{customerEmail || profile.userId}</span>.
                                </p>
                            </div>
                        </div>
                    )}

                    {state === 'guest' && guest && (
                        <div className="space-y-6" data-state="guest">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Orders</p>
                                    <p className="text-lg md:text-xl font-black text-white mt-0.5">{guest.orderCount}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Spend</p>
                                    <p className="text-lg md:text-xl font-black text-emerald-400 mt-0.5">{fmtUsd(guest.totalSpend)}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">First Order</p>
                                    <p className="text-sm font-bold text-white mt-0.5">{fmtDate(guest.firstOrderDate)}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Last Order</p>
                                    <p className="text-sm font-bold text-white mt-0.5">{fmtDate(guest.lastOrderDate)}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {guest.isVerifiedBuyer ? (
                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase font-black tracking-widest flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded uppercase font-black tracking-widest flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> No paid orders on file
                                    </span>
                                )}
                                <span className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 border border-white/10 rounded uppercase font-black tracking-widest flex items-center gap-1">
                                    <User className="w-3 h-3" /> Guest Lookup
                                </span>
                            </div>
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-300/80 leading-relaxed">
                                    No authenticated profile row — resolved by email only. Lifetime stats, socials, and VIP are unavailable until the buyer creates an account.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerLinkModal;
