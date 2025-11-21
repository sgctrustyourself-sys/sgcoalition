import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted to use default
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

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { items } = req.body;

        if (!items || items.length === 0) {
            res.status(400).json({ error: 'No items in cart' });
            return;
        }

        // Determine the base URL with multiple fallbacks
        let origin = process.env.VITE_APP_URL;

        // Fallback 1: VERCEL_URL (System env var, usually set by Vercel)
        if (!origin && process.env.VERCEL_URL) {
            origin = `https://${process.env.VERCEL_URL}`;
        }

        // Fallback 2: Request Headers
        if (!origin) {
            const host = req.headers.host;
            if (host) {
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                origin = `${protocol}://${host}`;
            }
        }

        // Fallback 3: Hardcoded Fallback (The latest known working URL)
        if (!origin) {
            origin = 'https://coalition-brand-m463tsoyc-derron-byrds-projects.vercel.app';
        }

        // Remove trailing slash if present
        origin = origin.replace(/\/$/, '');

        // Ensure protocol is present (Stripe requires http:// or https://)
        if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
            origin = `https://${origin}`;
        }

        console.log('Stripe Checkout Origin:', origin);

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map((item: any) => {
                // Fix image URLs: Stripe requires absolute URLs
                let itemImages: string[] = [];
                if (item.images && item.images.length > 0) {
                    itemImages = item.images.map((img: string) => {
                        if (img.startsWith('/')) {
                            return `${origin}${img}`;
                        }
                        return img;
                    });
                }

                return {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: item.name,
                            description: `Size: ${item.selectedSize}`,
                            images: itemImages,
                        },
                        unit_amount: Math.round(item.price * 100), // Convert to cents
                    },
                    quantity: item.quantity,
                };
            }),
            mode: 'payment',
            success_url: `${origin}/#/order/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/#/order/cancel`,
            shipping_address_collection: {
                allowed_countries: ['US', 'CA'],
            },
        });

        res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (err: any) {
        console.error('Stripe error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
