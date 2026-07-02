import Stripe from 'stripe';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, resolvePublicOrigin, setCorsHeaders, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    CheckoutSessionItemInput,
    CheckoutSessionResponse,
    CreateCheckoutSessionBody,
} from '../_types';

const KEYCHAIN_CLIP_PRICE_USD = 10;
const CURRENCY = 'usd';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted to use default
});

function absoluteImages(images: unknown, origin: string): string[] {
    if (!Array.isArray(images) || images.length === 0) return [];
    return images.map((raw: unknown) => {
        const img = String(raw ?? '');
        if (!img) return '';
        return img.startsWith('/') ? `${origin}${img}` : img;
    }).filter(Boolean);
}

async function createCheckoutSession(req: ApiRequest): Promise<CheckoutSessionResponse> {
    const rawBody = parseBody(req);
    const body = rawBody as CreateCheckoutSessionBody;
    const items = Array.isArray(body.items) ? (body.items as CheckoutSessionItemInput[]) : [];

    if (items.length === 0) {
        throw createHttpError(400, 'No items in cart');
    }

    const origin = resolvePublicOrigin(req);
    console.log('Stripe Checkout Origin:', origin);

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map((item: CheckoutSessionItemInput) => {
            const itemImages = absoluteImages(item.images, origin);
            const unitUsd = Number(item.price || 0) + (item.keychainClipOn ? KEYCHAIN_CLIP_PRICE_USD : 0);

            return {
                price_data: {
                    currency: CURRENCY,
                    product_data: {
                        name: String(item.name || 'Coalition Item'),
                        description: `Size: ${item.selectedSize || 'One Size'}${item.keychainClipOn ? ' \u2022 Keychain clip-on' : ''}`,
                        images: itemImages,
                    },
                    unit_amount: Math.round(unitUsd * 100),
                },
                quantity: Number(item.quantity || 1),
            };
        }),
        mode: 'payment',
        success_url: `${origin}/#/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/#/order/cancel`,
        shipping_address_collection: {
            allowed_countries: ['US', 'CA'],
        },
    });

    return { sessionId: session.id, url: session.url };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { methods: 'GET,OPTIONS,PATCH,DELETE,POST,PUT', allowedHeaders: EXTENDED_CORS_HEADERS });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        res.status(200).json(await createCheckoutSession(req));
    } catch (error: unknown) {
        const httpError = error as HttpError | null;
        const message = (error as { message?: string } | null)?.message;
        const status = Number(httpError?.status || 500);
        console.error('Stripe error:', error);
        res.status(status).json({ error: message || 'Internal server error' });
    }
}
