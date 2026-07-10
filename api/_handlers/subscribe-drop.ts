// /api/subscribe-drop
// Single opt-in endpoint for the Coalition drop list.
// - Validates email and a constrained source enum.
// - Upserts a row into subscribe_emails via SUPABASE_SERVICE_ROLE_KEY.
// - Fires one Resend confirmation email (only on first subscribe per email,
//   so refreshes and double-clicks do not pile up duplicate messages).
// - Surfaces no secrets in any branch.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const ALLOWED_SOURCES = new Set(['home', 'shop', 'about', 'footer']);

// Cache the admin client across warm Lambda / Vercel function invocations so we
// don't re-initialize on every request.
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
    // Conservative pragmatic regex; real validation happens via Resend's
    // SMTP delivery handshake on the way out.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
    return trimmed;
}

function getResendFromAddress(): string {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

// Reviewer NITPICK 1: redact the email before logging so an unconfigured prod
// does not persist every opt-in email address in Vercel function logs.
function redactEmail(value: string): string {
    const at = value.indexOf('@');
    if (at <= 0 || value.length === 0) return '[redacted]';
    const local = value.slice(0, at);
    const domain = value.slice(at);
    if (local.length <= 1) return `${local}***${domain}`;
    return `${local[0]}***${domain}`;
}

async function sendConfirmationEmail(opts: {
    to: string;
    source: string;
    unsubscribeToken: string;
}): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        // Dev / unconfigured: log so the operator sees why the email didn't
        // go out, but do not 500 the user - the row is already persisted.
        console.warn(
            '[subscribe-drop] RESEND_API_KEY not set; skipping confirmation email for source=',
            opts.source,
            'email=',
            redactEmail(opts.to),
        );
        return;
    }
    const resend = new Resend(apiKey);
    const appUrl = process.env.VITE_APP_URL || 'https://sgcoalition.xyz';
    const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}`;
    const subject = 'You are on the Coalition drop list';
    const html = confirmationEmailHtml({ source: opts.source, unsubscribeUrl });
    const text = confirmationEmailText({ source: opts.source, unsubscribeUrl });
    const result = await resend.emails.send({
        from: getResendFromAddress(),
        to: [opts.to],
        subject,
        html,
        text,
    });
    const error = (result as any)?.error;
    if (error) {
        throw new Error(error.message || 'Resend rejected the confirmation email.');
    }
}

function confirmationEmailHtml(opts: { source: string; unsubscribeUrl: string }): string {
    // PLACEHOLDER copy pending operator review per the feature brief.
    // Voice: personal, anti-spam, founder-tone. One email per drop.
    const sourceLabel = opts.source && opts.source !== 'footer'
        ? ` from the ${opts.source} page of the storefront`
        : ' from the Coalition storefront';
    const safeUnsubscribeUrl = escapeHtml(opts.unsubscribeUrl);
    return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #2a2a2a;border-radius:8px;padding:32px;">
<tr><td>
<p style="margin:0 0 14px;font-size:11px;letter-spacing:3px;color:#9ca3af;text-transform:uppercase;">Coalition &middot; Built in Baltimore</p>
<h1 style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;letter-spacing:1px;margin:0 0 16px;color:#fff;">You are on the list.</h1>
<p style="font-size:14px;line-height:1.7;color:#d4d4d4;margin:0 0 16px;">
Thank you for signing up${sourceLabel}.
You will receive a single email the day each new Coalition drop goes live. No marketing, no listicles, no drip campaigns &mdash; one note, when a new piece is ready.
</p>
<p style="font-size:13px;line-height:1.6;color:#9ca3af;margin:0 0 24px;">
Once a Coalition piece sells out, it does not restock. That is the only reason this list exists: to hear from us the day the next one is ready.
</p>
<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;color:#6b7280;text-transform:uppercase;">Change your mind anytime</p>
<p style="margin:0;">
<a href="${safeUnsubscribeUrl}" style="display:inline-block;padding:10px 16px;border:1px solid #6b7280;border-radius:4px;color:#9ca3af;text-decoration:none;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Unsubscribe</a>
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

function confirmationEmailText(opts: { source: string; unsubscribeUrl: string }): string {
    const sourceLabel = opts.source && opts.source !== 'footer'
        ? ` from the ${opts.source} page of the storefront`
        : ' from the Coalition storefront';
    return [
        'You are on the Coalition drop list.',
        '',
        `Thank you for signing up${sourceLabel}.`,
        'You will receive a single email the day each new Coalition drop goes live.',
        'No marketing, no listicles, no drip campaigns - one note, when a new piece is ready.',
        '',
        'Once a Coalition piece sells out, it does not restock. That is the only reason',
        'this list exists: to hear from us the day the next one is ready.',
        '',
        'Unsubscribe any time:',
        opts.unsubscribeUrl,
        '',
        '-- Coalition, Baltimore, Maryland',
    ].join('\n');
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Vercel sometimes hands us a string body when Content-Type slips.
    let body: any = req.body ?? {};
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const rawEmail = body?.email;
    const rawSource = body?.source;

    const email = validateEmail(rawEmail);
    if (!email) {
        res.status(400).json({ error: 'A valid email address is required.' });
        return;
    }
    const source = typeof rawSource === 'string' && ALLOWED_SOURCES.has(rawSource)
        ? rawSource
        : 'footer';

    const admin = getSupabaseAdmin();
    if (!admin) {
        console.error('[subscribe-drop] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
        res.status(500).json({
            error: 'Subscription service is not configured. Please try again later.',
        });
        return;
    }

    try {
        // Idempotent subscribe: on previously-unsubscribed emails, treat as a
        // re-subscribe (clear unsubscribe_at, reuse the row's token).
        const { data: existing } = await admin
            .from('subscribe_emails')
            .select('id, unsubscribe_token, unsubscribe_at')
            .eq('email', email)
            .maybeSingle();

        let unsubscribeToken: string;
        let alreadySubscribed: boolean;

        if (existing && !existing.unsubscribe_at) {
            unsubscribeToken = existing.unsubscribe_token;
            alreadySubscribed = true;
        } else if (existing && existing.unsubscribe_at) {
            // Re-subscribe path: clear unsubscribe_at, update source, keep token.
            const { data: reactivated, error: reactivateError } = await admin
                .from('subscribe_emails')
                .update({ unsubscribe_at: null, source })
                .eq('id', existing.id)
                .select('unsubscribe_token')
                .single();
            if (reactivateError || !reactivated) {
                throw new Error(reactivateError?.message || 'Could not re-subscribe existing email.');
            }
            unsubscribeToken = reactivated.unsubscribe_token;
            alreadySubscribed = false;
        } else {
            const { data: inserted, error: insertError } = await admin
                .from('subscribe_emails')
                .insert({ email, source })
                .select('unsubscribe_token')
                .single();
            if (insertError || !inserted) {
                throw new Error(insertError?.message || 'Could not save subscription.');
            }
            unsubscribeToken = inserted.unsubscribe_token;
            alreadySubscribed = false;
        }

        // Only fire the confirmation email on first-time (or reactivated) subscribe
        // so a refresh doesn't pile up duplicate "you're on the list" messages.
        let emailDelivered = false;
        if (!alreadySubscribed) {
            await sendConfirmationEmail({ to: email, source, unsubscribeToken });
            emailDelivered = true;
        }

        res.status(200).json({
            success: true,
            alreadySubscribed,
            emailDelivered,
            source,
        });
    } catch (err: any) {
        console.error('[subscribe-drop] failed:', err);
        res.status(500).json({
            error: err?.message || 'Could not save subscription. Please try again.',
        });
    }
}
