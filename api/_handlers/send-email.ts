import { Resend } from 'resend';
import { createHttpError, setCorsHeaders } from '../_helpers';
import type { ApiRequest, ApiResponse, ResendEmailPayload } from '../_types';

// Lazy Resend getter. Originally eagerly instantiated at module top, but to
// match the Stripe handlers' cold-start-safe pattern (no process.env reads
// at module init) we lazy-init. Callers hit this once and get a 503 if
// RESEND_API_KEY is unset.
let resendInstance: Resend | null = null;
function getResend(): Resend {
    if (resendInstance) return resendInstance;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw createHttpError(503, 'Resend is not configured on this server.');
    }
    resendInstance = new Resend(apiKey);
    return resendInstance;
}

function getResendFromAddress() {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

async function sendResendEmail(payload: ResendEmailPayload) {
    const result = await getResend().emails.send({
        ...payload,
        from: getResendFromAddress(),
    } as Parameters<Resend['emails']['send']>[0]);

    const error = result?.error;
    if (error) {
        throw new Error(error.message || 'Resend rejected the email request.');
    }

    return result;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { methods: 'POST,OPTIONS' });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        interface SendEmailBody { to?: string; subject?: string; html?: string; }
        const body = (req.body ?? {}) as SendEmailBody;
        const { to, subject, html } = body;

        if (!to || !subject || !html) {
            res.status(400).json({ error: 'Missing required fields: to, subject, html' });
            return;
        }

        const data = await sendResendEmail({
            to: [to],
            subject,
            html,
        });

        res.status(200).json({ success: true, data });
    } catch (err: unknown) {
        console.error('Send email error:', err);
        const message = err instanceof Error ? err.message : 'Failed to send email';
        res.status(500).json({ error: message });
    }
}
