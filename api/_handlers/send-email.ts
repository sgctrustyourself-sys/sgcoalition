import { resendClient } from '../../api/_services.js';
import { setCorsHeaders } from '../_helpers.js';
import { isSharedSecretAdmin } from '../_adminAuth.js';

// Anti-relay auth gate (pinned by tests/sendEmailGate.test.ts):
//   - Authorization: Bearer <ADMIN_API_TOKEN or ADMIN_PASSPHRASE>
//     -> any recipient allowed (admin UI flows: drop vouchers, SGCoin
//     approvals, referral script). Either secret is accepted, mirroring
//     admin-verify.ts, which accepts both as login credentials — this keeps
//     deployments that only set ADMIN_PASSPHRASE working.
//   - No/invalid token                         -> recipient must be the owner
//     notification address (ORDER_NOTIFICATION_EMAIL, falling back to the
//     legacy hardcoded admin email). Anything else -> 403.
// This endpoint used to be an open relay: any caller could send email as the
// brand from the verified sending domain. The recipient allowlist + shared
// secret close that while keeping every existing flow working.

function getResendFromAddress() {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

function getOwnerNotificationAddress() {
    return (process.env.ORDER_NOTIFICATION_EMAIL || '').trim() || 'sgctrustyourself@gmail.com';
}

// The admin-caller check lives in api/_adminAuth.ts (single owner of the whole
// credential policy). This handler deliberately calls the SHARED-SECRET
// predicate rather than the all-or-nothing `withAdminAuth` gate, because an
// anonymous caller is still allowed to reach one recipient (the owner address).
// It is a conditional, not a gate: it decides WHICH recipient is permitted.

function normalizeRecipient(raw: unknown): string {
    return String(raw ?? '').trim().toLowerCase();
}

async function sendResendEmail(payload: any) {
    const resend = resendClient();
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
        const { to, subject, html } = req.body;

        if (!to || !subject || !html) {
            res.status(400).json({ error: 'Missing required fields: to, subject, html' });
            return;
        }

        const recipient = normalizeRecipient(to);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
            res.status(400).json({ error: 'Invalid recipient address.' });
            return;
        }

        if (!isSharedSecretAdmin(req) && recipient !== normalizeRecipient(getOwnerNotificationAddress())) {
            console.warn('[send-email] blocked unauthenticated send to non-owner recipient');
            res.status(403).json({ error: 'Admin token required to email this recipient.' });
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
