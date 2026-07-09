// /api/subscribe-drop
// Single opt-in endpoint for the Coalition drop list.
// - Validates email and a constrained source enum.
// - Upserts a row into subscribe_emails via SUPABASE_SERVICE_ROLE_KEY.
// - Fires one Resend confirmation email (only on first subscribe per email,
//   so refreshes and double-clicks do not pile up duplicate messages).
// - Surfaces no secrets in any branch.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createHttpError, parseBody, setCorsHeaders, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    SubscribeDropBody,
    SubscribeDropResponse,
    SubscribeEmailRow,
} from '../_types';

const ALLOWED_SOURCES = new Set<string>(['home', 'shop', 'about', 'footer']);
const DEFAULT_PUBLIC_ORIGIN = 'https://sgcoalition.xyz';
const DEFAULT_FROM_ADDRESS = 'SG Coalition <onboarding@resend.dev>';
const DEFAULT_SOURCE = 'footer';

// Cache the admin client across warm Lambda / Vercel function invocations so we
// don't re-initialize on every request. Returns null when env is missing so the
// caller can respond with a 503 rather than crashing the Lambda cold-start.
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
    return process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_ADDRESS;
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
        console.warn(
            '[subscribe-drop] RESEND_API_KEY not set; skipping confirmation email for source=',
            opts.source,
            'email=',
            redactEmail(opts.to),
        );
        return;
    }
    const resend = new Resend(apiKey);
    const appUrl = process.env.VITE_APP_URL || DEFAULT_PUBLIC_ORIGIN;
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
    const error = (result as { error?: { message?: string } | null } | null)?.error;
    if (error) {
        throw new Error(error.message || 'Resend rejected the confirmation email.');
    }
}

function confirmationEmailHtml(opts: { source: string; unsubscribeUrl: string }): string {
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

async function subscribeDrop(req: ApiRequest): Promise<SubscribeDropResponse> {
    const bodyRaw = parseBody(req);
    const body = bodyRaw as SubscribeDropBody;

    const email = validateEmail(body.email);
    if (!email) {
        throw createHttpError(400, 'A valid email address is required.');
    }
    const source = typeof body.source === 'string' && ALLOWED_SOURCES.has(body.source)
        ? body.source
        : DEFAULT_SOURCE;

    const admin = getSupabaseAdmin();
    if (!admin) {
        console.error('[subscribe-drop] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
        throw createHttpError(500, 'Subscription service is not configured. Please try again later.');
    }

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
        unsubscribeToken = String((existing as Pick<SubscribeEmailRow, 'unsubscribe_token'>).unsubscribe_token || '');
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
        unsubscribeToken = String((reactivated as Pick<SubscribeEmailRow, 'unsubscribe_token'>).unsubscribe_token || '');
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
        unsubscribeToken = String((inserted as Pick<SubscribeEmailRow, 'unsubscribe_token'>).unsubscribe_token || '');
        alreadySubscribed = false;
    }

    let emailDelivered = false;
    if (!alreadySubscribed) {
        await sendConfirmationEmail({ to: email, source, unsubscribeToken });
        emailDelivered = true;
    }

    return { success: true, alreadySubscribed, emailDelivered, source };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { methods: 'POST,OPTIONS', allowedHeaders: 'Content-Type' });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        res.status(200).json(await subscribeDrop(req));
    } catch (error: unknown) {
        const httpError = error as HttpError | null;
        const status = Number(httpError?.status || 500);
        const message = (error as { message?: string } | null)?.message;
        console.error('[subscribe-drop] failed:', error);
        res.status(status).json({ error: message || 'Could not save subscription. Please try again.' });
    }
}
