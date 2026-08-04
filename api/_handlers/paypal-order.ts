import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    type ApiRequest,
    type ApiResponse,
    type PayPalCaptureOrderInput,
    type PayPalCreateOrderInput,
    type PayPalNormalizedCheckoutItem,
    type PayPalOAuthResponse,
    type PayPalOrderResponse,
} from '../_types';
import {
    createHttpError,
    parseBody,
    setCorsHeaders,
} from '../_helpers';
import { resolvePricing, type PricingItem, HttpError } from '../../services/orderIntake.js';

const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const CURRENCY_CODE = 'USD';
const KEYCHAIN_CLIP_PRICE_CENTS = 1000;
const MAX_PAYPAL_QUANTITY = 99;

function getPaypalBaseUrl() {
    const explicitBaseUrl = process.env.PAYPAL_API_BASE_URL?.trim();
    if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, '');

    const mode = (process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'live').toLowerCase();
    return mode === 'sandbox' ? PAYPAL_SANDBOX_API : PAYPAL_LIVE_API;
}

function getPaypalCredentials() {
    const clientId = (process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || '').trim();
    const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();

    if (!clientId || !clientSecret) {
        throw createHttpError(503, 'PayPal server credentials are not configured.');
    }

    return { clientId, clientSecret };
}

function moneyFromCents(cents: number) {
    return (Math.max(0, cents) / 100).toFixed(2);
}

function normalizeCheckoutItems(items: unknown[]): PayPalNormalizedCheckoutItem[] {
    if (!Array.isArray(items) || items.length === 0) {
        throw createHttpError(400, 'PayPal order requires at least one item.');
    }

    return items.map((rawItem, index) => {
        const item = (rawItem ?? {}) as Record<string, unknown>;
        const productId = String(item.productId || item.product_id || item.id || '').trim();
        if (!productId) {
            throw createHttpError(400, `Item ${index + 1} is missing a product ID.`);
        }

        const quantity = Number(item.quantity || 1);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PAYPAL_QUANTITY) {
            throw createHttpError(400, `Item ${index + 1} has an invalid quantity.`);
        }

        return {
            productId,
            selectedSize: String(item.selectedSize || item.size || 'One Size').trim() || 'One Size',
            quantity,
            keychainClipOn: Boolean(item.keychainClipOn || item.keychain_clip_on),
        };
    });
}

// Pricing delegated to the shared Order intake module.
function pricingItemsFromCheckout(items: PayPalNormalizedCheckoutItem[]): PricingItem[] {
    return items.map(i => ({ productId: i.productId, selectedSize: i.selectedSize, quantity: i.quantity, keychainClipOn: i.keychainClipOn }));
}

function getRequestId(prefix: string, value: unknown) {
    const normalized = String(value || `${prefix}_${Date.now()}`)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 96);
    return normalized || `${prefix}_${Date.now()}`;
}

async function getAccessToken(): Promise<string> {
    const { clientId, clientSecret } = getPaypalCredentials();
    const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    const data = (await response.json().catch(() => ({}))) as PayPalOAuthResponse;
    if (!response.ok || !data.access_token) {
        throw createHttpError(response.status || 502, data.error_description || data.error || 'Unable to authenticate with PayPal.');
    }

    return data.access_token;
}

async function createPaypalOrder(body: PayPalCreateOrderInput) {
    const normalizedItems = normalizeCheckoutItems(Array.isArray(body.items) ? body.items : []);

    // Use the shared pricing authority
    const pricing = await resolvePricing(
        pricingItemsFromCheckout(normalizedItems),
        Number(body.shipping || 0),
        Number(body.discount || 0),
        'paypal',
    );

    // Client total sanity check
    if (body.expectedTotal !== undefined) {
        const expectedCents = Math.round(Number(body.expectedTotal) * 100);
        if (expectedCents !== pricing.totalCents) {
            console.warn('[PayPal API] expectedTotal mismatch: client=' + expectedCents + 'c server=' + pricing.totalCents + 'c');
        }
    }

    if (pricing.totalCents <= 0) throw createHttpError(400, 'PayPal order total must be greater than zero.');

    // Build PayPal line items from the resolved pricing
    const paypalItems = pricing.items.map((pi, i) => ({
        name: pi.productName.slice(0, 127),
        quantity: String(pi.quantity),
        category: 'PHYSICAL_GOODS' as const,
        unit_amount: { currency_code: CURRENCY_CODE, value: moneyFromCents(pi.unitCents) },
    }));

    const accessToken = await getAccessToken();
    const referenceId = String(body.referenceId || 'coalition_' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const response = await fetch(getPaypalBaseUrl() + '/v2/checkout/orders', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json', Prefer: 'return=representation', 'PayPal-Request-Id': getRequestId('create', referenceId) },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: referenceId,
                custom_id: body.orderId || referenceId,
                description: String(body.description || 'Coalition order').slice(0, 127),
                amount: {
                    currency_code: CURRENCY_CODE,
                    value: moneyFromCents(pricing.totalCents),
                    breakdown: {
                        item_total: { currency_code: CURRENCY_CODE, value: moneyFromCents(pricing.itemTotalCents) },
                        shipping: { currency_code: CURRENCY_CODE, value: moneyFromCents(pricing.shippingCents) },
                        discount: { currency_code: CURRENCY_CODE, value: moneyFromCents(pricing.discountCents) },
                    },
                },
                items: paypalItems,
            }],
        }),
    });

    const data: PayPalOrderResponse = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) {
        throw createHttpError(response.status || 502, data.message || data.error || 'Unable to create PayPal order.');
    }

    return { id: data.id, status: data.status, amount: moneyFromCents(pricing.totalCents), referenceId };
}

async function capturePaypalOrder(body: PayPalCaptureOrderInput) {
    const orderId = String(body.orderId || '').trim();
    if (!orderId) throw createHttpError(400, 'PayPal order ID is required.');

    const accessToken = await getAccessToken();
    const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            'PayPal-Request-Id': getRequestId('capture', orderId),
        },
    });

    const data: PayPalOrderResponse = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw createHttpError(response.status || 502, data.message || data.error || 'Unable to capture PayPal order.');
    }

    const purchaseUnit = data.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    if (data.status !== 'COMPLETED' || capture?.status !== 'COMPLETED') {
        throw createHttpError(402, 'PayPal payment was not completed.');
    }

    return {
        orderId: data.id,
        status: data.status,
        captureId: capture.id,
        captureStatus: capture.status,
        amount: capture.amount,
        referenceId: purchaseUnit?.reference_id || purchaseUnit?.custom_id || null,
        payer: data.payer || null,
    };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const body = parseBody(req) as PayPalCreateOrderInput & PayPalCaptureOrderInput;
        const action = String(body.action || '');

        if (action === 'create') {
            res.status(200).json(await createPaypalOrder(body as PayPalCreateOrderInput));
            return;
        }

        if (action === 'capture') {
            res.status(200).json(await capturePaypalOrder(body as PayPalCaptureOrderInput));
            return;
        }

        res.status(400).json({ error: 'Invalid PayPal action.' });
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[PayPal API]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'PayPal request failed.' });
    }
}
