// /api/marketing-subscribe
// Unified opt-in for SMS + email marketing. Idempotent. Writes to marketing_contacts
// + marketing_consent_log. Fires the Resend confirmation on first subscribe
// (only when email is present); SMS confirmation is gated on Twilio env being
// configured so an unconfigured prod short-circuits gracefully.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const ALLOWED_SOURCES = new Set(['home', 'shop', 'about', 'footer', 'sms_signup', 'product', 'custom_wallets']);

let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
    if (cachedAdminClient) return cachedAdminClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    cachedAdminClient = createClient(url, key, { auth: { persistSession: false } });
    return cachedAdminClient;
}

function validateEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed.length > 320) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
    return trimmed;
}

function validatePhone(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) return null;
    return trimmed;
}

function redactEmail(value: string): string {
    const at = value.indexOf('@');
    if (at <= 0 || value.length === 0) return '[redacted]';
    const local = value.slice(0, at);
    const domain = value.slice(at);
    if (local.length <= 1) return `${local}***${domain}`;
    return `${local[0]}***${domain}`;
}

function redactPhone(value: string): string {
    if (value.length < 4) return '[redacted]';
    return '+***' + value.slice(-4);
}

function getResendFromAddress(): string {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function sendEmailConfirmation(opts: { to: string; source: string; unsubscribeToken: string }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn(
            '[marketing-subscribe] RESEND_API_KEY not set; skipping email confirmation',
            { source: opts.source, email: redactEmail(opts.to) },
        );
        return;
    }
    const resend = new Resend(apiKey);
    const appUrl = process.env.VITE_APP_URL || 'https://sgcoalition.xyz';
    const unsubscribeUrl = `${appUrl}/api/marketing-optout?token=${encodeURIComponent(opts.unsubscribeToken)}&channel=email`;
    const sourceLabel = opts.source && opts.source !== 'footer' && opts.source !== 'sms_signup'
        ? ` via the ${opts.source} page`
        : '';

    const result = await resend.emails.send({
        from: getResendFromAddress(),
        to: [opts.to],
        subject: 'You are on the Coalition list',
        text: [
            'You are on the Coalition list.',
            '',
            `Thank you for opting in${sourceLabel}.`,
            'One email the day a new Coalition drop goes live. No marketing.',
            '',
            'Once a Coalition piece sells out, it does not restock. That is the only reason this list exists.',
            '',
            'Unsubscribe any time:',
            unsubscribeUrl,
            '',
            '-- Coalition, Baltimore, Maryland',
        ].join('\n'),
        html: confirmationEmailHtml({ sourceLabel, unsubscribeUrl }),
    });
    const error = (result as any)?.error;
    if (error) throw new Error(error.message || 'Resend rejected email');
}

function confirmationEmailHtml(opts: { sourceLabel: string; unsubscribeUrl: string }): string {
    const safeUrl = escapeHtml(opts.unsubscribeUrl);
    return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #2a2a2a;border-radius:8px;padding:32px;">
<tr><td>
<p style="margin:0 0 14px;font-size:11px;letter-spacing:3px;color:#9ca3af;text-transform:uppercase;">Coalition &middot; Built in Baltimore</p>
<h1 style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;letter-spacing:1px;margin:0 0 16px;color:#fff;">You are on the Coalition list.</h1>
<p style="font-size:14px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">Thank you for opting in${escapeHtml(opts.sourceLabel)}. You will receive a single email the day each new Coalition drop goes live. No marketing, no listicles, no drip campaigns.</p>
<p style="font-size:13px;line-height:1.6;color:#9ca3af;margin:0 0 24px;">Once a Coalition piece sells out, it does not restock. That is the only reason this list exists: to hear from us the day the next one is ready.</p>
<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;color:#6b7280;text-transform:uppercase;">Change your mind anytime</p>
<p style="margin:0;">
<a href="${safeUrl}" style="display:inline-block;padding:10px 16px;border:1px solid #6b7280;border-radius:4px;color:#9ca3af;text-decoration:none;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Unsubscribe</a>
</p>
</td></tr>
</table>
<p style="font-size:11px;color:#4b5563;margin:18px 0 0;letter-spacing:1px;text-transform:uppercase;">Coalition &middot; Baltimore, Maryland</p>
</td></tr>
</table>
</body>
</html>`;
}
async function writeConsentLog(admin: SupabaseClient, params: {
    contactId: string;
    channel: 'email' | 'sms';
    action: 'subscribe' | 'unsubscribe';
    source?: string;
    ip?: string | null;
    userAgent?: string | null;
    consentText?: string | null;
}): Promise<void> {
    try {
        await admin.from('marketing_consent_log').insert({
            contact_id: params.contactId,
            channel: params.channel,
            action: params.action,
            source: params.source || null,
            ip: params.ip || null,
            user_agent: params.userAgent || null,
            consent_text: params.consentText || null,
        });
    } catch (err) {
        console.warn('[marketing-subscribe] failed to write consent log:', err);
    }
}

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    let body: any = req.body ?? {};
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const rawEmail = body?.email;
    const rawPhone = body?.phone;
    const rawSource = body?.source ?? 'sms_signup';
    const rawConsentText = body?.consentText;
    const rawProductId = body?.productId;
    const rawPagePath = body?.pagePath;

    const email = rawEmail == null ? null : validateEmail(rawEmail);
    const phone = rawPhone == null ? null : validatePhone(rawPhone);

    if (!email && !phone) {
        res.status(400).json({ error: 'A valid email or E.164 phone is required.' });
        return;
    }

    const source = typeof rawSource === 'string' && ALLOWED_SOURCES.has(rawSource) ? rawSource : 'sms_signup';
    const channel: 'sms' | 'email' | 'both' = email && phone ? 'both' : (email ? 'email' : 'sms');
    const consentText = typeof rawConsentText === 'string' && rawConsentText.length > 0 && rawConsentText.length <= 1000 ? rawConsentText : null;
    const productId = typeof rawProductId === 'string' && rawProductId.length <= 120 ? rawProductId : null;
    const pagePath = typeof rawPagePath === 'string' && rawPagePath.length <= 240 ? rawPagePath : null;

    const ipHeader = req.headers?.['x-forwarded-for'];
    const ip = typeof ipHeader === 'string' ? ipHeader.split(',')[0]?.trim() || null : null;
    const uaHeader = req.headers?.['user-agent'];
    const userAgent = typeof uaHeader === 'string' ? uaHeader.slice(0, 500) : null;

    const admin = getSupabaseAdmin();
    if (!admin) {
        console.error('[marketing-subscribe] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
        res.status(500).json({ error: 'Marketing service is not configured.' });
        return;
    }

    try {
        let existing: any = null;
        if (email) {
            const { data } = await admin.from('marketing_contacts').select('*').eq('email', email).maybeSingle();
            if (data) existing = data;
        }
        if (!existing && phone) {
            const { data } = await admin.from('marketing_contacts').select('*').eq('phone_e164', phone).maybeSingle();
            if (data) existing = data;
        }

        let row: any;
        let alreadySubscribed: boolean;

        if (existing && !existing.unsubscribed_at) {
            row = existing;
            alreadySubscribed = true;
        } else if (existing && existing.unsubscribed_at) {
            const { data: updated, error } = await admin.from('marketing_contacts').update({
                email: email || existing.email,
                phone_e164: phone || existing.phone_e164,
                country_code: extractCountryCode(phone) || existing.country_code,
                channel,
                source,
                unsubscribed_at: null,
            }).eq('id', existing.id).select('*').single();
            if (error || !updated) throw new Error(error?.message || 'Could not re-subscribe.');
            row = updated;
            alreadySubscribed = false;
        } else {
            const { data: inserted, error } = await admin.from('marketing_contacts').insert({
                email,
                phone_e164: phone,
                country_code: extractCountryCode(phone),
                channel,
                source,
                metadata: { ip, userAgent, consentText, productId, pagePath },
            }).select('*').single();
            if (error || !inserted) throw new Error(error?.message || 'Could not save subscription.');
            row = inserted;
            alreadySubscribed = false;
        }

        await writeConsentLog(admin, {
            contactId: row.id,
            channel: channel === 'both' ? 'email' : channel,
            action: 'subscribe',
            source,
            ip,
            userAgent,
            consentText,
        });

        let emailDelivered = false;
        if (!alreadySubscribed && email) {
            try {
                await sendEmailConfirmation({ to: email, source, unsubscribeToken: row.unsubscribe_token });
                emailDelivered = true;
            } catch (err) {
                console.warn('[marketing-subscribe] email confirmation failed:', err);
            }
        }

        res.status(200).json({
            success: true,
            alreadySubscribed,
            emailDelivered,
            channel,
        });
    } catch (err: any) {
        console.error('[marketing-subscribe] failed:', err);
        res.status(500).json({ error: err?.message || 'Subscription failed.' });
    }
}

function extractCountryCode(phone: string | null): string | null {
    if (!phone) return null;
    const match = phone.match(/^(\+\d{1,3})/);
    return match ? match[1] : null;
}
