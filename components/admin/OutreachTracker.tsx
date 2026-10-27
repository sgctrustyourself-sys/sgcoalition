import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
    ClipboardList, Phone, DollarSign, Image, Image as ImageIcon,
    CheckCircle, X as XIcon, Loader, Plus, Edit2, Trash2, Search,
    Clock, Target, Volume2, Package, Banknote, Save, UserCircle2, Download,
} from 'lucide-react';

const STORAGE_KEY = 'coalition_outreach_contacts';

type Category = 'Brand' | 'Model' | 'Community';
type Platform = 'Instagram' | 'Twitter' | 'TikTok' | 'YouTube' | 'Discord' | 'Email' | 'Other';
type MessageVariant = 'A' | 'B';
type Status =
    | 'Contacted'
    | 'Responded'
    | 'Item Sent'
    | 'Picture Collected'
    | 'Posted'
    | 'Paid'
    | 'Follow Up'
    | 'Closed'
    | 'Not Interested';

type PaymentType = 'free' | 'paid' | 'pending';

const DAILY_GOAL = 10;

const STATUS_ORDER: Status[] = [
    'Contacted', 'Responded', 'Item Sent', 'Picture Collected', 'Posted',
    'Paid', 'Follow Up', 'Closed', 'Not Interested',
];

const STATUS_COLORS: Record<Status, string> = {
    Contacted: 'text-blue-400 border-blue-500/30',
    Responded: 'text-purple-400 border-purple-500/30',
    'Item Sent': 'text-orange-400 border-orange-500/30',
    'Picture Collected': 'text-amber-400 border-amber-500/30',
    Posted: 'text-green-400 border-green-500/30',
    Paid: 'text-emerald-400 border-emerald-500/30',
    'Follow Up': 'text-yellow-400 border-yellow-500/30',
    Closed: 'text-gray-400 border-gray-500/30',
    'Not Interested': 'text-red-400 border-red-500/30',
};

const CATEGORY_COLORS: Record<Category, string> = {
    Brand: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Model: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Community: 'bg-green-500/10 text-green-400 border-green-500/20',
};

type OutreachRow = {
    id: string;
    date: string;
    category: Category;
    name: string;
    handle: string;
    platform: Platform;
    link: string;
    message_variant: MessageVariant;
    status: Status;
    follow_up_date: string | null;
    notes: string;
    item_sent: string | null;
    item_sent_date: string | null;
    picture_received: boolean;
    picture_date: string | null;
    posted: boolean;
    posted_platform: string | null;
    payment_type: PaymentType;
    payment_amount: number | null;
    payment_date: string | null;
    commission_paid: boolean;
    created_at: string;
    updated_at: string;
};

type OutreachContact = Omit<OutreachRow, 'created_at' | 'updated_at'> & {
    created_at?: string;
    updated_at?: string;
};

const emptyContact: OutreachContact = {
    id: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'Brand',
    name: '',
    handle: '',
    platform: 'Instagram',
    link: '',
    message_variant: 'A',
    status: 'Contacted',
    follow_up_date: null,
    notes: '',
    item_sent: null,
    item_sent_date: null,
    picture_received: false,
    picture_date: null,
    posted: false,
    posted_platform: null,
    payment_type: 'free',
    payment_amount: null,
    payment_date: null,
    commission_paid: false,
};

const OutreachTracker: React.FC = () => {
    const { addToast } = useToast();
    const { isSupabaseConfigured } = useApp();

    const [contacts, setContacts] = useState<OutreachRow[]>([]);
    const [, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editing, setEditing] = useState<OutreachContact | null>(null);
    const editPanelRef = useRef<HTMLDivElement>(null);

    // Escape is a cancel, except while the contact is being written: the gate
    // matches MarketingManager's send confirmation, so the in-flight save owns
    // the form until it settles.
    useFocusTrap({
        active: editing !== null && !isSaving,
        containerRef: editPanelRef,
        onEscape: () => setEditing(null),
    });
    const [view, setView] = useState<'dashboard' | 'table'>('dashboard');
    const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const today = new Date().toISOString().slice(0, 10);

    // ---- Data loading ----
    const loadContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isSupabaseConfigured) {
                const { data, error } = await supabase
                    .from('outreach_contacts')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setContacts((data as OutreachRow[] | null) || []);
            } else {
                const raw = typeof localStorage !== 'undefined'
                    ? localStorage.getItem(STORAGE_KEY)
                    : null;
                const parsed = raw ? JSON.parse(raw) : [];
                setContacts(parsed as OutreachRow[]);
            }
        } catch (err) {
            console.error('Error loading outreach contacts:', err);
            try {
                const raw = typeof localStorage !== 'undefined'
                    ? localStorage.getItem(STORAGE_KEY)
                    : null;
                const parsed = raw ? JSON.parse(raw) : [];
                setContacts(parsed as OutreachRow[]);
            } catch { setContacts([]); }
        } finally {
            setIsLoading(false);
        }
    }, [isSupabaseConfigured]);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    const persistContacts = useCallback((next: OutreachRow[]) => {
        setContacts(next);
        if (!isSupabaseConfigured) {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                }
            } catch { /* no-op */ }
        }
    }, [isSupabaseConfigured]);

    const saveContact = async (contact: OutreachContact) => {
        setIsSaving(true);
        try {
            if (isSupabaseConfigured) {
                const row = {
                    date: contact.date,
                    category: contact.category,
                    name: contact.name,
                    handle: contact.handle,
                    platform: contact.platform,
                    link: contact.link,
                    message_variant: contact.message_variant,
                    status: contact.status,
                    follow_up_date: contact.follow_up_date,
                    notes: contact.notes,
                    item_sent: contact.item_sent,
                    item_sent_date: contact.item_sent_date,
                    picture_received: contact.picture_received,
                    picture_date: contact.picture_date,
                    posted: contact.posted,
                    posted_platform: contact.posted_platform,
                    payment_type: contact.payment_type,
                    payment_amount: contact.payment_amount,
                    payment_date: contact.payment_date,
                    commission_paid: contact.commission_paid,
                    ...(contact.id ? { id: contact.id } : {}),
                };

                const { error } = await supabase
                    .from('outreach_contacts')
                    .upsert(row);

                if (error) throw error;
                addToast('Contact saved.', 'success');
            } else {
                const now = new Date().toISOString();
                const next: OutreachRow[] = contacts.map((c) =>
                    c.id === contact.id ? { ...contact, id: c.id, updated_at: now } as OutreachRow : c
                );
                if (!next.some((c) => c.id === contact.id)) {
                    next.unshift({
                        ...contact,
                        id: `local-${Date.now()}`,
                        created_at: now,
                        updated_at: now,
                    } as OutreachRow);
                }
                persistContacts(next);
                addToast('Contact saved.', 'success');
            }
            setEditing(null);
            loadContacts();
        } catch (err) {
            addToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteContact = async (id: string) => {
        if (!confirm('Delete this outreach contact?')) return;
        try {
            if (isSupabaseConfigured) {
                const { error } = await supabase
                    .from('outreach_contacts')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } else {
                persistContacts(contacts.filter((c) => c.id !== id));
            }
            addToast('Contact deleted.', 'success');
            loadContacts();
        } catch (err) {
            addToast(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
    };

    // ---- Derived data ----
    const todayContacts = contacts.filter((c) => c.date === today);
    const todaysSent = todayContacts.length;
    const goalProgress = Math.min((todaysSent / DAILY_GOAL) * 100, 100);

    const totalContacts = contacts.length;
    const responded = contacts.filter((c) => c.status === 'Responded').length;
    const responseRate = totalContacts > 0 ? Math.round((responded / totalContacts) * 100) : 0;

    const itemsSent = contacts.filter((c) => c.item_sent).length;
    const picturesReceived = contacts.filter((c) => c.picture_received).length;
    const posted = contacts.filter((c) => c.posted).length;
    const paidCollabs = contacts.filter((c) => c.payment_type === 'paid').length;
    const totalPaid = contacts
        .filter((c) => c.payment_type === 'paid' && c.payment_amount)
        .reduce((sum, c) => sum + (c.payment_amount || 0), 0);

    const overdueFollowUps = contacts.filter(
        (c) => c.follow_up_date && c.follow_up_date < today && c.status !== 'Closed' && c.status !== 'Not Interested'
    );
    const dueTodayFollowUps = contacts.filter(
        (c) => c.follow_up_date === today && c.status !== 'Closed' && c.status !== 'Not Interested'
    );

    const filtered = useMemo(() => {
        return contacts.filter((c) => {
            const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
            const matchStatus = statusFilter === 'all' || c.status === statusFilter;
            const q = searchQuery.toLowerCase();
            const matchSearch =
                c.name.toLowerCase().includes(q) ||
                c.handle.toLowerCase().includes(q) ||
                c.platform.toLowerCase().includes(q) ||
                c.notes.toLowerCase().includes(q) ||
                (c.item_sent && c.item_sent.toLowerCase().includes(q));
            return matchCategory && matchStatus && matchSearch;
        });
    }, [contacts, categoryFilter, statusFilter, searchQuery]);

    // ---- Form handlers ----
    const openAdd = () => {
        setEditing({ ...emptyContact, date: today });
    };

    const openEdit = (row: OutreachRow) => {
        setEditing({ ...row, id: row.id });
    };

    const closeEdit = () => setEditing(null);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        if (!editing.name || !editing.handle) {
            addToast('Name and handle are required.', 'error');
            return;
        }
        saveContact(editing);
    };

    const updateField = (key: keyof OutreachContact, value: unknown) => {
        if (!editing) return;
        setEditing({ ...editing, [key]: value } as OutreachContact);
    };

    const toggleBoolean = (key: 'picture_received' | 'posted' | 'commission_paid') => {
        if (!editing) return;
        setEditing({ ...editing, [key]: !editing[key] } as OutreachContact);
    };

    // ---- Render helpers ----
    const statCard = (
        label: string,
        value: number | string,
        Icon: React.ComponentType<{ className?: string }>,
        accent: 'purple' | 'blue' | 'green' | 'orange' | 'gray' = 'gray'
    ) => {
        const accentClass = {
            purple: 'text-purple-400',
            blue: 'text-blue-400',
            green: 'text-green-400',
            orange: 'text-orange-400',
            gray: 'text-gray-400',
        }[accent];
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl font-black">{value}</div>
                    <Icon className={`w-5 h-5 ${accentClass}`} />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
            </div>
        );
    };

    const statusBadge = (status: Status) => {
        const color = STATUS_COLORS[status];
        return (
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${color}`}>
                {status}
            </span>
        );
    };

    const categoryBadge = (category: Category) => {
        const color = CATEGORY_COLORS[category];
        return (
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${color}`}>
                {category}
            </span>
        );
    };

    const overdueBadge = (date: string | null) => {
        if (!date) return null;
        const isOverdue = date < today;
        return (
            <span className={`text-[9px] font-bold uppercase tracking-widest ${isOverdue ? 'text-red-500' : 'text-orange-400'}`}>
                {isOverdue ? 'OVERDUE' : 'DUE TODAY'}
            </span>
        );
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-display uppercase tracking-widest flex items-center gap-3">
                        <ClipboardList className="w-6 h-6 text-brand-accent" />
                        Outreach Tracker
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">
                        Daily goal: {DAILY_GOAL} contacts &bull; Founder-led outbound
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setView('dashboard')}
                        className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${view === 'dashboard'
                            ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <Target className="w-4 h-4" /> Dashboard
                    </button>
                    <button
                        onClick={() => setView('table')}
                        className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${view === 'table'
                            ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <ClipboardList className="w-4 h-4" /> Tracker
                    </button>
                    <button
                        onClick={openAdd}
                        className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent/90 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-brand-accent/20"
                    >
                        <Plus className="w-4 h-4" />
                        Log Contact
                    </button>
                </div>
            </div>

            {view === 'dashboard' ? (
                <div className="space-y-6">
                    {/* Daily goal */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-bold uppercase tracking-tighter text-white mb-1">Today's Progress</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    {todaysSent} of {DAILY_GOAL} contacts sent
                                </p>
                            </div>
                            <div className="text-4xl font-black">{todaysSent}</div>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-3 mb-2 overflow-hidden border border-white/10">
                            <div
                                className="h-full bg-gradient-to-r from-brand-accent to-blue-400 transition-all duration-700"
                                style={{ width: `${goalProgress}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            <span>{Math.round(goalProgress)}% to goal</span>
                            <span>{goalProgress >= 100 ? 'Goal met' : `${DAILY_GOAL - todaysSent} left today`}</span>
                        </div>
                        {goalProgress >= 100 && (
                            <div className="mt-3 flex items-center gap-2 text-green-400 text-[10px] font-bold uppercase tracking-widest">
                                <CheckCircle className="w-3 h-3" /> Daily goal complete
                            </div>
                        )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {statCard('Total Contacts', totalContacts, UserCircle2, 'purple')}
                        {statCard('Response Rate', `${responseRate}%`, Phone, 'blue')}
                        {statCard('Items Sent', itemsSent, Package, 'orange')}
                        {statCard('Pictures', picturesReceived, Image, 'green')}
                        {statCard('Posted', posted, Volume2, 'blue')}
                        {statCard('Paid Collabs', paidCollabs, DollarSign, 'green')}
                        {statCard('Total Paid', `$${totalPaid.toFixed(0)}`, Banknote, 'gray')}
                        {statCard('Follow-ups Due', overdueFollowUps.length + dueTodayFollowUps.length, Clock, 'orange')}
                    </div>

                    {/* Follow-up reminders */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Follow-Up Reminders</h3>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                {overdueFollowUps.length + dueTodayFollowUps.length} needing attention
                            </span>
                        </div>
                        {(overdueFollowUps.length + dueTodayFollowUps.length) === 0 ? (
                            <p className="text-gray-500 text-sm">No follow-ups due. Keep the pipeline moving.</p>
                        ) : (
                            <div className="space-y-3">
                                {[...overdueFollowUps, ...dueTodayFollowUps].slice(0, 8).map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm font-bold">{c.name}</div>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                {categoryBadge(c.category)}
                                                {overdueBadge(c.follow_up_date)}
                                            </div>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                                {c.status}
                                            </div>
                                            <div className="text-xs font-mono text-white">{c.handle}</div>
                                        </div>
                                        <button
                                            onClick={() => { setView('table'); openEdit(c); }}
                                            className="text-[9px] font-bold uppercase tracking-widest text-brand-accent hover:text-white"
                                        >
                                            Open
                                        </button>
                                    </div>
                                ))}
                                {(overdueFollowUps.length + dueTodayFollowUps.length) > 8 && (
                                    <div className="text-center py-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                        View all in Tracker tab
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Recent activity */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <h3 className="text-xl font-bold uppercase tracking-tighter text-white mb-4">Recent Activity</h3>
                        {contacts.slice(0, 10).length === 0 ? (
                            <p className="text-gray-500 text-sm">No outreach activity yet. Log your first contact.</p>
                        ) : (
                            <div className="space-y-3">
                                {contacts.slice(0, 10).map((c) => (
                                    <div key={c.id} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm font-bold">{c.name}</div>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                {categoryBadge(c.category)}
                                                <span className="text-gray-600">{c.date}</span>
                                            </div>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{c.status}</div>
                                            <div className="text-xs font-mono text-white">{c.handle}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search name, handle, notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm w-[200px] focus:border-brand-accent/50 outline-none transition-all"
                            />
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value as Category | 'all')}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-accent/50 outline-none transition-all"
                        >
                            <option value="all">All Categories</option>
                            <option value="Brand">Brands</option>
                            <option value="Model">Models / Sponsors</option>
                            <option value="Community">Community</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-accent/50 outline-none transition-all"
                        >
                            <option value="all">All Statuses</option>
                            {STATUS_ORDER.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                setCategoryFilter('all');
                                setStatusFilter('all');
                                setSearchQuery('');
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white"
                        >
                            Clear filters
                        </button>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5">
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Date</th>
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Contact</th>
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Category</th>
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Platform</th>
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Status</th>
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Follow-up</th>
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Item / Paid</th>
                                        <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-20 text-center text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                                                No matching contacts. Log your first outreach.
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((c) => (
                                            <tr key={c.id} className="group hover:bg-white/[0.02] transition-all">
                                                <td className="py-5 px-4">
                                                    <span className="text-xs font-mono text-gray-400">{c.date}</span>
                                                </td>
                                                <td className="py-5 px-4">
                                                    <div className="text-sm font-bold uppercase tracking-tight">{c.name}</div>
                                                    <span className="text-[10px] text-gray-600 font-mono">@{c.handle}</span>
                                                    {c.link && (
                                                        <a
                                                            href={c.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] text-brand-accent font-bold uppercase tracking-widest mt-1 inline-block hover:text-white"
                                                        >
                                                            Open profile
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="py-5 px-4">{categoryBadge(c.category)}</td>
                                                <td className="py-5 px-4">
                                                    <span className="text-[10px] font-mono text-gray-400 uppercase">{c.platform}</span>
                                                    {c.message_variant && (
                                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-gray-400">
                                                            V{c.message_variant}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-5 px-4">{statusBadge(c.status)}</td>
                                                <td className="py-5 px-4 text-right">
                                                    {c.follow_up_date ? (
                                                        <div className="space-y-1">
                                                            <span className="text-xs font-mono">{c.follow_up_date}</span>
                                                            {overdueBadge(c.follow_up_date)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-600">—</span>
                                                    )}
                                                </td>
                                                <td className="py-5 px-4 text-right">
                                                    <div className="text-left">
                                                        {c.item_sent && (
                                                            <div className="text-xs font-bold">{c.item_sent}</div>
                                                        )}
                                                        {c.payment_type === 'paid' && c.payment_amount && (
                                                            <div className="text-[10px] text-green-400 font-bold">${c.payment_amount.toFixed(0)}</div>
                                                        )}
                                                        {c.payment_type === 'paid' && c.commission_paid && (
                                                            <span className="text-[9px] text-green-500 uppercase tracking-widest">commission paid</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openEdit(c)}
                                                            className="p-2 border border-white/10 rounded-sm hover:bg-white hover:text-black transition-all"
                                                            title="Edit"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteContact(c.id)}
                                                            className="p-2 border border-white/10 rounded-sm hover:bg-red-500 hover:text-white transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {filtered.length > 0 && (
                            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/5">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    {filtered.length} of {totalContacts} contacts
                                </span>
                                <button
                                    onClick={() => {
                                        const csvHeaders = [
                                            'Date','Category','Name','Handle','Platform','Link','Message Variant','Status',
                                            'Follow-up Date','Notes','Item Sent','Item Sent Date','Picture Received',
                                            'Picture Date','Posted','Posted Platform','Payment Type','Payment Amount',
                                            'Payment Date','Commission Paid',
                                        ];
                                        const rows = filtered.map((c) => [
                                            c.date, c.category, c.name, c.handle, c.platform, c.link,
                                            c.message_variant, c.status, c.follow_up_date || '', c.notes,
                                            c.item_sent || '', c.item_sent_date || '', c.picture_received ? 'yes' : 'no',
                                            c.picture_date || '', c.posted ? 'yes' : 'no', c.posted_platform || '',
                                            c.payment_type, c.payment_amount || '', c.payment_date || '',
                                            c.commission_paid ? 'yes' : 'no',
                                        ]);
                                        const csv = [
                                            csvHeaders,
                                            ...rows.map((r) => r.map((cell) =>
                                                String(cell).includes(',') ? '"' + String(cell).replace(/"/g, '""') + '"' : String(cell)
                                            ).join(',')),
                                        ].join('\n');
                                        const blob = new Blob([csv], { type: 'text/csv' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `coalition-outreach-${today}.csv`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                        addToast('Exported CSV.', 'success');
                                    }}
                                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                >
                                    <Download className="w-3 h-3" /> Export CSV
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add / Edit form */}
            {editing && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div
                        ref={editPanelRef}
                        className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        aria-label={editing.id ? 'Edit contact' : 'Log new contact'}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold uppercase tracking-tighter text-white">
                                {editing.id ? 'Edit Contact' : 'Log New Contact'}
                            </h3>
                            <button
                                onClick={closeEdit}
                                disabled={isSaving}
                                className="text-gray-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Close modal"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Date</label>
                                    <input
                                        type="date"
                                        value={editing.date}
                                        onChange={(e) => updateField('date', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Category</label>
                                    <select
                                        value={editing.category}
                                        onChange={(e) => updateField('category', e.target.value as Category)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-accent/50 outline-none transition-all"
                                    >
                                        <option value="Brand">Brand / Potential Customer</option>
                                        <option value="Model">Model / Sponsor</option>
                                        <option value="Community">Community / Random</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Name</label>
                                    <input
                                        type="text"
                                        value={editing.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        placeholder="Example Boutique"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Handle</label>
                                    <input
                                        type="text"
                                        value={editing.handle}
                                        onChange={(e) => updateField('handle', e.target.value)}
                                        placeholder="@exampleboutique"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Platform</label>
                                    <select
                                        value={editing.platform}
                                        onChange={(e) => updateField('platform', e.target.value as Platform)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-accent/50 outline-none transition-all"
                                    >
                                        <option value="Instagram">Instagram</option>
                                        <option value="Twitter">Twitter / X</option>
                                        <option value="TikTok">TikTok</option>
                                        <option value="YouTube">YouTube</option>
                                        <option value="Discord">Discord</option>
                                        <option value="Email">Email</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Message Variant</label>
                                    <select
                                        value={editing.message_variant}
                                        onChange={(e) => updateField('message_variant', e.target.value as MessageVariant)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-accent/50 outline-none transition-all"
                                    >
                                        <option value="A">Variant A</option>
                                        <option value="B">Variant B</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Status</label>
                                    <select
                                        value={editing.status}
                                        onChange={(e) => updateField('status', e.target.value as Status)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-accent/50 outline-none transition-all"
                                    >
                                        {STATUS_ORDER.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Link (profile / linktree)</label>
                                <input
                                    type="url"
                                    value={editing.link}
                                    onChange={(e) => updateField('link', e.target.value)}
                                    placeholder="https://instagram.com/..."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Follow-up Date</label>
                                <input
                                    type="date"
                                    value={editing.follow_up_date || ''}
                                    onChange={(e) => updateField('follow_up_date', e.target.value || null)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                />
                                <p className="text-[10px] text-gray-600 mt-1">Set a reminder to follow up. Overdue dates show in red.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Notes</label>
                                <textarea
                                    value={editing.notes}
                                    onChange={(e) => updateField('notes', e.target.value)}
                                    rows={3}
                                    placeholder="Whats been discussed, what was sent, next steps..."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                />
                            </div>

                            {/* Fulfillment section */}
                            <div className="pt-6 border-t border-white/10 space-y-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Fulfillment</h4>

                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Item Sent</label>
                                        <input
                                            type="text"
                                            value={editing.item_sent || ''}
                                            onChange={(e) => updateField('item_sent', e.target.value || null)}
                                            placeholder="e.g. Coalition Parts Wallet"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Item Sent Date</label>
                                        <input
                                            type="date"
                                            value={editing.item_sent_date || ''}
                                            onChange={(e) => updateField('item_sent_date', e.target.value || null)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1 flex items-center gap-1">
                                            <ImageIcon className="w-3 h-3" /> Picture Received
                                        </label>
                                        <button
                                            onClick={() => toggleBoolean('picture_received')}
                                            className={`w-full py-2 rounded-lg border transition-all ${
                                                editing.picture_received
                                                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            } flex items-center justify-center gap-2`}
                                        >
                                            {editing.picture_received ? 'Yes' : 'No'}
                                        </button>
                                        {editing.picture_received && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Picture Date</label>
                                                <input
                                                    type="date"
                                                    value={editing.picture_date || ''}
                                                    onChange={(e) => updateField('picture_date', e.target.value || null)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1 flex items-center gap-1">
                                        <Volume2 className="w-3 h-3" /> Posted
                                    </label>
                                    <button
                                        onClick={() => toggleBoolean('posted')}
                                        className={`w-full py-2 rounded-lg border transition-all ${
                                            editing.posted
                                                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                        } flex items-center justify-center gap-2`}
                                    >
                                        {editing.posted ? 'Yes' : 'No'}
                                    </button>
                                    {editing.posted && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Posted Platform</label>
                                            <input
                                                type="text"
                                                value={editing.posted_platform || ''}
                                                onChange={(e) => updateField('posted_platform', e.target.value || null)}
                                                placeholder="e.g. Instagram"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Payment Type</label>
                                        <select
                                            value={editing.payment_type}
                                            onChange={(e) => updateField('payment_type', e.target.value as PaymentType)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-accent/50 outline-none transition-all"
                                        >
                                            <option value="free">Free (gift)</option>
                                            <option value="paid">Paid</option>
                                            <option value="pending">Pending</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Amount ($)</label>
                                        <input
                                            type="number"
                                            value={editing.payment_amount ?? ''}
                                            onChange={(e) => updateField('payment_amount', e.target.value ? parseFloat(e.target.value) : null)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Payment Date</label>
                                        <input
                                            type="date"
                                            value={editing.payment_date || ''}
                                            onChange={(e) => updateField('payment_date', e.target.value || null)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-brand-accent/50 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Commission Paid
                                    </label>
                                    <button
                                        onClick={() => toggleBoolean('commission_paid')}
                                        className={`w-full py-2 rounded-lg border transition-all ${
                                            editing.commission_paid
                                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                        } flex items-center justify-center gap-2`}
                                    >
                                        {editing.commission_paid ? 'Yes' : 'No'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 bg-brand-accent text-white font-bold uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-brand-accent/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-accent/20"
                                >
                                    {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Contact
                                </button>
                                <button
                                    type="button"
                                    onClick={closeEdit}
                                    disabled={isSaving}
                                    className="flex-1 border border-white/10 text-gray-400 font-bold uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-white/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutreachTracker;