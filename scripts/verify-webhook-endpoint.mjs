// scripts/verify-webhook-endpoint.mjs
//
// Answers one question that no dashboard shows you: does the host I am
// about to point Stripe at actually SERVE this deployment's webhook
// handler?
//
// The failure this exists for is silent by construction. A Stripe endpoint
// aimed at a hostname that no longer serves the app (a dead alias, a
// domain still pointing at the previous host) never reaches any code: no
// handler runs, no error is raised, and the app looks perfectly healthy
// while money moves and orders never reconcile. Nothing in the app can
// observe it, because nothing is delivered.
//
// How it works: it signs a synthetic `payment_intent.succeeded` event with
// the real STRIPE_WEBHOOK_SECRET and POSTs it. The event carries NO
// order_id in metadata, so the handler takes its documented
// "expected for off-checkout payments" branch — it logs, returns 200, and
// touches no order and sends no admin email. A real order is never at
// risk.
//
// The four outcomes it distinguishes:
//   SERVING + VERIFIED  200 — the handler ran and the signature matched.
//   SERVING, SECRET?    400 + "signature verification failed" — the handler
//                        is live but the secret does not match the one the
//                        host expects. The endpoint is fine; the secret you
//                        are holding belongs to a different endpoint.
//   NOT SERVING         402 / 404 / 5xx — a webhook aimed here never
//                        arrives. Fix the hostname before it costs money.
//   OK but no order_id  200 with an ack — the whole path is live.
//
// Usage:
//   STRIPE_WEBHOOK_SECRET=whsec_... node scripts/verify-webhook-endpoint.mjs https://sgcoalition.shop
//
// Exit code 0 when the endpoint is serving, 1 when it is not, 2 on a usage
// error. Safe to point at production: it writes nothing.

import { createHmac } from 'node:crypto';

const baseUrl = (process.argv[2] || '').replace(/\/+$/, '');
if (!baseUrl) {
    console.error('usage: node scripts/verify-webhook-endpoint.mjs <baseUrl>');
    process.exitCode = 2;
}

const secret = process.env.STRIPE_WEBHOOK_SECRET;
if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    process.exitCode = 2;
}

const event = {
    id: 'evt_verify_endpoint_1',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
        object: {
            id: 'pi_verify_endpoint_1',
            object: 'payment_intent',
            amount: 1,
            currency: 'usd',
            // No order_id: the handler acknowledges without touching an order.
            metadata: {},
        },
    },
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signed = `${timestamp}.${payload}`;
const signature = createHmac('sha256', secret).update(signed).digest('hex');

let response;
try {
    response = await fetch(`${baseUrl}/api/stripe-webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'stripe-signature': `t=${timestamp},v1=${signature}`,
        },
        body: payload,
    });
} catch (error) {
    console.log(`host:    ${baseUrl}`);
    console.log('VERDICT: NOT SERVING — the host could not be reached at all');
    console.log(`detail:  ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}

const text = await response.text();
console.log(`host:    ${baseUrl}`);
console.log(`status:  ${response.status}`);
console.log(`body:    ${text.slice(0, 220).replace(/\n/g, ' ')}`);

if (response.status === 200) {
    console.log('VERDICT: SERVING + VERIFIED — the handler ran and the signature matched.');
    process.exitCode = 0;
} else if (response.status === 400 && /signature verification failed/i.test(text)) {
    // A 400 carrying Stripe's verifier message is the handler's own response:
    // it proves the code is live and reached signature verification. Only the
    // secret failed to match.
    console.log('VERDICT: SERVING, SECRET MISMATCH — the handler is live and verifying,');
    console.log('         but this STRIPE_WEBHOOK_SECRET is not the one it expects.');
    console.log('         The endpoint is fine; you are holding a different endpoint\'s secret.');
    process.exitCode = 0;
} else {
    console.log('VERDICT: NOT SERVING — a webhook aimed at this host never arrives.');
    console.log('         Point Stripe at a host that answers the webhook route.');
    process.exitCode = 1;
}
