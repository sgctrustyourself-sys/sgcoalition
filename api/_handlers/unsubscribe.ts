// /api/unsubscribe
// One-click opt-out companion to /api/subscribe-drop.
// Reads `?token=<uuid>` from the URL, looks up the matching subscribe_emails row,
// and stamps unsubscribe_at if it's not already set. Returns a small HTML page so
// the link works in browsers and markdown email clients alike.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
    ApiRequest,
    ApiResponse,
    UnsubscribeBody,
} from '../_types';

const DEFAULT_PUBLIC_ORIGIN = 'https://sgcoalition.xyz';

let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
    if (cachedAdminClient) return cachedAdminClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    cachedAdminClient = createClient(url, key, { auth: { persistSession: false } });
    return cachedAdminClient;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderHtml(opts: { ok: boolean; title: string; body: string; appUrl: string }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coalition - ${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:48px 16px;">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #2a2a2a;border-radius:8px;padding:32px;text-align:left;">
<tr><td>
<p style="margin:0 0 12px;font-size:11px;letter-spacing:3px;color:#9ca3af;text-transform:uppercase;">Coalition</p>
<h1 style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;letter-spacing:1px;margin:0 0 14px;color:#fff;${opts.ok ? '' : 'color:#f9a8a8;'}">${escapeHtml(opts.title)}</h1>
<p style="font-size:14px;line-height:1.7;color:#d4d4d4;margin:0 0 18px;">${escapeHtml(opts.body)}</p>
<p style="margin:18px 0 0;">
<a href="${escapeHtml(opts.appUrl)}" style="display:inline-block;padding:10px 16px;background:#fff;color:#000;border-radius:4px;text-decoration:none;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;">Back to Coalition</a>
</p>
</td></tr>
</table>
<p style="font-size:11px;color:#4b5563;margin:18px 0 0;letter-spacing:1px;text-transform:uppercase;">
Coalition &middot; Baltimore, Maryland
</p>
</td></tr>
</table>
</body>
</html>`;
}

function readToken(req: ApiRequest): string {
    // Channel 1: ?token=<uuid> in the URL (email-client friendly).
    const queryTokenRaw = req.query?.token;
    const queryToken = Array.isArray(queryTokenRaw)
        ? queryTokenRaw[0]
        : queryTokenRaw;

    if (typeof queryToken === 'string' && queryToken.trim()) {
        return queryToken.trim();
    }

    // Channel 2: future in-app Unsubscribe buttons POST with body.token.
    if (req.body && typeof req.body === 'object' && req.body !== null) {
        const bodyToken = (req.body as UnsubscribeBody).token;
        if (typeof bodyToken === 'string' && bodyToken.trim()) {
            return bodyToken.trim();
        }
    }

    return '';
}

async function performUnsubscribe(token: string): Promise<'unsubscribed' | 'already_off'> {
    const admin = getSupabaseAdmin();
    if (!admin) {
        throw new Error('Subscription service is not configured.');
    }

    const { data, error } = await admin
        .from('subscribe_emails')
        .update({ unsubscribe_at: new Date().toISOString() })
        .eq('unsubscribe_token', token)
        .is('unsubscribe_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    return data ? 'unsubscribed' : 'already_off';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    const appUrl = process.env.VITE_APP_URL || DEFAULT_PUBLIC_ORIGIN;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', appUrl);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).send(renderHtml({
            ok: false,
            title: 'Method not allowed',
            body: 'Use the unsubscribe link from the email, or send a GET request with ?token=<uuid>.',
            appUrl,
        }));
        return;
    }

    const token = readToken(req);
    if (!token) {
        res.status(400).send(renderHtml({
            ok: false,
            title: 'Invalid unsubscribe link',
            body: 'This unsubscribe link is missing or malformed. If you reached this page in error, simply close it; we will not email you again until you sign up.',
            appUrl,
        }));
        return;
    }

    try {
        const outcome = await performUnsubscribe(token);
        if (outcome === 'already_off') {
            // Already unsubscribed OR token doesn't match a row. Same response:
            // we never confirm whether an email exists for security reasons.
            res.status(200).send(renderHtml({
                ok: true,
                title: 'Already off the list',
                body: 'Your email is already off the Coalition drop list. No further drop emails will come from us.',
                appUrl,
            }));
            return;
        }

        res.status(200).send(renderHtml({
            ok: true,
            title: 'You are off the list.',
            body: 'Your email has been removed from the Coalition drop list. We will not email you again until you sign up from the site.',
            appUrl,
        }));
    } catch (error: unknown) {
        // Distinguish the explicit "service not configured" throw from an
        // upstream Supabase/network error so the rendered page matches the
        // previous operator-facing message.
        const message = (error as { message?: string } | null)?.message || '';
        if (message.includes('not configured')) {
            console.error('[unsubscribe] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
            res.status(503).send(renderHtml({
                ok: false,
                title: 'Service temporarily unavailable',
                body: 'The unsubscribe service is not configured right now. Reply STOP to any of our emails and we will remove you by hand.',
                appUrl,
            }));
            return;
        }
        console.error('[unsubscribe] failed:', error);
        res.status(500).send(renderHtml({
            ok: false,
            title: 'Unsubscribe could not complete',
            body: 'Something went wrong on our end. Reply STOP to any of our emails and we will remove you by hand.',
            appUrl,
        }));
    }
}
