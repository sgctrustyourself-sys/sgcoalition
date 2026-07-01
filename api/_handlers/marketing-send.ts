// /api/marketing-send
// Admin-only POST: dispatch a campaign through Resend (email) + Twilio (SMS).
// Writes marketing_campaigns + per-recipient marketing_sends rows.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { setCorsHeaders } from '../_helpers';
import type { ApiRequest, ApiResponse, MarketingAudienceRow, MarketingChannel, ResendEmailPayload } from '../_types';

let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
    if (cachedAdminClient) return cachedAdminClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    cachedAdminClient = createClient(url, key, { auth: { persistSession: false } });
    return cachedAdminClient;
}

function getResendFromAddress(): string {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

function isAdminAuthorized(authHeader: string | undefined): boolean {
    const expected = process.env.ADMIN_BROADCAST_TOKEN;
    const sessionToken = process.env.ADMIN_SESSION_TOKEN;
    if (!authHeader) return false;
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (!bearer) return false;
    if (expected && bearer === expected) return true;
    if (sessionToken && bearer === sessionToken) return true;
    return false;
}

async function fetchAudience(
    admin: SupabaseClient,
    channel: MarketingChannel,
): Promise<MarketingAudienceRow[]> {
    const rows = new Map<string, MarketingAudienceRow>();

    if (channel === 'email' || channel === 'both') {
        const [dropRes, mcRes, cssRes, ordersRes] = await Promise.all([
            admin.from('subscribe_emails').select('email, unsubscribe_at').is('unsubscribe_at', null),
            admin.from('marketing_contacts').select('id, email, phone_e164, source, unsubscribed_at, unsubscribe_token')
                .is('unsubscribed_at', null).not('email', 'is', null),
            admin.from('coalition_signal_subscribers').select('contact_value, subscriber_type, status')
                .eq('subscriber_type', 'email').eq('status', 'active'),
            admin.from('orders').select('customer_email, customer_name, created_at')
                .not('customer_email', 'is', null)
                .gte('created_at', new Date(Date.now() - 365 * 86400_000).toISOString()),
        ]);
        if (dropRes.data) for (const r of dropRes.data) if (r.email) rows.set(`drop:${r.email.toLowerCase()}`, { email: r.email, phone: null, source: 'drop_list', unsubscribe_token: null });
        if (mcRes.data) for (const r of mcRes.data) if (r.email) {
            const key = `mc:${r.email.toLowerCase()}`;
            if (!rows.has(key)) rows.set(key, { id: r.id, email: r.email, phone: null, source: r.source || 'marketing_contacts', unsubscribe_token: r.unsubscribe_token || null });
        }
        if (cssRes.data) for (const r of cssRes.data) if (r.contact_value) {
            const k = `css:${r.contact_value.toLowerCase()}`;
            if (!rows.has(k)) rows.set(k, { email: r.contact_value, phone: null, source: 'sms_signup_email', unsubscribe_token: null });
        }
        if (ordersRes.data) {
            for (const o of ordersRes.data) if (o.customer_email) {
                const k = `order:${o.customer_email.toLowerCase()}`;
                if (!rows.has(k)) rows.set(k, { email: o.customer_email, phone: null, source: 'past_customer', unsubscribe_token: null });
            }
        }
    }

    if (channel === 'sms' || channel === 'both') {
        const [cssRes, mcRes] = await Promise.all([
            admin.from('coalition_signal_subscribers').select('contact_value, status')
                .eq('subscriber_type', 'sms').eq('status', 'active'),
            admin.from('marketing_contacts').select('id, email, phone_e164, source, unsubscribed_at, unsubscribe_token')
                .is('unsubscribed_at', null).not('phone_e164', 'is', null),
        ]);
        if (cssRes.data) for (const r of cssRes.data) if (r.contact_value) {
            const k = `css:${r.contact_value}`;
            if (!rows.has(k)) rows.set(k, { email: null, phone: r.contact_value, source: 'sms_signup', unsubscribe_token: null });
        }
        if (mcRes.data) for (const r of mcRes.data) if (r.phone_e164) {
            const k = `mc:${r.phone_e164}`;
            if (!rows.has(k)) rows.set(k, { id: r.id, email: r.email, phone: r.phone_e164, source: r.source || 'marketing_contacts', unsubscribe_token: r.unsubscribe_token || null });
        }
    }

    return Array.from(rows.values());
}
async function sendEmails(opts: {
    recipients: Array<{ id?: string; email: string; unsubscribe_url?: string }>;
    subject: string;
    html: string;
    text?: string;
    campaignId: string;
    contactIds: Map<string, string>;
    fallbackUnsubscribeUrl: string;
    admin: SupabaseClient;
}): Promise<{ sent: number; failed: number }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn('[marketing-send] RESEND_API_KEY not set; skipping', opts.recipients.length, 'email recipients');
        for (const r of opts.recipients) {
            await opts.admin.from('marketing_sends').upsert({
                campaign_id: opts.campaignId, contact_id: r.id || null, channel: 'email',
                status: 'failed', error: 'RESEND_API_KEY not configured',
            }, { onConflict: 'campaign_id,contact_id,channel', ignoreDuplicates: true });
        }
        return { sent: 0, failed: opts.recipients.length };
    }
    const resend = new Resend(apiKey);
    let sent = 0, failed = 0;
    for (const r of opts.recipients) {
        try {
            const footerHtml = buildUnsubscribeFooterHtml(r.unsubscribe_url, opts.fallbackUnsubscribeUrl);
            const html = (opts.html || '') + footerHtml;
            const headers: Record<string, string> = {};
            if (r.unsubscribe_url) {
                headers['List-Unsubscribe'] = `<${r.unsubscribe_url}>`;
                headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
            }
            const result = await resend.emails.send({
                from: getResendFromAddress(),
                to: [r.email],
                subject: opts.subject,
                html,
                text: opts.text,
                headers,
            } as Parameters<Resend['emails']['send']>[0]);
            const error = result?.error;
            const messageId = result?.data?.id ?? null;
            await opts.admin.from('marketing_sends').upsert({
                campaign_id: opts.campaignId, contact_id: r.id || null, channel: 'email',
                message_id: messageId,
                status: error ? 'failed' : 'delivered',
                error: error?.message || null,
                delivered_at: error ? null : new Date().toISOString(),
            }, { onConflict: 'campaign_id,contact_id,channel', ignoreDuplicates: true });
            if (error) failed += 1; else sent += 1;
        } catch (e: unknown) {
            failed += 1;
            const message = e instanceof Error ? e.message : 'send failed';
            await opts.admin.from('marketing_sends').upsert({
                campaign_id: opts.campaignId, contact_id: r.id || null, channel: 'email',
                status: 'failed', error: typeof message === 'string' ? message : 'send failed',
            }, { onConflict: 'campaign_id,contact_id,channel', ignoreDuplicates: true });
        }
    }
    return { sent, failed };
}

function buildUnsubscribeFooterHtml(url?: string | null, fallbackUrl?: string | null): string {
    const linkPart = url
        ? ` &middot; <a href="${url}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>`
        : (fallbackUrl
            ? ` &middot; <a href="${fallbackUrl}" style="color:#9ca3af;text-decoration:underline;">Manage preferences</a>`
            : '');
    return `\n<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #2a2a2a;padding-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#9ca3af;font-size:11px;line-height:1.6;"><tr><td align="center">\nSG Coalition &middot; Baltimore, Maryland<br>\nYou're receiving this because you opted in at sgcoalition.xyz.${linkPart}\n</td></tr></table>\n`;
}

function getCampaignSenderBaseUrl(): string {
    return (process.env.VITE_APP_URL || 'https://sgcoalition.xyz').replace(/\/+$/, '');
}

function appendStopGuidance(body: string): string {
    const tail = (body || '').slice(-12).toUpperCase();
    if (tail.includes('STOP')) return body;
    return `${body} Reply STOP to unsubscribe.`;
}

async function sendSmss(opts: {
    recipients: Array<{ id?: string; phone: string }>;
    body: string;
    campaignId: string;
    admin: SupabaseClient;
}): Promise<{ sent: number; failed: number }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
        console.warn('[marketing-send] Twilio env not set; skipping', opts.recipients.length, 'sms recipients');
        for (const r of opts.recipients) {
            await opts.admin.from('marketing_sends').upsert({
                campaign_id: opts.campaignId, contact_id: r.id || null, channel: 'sms',
                status: 'failed', error: 'Twilio env not configured',
            }, { onConflict: 'campaign_id,contact_id,channel', ignoreDuplicates: true });
        }
        return { sent: 0, failed: opts.recipients.length };
    }
    const twilioImport = await import('twilio');
    const Twilio = twilioImport.default ?? twilioImport;
    const client = (Twilio as unknown as (sid: string, token: string) => { messages: { create(opts: { to: string; from: string; body: string }): Promise<{ sid: string }> } })(sid, token);

    // CRITICAL 2.2: ensure every SMS body carries a Reply STOP reminder; Twilio
    // carriers + TCPA both expect this hint even when the sender forgot to type
    // it. Append only if not already present (case-insensitive last 12 chars).
    const body = appendStopGuidance(opts.body);

    let sent = 0, failed = 0;
    const tasks = opts.recipients.map(async (r) => {
        const result = await client.messages.create({ to: r.phone, from, body });
        return { contact: r, result };
    });
    const results = await Promise.allSettled(tasks);
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const recipient = opts.recipients[i];
        if (r.status === 'fulfilled') {
            sent += 1;
            await opts.admin.from('marketing_sends').upsert({
                campaign_id: opts.campaignId, contact_id: recipient.id || null, channel: 'sms',
                message_id: r.value?.result?.sid || null,
                status: 'delivered', delivered_at: new Date().toISOString(),
            }, { onConflict: 'campaign_id,contact_id,channel', ignoreDuplicates: true });
        } else {
            failed += 1;
            await opts.admin.from('marketing_sends').upsert({
                campaign_id: opts.campaignId, contact_id: recipient.id || null, channel: 'sms',
                status: 'failed', error: String(r.reason?.message || r.reason || 'send failed'),
            }, { onConflict: 'campaign_id,contact_id,channel', ignoreDuplicates: true });
        }
    }
    return { sent, failed };
}
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { methods: 'POST,OPTIONS' });

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : undefined;
    if (!isAdminAuthorized(authHeader)) {
        res.status(401).json({ error: 'Admin authorization required.' });
        return;
    }

    let body: Record<string, unknown> = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body === 'string') {
        try { body = JSON.parse(body) as Record<string, unknown>; } catch { body = {}; }
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
    const channel: MarketingChannel =
        body.channel === 'sms' || body.channel === 'email' || body.channel === 'both' ? body.channel : 'email';
    const subject = typeof body.subject === 'string' ? body.subject.slice(0, 200) : '';
    const bodyHtml = typeof body.bodyHtml === 'string' ? body.bodyHtml.slice(0, 50000) : '';
    const bodyText = typeof body.bodyText === 'string' ? body.bodyText.slice(0, 10000) : '';
    const smsBody = typeof body.smsBody === 'string' ? body.smsBody.slice(0, 1600) : '';

    if (!name) { res.status(400).json({ error: 'Campaign name is required.' }); return; }
    if ((channel === 'email' || channel === 'both') && (!subject || !bodyHtml)) {
        res.status(400).json({ error: 'Subject and HTML body are required for email campaigns.' }); return;
    }
    if ((channel === 'sms' || channel === 'both') && !smsBody) {
        res.status(400).json({ error: 'SMS body is required for sms campaigns.' }); return;
    }

    const admin = getSupabaseAdmin();
    if (!admin) { res.status(500).json({ error: 'Marketing service not configured.' }); return; }

    try {
        const { data: campaign, error: cErr } = await admin.from('marketing_campaigns').insert({
            name,
            subject: channel !== 'sms' ? subject : null,
            body_html: channel !== 'sms' ? bodyHtml : null,
            body_text: channel !== 'sms' ? bodyText : null,
            sms_body: channel !== 'email' ? smsBody : null,
            channel,
            status: 'sending',
            audience_filter: typeof body.audienceFilter === 'object' && body.audienceFilter !== null ? body.audienceFilter : {},
        }).select('*').single();
        if (cErr || !campaign) throw new Error(cErr?.message || 'Could not create campaign.');

        const audience = await fetchAudience(admin, channel);

        // CRITICAL 2: consent re-verification right before dispatch. Pull the
        // active contact set in one batch query and skip any audience row whose
        // id is not active at send time (covers a subscriber clicking unsubscribe
        // in the gap between fetchAudience and now).
        const candidateIds = audience.map((r) => r.id).filter((id): id is string => !!id);
        const activeIds = new Set<string>();
        if (candidateIds.length > 0) {
            const { data: stillActive } = await admin.from('marketing_contacts')
                .select('id')
                .in('id', candidateIds)
                .eq('status', 'active')
                .is('unsubscribed_at', null);
            for (const r of stillActive || []) activeIds.add(r.id);
        }

    const baseUrl = getCampaignSenderBaseUrl();
    const unsubUrlFor = (token: string | null) =>
        token ? `${baseUrl}/api/marketing-optout?token=${token}` : '';
    const fallbackUnsubscribeUrl = `${baseUrl}/#/sms-signup`;

        const emailRecipients: Array<{ id?: string; email: string; unsubscribe_url?: string }> = [];
        const smsRecipients: Array<{ id?: string; phone: string }> = [];
        const contactIds = new Map<string, string>();
        const tokenRefreshIds: string[] = [];
        for (const row of audience) {
            if (row.id && !activeIds.has(row.id)) continue;
            if ((channel === 'email' || channel === 'both') && row.email) {
                emailRecipients.push({ id: row.id, email: row.email, unsubscribe_url: unsubUrlFor(row.unsubscribe_token) });
                if (row.id) {
                    contactIds.set(row.email.toLowerCase(), row.id);
                    if (row.unsubscribe_token) tokenRefreshIds.push(row.id);
                }
            }
            if ((channel === 'sms' || channel === 'both') && row.phone) {
                smsRecipients.push({ id: row.id, phone: row.phone });
                if (row.id) contactIds.set(row.phone, row.id);
            }
        }

        // Refresh the unsubscribe-token-active window for every contact we
        // emailed, so /api/marketing-optout GET keeps accepting their link for
        // the next 365 days. Skipped when marketing_sends-no_dup already covers
        // a refresh on the latest send row.
        if (tokenRefreshIds.length > 0) {
            await admin.from('marketing_contacts').update({ updated_at: new Date().toISOString() }).in('id', tokenRefreshIds);
        }

        const emailResult = emailRecipients.length > 0 ? await sendEmails({
            recipients: emailRecipients, subject, html: bodyHtml, text: bodyText,
            campaignId: campaign.id, contactIds, fallbackUnsubscribeUrl, admin,
        }) : { sent: 0, failed: 0 };

        const smsResult = smsRecipients.length > 0 ? await sendSmss({
            recipients: smsRecipients, body: smsBody, campaignId: campaign.id, admin,
        }) : { sent: 0, failed: 0 };

        const totalSent = emailResult.sent + smsResult.sent;
        const totalFailed = emailResult.failed + smsResult.failed;
        const status = totalFailed === 0 ? 'sent' : (totalSent > 0 ? 'partial' : 'failed');

        await admin.from('marketing_campaigns').update({
            status,
            sent_at: new Date().toISOString(),
            stats: {
                email: emailResult,
                sms: smsResult,
                total_sent: totalSent,
                total_failed: totalFailed,
                audience_count: audience.length,
            },
        }).eq('id', campaign.id);

        res.status(200).json({
            success: true,
            campaignId: campaign.id,
            audienceCount: audience.length,
            email: emailResult,
            sms: smsResult,
            status,
        });
    } catch (err: unknown) {
        console.error('[marketing-send] failed:', err);
        const message = err instanceof Error ? err.message : 'Send failed.';
        res.status(500).json({ error: message });
    }
}
