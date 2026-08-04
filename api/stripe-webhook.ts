// api/stripe-webhook.ts
//
// Dedicated top-level Vercel serverless route for Stripe webhooks.
// Must NOT go through the catch-all [...slug].ts because this handler
// needs the raw request body for signature verification.
//
// Flow:
//   1. Stripe sends a POST to /api/stripe-webhook
//   2. We verify the signature using STRIPE_WEBHOOK_SECRET
//   3. On payment_intent.succeeded, extract order_id from metadata
//   4. Look up the order in Supabase; if balance_due > 0 and matches,
//      call the reconcile_balance_payment RPC to auto-flip to paid
//   5. Return 200 so Stripe doesn't retry
//
// The config.api.bodyParser = false export tells Vercel to leave the
// body as a raw Buffer, which is required by stripe.webhooks.constructEvent.

import Stripe from 'stripe';
import { reconcilePayment } from '../services/orderIntake.js';

// Disable Vercel's automatic JSON body parsing — Stripe signature
// verification requires the raw body bytes.
export const config = {
    api: {
        bodyParser: false,
    },
};

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the raw body from the incoming request (Buffer or string). */
function readRawBody(req: { body?: unknown; on?: (event: string, cb: (chunk: unknown) => void) => void }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        if (Buffer.isBuffer(req.body)) {
            resolve(req.body);
            return;
        }
        if (typeof req.body === 'string') {
            resolve(Buffer.from(req.body, 'utf8'));
            return;
        }

        const chunks: Buffer[] = [];
        req.on?.('data', (chunk: unknown) => {
            if (Buffer.isBuffer(chunk)) {
                chunks.push(chunk);
            } else if (typeof chunk === 'string') {
                chunks.push(Buffer.from(chunk, 'utf8'));
            }
        });
        req.on?.('end', () => {
            resolve(Buffer.concat(chunks));
        });
        req.on?.('error', (err: unknown) => {
            reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
}

/** Auto-reconcile an order via the shared Order intake module. */
async function tryAutoReconcile(orderId: string, paymentIntentId: string): Promise<boolean> {
    const result = await reconcilePayment(orderId);
    if (result.success) {
        console.log('[stripe-webhook] Reconciled order ' + orderId + ' (PI ' + paymentIntentId + ')');
        return true;
    }
    console.warn('[stripe-webhook] Reconcile failed for ' + orderId + ': ' + result.error);
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
        on?: (event: string, cb: (chunk: unknown) => void) => void;
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

    const signature = String(req.headers['stripe-signature'] ?? '');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
    }

    let rawBody: Buffer;
    try {
        rawBody = await readRawBody(req);
    } catch (_err: unknown) {
        console.error('[stripe-webhook] Failed to read raw body:', _err);
        res.status(400).json({ error: 'Failed to read request body' });
        return;
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (_err: unknown) {
        const message = _err instanceof Error ? _err.message : String(_err);
        console.error('[stripe-webhook] Signature verification failed:', message);
        res.status(400).json({ error: 'Webhook signature verification failed: ' + message });
        return;
    }

    try {
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.order_id;

            if (orderId) {
                const reconciled = await tryAutoReconcile(orderId, paymentIntent.id);
                if (!reconciled) {
                    res.status(500).json({ error: 'Auto-reconciliation failed — will retry' });
                    return;
                }
            } else {
                console.log(
                    '[stripe-webhook] PI ' + paymentIntent.id +
                    ' succeeded but no order_id in metadata. ' +
                    'Pass orderId in create-payment-intent body to enable auto-reconciliation.'
                );
            }
        }

        res.status(200).json({ received: true });
    } catch (_err: unknown) {
        const message = _err instanceof Error ? _err.message : String(_err);
        console.error('[stripe-webhook] Event handling error:', message);
        res.status(500).json({ error: 'Event handling failed: ' + message });
    }
}
