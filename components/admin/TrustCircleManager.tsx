import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, XCircle, Search, Send, Trash2, Ticket } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../services/supabase';
import {
    getApplications,
    reviewApplication,
    inviteUser,
    revokeMember,
    issueDropVoucher,
    TRUST_CIRCLE_FLAT_RATE,
    type TrustCircleApplication,
} from '../../services/trustCircle';

interface CircleMemberRow {
    user_id: string;
    referral_code: string;
    partner_tier: string;
    trust_circle_commission_rate: number | null;
    circle_member_since: string | null;
    email?: string;
}

interface ApplicantContext {
    id: string;
    email?: string;
    full_name?: string;
    lifetime_orders?: number | null;
    lifetime_spend_usd?: number | null;
}

const TrustCircleManager: React.FC = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [applications, setApplications] = useState<TrustCircleApplication[]>([]);
    const [members, setMembers] = useState<CircleMemberRow[]>([]);
    const [applicantContext, setApplicantContext] = useState<ApplicantContext[]>([]);
    const [searchEmail, setSearchEmail] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [busy, setBusy] = useState<string | null>(null);

    // Batch-fetch lifetime order stats for the pending applicants so the
    // vetting view shows real-customer context (order count + spend) inline.
    const fetchApplicantContext = async (apps: TrustCircleApplication[]) => {
        const pendingIds = apps.filter(a => a.status === 'pending').map(a => a.user_id);
        if (pendingIds.length === 0) return;
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, lifetime_orders, lifetime_spend_usd, email, full_name')
            .in('id', pendingIds);
        if (profiles) setApplicantContext(profiles as ApplicantContext[]);
    };

    const reload = async () => {
        const apps = await getApplications();
        setApplications(apps);
        void fetchApplicantContext(apps);
        const { data } = await supabase
            .from('referral_stats')
            .select('user_id, referral_code, partner_tier, trust_circle_commission_rate, circle_member_since')
            .eq('partner_tier', 'trust_circle');
        setMembers((data as CircleMemberRow[]) || []);
    };

    useEffect(() => { void reload(); }, []);

    const handleApprove = async (app: TrustCircleApplication) => {
        setBusy(app.id);
        const result = await reviewApplication(app.id, true, '', user?.uid || '');
        if (result.success) addToast(`${app.user_id} joined the Trust Circle.`, 'success');
        else addToast(result.error || 'Approval failed.', 'error');
        await reload();
        setBusy(null);
    };

    const handleDecline = async (app: TrustCircleApplication) => {
        setBusy(app.id);
        const result = await reviewApplication(app.id, false, '', user?.uid || '');
        if (result.success) addToast('Application declined.', 'success');
        else addToast(result.error || 'Decline failed.', 'error');
        await reload();
        setBusy(null);
    };

    const handleInvite = async () => {
        if (!searchResult) return;
        const result = await inviteUser(searchResult.id);
        if (result.success) addToast(`Invited ${searchResult.email}.`, 'success');
        else addToast(result.error || 'Invite failed.', 'error');
    };

    const handleRevoke = async (userId: string) => {
        const result = await revokeMember(userId);
        if (result.success) addToast('Membership revoked.', 'success');
        else addToast(result.error || 'Revoke failed.', 'error');
        await reload();
    };

    const handleDropVoucher = async (member: CircleMemberRow) => {
        const code = `DROP-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
        const { error } = await supabase.from('coupons').insert({
            code,
            discount_type: 'percent',
            discount_value: 100,
            min_order_value: 0,
            max_uses: 1,
            is_active: true,
        });
        if (error) { addToast('Coupon creation failed.', 'error'); return; }
        const result = await issueDropVoucher(member.user_id, code);
        if (result.success) addToast(`Drop voucher ${code} issued.`, 'success');
        else addToast(result.error || 'Voucher ledger failed.', 'error');
    };

    const searchUser = async () => {
        if (!searchEmail.trim()) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .ilike('email', `%${searchEmail.trim()}%`)
            .limit(5);
        if (error) { addToast('Search failed.', 'error'); return; }
        setSearchResult(data?.[0] || null);
        if (!data?.length) addToast('No user found.', 'error');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-purple-400" />
                <div>
                    <h2 className="text-xl font-bold text-white">Trust Circle</h2>
                    <p className="text-gray-400 text-sm">Brand team — flat {TRUST_CIRCLE_FLAT_RATE}% rate, free drops, early access.</p>
                </div>
            </div>

            {/* Applications queue */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Applications</h3>
                {applications.filter(a => a.status === 'pending').length === 0 ? (
                    <p className="text-gray-500 text-sm">No pending applications.</p>
                ) : (
                    <div className="space-y-4">
                        {applications.filter(a => a.status === 'pending').map((app) => (
                            <div key={app.id} className="bg-black/30 border border-white/10 rounded-lg p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-bold text-white">{app.why_join}</p>
                                        <p className="text-sm text-gray-400 mt-1">{app.what_you_create}</p>
                                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                            <span className="text-gray-500">{app.platforms.join(', ') || '—'}</span>
                                            {app.handles && Object.entries(app.handles).map(([k, v]) => (
                                                <span key={k} className="text-purple-300">{k}: {String(v)}</span>
                                            ))}
                                            {app.audience_size && <span className="text-emerald-400">{app.audience_size}</span>}
                                        </div>
                                        {app.portfolio_url && (
                                            <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer"
                                               className="text-xs text-blue-400 underline mt-1 inline-block">{app.portfolio_url}</a>
                                        )}
                                        {(() => {
                                            const ctx = applicantContext.find(c => c.id === app.user_id);
                                            return ctx ? (
                                                <p className="text-[11px] text-gray-400 mt-2">
                                                    {ctx.email || 'No email on file'} · {ctx.lifetime_orders ?? 0} orders ·
                                                    ${(ctx.lifetime_spend_usd ?? 0).toFixed(2)} lifetime spend
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-gray-600 mt-2 font-mono">User: {app.user_id}</p>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex flex-col gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleApprove(app)}
                                            disabled={busy === app.id}
                                            className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition"
                                        >
                                            {busy === app.id ? '…' : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve</>}
                                        </button>
                                        <button
                                            onClick={() => handleDecline(app)}
                                            disabled={busy === app.id}
                                            className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500/20 transition"
                                        >
                                            <XCircle className="w-3.5 h-3.5" /> Decline
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Invite */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Send className="w-4 h-4" /> Invite to Trust Circle</h3>
                <div className="flex gap-2">
                    <input
                        value={searchEmail}
                        onChange={e => setSearchEmail(e.target.value)}
                        placeholder="Search by email…"
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                    />
                    <button onClick={searchUser} className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-gray-200 transition">
                        <Search className="w-4 h-4" /> Search
                    </button>
                    {searchResult && (
                        <button onClick={handleInvite} className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-purple-600 transition">
                            <Send className="w-4 h-4" /> Invite {searchResult.email}
                        </button>
                    )}
                </div>
            </div>

            {/* Members */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Current Members</h3>
                {members.length === 0 ? (
                    <p className="text-gray-500 text-sm">No Trust Circle members yet.</p>
                ) : (
                    <div className="space-y-3">
                        {members.map((m) => (
                            <div key={m.user_id} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-4 py-3">
                                <div>
                                    <p className="text-sm font-bold text-white font-mono">{m.referral_code}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{m.user_id}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-emerald-400 font-bold">{m.trust_circle_commission_rate ?? TRUST_CIRCLE_FLAT_RATE}%</span>
                                    <button
                                        onClick={() => handleDropVoucher(m)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition"
                                        title="Issue 100%-off drop voucher"
                                    >
                                        <Ticket className="w-3.5 h-3.5" /> Drop
                                    </button>
                                    <button
                                        onClick={() => handleRevoke(m.user_id)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrustCircleManager;
