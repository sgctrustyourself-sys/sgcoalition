import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any })
    : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!stripe || !webhookSecret) { res.status(503).json({ error: 'Stripe webhook not configured.' }); return; }

    const signature = req.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
        // Vercel populates req.body as a string for non-JSON content types; for
        // the webhook we need the raw body bytes for signature verification.
        const rawBody = typeof req.body === 'string' ? req.body : (req.rawBody ?? JSON.stringify(req.body ?? ''));
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err?.message || err);
        res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
        return;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        try {
            const origin = (process.env.VITE_APP_URL || 'https://sgcoalition.xyz').replace(/\/$/, '');
            const metadata = (session.metadata || {}) as Record<string, string>;
            const adminToken = process.env.ADMIN_API_TOKEN || process.env.STRIPE_SECRET_KEY || '';
            const orderPayload = {
                action: 'create_from_stripe',
                stripeSessionId: session.id,
                stripePaymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
                userId: metadata.userId || null,
                orderSeed: metadata.orderSeed ? safeJsonParse(metadata.orderSeed) : {},
                shippingInfo: metadata.shippingInfo ? safeJsonParse(metadata.shippingInfo) : {},
                shippingMethod: metadata.shippingMethod || 'standard',
                items: metadata.items ? safeJsonParse(metadata.items) : [],
                amountTotal: (session.amount_total || 0) / 100,
                amountSubtotal: (session.amount_subtotal || 0) / 100,
                amountDiscount: (session.total_details?.amount_discount || 0) / 100,
                customerEmail: session.customer_details?.email || '',
                customerName: session.customer_details?.name || '',
            };
            const r = await fetch(`${origin}/api/complete-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}) },
                body: JSON.stringify(orderPayload),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                console.error('complete-order rejected the Stripe webhook payload:', r.status, text.slice(0, 500));
                res.status(500).json({ error: 'Order creation failed' });
                return;
            }
        } catch (e: any) {
            console.error('Failed to create order from Stripe webhook:', e?.message || e);
            res.status(500).json({ error: 'Order creation failed' });
            return;
        }
    }

    res.status(200).json({ received: true });
}

function safeJsonParse(s: string) {
    try { return JSON.parse(s); } catch { return {}; }
}
