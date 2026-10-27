// api/whop-webhook.ts
// Whop webhook handler for card payment events
// Replace: api/stripe-webhook.ts

import { createHmac, timingSafeEqual } from 'node:crypto';
import { reconcilePayment, notifyAdminReconcileFailure } from '../services/orderIntake.js';
import { purchaseLabelForOrder } from '../services/shipping.js';
import { createLogger } from '../utils/logger.js';
import { originStatus } from './_helpers.js';

const webhookLog = createLogger('whop-webhook');

/** Read the raw body from the incoming request (string or Buffer). */
function readRawBody(req: {
    body?: unknown;
    on?: (event: string, cb: (chunk: unknown) => void) => void;
}): Promise<string> {
    return new Promise((resolve, reject) => {
        if (typeof req.body === 'string') {
            resolve(req.body);
            return;
        }
        if (Buffer.isBuffer(req.body)) {
            resolve(req.body.toString('utf8'));
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
            resolve(Buffer.concat(chunks).toString('utf8'));
        });
        req.on?.('error', (err: unknown) => {
            reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
}

/** Verify Whop webhook signature.
 *  Whop webhook signature format: "v1,<base64 HMAC-SHA256 of raw body using webhook secret>"
 *  The webhook secret starts with "ws_" and is stored as WHOP_WEBHOOK_SECRET.
 */
function verifyWhopSignature(
    rawBody: string,
    signatureHeader: string,
    webhookSecret: string
): { valid: boolean } {
    // Whop signature format: "v1,<base64 signature>"
    const match = signatureHeader.match(/^v1,(.+)$/);
    if (!match) {
        return { valid: false };
    }

    const signatureB64 = match[1];
    // Decode the base64 signature
    const signature = Buffer.from(signatureB64, 'base64');

    // Compute HMAC-SHA256 of the raw body using the webhook secret
    // The webhook secret from Whop starts with "ws_" - use it as-is
    //
    // `node:crypto` is imported at module scope on purpose: this package is
    // ESM (package.json "type": "module"), so loading crypto with a CommonJS
    // require from inside this function threw `ReferenceError: require is not
    // defined` on every real `v1,<sig>` delivery in production — a 500 that
    // made Whop retry and left paid orders unreconciled while GET/OPTIONS kept
    // the endpoint looking alive.
    const secretKey = webhookSecret.startsWith('ws_')
        ? webhookSecret
        : `ws_${webhookSecret}`;
    // Compare raw digest bytes against the decoded header bytes. Encoding the
    // digest as base64 here (Buffer.from(digest('base64'))) compares 44 UTF-8
    // bytes against the 32 decoded bytes and can never match a real delivery.
    const hmac = createHmac('sha256', secretKey);
    const computed = hmac.update(rawBody).digest();

    // timingSafeEqual throws RangeError when the buffers differ in length, so a
    // truncated or undecodable signature must be rejected here, not thrown.
    if (signature.length !== computed.length) {
        return { valid: false };
    }

    // Compare the signatures using constant-time comparison
    const isValid = timingSafeEqual(signature, computed);

    return { valid: isValid };
}

/** Check if an order_id is valid for reconciliation.
 *  A valid order_id is a non-empty string of reasonable length
 *  using only characters our order IDs use (`order_<digits>`).
 */
export function isValidOrderId(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
}

/** Auto-reconcile an order via the shared Order intake module. */
async function tryAutoReconcile(orderId: string, paymentIntentId: string, eventId?: string, deliveryHost?: string | null): Promise<{ reconciled: boolean; retryable: boolean }> {
    // Retry with exponential backoff: 3 attempts, starting at 100ms, doubling each time
    // Maximum total wait: 100ms + 200ms + 400ms = 700ms
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        const result = await reconcilePayment(orderId);
        if (result.success) {
            webhookLog.info('Reconciled order ' + orderId + ' (PI ' + paymentIntentId + ')');
            return await finishWithLabelPurchase(orderId, { reconciled: true, retryable: false });
        }

        // Permanent failures: retrying cannot fix it; back off then alert admin
        if (result.permanent) {
            // Last attempt — alert and give up
            if (attempt >= maxAttempts) {
                console.warn('[whop-webhook] Permanent reconcile failure for ' + orderId + ' (PI ' + paymentIntentId + '): ' + result.error);
                await notifyAdminReconcileFailure(orderId, paymentIntentId, result.error || 'Unknown reconcile failure', false, eventId, deliveryHost);
                return { reconciled: false, retryable: false };
            }
            // Back off before next attempt
            const backoffDelay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
            console.log(`⏳ Permanent failure, backing off ${Math.round(backoffDelay / 1000)}s before retry ${attempt}/${maxAttempts} for ${orderId}`);
            await new Promise(r => setTimeout(r, backoffDelay));
            continue;
        }

        // Transient failure — retry after backoff
        if (attempt >= maxAttempts) {
            console.warn('[whop-webhook] Transient reconcile failure exhausted for ' + orderId + ' (PI ' + paymentIntentId + '): ' + result.error);
            await notifyAdminReconcileFailure(orderId, paymentIntentId, result.error || 'Unknown reconcile failure', true, eventId, deliveryHost);
            return { reconciled: false, retryable: true };
        }
        // Back off before next attempt
        const backoffDelay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
        console.log(`⏳ Transient failure, backing off ${Math.round(backoffDelay / 1000)}s before retry ${attempt}/${maxAttempts} for ${orderId}`);
        await new Promise(r => setTimeout(r, backoffDelay));
    }
    // Should not reach here, but just in case:
    return { reconciled: false, retryable: false };
}

/** After a successful reconcile, buy the shipping label. */
async function finishWithLabelPurchase(orderId: string, verdict: { reconciled: boolean; retryable: boolean }): Promise<{ reconciled: boolean; retryable: boolean }> {
    try {
        const label = await purchaseLabelForOrder(orderId);
        if (label.outcome === 'purchased') {
            webhookLog.info('Shipping label purchased for ' + orderId);
        } else if (label.outcome === 'retryable') {
            console.warn('[whop-webhook] Label purchase failed (transient) for ' + orderId + ': ' + label.reason);
            return { reconciled: true, retryable: true };
        } else if (label.outcome === 'failed') {
            // Permanent — email the admin; a redelivery could never fix a
            // bad address or a rate cap, so don't burn Whop retries.
            console.warn('[whop-webhook] Label purchase failed (permanent) for ' + orderId + ': ' + label.reason);
            await notifyAdminLabelFailure(orderId, label.reason);
        }
        // 'skipped' is neutral: not configured, already claimed by a
        // concurrent delivery, or the order wasn't in a label-eligible state.
    } catch (e) {
        // Defensive: the service resolves every path internally, but a throw
        // here must degrade to the webhook's transient behavior, not 500-crash
        // a successfully-reconciled payment.
        console.warn('[whop-webhook] Label purchase threw for ' + orderId, e);
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
            + '<p>The order was paid but no label was bought. Reason: <strong>' + reason + '</strong></p>'
            + '<p>Buy the label manually in Shippo (or fix the cause and let the next webhook redelivery retry), then fulfill the order.</p>'
            + '<p><a href="https://sgcoalition-five.vercel.app/#/admin?tab=orders&q=' + encodeURIComponent(orderId) + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Open order in Admin</a></p>'
            + '<p style="color:#6b7280;">Order ID: <code>' + orderId + '</code></p>'
            + '</div>';
        await resendClient().emails.send({ from: process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>', to: rcpts, subject: 'ACTION REQUIRED: label failed for ' + orderId, html } as never);
    } catch (e) {
        console.warn('[whop-webhook] Label-failure alert email failed:', e);
    }
}

/** Whop webhook handler for card payment events. */
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

    // Which host actually took this delivery. When it is not the configured
    // origin, the Whop endpoint (or the DNS behind it) is pointed somewhere
    // other than where this deployment expects to be — the exact class of
    // misconfiguration that makes orders quietly fail to reconcile. The
    // delivery is still processed: the order must land even if the hostname
    // is off, and rejecting it would leave a paid order with no order at all.
    // It is recorded on the failure alert instead.
    const origin = originStatus(
        typeof req.headers?.host === 'string' ? req.headers.host : null
    );
    const deliveryHost = origin.requestHost;
    if (origin.matches === false) {
        console.warn(
            '[whop-webhook] Delivery landed on ' + deliveryHost +
            ' but VITE_APP_URL names ' + origin.configuredHost +
            ' — check the Whop webhook URL and DNS for this domain.'
        );
    }

    const signature = String(req.headers['whop-signature'] ?? '');
    const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('[whop-webhook] WHOP_WEBHOOK_SECRET is not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
    }

    let rawBody: string;
    try {
        rawBody = await readRawBody(req);
    } catch (_err: unknown) {
        console.error('[whop-webhook] Failed to read raw body:', _err);
        res.status(400).json({ error: 'Failed to read request body' });
        return;
    }

    // Verify the Whop webhook signature
    const verification = verifyWhopSignature(rawBody, signature, webhookSecret);
    if (!verification.valid) {
        console.error('[whop-webhook] Signature verification failed');
        res.status(400).json({ error: 'Webhook signature verification failed' });
        return;
    }

    // Parse the event - Whop sends JSON body
    let event: any;
    try {
        event = JSON.parse(rawBody);
    } catch (_err: unknown) {
        console.error('[whop-webhook] Failed to parse event JSON:', _err);
        res.status(400).json({ error: 'Failed to parse webhook event' });
        return;
    }

    try {
        if (event.type === 'payment.succeeded') {
            const payment = event.data.object;
            const orderId = payment.metadata?.order_id;

            if (orderId === undefined || orderId === null || orderId === '') {
                // Expected for off-checkout payments — log and accept so
                // Whop does not retry an event we will never act on.
                webhookLog.info(
                    'PI ' + payment.id + ' succeeded but no order_id in metadata. ' +
                    'Pass orderId in create-payment-intent body to enable auto-reconciliation.'
                );
            } else if (!isValidOrderId(orderId)) {
                // Malformed metadata — a permanently-bad event. 400 tells
                // Whop to stop redelivering; 500 would retry for ~24 hours.
                console.error('[whop-webhook] PI ' + payment.id + ' has malformed order_id metadata: ' + JSON.stringify(String(orderId).slice(0, 200)));
                res.status(400).json({ error: 'Malformed order_id metadata' });
                return;
            } else {
                const { reconciled, retryable } = await tryAutoReconcile(orderId, payment.id, event.id, deliveryHost);
                if (!reconciled) {
                    // 500 only for transient failures (DB/network, or an
                    // order whose write has not landed yet — that write is
                    // what this webhook races) — Whop retries those.
                    // Permanent failures (RPC business reject) return 200: the
                    // admin alert email carries the signal, and redelivery
                    // could never change the outcome — it would just burn
                    // Whop retries and spam the alert inbox.
                    if (retryable) {
                        res.status(500).json({ error: 'Auto-reconciliation failed — will retry' });
                        return;
                    }
                    res.status(200).json({ received: true, reconciled: false, reason: 'permanently unreconcilable — admin notified' });
                    return;
                }
                if (retryable) {
                    // Reconcile succeeded but the label purchase failed
                    // transiently — 500 asks Whop to redeliver. The next
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
        console.error('[whop-webhook] Event handling error:', message);
        res.status(500).json({ error: 'Event handling failed: ' + message });
    }
}