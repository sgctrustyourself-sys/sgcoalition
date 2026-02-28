import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted
});

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { userId } = req.body;

        // Determine origin for success/cancel URLs
        let origin = process.env.VITE_APP_URL;
        if (!origin && process.env.VERCEL_URL) {
            origin = `https://${process.env.VERCEL_URL}`;
        }
        if (!origin) {
            const host = req.headers.host;
            if (host) {
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                origin = `${protocol}://${host}`;
            }
        }
        if (!origin) {
            origin = 'https://sgcoalition.xyz';
        }
        origin = origin.replace(/\/$/, '');
        if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
            origin = `https://${origin}`;
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Coalition VIP Membership',
                            description: 'Monthly Store Credit + Credit Building Reporting + Free Shipping',
                            // Optional: Add logo if available
                        },
                        unit_amount: 1500, // $15.00
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/#/order/success?session_id={CHECKOUT_SESSION_ID}&type=membership`,
            cancel_url: `${origin}/#/membership`,
            subscription_data: {
                metadata: {
                    type: 'coalition_vip',
                    userId: userId || 'guest',
                },
            },
            metadata: {
                userId: userId || 'guest',
            },
        });

        res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (err: any) {
        console.error('Stripe Subscription Error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
