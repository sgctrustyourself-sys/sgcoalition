import React, { useEffect, useRef, useState } from 'react';
import { Award, AtSign, Facebook, Loader2, RefreshCw, Search, UserCircle, Wallet, Mail, Coins, Hash, FileText, ShieldCheck } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

interface CustomerProfileRow {
    id: string;
    email: string | null;
    full_name: string | null;
    wallet_address: string | null;
    wallet_linked_at: string | null;
    sg_coin_balance: number | null;
    store_credit: number | null;
    is_vip: boolean | null;
    is_admin: boolean | null;
    lifetime_spend_usd: number | null;
    lifetime_orders: number | null;
    last_reward_credit_at: string | null;
    last_reward_credit_amount: number | null;
    customer_notes: string | null;
    created_at: string;
}

interface CustomerRewardCreditRow {
    id: string;
    profile_id: string;
    order_id: string | null;
    amount_sgc: number;
    amount_usd: number | null;
    reason: string;
    created_at: string;
}

const CustomerProfileAdmin: React.FC = () => {
    const { addToast } = useToast();
    const { adminCreditCustomerReward, adminAttributeOrderToFacebook } = useApp();
    const [customers, setCustomers] = useState<CustomerProfileRow[]>([]);
    const [creditHistory, setCreditHistory] = useState<Record<string, CustomerRewardCreditRow[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [instagramFilter, setInstagramFilter] = useState('');
    const [instaHandlesByProfile, setInstaHandlesByProfile] = useState<Record<string, string[]>>({});
    const [unmatchedInstagramHandles, setUnmatchedInstagramHandles] = useState<string[]>([]);
    const [selected, setSelected] = useState<CustomerProfileRow | null>(null);

    const [creditAmount, setCreditAmount] = useState('');
    const [creditReason, setCreditReason] = useState('');
    const [creditOrderId, setCreditOrderId] = useState('');
    const [isCrediting, setIsCrediting] = useState(false);

    const [fbUsername, setFbUsername] = useState('');
    const [fbOrderId, setFbOrderId] = useState('');
    const [fbNote, setFbNote] = useState('');
    const [isAttributing, setIsAttributing] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Debounce the IG filter so the marketing_contacts ILIKE only fires once
    // the operator stops typing. The table filter (in-memory social_accounts
    // match) stays un-debounced so the operator gets instant profile feedback.
    const [debouncedIgFilter, setDebouncedIgFilter] = useState('');
    useEffect(() => {
        const id = setTimeout(() => setDebouncedIgFilter(instagramFilter), 300);
        return () => clearTimeout(id);
    }, [instagramFilter]);

    // Snapshot the profile-email set into a ref so the marketing_contacts
    // lookup only fires when the IG handle actually changes. A useMemo would
    // churn its reference on every profile refresh and re-run the ILIKE; the
    // ref pattern avoids that.
    const profileEmailsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        profileEmailsRef.current = new Set(
            customers.map(c => (c.email || '').toLowerCase()).filter(Boolean)
        );
    }, [customers]);

    // Walk marketing_contacts.metadata->>instagram_username whenever the
    // debounced handle changes. The profile-email set is read from the ref
    // (no dep churn). A matching handle without a profile row surfaces in
    // the rail banner so the operator knows to open the /admin "Verified
    // Buyers" tab instead.
    useEffect(() => {
        const handle = debouncedIgFilter.trim().replace(/^@/, '').toLowerCase();
        if (!handle) {
            setUnmatchedInstagramHandles([]);
            return;
        }
        // Escape ILIKE wildcards so a literal `%`/`_` in a handle cannot
        // broaden the match. IG usernames never contain these but defending
        // against future schema drift is cheap.
        const escapedHandle = handle.replace(/[%_\\]/g, (c) => '\\' + c);
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('marketing_contacts')
                    .select('id, email, metadata')
                    .ilike('metadata->>instagram_username', `%${escapedHandle}%`);
                if (error || cancelled) return;
                const mcRows: Array<{ id: string; email: string | null; metadata: { instagram_username?: string } }> = Array.isArray(data)
                    ? (data as unknown as Array<{ id: string; email: string | null; metadata: { instagram_username?: string } }>)
                    : [];
                const matchedProfiles = profileEmailsRef.current;
                const unmatchedHandleList = mcRows
                    .filter(r => !(r.email && matchedProfiles.has(r.email.toLowerCase())))
                    .map(r => r.metadata?.instagram_username || '')
                    .filter(Boolean);
                setUnmatchedInstagramHandles(Array.from(new Set(unmatchedHandleList)));
            } catch {
                if (!cancelled) setUnmatchedInstagramHandles([]);
            }
        })();
        return () => { cancelled = true; };
    }, [debouncedIgFilter]);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            // Admin UI uses service-role fetch, so customer_notes IS visible here
            // (the user-side AppContext select deliberately drops it for privacy).
            const { data, error } = await supabase
                .from('profiles')
                .select(
                    'id, email, full_name, wallet_address, wallet_linked_at, ' +
                    'sg_coin_balance, store_credit, is_vip, is_admin, ' +
                    'lifetime_spend_usd, lifetime_orders, ' +
                    'last_reward_credit_at, last_reward_credit_amount, customer_notes, ' +
                    'created_at'
                )
                .order('created_at', { ascending: false });

            if (error) throw error;
            // Supabase's typings without a generated schema return a structurally-
            // narrow `data` type that TS rejects as `CustomerProfileRow[]`. Two
            // casts through `unknown` keep the call chain clean without dropping
            // the strict typing on `selected.customer_notes` downstream.
            const rows: CustomerProfileRow[] = Array.isArray(data)
                ? (data as unknown as CustomerProfileRow[])
                : [];
            setCustomers(rows);

            const ids = rows.map(c => c.id);
            if (ids.length > 0) {
                const { data: creditData, error: creditErr } = await supabase
                    .from('customer_reward_credits')
                    .select('id, profile_id, order_id, amount_sgc, amount_usd, reason, created_at')
                    .in('profile_id', ids)
                    .order('created_at', { ascending: false })
                    .limit(100);
                if (!creditErr) {
                    const grouped: Record<string, CustomerRewardCreditRow[]> = {};
                    const creditRows: CustomerRewardCreditRow[] = Array.isArray(creditData)
                        ? (creditData as unknown as CustomerRewardCreditRow[])
                        : [];
                    creditRows.forEach((row: CustomerRewardCreditRow) => {
                        if (!grouped[row.profile_id]) grouped[row.profile_id] = [];
                        grouped[row.profile_id].push(row);
                    });
                    setCreditHistory(grouped);
                }
            }
            if (ids.length > 0) {
                // social_accounts.username per profile.id for the IG filter.
                // Limited to platform='instagram' since the filter surfaces IG
                // handles only; Facebook + tiktok + twitter handles stay in
                // separate flows.
                const { data: saData, error: saErr } = await supabase
                    .from('social_accounts')
                    .select('user_id, username')
                    .eq('platform', 'instagram')
                    .in('user_id', ids);
                if (!saErr) {
                    const map: Record<string, string[]> = {};
                    const saRows: Array<{ user_id: string; username: string }> = Array.isArray(saData)
                        ? (saData as unknown as Array<{ user_id: string; username: string }>)
                        : [];
                    saRows.forEach(row => {
                        (map[row.user_id] ||= []).push(row.username);
                    });
                    setInstaHandlesByProfile(map);
                }
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to fetch customers', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const onCredit = async () => {
        if (!selected) return;
        const amount = Number(creditAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            addToast('Enter a positive SGC amount', 'error');
            return;
        }
        if (!creditReason.trim()) {
            addToast('Reason is required', 'error');
            return;
        }
        setIsCrediting(true);
        try {
            const result = await adminCreditCustomerReward(
                selected.id,
                amount,
                creditReason.trim(),
                { orderId: creditOrderId.trim() || undefined }
            );
            if (result.success) {
                addToast('Credited ' + amount + ' SGC -> balance ' + result.newBalance, 'success');
                setCreditAmount('');
                setCreditReason('');
                setCreditOrderId('');
                await fetchCustomers();
                const refreshed = customers.find(c => c.id === selected.id);
                if (refreshed) setSelected(refreshed);
            }
        } finally {
            setIsCrediting(false);
        }
    };

    const onAttribute = async () => {
        if (!fbOrderId.trim() || !fbUsername.trim()) {
            addToast('orderId + facebookUsername both required', 'error');
            return;
        }
        setIsAttributing(true);
        try {
            const result = await adminAttributeOrderToFacebook(
                fbOrderId.trim(),
                fbUsername.trim(),
                fbNote.trim() || undefined
            );
            if (result.success) {
                addToast('Order attributed to @' + fbUsername.trim(), 'success');
                setFbUsername('');
                setFbOrderId('');
                setFbNote('');
            }
        } finally {
            setIsAttributing(false);
        }
    };

    const normalizedIg = instagramFilter.trim().replace(/^@/, '').toLowerCase();
    const filtered = customers.filter(c => {
        const baseMatch =
            (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.wallet_address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.id || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!normalizedIg) return baseMatch;
        if (!baseMatch) return false;
        const handles = instaHandlesByProfile[c.id] || [];
        return handles.some(h => h.toLowerCase().includes(normalizedIg));
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black font-display uppercase tracking-widest text-white flex items-center gap-3">
                        <UserCircle className="w-6 h-6 text-brand-accent" />
                        Customer Profiles
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">
                        Iterate every customer - credit SGC rewards, attribute orders to social.
                    </p>
                </div>
                <button
                    onClick={fetchCustomers}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-accent transition-all"
                >
                    <RefreshCw className="w-3 h-3" /> Refresh
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                    type="text"
                    placeholder="Search by email, name, wallet, or user ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-white/30"
                />
            </div>

            {/* Instagram-handle filter: walks social_accounts.username per profile
                + marketing_contacts.metadata->>instagram_username. Strict partial
                match, case-insensitive, leading '@' stripped. */}
            <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-400" />
                <input
                    type="text"
                    placeholder="Instagram handle filter (e.g. friiqy) -> social_accounts + marketing_contacts"
                    value={instagramFilter}
                    onChange={(e) => setInstagramFilter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-pink-500/40"
                />
            </div>

            {instagramFilter.trim() && unmatchedInstagramHandles.length > 0 && (
                <div className="rounded-2xl border border-pink-500/30 bg-pink-500/[0.04] px-5 py-4 text-xs text-pink-200">
                    <span className="block font-black uppercase tracking-widest text-[10px] text-pink-300 mb-1">No profile row</span>
                    Marketing contacts whose <span className="font-mono">metadata.instagram_username</span> matches but whose email is not linked to a profile row:&nbsp;
                    {unmatchedInstagramHandles.map(h => '@' + h).join(', ')}. They will surface in the /admin <span className="font-mono">Verified Buyers</span> tab.
                </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Identity</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Wallet</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Lifetime</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Last Bonus</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto" />
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 uppercase tracking-widest text-xs font-bold">
                                        No customers yet
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(c => (
                                    <tr
                                        key={c.id}
                                        onClick={() => setSelected(c)}
                                        className={'hover:bg-white/5 transition-colors cursor-pointer ' + (selected?.id === c.id ? 'bg-white/10' : '')}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-white text-sm">{c.full_name || c.email?.split('@')[0] || 'Anonymous'}</p>
                                                {c.is_admin && <ShieldCheck className="w-3 h-3 text-purple-400" />}
                                            </div>
                                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <Mail className="w-3 h-3" /> {c.email || 'no email'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-[10px] text-white font-mono">
                                            {c.wallet_address ? (
                                                <span className="flex items-center gap-1">
                                                    <Wallet className="w-3 h-3 text-gray-500" />
                                                    {c.wallet_address.slice(0, 6)}...{c.wallet_address.slice(-4)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600">none</span>
                                            )}
                                            {c.wallet_linked_at && (
                                                <p className="text-[9px] text-gray-500 uppercase tracking-widest">
                                                    linked {new Date(c.wallet_linked_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-[10px]">
                                            <p className="text-emerald-400 font-black">${Number(c.lifetime_spend_usd || 0).toFixed(2)}</p>
                                            <p className="text-gray-500">{Number(c.lifetime_orders || 0)} orders</p>
                                        </td>
                                        <td className="px-6 py-4 text-[10px]">
                                            <p className="text-emerald-400 font-black">{Number(c.last_reward_credit_amount || 0).toLocaleString()} SGC</p>
                                            <p className="text-gray-500">
                                                {c.last_reward_credit_at ? new Date(c.last_reward_credit_at).toLocaleString() : '-'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-[10px]">
                                            <span className="text-gray-400 uppercase tracking-widest font-bold">Open --&gt;</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selected && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <h3 className="text-lg font-black font-display uppercase tracking-widest text-white flex items-center gap-2 mb-4">
                            <Coins className="w-5 h-5 text-emerald-400" /> Credit SGC Reward
                        </h3>
                        <div className="space-y-3 text-xs">
                            <p className="text-gray-400">
                                Bumping {selected.email || selected.id}'s balance. Append-only:
                                every credit writes a customer_reward_credits row.
                            </p>
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">SGC amount</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(e.target.value)}
                                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white"
                                    placeholder="50"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Reason (required)</span>
                                <input
                                    type="text"
                                    value={creditReason}
                                    onChange={(e) => setCreditReason(e.target.value)}
                                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white"
                                    placeholder="Starrboii067 - wallet bonus"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Linked orderId (optional)</span>
                                <input
                                    type="text"
                                    value={creditOrderId}
                                    onChange={(e) => setCreditOrderId(e.target.value)}
                                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white font-mono"
                                    placeholder="order_grey_wave_wallet_2_2_york_pa_2026_07_02"
                                />
                            </label>
                            <button
                                onClick={onCredit}
                                disabled={isCrediting}
                                className="w-full bg-emerald-500 text-black font-black uppercase tracking-widest text-[10px] px-4 py-3 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-30"
                            >
                                {isCrediting ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Award className="w-4 h-4 inline mr-2" />}
                                Credit reward
                            </button>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <h3 className="text-lg font-black font-display uppercase tracking-widest text-white flex items-center gap-2 mb-4">
                            <Facebook className="w-5 h-5 text-blue-400" /> Attribute Order to Facebook
                        </h3>
                        <div className="space-y-3 text-xs">
                            <p className="text-gray-400">
                                Stamp orders.facebook_username on an existing order.
                                Accepts URL, @handle, or bare handle; we normalize server-side.
                            </p>
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Order ID</span>
                                <input
                                    type="text"
                                    value={fbOrderId}
                                    onChange={(e) => setFbOrderId(e.target.value)}
                                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white font-mono"
                                    placeholder="order_grey_wave_wallet_2_2_york_pa_2026_07_02"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Facebook username</span>
                                <input
                                    type="text"
                                    value={fbUsername}
                                    onChange={(e) => setFbUsername(e.target.value)}
                                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white"
                                    placeholder="facebook.com/starrboii067"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Note (optional)</span>
                                <textarea
                                    value={fbNote}
                                    onChange={(e) => setFbNote(e.target.value)}
                                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white"
                                    rows={2}
                                    placeholder="Confirmed via FB DM"
                                />
                            </label>
                            <button
                                onClick={onAttribute}
                                disabled={isAttributing}
                                className="w-full bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] px-4 py-3 rounded-xl hover:bg-blue-400 transition-all disabled:opacity-30"
                            >
                                {isAttributing ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Hash className="w-4 h-4 inline mr-2" />}
                                Attribute order
                            </button>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <h3 className="text-lg font-black font-display uppercase tracking-widest text-white mb-4">Lifetime</h3>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Spend</p>
                                <p className="text-emerald-400 font-black text-lg">${Number(selected.lifetime_spend_usd || 0).toFixed(2)}</p>
                            </div>
                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Orders</p>
                                <p className="text-white font-black text-lg">{Number(selected.lifetime_orders || 0)}</p>
                            </div>
                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">SGC balance</p>
                                <p className="text-emerald-400 font-black text-lg">{Number(selected.sg_coin_balance || 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Store credit</p>
                                <p className="text-brand-accent font-black text-lg">${Number(selected.store_credit || 0).toFixed(2)}</p>
                            </div>
                        </div>
                        {selected.customer_notes && (
                            <p className="mt-4 text-[10px] text-gray-400 italic border-l-2 border-purple-500/40 pl-3">
                                <FileText className="w-3 h-3 inline mr-1 text-purple-400" />
                                {selected.customer_notes}
                            </p>
                        )}
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <h3 className="text-lg font-black font-display uppercase tracking-widest text-white mb-4">Credit History</h3>
                        {(creditHistory[selected.id] || []).length === 0 ? (
                            <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">No credits yet</p>
                        ) : (
                            <ul className="space-y-2 text-xs max-h-64 overflow-y-auto">
                                {(creditHistory[selected.id] || []).map(row => (
                                    <li key={row.id} className="border-b border-white/5 pb-2">
                                        <p className="font-black text-emerald-400">+{Number(row.amount_sgc).toLocaleString()} SGC</p>
                                        <p className="text-gray-400">{row.reason}</p>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                            {new Date(row.created_at).toLocaleString()} - {row.order_id || 'no order link'}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerProfileAdmin;
