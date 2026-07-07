import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Loader2, Instagram, UserCheck, ChevronDown, ChevronRight, MapPin, Calendar, ShoppingBag } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';

// ----------------------------------------------------------------------------
// /admin "Verified Buyers" tab.
//
// Pulls every marketing_contacts row whose source is in the verified-customer
// sources documented in utils/marketingAudience.ts (manual_seed +
// past_customer). Joins to orders by instagram_username via the column added
// by supabase/migrations/20260704_add_instagram_username_to_orders.sql, and
// computes lifetime + order count in-component. No PostgREST RPC and no new
// migration: the verified-row count is small enough that the two-step
// (marketing_contacts -> orders IN-list) aggregate reads cleaner than a
// JOIN+SUM SQL function would at this scale.
//
// Component state is local (no AppContext reads). Admin shell + the RLS
// policy on marketing_contacts (admin_users lookup) already gate access to
// admin auth.
//
// Privacy: lifetime + order detail only. No address / ZIP / customer name
// surfaced raw. metadata.customer_name is synthetic ("Abingdon Customer",
// etc.) per the convention the seed scripts already apply.
// ----------------------------------------------------------------------------

interface VerifiedBuyerContact {
    id: string;
    email: string | null;
    source: string;
    status: string;
    created_at: string;
    metadata: {
        instagram_username?: string;
        customer_name?: string;
        notes?: string;
        seeded_at?: string;
        [key: string]: unknown;
    };
}

interface VerifiedBuyerOrder {
    id: string;
    total: number | null;
    payment_status: string | null;
    payment_method: string | null;
    instagram_username: string | null;
    created_at: string;
    shippingAddress?: { city?: string; state?: string; country?: string } | null;
    items?: { productName?: string; productId?: string; quantity?: number; price?: number; selectedSize?: string }[];
}

interface DisplayRow {
    contact: VerifiedBuyerContact;
    handle: string;
    orders: VerifiedBuyerOrder[];
    lifetime: number;
    orderCount: number;
    lastAt: string | null;
}

const formatMoney = (n: number): string => '$' + n.toFixed(2);
const formatDate = (s: string | null): string => (s ? new Date(s).toLocaleDateString() : '—');

const VerifiedBuyersAdmin: React.FC = () => {
    const { addToast } = useToast();
    const [contacts, setContacts] = useState<VerifiedBuyerContact[]>([]);
    const [orders, setOrders] = useState<VerifiedBuyerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const fetchAll = async () => {
        setLoading(true);
        try {
            const { data: contactsData, error: contactsErr } = await supabase
                .from('marketing_contacts')
                .select('id, email, source, status, created_at, metadata')
                .in('source', ['past_customer', 'manual_seed'])
                .order('created_at', { ascending: false });
            if (contactsErr) throw contactsErr;

            const safeContacts: VerifiedBuyerContact[] = Array.isArray(contactsData)
                ? (contactsData as unknown as VerifiedBuyerContact[])
                : [];
            setContacts(safeContacts);

            const handles = Array.from(
                new Set(
                    safeContacts
                        .map((c) => c.metadata?.instagram_username)
                        .filter((s): s is string => typeof s === 'string' && s.length > 0)
                )
            );

            if (handles.length === 0) {
                setOrders([]);
            } else {
                const { data: ordersData, error: ordersErr } = await supabase
                    .from('orders')
                    .select('id, total, payment_status, payment_method, instagram_username, created_at, shippingAddress, items')
                    .in('instagram_username', handles)
                    // Lifetime math must NOT count pending / cancelled / refunded / failed
                    // rows. Without this clamp, friiqy's expected $455 lifetime drifts
                    // upward the moment a non-paid test order is seeded with her handle.
                    // Locked by tests/productDiscount.test.ts (catalog + cart + no-stack)
                    // and the Batch B marketing tests so any future regression that
                    // drops the filter lights up immediately.
                    .eq('payment_status', 'paid')
                    .order('created_at', { ascending: false })
                    .limit(200);
                if (ordersErr) throw ordersErr;
                setOrders(
                    Array.isArray(ordersData) ? (ordersData as unknown as VerifiedBuyerOrder[]) : []
                );
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch verified buyers';
            addToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const ordersByHandle = useMemo(() => {
        const m: Record<string, VerifiedBuyerOrder[]> = {};
        for (const o of orders) {
            if (!o.instagram_username) continue;
            (m[o.instagram_username] ||= []).push(o);
        }
        return m;
    }, [orders]);

    const rows = useMemo<DisplayRow[]>(() => {
        const out: DisplayRow[] = [];
        for (const c of contacts) {
            const handle = c.metadata?.instagram_username || '';
            const obs = handle ? ordersByHandle[handle] || [] : [];
            const lifetime = obs.reduce((s, o) => s + Number(o.total || 0), 0);
            out.push({
                contact: c,
                handle: handle ? '@' + handle : '(no handle)',
                orders: obs,
                lifetime,
                orderCount: obs.length,
                lastAt: obs[0]?.created_at || null,
            });
        }
        out.sort((a, b) => b.lifetime - a.lifetime || b.orderCount - a.orderCount || a.handle.localeCompare(b.handle));
        return out;
    }, [contacts, ordersByHandle]);

    const filtered = useMemo<DisplayRow[]>(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            const handleRaw = r.handle.replace(/^@/, '');
            return (
                handleRaw.toLowerCase().includes(q) ||
                (r.contact.metadata?.customer_name || '').toLowerCase().includes(q) ||
                (r.contact.email || '').toLowerCase().includes(q) ||
                r.contact.source.toLowerCase().includes(q)
            );
        });
    }, [rows, search]);
const totals = useMemo(() => {
    const lifetime = rows.reduce((s, r) => s + r.lifetime, 0);
    const orderCount = rows.reduce((s, r) => s + r.orderCount, 0);
    const sources = new Set(rows.map((r) => r.contact.source)).size;
    return { lifetime, orderCount, sources };
}, [rows]);

const toggle = (handle: string) => {
    setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(handle)) next.delete(handle);
        else next.add(handle);
        return next;
    });
};

return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-2xl font-black font-display uppercase tracking-widest text-white flex items-center gap-3">
                    <UserCheck className="w-6 h-6 text-brand-accent" />
                    Verified Buyers
                </h2>
                <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">
                    Contacts with <span className="font-mono text-gray-300">source = 'past_customer' | 'manual_seed'</span> joined to orders by{ ' '}
                    <span className="font-mono text-gray-300">orders.instagram_username</span>.
                </p>
            </div>
            <button
                onClick={fetchAll}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-accent transition-all"
            >
                <RefreshCw className="w-3 h-3" /> Refresh
            </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Verified Contacts" value={rows.length} accent="green" />
            <StatCard label="Lifetime Total" value={formatMoney(totals.lifetime)} accent="green" />
            <StatCard label="Orders Joined" value={totals.orderCount} accent="purple" />
            <StatCard label="Sources" value={totals.sources} accent="blue" />
        </div>

        <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
                type="text"
                placeholder="Search by handle, customer name, email, or source..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-white/30"
            />
        </div>


        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 w-8"></th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Instagram</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Source</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Lifetime</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Orders</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Last Order</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto" /></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 uppercase tracking-widest text-xs font-bold">No verified buyers yet</td></tr>
                        ) : (
                            filtered.map((r) => (
                                <React.Fragment key={r.contact.id}>
                                    <tr
                                        onClick={() => toggle(r.handle)}
                                        className={"hover:bg-white/5 transition-colors cursor-pointer " + (expanded.has(r.handle) ? "bg-white/10" : "")}
                                    >
                                        <td className="px-4 py-4 text-gray-400">
                                            {expanded.has(r.handle) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </td>
													<td className="px-6 py-4">
															{r.handle !== "(no handle)" ? (
																<a href={"https://instagram.com/" + r.handle.replace(/^@/, "")} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-brand-accent hover:underline">
																	<Instagram className="w-3 h-3" /> {r.handle}
																</a>
															) : (
																<span className="text-gray-500 font-mono text-xs">{r.handle}</span>
															)}
														</td>
														<td className="px-6 py-4">
															<div className="text-white text-sm font-bold">{r.contact.metadata?.customer_name || "\u2014"}</div>
															<div className="text-gray-500 text-[10px] font-mono">{r.contact.id.slice(0, 12)}</div>
														</td>
														<td className="px-6 py-4">
															<span className={"inline-block px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest " + (r.contact.source === "past_customer" ? "bg-purple-500/15 text-purple-300" : "bg-emerald-500/15 text-emerald-300")}>
																{r.contact.source}
															</span>
														</td>
														<td className="px-6 py-4 text-white font-black tabular-nums">{formatMoney(r.lifetime)}</td>
														<td className="px-6 py-4 text-gray-300 font-bold tabular-nums">{r.orderCount}</td>
														<td className="px-6 py-4 text-gray-400 text-xs">{formatDate(r.lastAt)}</td>
													</tr>
													{expanded.has(r.handle) && (
														<tr className="bg-white/[0.03]">
															<td colSpan={7} className="px-6 py-4">
																<div className="space-y-2">
																	<div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Orders joined via instagram_username ({r.orders.length})</div>
																{r.orders.length === 0 ? (
																	<div className="text-gray-500 text-xs italic">No orders matched this instagram handle in the orders table.</div>
																) : r.orders.map((o) => {
																	const statusKey = (o.payment_status || "").toLowerCase();
																	const statusColor = statusKey === "paid" ? "text-emerald-300 bg-emerald-500/15" : statusKey === "pending" ? "text-amber-300 bg-amber-500/15" : "text-gray-400 bg-white/5";
																	return (
																		<div key={o.id} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
																		<div className="flex items-center gap-3 min-w-0">
																			<ShoppingBag className="w-4 h-4 text-gray-400 shrink-0" />
																			<div className="min-w-0">
																				<div className="text-white text-sm font-bold truncate">{o.items?.[0]?.productName || "Order"}</div>
																				<div className="text-gray-500 text-[10px] font-mono flex items-center gap-2">
																					<MapPin className="w-3 h-3" /> {o.shippingAddress?.city || "\u2014"}{o.shippingAddress?.state ? ", " + o.shippingAddress.state : ""}
																					<Calendar className="w-3 h-3 ml-2" /> {formatDate(o.created_at)}
																				</div>
																			</div>
																		</div>
																		<div className="flex items-center gap-3 shrink-0">
																			<span className={"inline-block px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest " + statusColor}>{(o.payment_status || "unknown").toUpperCase()}</span>
																			<span className="text-white font-black tabular-nums">{formatMoney(Number(o.total || 0))}</span>
																		</div>
																	</div>
																	);
																})}
															</div>
														</td>
													</tr>
												)}
											</React.Fragment>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-[11px] text-gray-500 leading-relaxed">
						These contacts are reachable from <span className="font-mono text-gray-300">"Test Drop"</span>-style campaigns because <span className="font-mono text-gray-300">utils/marketingAudience.ts &gt; filterVerifiedCustomers()</span> strips them out. Suppression applies to any campaign whose name contains the substring <span className="font-mono text-gray-300">"test"</span> (case-insensitive). Lifetime totals include both <span className="font-mono text-gray-300">"past_customer"</span> and <span className="font-mono text-gray-300">"manual_seed"</span> rows.
					</div>
				</div>
			);

		};


const StatCard: React.FC<{ label: string; value: string | number; accent: "green" | "purple" | "blue" }> = ({ label, value, accent }) => {
    const palette = accent === "green" ? "border-emerald-500/30 bg-emerald-500/[0.04]" : accent === "purple" ? "border-purple-500/30 bg-purple-500/[0.04]" : "border-blue-500/30 bg-blue-500/[0.04]";
    return (
        <div className={"rounded-2xl border " + palette + " px-5 py-4"}>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
            <div className="text-white text-2xl font-black font-display mt-1 tabular-nums">{value}</div>
        </div>
    );
};

export default VerifiedBuyersAdmin;
