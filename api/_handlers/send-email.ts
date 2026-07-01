import { Resend } from 'resend';
import { setCorsHeaders } from '../_helpers';
import type { ApiRequest, ApiResponse, ResendEmailPayload } from '../_types';

const resend = new Resend(process.env.RESEND_API_KEY);

function getResendFromAddress() {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

async function sendResendEmail(payload: ResendEmailPayload) {
    const result = await resend.emails.send({
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
