// api/paypal-webhook.ts
//
// Dedicated top-level Vercel serverless route for PayPal webhooks.
// Receives PAYMENT.CAPTURE.COMPLETED events and auto-reconciles
// partial-deposit orders that have a matching order_id in the
// purchase unit's custom_id.
//
// Flow:
//   1. PayPal sends a POST to /api/paypal-webhook
//   2. We verify the webhook signature via PayPal's verification API
//   3. On PAYMENT.CAPTURE.COMPLETED, extract custom_id (order_id)
//   4. Look up the order in Supabase; if balance_due > 0 and matches,
//      call the reconcile_balance_payment RPC
//   5. Return 200 so PayPal doesn't retry

import { createClient } from '@supabase/supabase-js';
import { reconcilePayment } from '../services/orderIntake.js';

const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getPaypalBaseUrl(): string {
    const explicit = process.env.PAYPAL_API_BASE_URL?.trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const mode = (process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'live').toLowerCase();
    return mode === 'sandbox' ? PAYPAL_SANDBOX_API : PAYPAL_LIVE_API;
}

async function getPaypalAccessToken(): Promise<string> {
    const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
    const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing');
    }
    const response = await fetch(getPaypalBaseUrl() + '/v1/oauth2/token', {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    const data = (await response.json().catch(() => ({}))) as {
        access_token?: string;
        error?: string;
        error_description?: string;
    };

    if (!response.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || 'PayPal auth failed');
    }

    return data.access_token;
}

async function verifyPaypalWebhook(
    webhookId: string,
    body: string,
    headers: Record<string, unknown>
): Promise<boolean> {
    const accessToken = await getPaypalAccessToken();

    const verificationBody = {
        auth_algo: String(headers['paypal-auth-algo'] ?? ''),
        cert_url: String(headers['paypal-cert-url'] ?? ''),
        transmission_id: String(headers['paypal-transmission-id'] ?? ''),
        transmission_sig: String(headers['paypal-transmission-sig'] ?? ''),
        transmission_time: String(headers['paypal-transmission-time'] ?? ''),
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
    };

    const response = await fetch(getPaypalBaseUrl() + '/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationBody),
    });

    const data = (await response.json().catch(() => ({}))) as {
        verification_status?: string;
    };

    return data.verification_status === 'SUCCESS';
}

async function tryAutoReconcile(orderId: string, captureId: string): Promise<boolean> {
    const result = await reconcilePayment(orderId);
    if (result.success) {
        console.log('[paypal-webhook] Reconciled order ' + orderId + ' (capture ' + captureId + ')');
        return true;
    }
    console.warn('[paypal-webhook] Reconcile failed for ' + orderId + ': ' + result.error);
    return false;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(
    req: {
        method?: string;
        headers: Record<string, unknown>;
        body?: unknown;
    },
    res: {
        status: (code: number) => { json: (body: unknown) => void; end: () => void };
        setHeader: (k: string, v: string) => void;
    }
): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const webhookId = (process.env.PAYPAL_WEBHOOK_ID || '').trim();
    if (!webhookId) {
        console.error('[paypal-webhook] PAYPAL_WEBHOOK_ID is not configured');
        res.status(500).json({ error: 'Webhook ID not configured' });
        return;
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    let verified: boolean;
    try {
        verified = await verifyPaypalWebhook(webhookId, rawBody, req.headers);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[paypal-webhook] Verification error:', message);
        res.status(500).json({ error: 'Webhook verification failed: ' + message });
        return;
    }

    if (!verified) {
        console.error('[paypal-webhook] Signature verification returned NOT success');
        res.status(400).json({ error: 'Webhook signature verification failed' });
        return;
    }

    let eventBody: {
        event_type?: string;
        resource?: {
            id?: string;
            status?: string;
            amount?: { value?: string; currency_code?: string };
            custom_id?: string;
            purchase_units?: Array<{
                custom_id?: string;
                payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string } }> };
            }>;
        };
    };

    try {
        eventBody = typeof req.body === 'string'
            ? JSON.parse(req.body)
            : (req.body as typeof eventBody);
    } catch {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
    }

    const eventType = eventBody.event_type || '';

    try {
        if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
            const resource = eventBody.resource;
            if (!resource) {
                res.status(200).json({ received: true });
                return;
            }

            const orderId = resource.custom_id
                || resource.purchase_units?.[0]?.custom_id
                || '';

            const captureAmountValue = resource.amount?.value || '0';

            if (orderId) {
                const reconciled = await tryAutoReconcile(orderId, resource.id || 'unknown');
                if (!reconciled) {
                    res.status(500).json({ error: 'Auto-reconciliation failed — will retry' });
                    return;
                }
            } else {
                console.log(
                    '[paypal-webhook] PAYMENT.CAPTURE.COMPLETED but no custom_id/order_id. ' +
                    'Ensure paypal-order.ts passes orderId through the purchase unit custom_id.'
                );
            }
        }

        res.status(200).json({ received: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[paypal-webhook] Event handling error:', message);
        res.status(500).json({ error: 'Event handling failed: ' + message });
    }
}
