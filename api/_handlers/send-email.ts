import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function getResendFromAddress() {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

async function sendResendEmail(payload: any) {
    const result = await resend.emails.send({
        ...payload,
        from: getResendFromAddress(),
    });

    const error = (result as any)?.error;
    if (error) {
        throw new Error(error.message || 'Resend rejected the email request.');
    }

    return result;
}

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { to, subject, html } = req.body;

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
    } catch (err: any) {
        console.error('Send email error:', err);
        res.status(500).json({ error: err.message || 'Failed to send email' });
    }
}
