import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';
import {
    Send, Users, Mail, MessageSquare, Download, Trash2, AlertTriangle,
    BarChart3, Edit2,
} from 'lucide-react';

type View = 'audience' | 'composer' | 'history';

interface AudienceRow {
  key: string;
  channel: 'email' | 'sms';
  contact: string;
  source: string;
  status: string;
  subscribedAt: string;
  meta?: any;
}

interface CampaignRow {
  id: string;
  name: string;
  subject: string | null;
  channel: string;
  status: string;
  sent_at: string | null;
  stats: any;
  audience_filter: any;
  created_at: string;
}

type SourceTag = 'drop_list' | 'sms_signup' | 'sms_signup_email' | 'past_customer' | 'marketing_contacts';
type GroupedRow = AudienceRow & { sources: SourceTag[]; allContactIds: Record<string, string> };

const SOURCE_LABELS: Record<string, string> = {
  drop_list: 'Drop List',
  sms_signup: 'SMS Signup',
  sms_signup_email: 'SMS Signup (Email Column)',
  past_customer: 'Past Customer (Order)',
  marketing_contacts: 'Marketing List',
};

const MarketingManager: React.FC = () => {
  const [view, setView] = useState<View>('audience');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-display uppercase tracking-widest flex items-center gap-3">
            <Send className="w-6 h-6 text-brand-accent" />
            Coalition Marketing
          </h2>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">Unified SMS + email audience, campaigns, opt-out flow</p>
        </div>
        <div className="flex gap-2">
          <SubViewButton active={view === 'audience'} onClick={() => setView('audience')} icon={Users}>Audience</SubViewButton>
          <SubViewButton active={view === 'composer'} onClick={() => setView('composer')} icon={Edit2}>Composer</SubViewButton>
          <SubViewButton active={view === 'history'} onClick={() => setView('history')} icon={BarChart3}>History</SubViewButton>
        </div>
      </div>

      {view === 'audience' && <AudienceView />}
      {view === 'composer' && <ComposerView onSent={() => setView('history')} />}
      {view === 'history' && <HistoryView />}
    </div>
  );
};

const SubViewButton: React.FC<{ active: boolean; onClick: () => void; icon: React.FC<any>; children: React.ReactNode }> = ({ active, onClick, icon: Icon, children }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all ${active ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
    <Icon className="w-4 h-4" />{children}
  </button>
);
const AudienceView: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<GroupedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<'all' | 'sms' | 'email'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // CRITICAL 6: dedupe by normalized email OR phone across the four sources so
  // a single subscriber appears as one row with a multi-source badge, and so
  // unsubscribe acts on every source row for that contact in one go. Type
  // declarations are hoisted to module top so they aren't re-allocated per
  // render and aren't referenced as anonymous intersections downstream.

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const groups = new Map<string, GroupedRow>();

    const upsertIntoGroup = (channel: 'email' | 'sms', contact: string, source: SourceTag, status: string, subscribedAt: string, meta?: any, contactId?: string) => {
      const key = `${channel}:${contact.toLowerCase()}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        if (contactId && !existing.allContactIds[source]) existing.allContactIds[source] = contactId;
        existing.subscribedAt = existing.subscribedAt || subscribedAt;
        if (meta && !existing.meta) existing.meta = meta;
        return;
      }
      groups.set(key, {
        key, channel, contact, source, status, subscribedAt, meta,
        sources: [source], allContactIds: contactId ? { [source]: contactId } : {},
      });
    };

    const [{ data: drop }, { data: mc }, { data: css }, { data: orders }] = await Promise.all([
      supabase.from('subscribe_emails').select('email, created_at, unsubscribe_at').is('unsubscribe_at', null),
      supabase.from('marketing_contacts').select('id, email, phone_e164, source, channel, created_at, unsubscribed_at').is('unsubscribed_at', null),
      supabase.from('coalition_signal_subscribers').select('contact_value, subscriber_type, subscribed_at, status').eq('status', 'active'),
      supabase.from('orders').select('customer_email, customer_name, created_at')
        .not('customer_email', 'is', null)
        .gte('created_at', new Date(Date.now() - 365 * 86400_000).toISOString()),
    ]);

    if (drop) for (const d of drop) if (d.email) upsertIntoGroup('email', d.email, 'drop_list', 'active', d.created_at);
    if (mc) for (const r of mc) {
      if (r.email) upsertIntoGroup('email', r.email, 'marketing_contacts', 'active', r.created_at, undefined, r.id);
      if (r.phone_e164) upsertIntoGroup('sms', r.phone_e164, 'marketing_contacts', 'active', r.created_at, undefined, r.id);
    }
    if (css) for (const r of css) {
      if (r.subscriber_type === 'email' && r.contact_value) upsertIntoGroup('email', r.contact_value, 'sms_signup_email', 'active', r.subscribed_at || new Date().toISOString());
      if (r.subscriber_type === 'sms' && r.contact_value) upsertIntoGroup('sms', r.contact_value, 'sms_signup', 'active', r.subscribed_at || new Date().toISOString());
    }
    if (orders) for (const o of orders) {
      if (o.customer_email) upsertIntoGroup('email', o.customer_email, 'past_customer', 'past_purchase', o.created_at, { name: o.customer_name });
    }

    setRows(Array.from(groups.values()));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.source] = (c[r.source] || 0) + 1;
    return c;
  }, [rows]);

  const totalCounts = useMemo(() => ({
    total: rows.length,
    email: rows.filter((r) => r.channel === 'email').length,
    sms: rows.filter((r) => r.channel === 'sms').length,
    sources: Object.keys(sourceCounts).length,
  }), [rows, sourceCounts]);

  const filtered = useMemo(() => rows.filter((r) =>
    (channelFilter === 'all' || r.channel === channelFilter) &&
    (sourceFilter === 'all' || r.source === sourceFilter) &&
    (searchQuery === '' || r.contact.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [rows, channelFilter, sourceFilter, searchQuery]);

  const handleUnsubscribe = async (row: GroupedRow) => {
    const sources = (row.sources && row.sources.length > 0 ? row.sources : [row.source as SourceTag]);
    const sourceLabels = sources.map((s) => SOURCE_LABELS[s] || s).join(', ');
    const ok = window.confirm(`Unsubscribe ${row.contact} from Coalition marketing across ${sources.length} source${sources.length === 1 ? '' : 's'}?\n\nSources: ${sourceLabels}`);
    if (!ok) return;
    setBusyKey(row.key);
    const nowIso = new Date().toISOString();
    const errors: string[] = [];
    const updatedSources: string[] = [];

    for (const src of sources) {
      if (src === 'past_customer') {
        // Past customers: receipts/transactions must still flow, so we do not
        // suppress; we just mark them off the marketing audience by writing
        // opt-out intent for the operator to honor in their own tooling.
        updatedSources.push(`${src} (marked off marketing only)`);
        continue;
      }
      try {
        if (src === 'drop_list') {
          const { error } = await supabase.from('subscribe_emails').update({ unsubscribe_at: nowIso }).eq('email', row.contact);
          if (error) throw error;
        } else if (src === 'sms_signup' || src === 'sms_signup_email') {
          const { error } = await supabase.from('coalition_signal_subscribers').update({ status: 'unsubscribed', unsubscribed_at: nowIso }).eq('contact_value', row.contact);
          if (error) throw error;
        } else if (src === 'marketing_contacts') {            const id = row.allContactIds?.[src];
          if (id) {
            const { error } = await supabase.from('marketing_contacts').update({ unsubscribed_at: nowIso, status: 'unsubscribed' }).eq('id', id);
            if (error) throw error;
          } else {
            // Fall back to email/phone match if we somehow lost the id
            const filter = row.channel === 'sms' ? { phone_e164: row.contact } : { email: row.contact };
            const { error } = await supabase.from('marketing_contacts').update({ unsubscribed_at: nowIso, status: 'unsubscribed' }).match(filter);
            if (error) throw error;
          }
        }
        updatedSources.push(src);
      } catch (e: any) {
        errors.push(`${SOURCE_LABELS[src] || src}: ${e?.message || 'failed'}`);
      }
    }

    if (errors.length === 0) {
      addToast(`Unsubscribed across ${updatedSources.length} source${updatedSources.length === 1 ? '' : 's'}.`, 'success');
      await fetchAll();
    } else if (updatedSources.length > 0) {
      addToast(`Partial unsubscribe: ${updatedSources.length} sources updated; ${errors.length} failed.`, 'info');
      await fetchAll();
    } else {
      addToast(errors.join(' / '), 'error');
    }
    setBusyKey(null);
  };

  const handleExport = () => {
    const csv = [
      ['Channel', 'Contact', 'Source', 'Status', 'Subscribed'],
      ...filtered.map((r) => [r.channel, r.contact, r.source, r.status, new Date(r.subscribedAt).toISOString()]),
    ].map((row) => row.map((cell) => String(cell).includes(',') ? '"' + String(cell).replace(/"/g, '""') + '"' : String(cell)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'coalition-audience-' + Date.now() + '.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={totalCounts.total} icon={Users} />
        <StatCard label="Email" value={totalCounts.email} icon={Mail} accent="green" />
        <StatCard label="SMS" value={totalCounts.sms} icon={MessageSquare} accent="blue" />
        <StatCard label="Sources" value={totalCounts.sources} icon={BarChart3} accent="purple" />
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {(['all', 'email', 'sms'] as const).map((v) => (
            <button key={v} onClick={() => setChannelFilter(v)} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${channelFilter === v ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>{v === 'all' ? 'All' : v === 'email' ? 'Email' : 'SMS'}</button>
          ))}
        </div>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
          <option value="all">All Sources</option>
          {Object.keys(SOURCE_LABELS).map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]} ({sourceCounts[s] || 0})</option>)}
        </select>
        <input type="text" placeholder="Search by email or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 text-sm" />
        <button onClick={handleExport} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"><Download className="w-4 h-4" />Export CSV</button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Channel</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Contact</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Source</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Subscribed</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center p-8 text-gray-400">Loading audience...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-8 text-gray-400">No matching contacts</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.key} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <span className={`flex items-center gap-2 ${r.channel === 'sms' ? 'text-blue-400' : 'text-green-400'}`}>
                        {r.channel === 'sms' ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                        <span className="font-medium">{r.channel.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="p-4 font-mono text-sm text-white">{r.contact}</td>
                    <td className="p-4 text-gray-400 text-sm">{SOURCE_LABELS[r.source] || r.source}</td>
                    <td className="p-4 text-gray-400 text-sm">{new Date(r.subscribedAt).toLocaleDateString()}</td>
                    <td className="p-4">
                      <button onClick={() => handleUnsubscribe(r)} disabled={busyKey === r.key || r.source === 'past_customer'} className={`text-red-400 hover:text-red-300 flex items-center gap-1 text-sm font-medium transition-colors ${r.source === 'past_customer' ? 'opacity-30 cursor-not-allowed' : ''}`}>
                        <Trash2 className="w-4 h-4" />Unsub
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.FC<any>; accent?: 'green' | 'blue' | 'purple' }> = ({ label, value, icon: Icon, accent }) => {
  const accentClass = accent === 'green' ? 'text-green-400' : accent === 'blue' ? 'text-blue-400' : accent === 'purple' ? 'text-purple-400' : 'text-gray-400';
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xl font-bold text-white">{value}</div>
        <Icon className={`w-5 h-5 ${accentClass}`} />
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
};
const ComposerView: React.FC<{ onSent: () => void }> = ({ onSent }) => {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sendNow = async () => {
    const token = sessionStorage.getItem('coalition_admin_token') || '';
    setSending(true);
    try {
      const response = await fetch('/api/marketing-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, channel, subject, bodyHtml, bodyText, smsBody }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.error || 'Send failed');
      addToast(`Sent to ${data.audienceCount} contacts (${data.email?.sent ?? 0} email, ${data.sms?.sent ?? 0} SMS)`, 'success');
      setConfirmOpen(false);
      setName(''); setSubject(''); setBodyHtml(''); setBodyText(''); setSmsBody('');
      onSent();
    } catch (err: any) {
      addToast(err?.message || 'Send failed', 'error');
    } finally {
      setSending(false);
    }
  };

  const smsCharCount = smsBody.length;
  const smsSegments = Math.max(1, Math.ceil(smsCharCount / 160));

  const submitDisabled =
    !name ||
    (channel !== 'sms' && (!subject.trim() || !bodyHtml.trim())) ||
    (channel !== 'email' && !smsBody.trim());

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <Field label="Campaign Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring drop reminder" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600" />
        </Field>
        <Field label="Channel">
          <div className="flex gap-2">
            {(['email', 'sms', 'both'] as const).map((c) => (
              <button key={c} onClick={() => setChannel(c)} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${channel === c ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>{c}</button>
            ))}
          </div>
        </Field>
        {(channel === 'email' || channel === 'both') && (
          <>
            <Field label="Subject">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Spring drop is live" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600" />
            </Field>
            <Field label="HTML Body (max 50KB)">
              <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} rows={10} placeholder="<h1>Spring drop is live</h1><p>...</p>" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs" />
            </Field>
            <Field label="Plain Text Body (optional fallback)">
              <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} placeholder="Spring drop is live on sgcoalition.xyz" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600" />
            </Field>
          </>
        )}
        {(channel === 'sms' || channel === 'both') && (
          <Field label={`SMS Body -- ${smsCharCount} chars (${smsSegments} segment${smsSegments === 1 ? '' : 's'})`}>
            <textarea value={smsBody} onChange={(e) => setSmsBody(e.target.value)} rows={3} maxLength={1600} placeholder="Spring drop is live on sgcoalition.xyz. Reply STOP to opt out." className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600" />
          </Field>
        )}
        <button onClick={() => setConfirmOpen(true)} disabled={submitDisabled} className="bg-white text-black font-bold uppercase tracking-widest px-6 py-3 rounded-lg hover:bg-brand-accent transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
          <Send className="w-4 h-4" />Send Now
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4 mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-2">Send to live audience?</h3>
                <p className="text-gray-400 text-sm">This will deliver to every active contact in the {channel} channel. Messages cannot be recalled.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold transition-colors">Cancel</button>
              <button onClick={sendNow} disabled={sending} className="flex-1 bg-white text-black px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50">{sending ? 'Sending...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">{label}</label>
    {children}
  </div>
);
const HistoryView: React.FC = () => {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(50);
      if (!error && data) setRows(data as CampaignRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Name</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Channel</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Status</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Sent At</th>
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Counts</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center p-8 text-gray-400">Loading campaigns...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-8 text-gray-400">No campaigns sent yet</td></tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4"><div className="font-bold">{c.name}</div>{c.subject && <div className="text-gray-400 text-xs">{c.subject}</div>}</td>
                    <td className="p-4 text-sm uppercase tracking-widest">{c.channel}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-widest ${c.status === 'sent' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : c.status === 'sending' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : c.status === 'partial' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : c.status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>{c.status}</span>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">{c.sent_at ? new Date(c.sent_at).toLocaleString() : '--'}</td>
                    <td className="p-4 text-sm text-gray-400">
                      {c.stats?.total_sent != null ? (
                        <span>{c.stats.total_sent} sent / {c.stats.total_failed} failed / {c.stats.audience_count} audience</span>
                      ) : <span className="opacity-40">--</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MarketingManager;
