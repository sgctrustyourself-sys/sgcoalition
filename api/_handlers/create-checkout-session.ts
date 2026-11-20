import { stripeClient } from '../../api/_services.js';
import { createLogger } from '../../utils/logger.js';
import { errorMessage } from '../../utils/errorMessage.js';
import type { ApiRequest, ApiResponse } from '../_types.js';

// Shape the client posts to this endpoint. Asserted once at the request
// boundary so the Stripe payload is built from named fields instead of `any`.
type CheckoutLineItem = {
    name: string;
    price: number;
    quantity: number;
    selectedSize?: string;
    keychainClipOn?: boolean;
    images?: string[];
};

type CheckoutSessionBody = { items?: CheckoutLineItem[] };

const checkoutSessionLog = createLogger('create-checkout-session');

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = stripeClient();

export default async function handler(req: ApiRequest, res: ApiResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition-five.vercel.app');
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
        const { items } = (req.body ?? {}) as CheckoutSessionBody;

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
            const hostHeader = req.headers?.host;
            const host = typeof hostHeader === 'string' ? hostHeader : undefined;
            if (host) {
                const protoHeader = req.headers?.['x-forwarded-proto'];
                const protocol = typeof protoHeader === 'string' && protoHeader ? protoHeader : 'http';
                origin = `${protocol}://${host}`;
            }
        }

        // Fallback 3: Hardcoded Fallback (The latest known working URL)
        if (!origin) {
            origin = 'https://sgcoalition-five.vercel.app';
        }

        // Remove trailing slash if present
        origin = origin.replace(/\/$/, '');

        // Ensure protocol is present (Stripe requires http:// or https://)
        if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
            origin = `https://${origin}`;
        }

        checkoutSessionLog.debug('Stripe checkout origin:', origin);

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map((item: CheckoutLineItem) => {
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
                            description: `Size: ${item.selectedSize}${item.keychainClipOn ? ' • Keychain clip-on' : ''}`,
                            images: itemImages,
                        },
                        unit_amount: Math.round((item.price + (item.keychainClipOn ? 10 : 0)) * 100), // Convert to cents
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
    } catch (err) {
        console.error('Stripe error:', err);
        res.status(500).json({ error: errorMessage(err) || 'Internal server error' });
    }
}
