// /api/marketing-optout
// One-click opt-out: GET via token from marketing email; POST via Twilio inbound
// webhook for STOP keywords. Twilio signature validated with HMAC-SHA1.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
    if (cachedAdminClient) return cachedAdminClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    cachedAdminClient = createClient(url, key, { auth: { persistSession: false } });
    return cachedAdminClient;
}

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const START_KEYWORDS = new Set(['START', 'YES', 'UNSTOP']);

function validateTwilioSignature(opts: {
    authToken: string;
    signatureHeader: string | undefined;
    fullUrl: string;
    bodyParams: Record<string, string>;
}): boolean {
    if (!opts.signatureHeader) return false;
    let data = opts.fullUrl;
    const keys = Object.keys(opts.bodyParams).sort();
    for (const k of keys) data += k + opts.bodyParams[k];
    const expected = crypto.createHmac('sha1', opts.authToken).update(data).digest('base64');
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(opts.signatureHeader);
    if (expectedBuf.length !== providedBuf.length) return false;
    try {
        return crypto.timingSafeEqual(expectedBuf, providedBuf);
    } catch {
        return false;
    }
}

async function writeConsentLog(admin: SupabaseClient, params: {
    contactId: string | null;
    channel: 'email' | 'sms';
    action: 'unsubscribe';
    source?: string | null;
    consentText?: string | null;
}): Promise<void> {
    try {
        await admin.from('marketing_consent_log').insert({
            contact_id: params.contactId,
            channel: params.channel,
            action: params.action,
            source: params.source || null,
            consent_text: params.consentText || null,
        });
    } catch (err) { console.warn('[marketing-optout] failed to write consent log:', err); }
}
async function unsubscribeByContactId(admin: SupabaseClient, contactId: string): Promise<void> {
    const now = new Date().toISOString();
    await admin.from('marketing_contacts').update({
        status: 'unsubscribed',
        unsubscribed_at: now,
    }).eq('id', contactId);

    const { data: row } = await admin.from('marketing_contacts').select('email, phone_e164').eq('id', contactId).maybeSingle();
    if (row?.email) {
        await admin.from('coalition_signal_subscribers').update({
            status: 'unsubscribed', unsubscribed_at: now,
        }).eq('subscriber_type', 'email').eq('contact_value', row.email);
        await admin.from('subscribe_emails').update({ unsubscribe_at: now }).eq('email', row.email);
    }
    if (row?.phone_e164) {
        await admin.from('coalition_signal_subscribers').update({
            status: 'unsubscribed', unsubscribed_at: now,
        }).eq('subscriber_type', 'sms').eq('contact_value', row.phone_e164);
    }
}

function htmlPage(message: string, success: boolean): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Unsubscribe</title></head>
<body style="margin:0;padding:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:80px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #2a2a2a;border-radius:8px;padding:32px;">
<tr><td>
<p style="margin:0 0 14px;font-size:11px;letter-spacing:3px;color:#9ca3af;text-transform:uppercase;">Coalition &middot; Baltimore, Maryland</p>
<h1 style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;letter-spacing:1px;margin:0 0 16px;color:#fff;">${success ? 'You are off the list.' : 'Could not process.'}</h1>
<p style="font-size:14px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">${message}</p>
<p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0;">If this was a mistake, you can re-subscribe any time at the storefront.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Twilio-Signature');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const admin = getSupabaseAdmin();

    if (req.method === 'GET') {
        const query = req.query || {};
        const token = typeof query.token === 'string' ? query.token : null;
        const sendPage = (msg: string, ok: boolean) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.status(200).send(htmlPage(msg, ok));
        };
        if (!admin) {
            sendPage('Service is not configured. Please try again later.', false);
            return;
        }
        if (!token) {
            sendPage('Missing unsubscribe token.', false);
            return;
        }
        try {
            const { data: row } = await admin.from('marketing_contacts').select('id, unsubscribed_at, updated_at').eq('unsubscribe_token', token).maybeSingle();
            if (!row) {
                sendPage('We could not find that address on our list. It may already be off, or the link is older than the last 365 days.', false);
                return;
            }
            // CRITICAL 4 (defense-in-depth): bound token validity to the contact's
            // last activity. We bump updated_at on each email send in
            // /api/marketing-send so an active recipient stays within the window.
            if (row.updated_at && Date.now() - new Date(row.updated_at).getTime() > 365 * 24 * 3600 * 1000) {
                sendPage('That unsubscribe link has expired. Visit sgcoalition.xyz to manage preferences, or reply STOP to any future SMS.', false);
                return;
            }
            if (row.unsubscribed_at) {
                sendPage('Already off the list. You will not hear from us again.', true);
                return;
            }
            await unsubscribeByContactId(admin, row.id);
            await writeConsentLog(admin, {
                contactId: row.id, channel: 'email', action: 'unsubscribe',
                source: 'email_unsubscribe_link',
                consentText: 'Email unsubscribe link click',
            });
            sendPage('You are off the Coalition marketing list. You will not receive any further marketing emails.', true);
            return;
        } catch (err: any) {
            console.error('[marketing-optout] GET failed:', err);
            sendPage('Something went wrong. Please try again later.', false);
            return;
        }
    }

    if (req.method === 'POST') {
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const signatureHeader = typeof req.headers?.['x-twilio-signature'] === 'string' ? req.headers['x-twilio-signature'] : undefined;

        let bodyParams: Record<string, string> = {};
        if (req.body && typeof req.body === 'object') {
            for (const [k, v] of Object.entries(req.body)) {
                bodyParams[k] = Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
            }
        }
        const from = bodyParams.From || '';
        const text = (bodyParams.Body || '').trim().toUpperCase();

        if (!authToken) {
            console.warn('[marketing-optout] TWILIO_AUTH_TOKEN not set; cannot validate signature; rejecting POST');
            res.setHeader('Content-Type', 'text/xml');
            res.status(503).send('<Response></Response>');
            return;
        }
        if (!signatureHeader) {
            console.warn('[marketing-optout] X-Twilio-Signature header missing on POST; cannot accept');
            res.setHeader('Content-Type', 'text/xml');
            res.status(403).send('<Response></Response>');
            return;
        }
        const proto = typeof req.headers?.['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'] : 'https';
        const host = req.headers?.host || (process.env.VITE_APP_URL ? new URL(process.env.VITE_APP_URL).host : 'sgcoalition.xyz');
        const fullUrl = `${proto}://${host}${req.url || '/api/marketing-optout'}`;
        const isValid = validateTwilioSignature({ authToken, signatureHeader, fullUrl, bodyParams });
        if (!isValid) {
            console.warn('[marketing-optout] rejecting invalid Twilio signature for From=', from);
            res.setHeader('Content-Type', 'text/xml');
            res.status(403).send('<Response><Message>Invalid signature</Message></Response>');
            return;
        }

        res.setHeader('Content-Type', 'text/xml');

        if (!admin) {
            res.status(200).send('<Response></Response>');
            return;
        }

        if (!STOP_KEYWORDS.has(text)) {
            res.status(200).send('<Response></Response>');
            return;
        }

        try {
            const { data: row } = await admin.from('marketing_contacts').select('id, unsubscribed_at').eq('phone_e164', from).maybeSingle();
            if (row && !row.unsubscribed_at) {
                await unsubscribeByContactId(admin, row.id);
                await writeConsentLog(admin, {
                    contactId: row.id, channel: 'sms', action: 'unsubscribe',
                    source: 'twilio_stop_keyword', consentText: `STOP keyword received: "${text}"`,
                });
            }
            res.status(200).send('<Response></Response>');
            return;
        } catch (err: any) {
            console.error('[marketing-optout] POST failed:', err);
            res.status(200).send('<Response></Response>');
            return;
        }
    }

    res.status(405).json({ error: 'Method not allowed' });
}
