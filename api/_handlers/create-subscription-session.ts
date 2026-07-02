import Stripe from 'stripe';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, resolvePublicOrigin, setCorsHeaders, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    CheckoutSessionResponse,
    CreateSubscriptionSessionBody,
} from '../_types';

const CURRENCY = 'usd';
const VIP_MONTHLY_PRICE_CENTS = 1500;
const VIP_INTERVAL = 'month';
const VIP_PRODUCT_NAME = 'Coalition VIP Membership';
const VIP_PRODUCT_DESCRIPTION = 'Monthly Store Credit + Credit Building Reporting + Free Shipping';
const VIP_METADATA_TYPE = 'coalition_vip';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion omitted
});

async function createSubscriptionSession(req: ApiRequest): Promise<CheckoutSessionResponse> {
    const rawBody = parseBody(req);
    const body = rawBody as CreateSubscriptionSessionBody;
    const userId = body.userId ? String(body.userId) : 'guest';

    const origin = resolvePublicOrigin(req);

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: CURRENCY,
                    product_data: {
                        name: VIP_PRODUCT_NAME,
                        description: VIP_PRODUCT_DESCRIPTION,
                    },
                    unit_amount: VIP_MONTHLY_PRICE_CENTS,
                    recurring: {
                        interval: VIP_INTERVAL,
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
                type: VIP_METADATA_TYPE,
                userId,
            },
        },
        metadata: {
            userId,
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
        res.status(200).json(await createSubscriptionSession(req));
    } catch (error: unknown) {
        const message = (error as { message?: string } | null)?.message;
        const httpError = error as HttpError | null;
        const status = Number(httpError?.status || 500);
        console.error('Stripe Subscription Error:', error);
        res.status(status).json({ error: message || 'Internal server error' });
    }
}
