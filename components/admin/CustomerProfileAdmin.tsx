// components/admin/CustomerProfileAdmin.tsx
//
// Admin Customer Profile Manager — single-customer detail view that
// surfaces the enriched CustomerProfile built by utils/customerProfile.
//
// Features:
//   • Search by user UUID, email, or MetaMask user_eth_* address.
//   • Auto-detects mode (userId vs guest email).
//   • Uses buildCustomerProfile(userId) + buildCustomerProfileByEmail(email).
//   • Renders lifetime stats, recent orders, referral stats, social
//     accounts, and editable customer notes.
//   • Admin actions: toggle VIP, credit/debit store credit, save notes.
//   • Recent searches persisted to localStorage for quick re-lookup.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    UserCircle2, Search, Loader2, Shield, ShieldCheck, Wallet,
    Mail, Calendar, Coins, CreditCard, TrendingUp, Receipt, Users as UsersIcon,
    Instagram, Facebook, Twitter, Globe, MessageSquare,
    Pencil, Save, X, Plus, Minus, RefreshCw, History, Tag, ShoppingBag,
    Sparkles, CheckCircle2, AlertCircle, Hash, ArrowUpRight,
} from 'lucide-react';
// bring in PayoutRequest type from services so the centralised payoutLastStatusDisplay
// helper below (and any future status-mapping DRY) has a single source of truth.
import type { PayoutRequest } from '../../services/payoutRequest';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';
import { buildCustomerProfile, buildCustomerProfileByEmail, CustomerProfile } from '../../utils/customerProfile';

interface RecentSearch { query: string; mode: 'userId' | 'email'; timestamp: number; }
interface OrderRow { id: string; total: number | string; created_at: string; payment_status: string; items: any[]; }

const RECENT_KEY = 'sgc_admin_recent_customer_searches';
const MAX_RECENT = 8;

// Tries to classify a raw search string into either a userId lookup
// or an email lookup. MetaMask user IDs start with 'user_eth_'.
// UUIDs have 36 chars with hyphens. Anything else is treated as email.
const classifyQuery = (raw: string): { mode: 'userId' | 'email'; value: string } => {
    const q = raw.trim().toLowerCase();
    if (!q) return { mode: 'userId', value: '' };
    if (q.startsWith('user_eth_')) return { mode: 'userId', value: q };
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) return { mode: 'userId', value: q };
    if (/^[0-9a-f]{32,40}$/i.test(q) || /^0x[0-9a-f]{40}$/i.test(q)) return { mode: 'userId', value: q };
    if (q.includes('@')) return { mode: 'email', value: q };
    return { mode: 'userId', value: q };
};

const formatCurrency = (v: number | string | null | undefined) => { const n = Number(v || 0); return `$${n.toFixed(2)}`; };
const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return '—'; }
};

const initialsFromString = (str: string) => {
    if (!str) return '??';
    const trimmed = str.trim();
    if (trimmed.startsWith('Wallet')) return '⬢';
    if (trimmed.startsWith('0x')) return '⬡';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return trimmed.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const SOCIAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    instagram: Instagram, facebook: Facebook, twitter: Twitter, x: Twitter,
    tiktok: MessageSquare, globe: Globe, world: Globe,
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const s = (status || 'unknown').toLowerCase();
    let classes = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    if (['paid', 'completed', 'shipped', 'delivered'].includes(s)) classes = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    else if (s === 'pending') classes = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    else if (['failed', 'cancelled', 'canceled', 'refunded'].includes(s)) classes = 'bg-red-500/10 text-red-400 border-red-500/20';
    return (
        <span className={`text-[9px] px-2 py-1 rounded uppercase font-black tracking-widest border ${classes}`}>
            {s}
        </span>
    );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: string; disabled?: boolean; }> = ({ icon, label, value, accent = 'text-white', disabled }) => (
    <div className={`bg-white/5 border border-white/10 rounded-2xl p-4 ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-500">{icon}</span>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</p>
        </div>
        <p className={`text-xl md:text-2xl font-black truncate ${accent}`} title={value}>{value}</p>
    </div>
);

const MiniStat: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent = 'text-white' }) => (
    <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</p>
        <p className={`text-base font-black mt-0.5 ${accent}`}>{value}</p>
    </div>
);

// Centralised mapper for the "Last Status" MiniStat. Returns BOTH the
// uppercase label AND the Tailwind accent so the value and color can't
// drift out of sync (e.g. showing "REJECTED" in emerald by mistake).
// Locked contract — easy to unit-test in isolation. SEC-DEFINER call sites
// (approve / complete / reject) consume the SAME status union as the
// services/payoutRequest RPC envelopes, no duplicative string literals.
const payoutLastStatusDisplay = (
    status: PayoutRequest['status'] | null,
): { value: string; accent: string } => {
    if (status === 'completed') return { value: 'COMPLETED', accent: 'text-emerald-400' };
    if (status === 'rejected') return { value: 'REJECTED', accent: 'text-red-400' };
    if (status === 'pending') return { value: 'PENDING', accent: 'text-yellow-400' };
    if (status === 'approved') return { value: 'APPROVED', accent: 'text-blue-400' };
    return { value: 'NONE', accent: 'text-white' };
};

const GuestDetail: React.FC<{ data: { email: string; orderCount: number; totalSpend: number; firstOrderDate: string | null; lastOrderDate: string | null; isVerifiedBuyer: boolean } }> = ({ data }) => {
    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8">
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-2xl font-black text-white shrink-0">✉</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight break-all">{data.email || 'Guest Buyer'}</h2>
                            {data.isVerifiedBuyer && (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase font-black tracking-widest flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Guest lookup — no authenticated profile row required</p>
                    </div>
                </div>
                {!data.isVerifiedBuyer && (
                    <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-300/80 leading-relaxed">No paid orders found for this email. Customer may have abandoned checkout or used a different address.</p>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<ShoppingBag className="w-4 h-4" />} label="Order Count" value={String(data.orderCount)} accent="text-white" />
                <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Spend" value={formatCurrency(data.totalSpend)} accent="text-emerald-400" />
                <StatCard icon={<Calendar className="w-4 h-4" />} label="First Order" value={formatDate(data.firstOrderDate)} />
                <StatCard icon={<Calendar className="w-4 h-4" />} label="Last Order" value={formatDate(data.lastOrderDate)} />
            </div>
        </div>
    );
};

interface ProfileDetailProps {
    profile: CustomerProfile | null;
    orders: OrderRow[];
    onRefresh: () => void;
    onSaveNotes: (notes: string) => Promise<void>;
    onToggleVIP: () => Promise<void>;
    onCreditDelta: (delta: number) => Promise<void>;
    onClear: () => void;
    onNavigatePayouts?: () => void;
}

const ProfileDetail: React.FC<ProfileDetailProps> = ({
    profile, orders, onRefresh, onSaveNotes, onToggleVIP, onCreditDelta, onClear, onNavigatePayouts,
}) => {
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesDraft, setNotesDraft] = useState(profile?.customerNotes || '');
    const [creditDelta, setCreditDelta] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setNotesDraft(profile?.customerNotes || '');
        setEditingNotes(false);
    }, [profile?.userId, profile?.customerNotes]);

    if (!profile) return null;

    const isMetaMask = profile.userId.startsWith('user_eth_');
    const hasFullProfile = !isMetaMask && (profile.isVIP || profile.storeCredit > 0 || profile.sgCoinBalance > 0 || profile.lifetimeOrders > 0);
    const referralEarnings = profile.referralStats?.totalEarnings || 0;

    const handleSaveNotes = async () => {
        if (isMetaMask) return;
        setBusy(true);
        try { await onSaveNotes(notesDraft); setEditingNotes(false); }
        finally { setBusy(false); }
    };

    const handleCredit = async (sign: number) => {
        if (isMetaMask) return;
        const amt = parseFloat(creditDelta);
        if (!amt || amt <= 0) return;
        setBusy(true);
        try { await onCreditDelta(sign * amt); setCreditDelta(''); }
        finally { setBusy(false); }
    };

    const SocialIconFor = (platform: string): React.ComponentType<{ className?: string }> => {
        return SOCIAL_ICON[platform?.toLowerCase()] || Globe;
    };

    return (
        <div className="space-y-6">
            {/* Header card */}
            <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-2xl font-black text-white shrink-0">
                            {initialsFromString(profile.displayName)}
                            {profile.isVIP && (
                                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center border-2 border-black">
                                    <Shield className="w-3 h-3 text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tight break-all">{profile.displayName}</h2>
                                {profile.isVIP && <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded uppercase font-black tracking-widest">VIP</span>}
                                {isMetaMask && <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded uppercase font-black tracking-widest flex items-center gap-1"><Wallet className="w-3 h-3" /> Web3 Wallet</span>}
                                {hasFullProfile && <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase font-black tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</span>}
                            </div>
                            <p className="text-[10px] font-mono text-gray-500 break-all flex items-center gap-2"><Hash className="w-3 h-3" />{profile.userId}</p>
                            {profile.walletAddress && <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 font-mono"><Wallet className="w-3 h-3" />{profile.walletAddress}</p>}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={onRefresh} className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:border-white/30 transition-all text-[10px] font-black uppercase tracking-widest" title="Refresh profile"><RefreshCw className="w-3 h-3" /> Refresh</button>
                        {onNavigatePayouts && (
                            <button onClick={onNavigatePayouts} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-emerald-400 hover:text-white hover:bg-emerald-500/30 hover:border-emerald-500/30 transition-all text-[10px] font-black uppercase tracking-widest" title="View this customer's payout history in the SG Coin Payouts admin tab"><Wallet className="w-3 h-3" /> View Payouts <ArrowUpRight className="w-3 h-3" /></button>
                        )}
                        <button onClick={onClear} className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-gray-300 hover:text-red-400 hover:border-red-500/30 transition-all text-[10px] font-black uppercase tracking-widest" title="Close profile"><X className="w-3 h-3" /> Close</button>
                    </div>
                </div>
                {isMetaMask && (
                    <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-300/80 leading-relaxed">MetaMask wallet user — no authenticated profile row found. Lifetime stats, VIP status, store credit, and socials are unavailable until this wallet signs up with email. Showing on-chain wallet data only.</p>
                    </div>
                )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Lifetime Spend" value={formatCurrency(profile.lifetimeSpendUsd)} accent="text-brand-accent" disabled={isMetaMask} />
                <StatCard icon={<Receipt className="w-4 h-4" />} label="Lifetime Orders" value={String(profile.lifetimeOrders)} accent="text-white" disabled={isMetaMask} />
                <StatCard icon={<ShoppingBag className="w-4 h-4" />} label="Total Spend (Calc)" value={formatCurrency(profile.totalSpend)} accent="text-emerald-400" />
                <StatCard icon={<Hash className="w-4 h-4" />} label="Order Count" value={String(profile.orderCount)} accent="text-white" />
                <StatCard icon={<CreditCard className="w-4 h-4" />} label="Store Credit" value={formatCurrency(profile.storeCredit)} accent="text-cyan-400" disabled={isMetaMask} />
                <StatCard icon={<Coins className="w-4 h-4" />} label="SGCoin Balance" value={`${profile.sgCoinBalance.toLocaleString()} SGC`} accent="text-yellow-400" disabled={isMetaMask} />
                <StatCard icon={<Calendar className="w-4 h-4" />} label="First Order" value={formatDate(profile.firstOrderDate)} />
                <StatCard icon={<Calendar className="w-4 h-4" />} label="Last Order" value={formatDate(profile.lastOrderDate)} />
            </div>

            {/* Recent orders */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-brand-accent" />Recent Orders ({orders.length})</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest font-bold">Most recent first · all payment statuses</p>
                    </div>
                </div>
                {orders.length === 0 ? (
                    <div className="p-12 text-center">
                        <Receipt className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No orders found for this customer</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/5">
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Order ID</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Date</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Items</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Total</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Status</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500 text-right">View</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {orders.slice(0, 20).map((o) => (
                                    <tr key={o.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] font-mono text-white break-all" title={o.id}>
                                                {o.id.length > 14 ? `${o.id.slice(0, 8)}\…${o.id.slice(-4)}` : o.id}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3"><span className="text-[10px] text-gray-400 font-bold">{formatDate(o.created_at)}</span></td>
                                        <td className="px-4 py-3"><span className="text-[10px] text-gray-400 font-bold">{Array.isArray(o.items) ? o.items.length : 0} items</span></td>
                                        <td className="px-4 py-3"><span className="text-xs font-black text-white">{formatCurrency(o.total)}</span></td>
                                        <td className="px-4 py-3"><StatusBadge status={o.payment_status} /></td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest font-bold" title={'Order: ' + o.id}>
                                                {o.id.slice(-6)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {orders.length > 20 && (
                            <div className="p-3 text-center text-[10px] text-gray-600 uppercase tracking-widest font-bold border-t border-white/5">
                                Showing 20 of {orders.length} orders
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Referral + Socials row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <UsersIcon className="w-4 h-4 text-emerald-400" /> Referral Program
                        </h3>
                        {profile.referralCode && (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded uppercase tracking-widest">
                                {profile.referralCode}
                            </span>
                        )}
                    </div>
                    {!profile.referralStats ? (
                        <div className="p-6 text-center">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Not enrolled in referral program</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <MiniStat label="Total Referrals" value={String(profile.referralStats.totalReferrals)} accent="text-white" />
                            <MiniStat label="Successful" value={String(profile.referralStats.successfulReferrals)} accent="text-emerald-400" />
                            <MiniStat label="Earnings" value={formatCurrency(referralEarnings)} accent="text-yellow-400" />
                            <MiniStat label="Tier" value={`Tier ${profile.referralStats.currentTier}`} accent="text-purple-400" />
                        </div>
                    )}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Globe className="w-4 h-4 text-cyan-400" /> Linked Socials ({profile.socialAccounts.length})
                    </h3>
                    {profile.socialAccounts.length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">No social accounts linked</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {profile.socialAccounts.map((s, i) => {
                                const Icon = SocialIconFor(s.platform);
                                return (
                                    <div key={`${s.platform}-${s.username}-${i}`} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl hover:border-white/10 transition-all">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4 text-gray-300" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{s.platform}</p>
                                            <p className="text-sm font-bold text-white break-all">@{s.username}</p>
                                        </div>
                                        {s.verified && (
                                            <div className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded uppercase font-black tracking-widest">
                                                <ShieldCheck className="w-3 h-3" /> Verified
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Payout History — see services/payoutRequest.ts. 4-card aggregate row
                (always rendered, shows zeros if no history yet) + raw rows table
                truncated to 20 (matches Recent Orders pattern). */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Coins className="w-4 h-4 text-yellow-400" />
                            Payout History ({profile.payoutRequests?.length || 0})
                        </h3>
                        <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest font-bold">
                            Manual SG Coin crypto-withdrawal requests · all statuses
                        </p>
                    </div>
                </div>
                <div className="p-4 md:p-6 bg-black/10 border-b border-white/5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <MiniStat label="Total Requested" value={`${(profile.payoutStats?.totalRequested || 0).toLocaleString()} SGC`} accent="text-yellow-400" />
                        <MiniStat label="Pending" value={String(profile.payoutStats?.pendingCount || 0)} accent="text-yellow-400" />
                        <MiniStat label="Completed" value={String(profile.payoutStats?.completedCount || 0)} accent="text-emerald-400" />
                        {(() => {
                            const last = payoutLastStatusDisplay(profile.payoutStats?.lastStatus ?? null);
                            return <MiniStat label="Last Status" value={last.value} accent={last.accent} />;
                        })()}
                    </div>
                </div>
                {(!profile.payoutRequests || profile.payoutRequests.length === 0) ? (
                    <div className="p-12 text-center">
                        <Wallet className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            No payout requests found for this customer
                        </p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1 max-w-md mx-auto leading-relaxed">
                            SG Coin stays on the SG Coalition server by default · only opted-in manual withdrawals appear here
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/5">
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Date</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Amount</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Wallet</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Status</th>
                                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-gray-500">Tx Hash / Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {profile.payoutRequests.slice(0, 20).map((p) => {
                                    const shortWallet = p.walletAddress ? `${p.walletAddress.slice(0, 6)}…${p.walletAddress.slice(-4)}` : '—';
                                    const shortHash = p.txHash ? `${p.txHash.slice(0, 10)}…${p.txHash.slice(-6)}` : null;
                                    return (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3"><span className="text-[10px] text-gray-400 font-bold">{formatDate(p.createdAt)}</span></td>
                                            <td className="px-4 py-3"><span className="text-xs font-black text-yellow-400">{Number(p.amount || 0).toLocaleString()} SGC</span></td>
                                            <td className="px-4 py-3"><span className="text-[10px] font-mono text-gray-400 break-all" title={p.walletAddress}>{shortWallet}</span></td>
                                            <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                                            <td className="px-4 py-3">
                                                {p.status === 'completed' && shortHash ? (
                                                    <a href={`https://polygonscan.com/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline break-all">{shortHash}</a>
                                                ) : p.status === 'rejected' && p.rejectionReason ? (
                                                    <span className="text-[10px] text-red-400 italic break-all">{p.rejectionReason}</span>
                                                ) : p.status === 'approved' && shortHash ? (
                                                    <span className="text-[10px] font-mono text-blue-400 break-all" title={p.txHash}>{shortHash}</span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {profile.payoutRequests.length > 20 && (
                            <div className="p-3 text-center text-[10px] text-gray-600 uppercase tracking-widest font-bold border-t border-white/5">
                                Showing 20 of {profile.payoutRequests.length} payout requests
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Admin actions */}
            {!isMetaMask && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" /> Admin Actions
                        </h3>
                        <div className="flex items-center justify-between gap-3 p-3 bg-white/5 border border-white/5 rounded-xl">
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">VIP Status</p>
                                <p className="text-sm font-bold text-white mt-0.5">{profile.isVIP ? 'Active member' : 'Standard tier'}</p>
                            </div>
                            <button
                                disabled={busy}
                                onClick={onToggleVIP}
                                className={`px-3 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${profile.isVIP ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-purple-500 text-white hover:bg-purple-400'} disabled:opacity-50`}
                            >
                                {profile.isVIP ? 'Revoke VIP' : 'Grant VIP'}
                            </button>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Adjust Store Credit</p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    placeholder="Amount $"
                                    value={creditDelta}
                                    onChange={(e) => setCreditDelta(e.target.value)}
                                    min="0"
                                    step="1"
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-bold focus:outline-none focus:border-white/30"
                                />
                                <button disabled={busy || !creditDelta} onClick={() => handleCredit(1)} className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-emerald-400 disabled:opacity-30 transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                                <button disabled={busy || !creditDelta} onClick={() => handleCredit(-1)} className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-red-500/30 disabled:opacity-30 transition-all flex items-center gap-1"><Minus className="w-3 h-3" /> Sub</button>
                            </div>
                            <p className="text-[9px] text-gray-600 tracking-wider">
                                Current: <span className="text-cyan-400 font-bold">{formatCurrency(profile.storeCredit)}</span>
                            </p>
                        </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-amber-400" /> Customer Notes
                            </h3>
                            {!editingNotes ? (
                                <button onClick={() => setEditingNotes(true)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors"><Pencil className="w-3 h-3" /> Edit</button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setNotesDraft(profile.customerNotes || ''); setEditingNotes(false); }} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
                                    <button disabled={busy} onClick={handleSaveNotes} className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 disabled:opacity-50 transition-all"><Save className="w-3 h-3" /> Save</button>
                                </div>
                            )}
                        </div>
                        {editingNotes ? (
                            <textarea
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                rows={6}
                                placeholder="Add admin notes about this customer..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400/50 resize-vertical"
                            />
                        ) : (
                            <div className="min-h-[120px] p-3 bg-black/40 border border-white/5 rounded-xl text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {profile.customerNotes || <span className="text-gray-600 italic text-xs">No notes yet \— click Edit to add internal notes.</span>}
                            </div>
                        )}
                        <p className="text-[9px] text-gray-600 tracking-wider">Internal only \— not visible to the customer. Last updated notes persist on the profiles row.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// Accepts an optional onNavigateToPayouts callback so the parent Admin
// surface can wire a cross-tab deep-link (e.g. from the customer profile
// straight into the SG Coin Payouts approval tab). Optional because the
// component also works in isolation for tests + any future embed.
const CustomerProfileAdmin: React.FC<{ onNavigateToPayouts?: () => void }> = ({ onNavigateToPayouts }) => {
    const { addToast } = useToast();
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [guest, setGuest] = useState<Awaited<ReturnType<typeof buildCustomerProfileByEmail>> | null>(null);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [mode, setMode] = useState<'userId' | 'email' | null>(null);
    const [recents, setRecents] = useState<RecentSearch[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            if (raw) setRecents(JSON.parse(raw));
        } catch { /* ignore */ }
    }, []);

    const pushRecent = useCallback((q: string, m: 'userId' | 'email') => {
        setRecents((prev) => {
            const filtered = prev.filter((r) => r.query.toLowerCase() !== q.toLowerCase());
            const next: RecentSearch[] = [{ query: q, mode: m, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
            try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const fetchOrders = useCallback(async (userId: string) => {
        try {
            const { data, error: err } = await supabase
                .from('orders')
                .select('id, total, created_at, payment_status, items')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (err) throw err;
            setOrders((data || []) as OrderRow[]);
        } catch (e: any) {
            console.error('Failed to fetch orders:', e);
            setOrders([]);
        }
    }, []);

    const doSearch = useCallback(async (rawQuery?: string) => {
        const q = (rawQuery ?? query).trim();
        if (!q) return;
        setIsLoading(true);
        setError(null);
        setProfile(null);
        setGuest(null);
        setOrders([]);
        try {
            const { mode: m, value } = classifyQuery(q);
            setMode(m);
            if (m === 'email') {
                const data = await buildCustomerProfileByEmail(value);
                setGuest(data);
                pushRecent(value, 'email');
            } else {
                const result = await buildCustomerProfile(value);
                if (!result) setError('No profile found for user ID: ' + value);
                else {
                    setProfile(result);
                    pushRecent(value, 'userId');
                    await fetchOrders(value);
                }
            }
        } catch (e: any) {
            console.error('Customer profile search failed:', e);
            setError(e?.message || 'Search failed');
        } finally {
            setIsLoading(false);
        }
    }, [query, pushRecent, fetchOrders]);

    const handleRefresh = useCallback(async () => {
        if (!profile) return;
        setIsLoading(true);
        try {
            const result = await buildCustomerProfile(profile.userId);
            setProfile(result);
            await fetchOrders(profile.userId);
        } finally { setIsLoading(false); }
    }, [profile, fetchOrders]);

    const handleSaveNotes = useCallback(async (notes: string) => {
        if (!profile || profile.userId.startsWith('user_eth_')) return;
        try {
            const { error: err } = await supabase.from('profiles').update({ customer_notes: notes || null }).eq('id', profile.userId);
            if (err) throw err;
            setProfile({ ...profile, customerNotes: notes || null });
            addToast('Notes saved', 'success');
        } catch (e: any) {
            addToast(e?.message || 'Failed to save notes', 'error');
            throw e;
        }
    }, [profile, addToast]);

    const handleToggleVIP = useCallback(async () => {
        if (!profile || profile.userId.startsWith('user_eth_')) return;
        try {
            const newVal = !profile.isVIP;
            const { error: err } = await supabase.from('profiles').update({ is_vip: newVal }).eq('id', profile.userId);
            if (err) throw err;
            setProfile({ ...profile, isVIP: newVal });
            addToast(newVal ? 'VIP granted' : 'VIP revoked', 'success');
        } catch (e: any) {
            addToast(e?.message || 'Failed to update VIP status', 'error');
            throw e;
        }
    }, [profile, addToast]);

    const handleCreditDelta = useCallback(async (delta: number) => {
        if (!profile || profile.userId.startsWith('user_eth_')) return;
        try {
            const newCredit = Math.max(0, Number(profile.storeCredit || 0) + delta);
            const { error: err } = await supabase.from('profiles').update({ store_credit: newCredit }).eq('id', profile.userId);
            if (err) throw err;
            setProfile({ ...profile, storeCredit: newCredit });
            addToast(delta >= 0 ? `Added $${delta.toFixed(2)} credit` : `Subtracted $${Math.abs(delta).toFixed(2)} credit`, 'success');
        } catch (e: any) {
            addToast(e?.message || 'Failed to update store credit', 'error');
            throw e;
        }
    }, [profile, addToast]);

    const handleClear = useCallback(() => {
        setProfile(null); setGuest(null); setOrders([]); setError(null); setMode(null); setQuery('');
        inputRef.current?.focus();
    }, []);

    const handleRecentClick = useCallback((r: RecentSearch) => {
        setQuery(r.query);
        setTimeout(() => doSearch(r.query), 0);
    }, [doSearch]);

    const handleClearRecents = useCallback(() => {
        setRecents([]);
        try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
    }, []);

    const placeholder = useMemo(() => {
        if (mode === 'email') return 'buyer@example.com';
        if (mode === 'userId') return 'user UUID, user_eth_0x... or wallet address';
        return 'Search by user UUID, email, or wallet address...';
    }, [mode]);

    const showEmptyState = !profile && !guest && !isLoading && !error;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black font-display uppercase tracking-widest text-white flex items-center gap-3">
                        <UserCircle2 className="w-6 h-6 text-brand-accent" /> Customer Profile
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">Drill into a single customer \— orders, referrals, socials, lifetime stats</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleClear} className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/20 transition-all border border-white/10"><X className="w-3 h-3" /> Reset</button>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
                <form onSubmit={(e) => { e.preventDefault(); doSearch(); }} className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <label htmlFor="customer-search-input" className="sr-only">Search for customer</label>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                        <input
                            ref={inputRef}
                            id="customer-search-input"
                            type="text"
                            placeholder={placeholder}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            aria-label="Search customer by user ID or email"
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm font-mono focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className="flex items-center gap-2 bg-white text-black px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Lookup
                    </button>
                </form>

                {query && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold">
                        <Tag className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-500">Detected:</span>
                        <span className="px-2 py-0.5 bg-white/10 border border-white/10 rounded text-white">
                            {classifyQuery(query).mode === 'email' ? 'Email lookup (guest buyers)' : 'User ID lookup (authenticated)'}
                        </span>
                    </div>
                )}

                {recents.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><History className="w-3 h-3" /> Recent Lookups</p>
                            <button onClick={handleClearRecents} className="text-[10px] text-gray-600 hover:text-red-400 uppercase tracking-widest font-bold transition-colors">Clear</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recents.map((r) => (
                                <button
                                    key={`${r.query}-${r.timestamp}`}
                                    onClick={() => handleRecentClick(r)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
                                    title={`${r.mode} lookup`}
                                >
                                    {r.mode === 'email' ? <Mail className="w-3 h-3 text-cyan-400" /> : <Hash className="w-3 h-3 text-emerald-400" />}
                                    <span className="truncate max-w-[180px]">{r.query}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isLoading && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                    <Loader2 className="w-10 h-10 text-brand-accent animate-spin mx-auto mb-3" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Aggregating profile...</p>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">Pulling profile, orders, socials, referral stats in parallel</p>
                </div>
            )}

            {error && !isLoading && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center">
                    <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-black text-red-300 uppercase tracking-widest mb-1">Lookup Failed</p>
                    <p className="text-xs text-red-400/70 font-bold">{error}</p>
                </div>
            )}

            {showEmptyState && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                    <UserCircle2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">Search for a Customer</p>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                        Enter a user UUID, MetaMask wallet user ID (user_eth_...), or email above to view the enriched profile with orders, referrals, socials, and lifetime stats.
                    </p>
                </div>
            )}

            {profile && !isLoading && (
                <ProfileDetail
                    profile={profile}
                    orders={orders}
                    onRefresh={handleRefresh}
                    onSaveNotes={handleSaveNotes}
                    onToggleVIP={handleToggleVIP}
                    onCreditDelta={handleCreditDelta}
                    onClear={handleClear}
                    onNavigatePayouts={onNavigateToPayouts}
                />
            )}

            {guest && !isLoading && <GuestDetail data={guest} />}
        </div>
    );
};

export default CustomerProfileAdmin;
