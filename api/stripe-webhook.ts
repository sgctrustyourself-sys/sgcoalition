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
//      (missing -> log + 200; malformed -> 400, no retry)
//   4. Look up the order in Supabase; if balance_due > 0 and still pending,
//      call the reconcile_balance_payment RPC to auto-flip to paid
//   5. HTTP status encodes retryability: 500 only for transient failures
//      (DB/network — Stripe retries); permanent failures (order missing,
//      RPC business reject) return 200 and email the admin instead
//
// The config.api.bodyParser = false export tells Vercel to leave the
// body as a raw Buffer, which is required by stripe.webhooks.constructEvent.

import type Stripe from 'stripe';
import { stripeClient } from './_services.js';
import { reconcilePayment, notifyAdminReconcileFailure } from '../services/orderIntake.js';
import { purchaseLabelForOrder } from '../services/shipping.js';

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

const stripe = stripeClient();

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

/**
 * Valid order_id for reconciliation: a non-empty string of reasonable length
 * using only characters our order IDs use (`order_<digits>`). The RPC's TEXT
 * param would accept anything, but garbage in metadata is a bug or a probe —
 * reject it up front so Stripe does not retry a permanently-bad event.
 */
export function isValidOrderId(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
}

/**
 * Auto-reconcile an order via the shared Order intake module.
 * On failure it also emails the admin — money moved, so silence is not an
 * option — and returns whether the failure is retryable so the caller can
 * pick the HTTP status that controls Stripe redelivery.
 */
async function tryAutoReconcile(orderId: string, paymentIntentId: string, eventId?: string): Promise<{ reconciled: boolean; retryable: boolean }> {
    const result = await reconcilePayment(orderId);
    if (result.success) {
        console.log('[stripe-webhook] Reconciled order ' + orderId + ' (PI ' + paymentIntentId + ')');
        return await finishWithLabelPurchase(orderId, { reconciled: true, retryable: false });
    }
    // permanent=true: retrying can never fix it (order absent, or the RPC
    // rejected the state transition under FOR UPDATE). Transient: DB/network.
    const retryable = !result.permanent;
    console.warn('[stripe-webhook] Reconcile failed for ' + orderId + ' (PI ' + paymentIntentId + '): ' + result.error + (retryable ? ' (transient — Stripe will retry)' : ' (permanent — no retry)'));
    // Awaited, not fire-and-forget: Vercel can freeze the lambda the moment
    // the response returns, which would silently drop a void'd send. The
    // failure path is rare and the helper swallows its own errors, so the
    // (at most ~1s) delay is worth the delivery guarantee.
    await notifyAdminReconcileFailure(orderId, paymentIntentId, result.error || 'Unknown reconcile failure', retryable, eventId);
    return { reconciled: false, retryable };
}

/**
 * After a successful reconcile, buy the shipping label. Maps the label
 * outcome onto the same retryable/permanent/skip contract the caller
 * already understands — a label failure inherits the reconcile verdict's
 * HTTP treatment, so Stripe's redelivery policy stays correct end to end.
 */
async function finishWithLabelPurchase(orderId: string, verdict: { reconciled: boolean; retryable: boolean }): Promise<{ reconciled: boolean; retryable: boolean }> {
    try {
        const label = await purchaseLabelForOrder(orderId);
        if (label.outcome === 'purchased') {
            console.log('[stripe-webhook] Shipping label purchased for ' + orderId);
        } else if (label.outcome === 'retryable') {
            console.warn('[stripe-webhook] Label purchase failed (transient) for ' + orderId + ': ' + label.reason);
            return { reconciled: true, retryable: true };
        } else if (label.outcome === 'failed') {
            // Permanent — email the admin; a redelivery could never fix a
            // bad address or a rate cap, so don't burn Stripe retries.
            console.warn('[stripe-webhook] Label purchase failed (permanent) for ' + orderId + ': ' + label.reason);
            await notifyAdminLabelFailure(orderId, label.reason);
        }
        // 'skipped' is neutral: not configured, already claimed by a
        // concurrent delivery, or the order wasn't in a label-eligible state.
    } catch (e) {
        // Defensive: the service resolves every path internally, but a throw
        // here must degrade to the webhook's transient behavior, not 500-crash
        // a successfully-reconciled payment.
        console.warn('[stripe-webhook] Label purchase threw for ' + orderId, e);
        return { reconciled: true, retryable: true };
    }
    return verdict;
}

/** Permanent label-failure alert (reuses the reconcile-failure email shape). */
async function notifyAdminLabelFailure(orderId: string, reason: string): Promise<void> {
    try {
        const key = process.env.RESEND_API_KEY;
        const rcpts = (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || 'sgctrustyourself@gmail.com')
            .split(',').map((e) => e.trim()).filter(Boolean);
        if (!key || !rcpts.length) return;
        const { resendClient } = await import('./_services.js');
        const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;color:#111827;">'
            + '<h2 style="letter-spacing:1px;text-transform:uppercase;">Shipping label could not be purchased</h2>'
            + '<p>The order was paid but no label was bought. Reason: <strong>' + esc(reason) + '</strong></p>'
            + '<p>Buy the label manually in Shippo (or fix the cause and let the next webhook redelivery retry), then fulfill the order.</p>'
            + '<p><a href="https://sgcoalition.xyz/#/admin?tab=orders&q=' + encodeURIComponent(orderId) + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Open order in Admin</a></p>'
            + '<p style="color:#6b7280;">Order ID: <code>' + esc(orderId) + '</code></p>'
            + '</div>';
        await resendClient().emails.send({ from: process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>', to: rcpts, subject: 'ACTION REQUIRED: label failed for ' + orderId, html } as never);
    } catch (e) {
        console.warn('[stripe-webhook] Label-failure alert email failed:', e);
    }
}

/** Tiny local esc for the alert email (single use, keeps imports minimal). */
function esc(v: unknown): string {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

            if (orderId === undefined || orderId === null || orderId === '') {
                // Expected for off-checkout payments — log and accept so
                // Stripe does not retry an event we will never act on.
                console.log(
                    '[stripe-webhook] PI ' + paymentIntent.id +
                    ' succeeded but no order_id in metadata. ' +
                    'Pass orderId in create-payment-intent body to enable auto-reconciliation.'
                );
            } else if (!isValidOrderId(orderId)) {
                // Malformed metadata — a permanently-bad event. 400 tells
                // Stripe to stop redelivering; 500 would retry for ~3 hours.
                console.error('[stripe-webhook] PI ' + paymentIntent.id + ' has malformed order_id metadata: ' + JSON.stringify(String(orderId).slice(0, 200)));
                res.status(400).json({ error: 'Malformed order_id metadata' });
                return;
            } else {
                const { reconciled, retryable } = await tryAutoReconcile(orderId, paymentIntent.id, event.id);
                if (!reconciled) {
                    // 500 only for transient failures (DB/network) — Stripe
                    // retries those. Permanent failures (missing order, RPC
                    // business reject) return 200: the admin alert email
                    // carries the signal, and redelivery could never change
                    // the outcome — it would just burn Stripe retries and
                    // spam the alert inbox.
                    if (retryable) {
                        res.status(500).json({ error: 'Auto-reconciliation failed — will retry' });
                        return;
                    }
                    res.status(200).json({ received: true, reconciled: false, reason: 'permanently unreconcilable — admin notified' });
                    return;
                }
                if (retryable) {
                    // Reconcile succeeded but the label purchase failed
                    // transiently — 500 asks Stripe to redeliver. The next
                    // attempt no-ops reconcile (already settled) and the
                    // shipments claim row gates the label retry.
                    res.status(500).json({ error: 'Label purchase failed — will retry' });
                    return;
                }
            }
        }

        res.status(200).json({ received: true });
    } catch (_err: unknown) {
        const message = _err instanceof Error ? _err.message : String(_err);
        console.error('[stripe-webhook] Event handling error:', message);
        res.status(500).json({ error: 'Event handling failed: ' + message });
    }
}
