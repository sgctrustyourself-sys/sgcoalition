import { createClient } from '@supabase/supabase-js';

interface HttpError extends Error {
    status?: number;
}

type NormalizedCheckoutItem = {
    productId: string;
    selectedSize: string;
    quantity: number;
    keychainClipOn: boolean;
};

const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const CURRENCY_CODE = 'USD';
const KEYCHAIN_CLIP_PRICE_CENTS = 1000;
const MAX_PAYPAL_QUANTITY = 99;

function setCorsHeaders(req: any, res: any) {
    const configuredOrigin = process.env.VITE_APP_URL || 'https://sgcoalition.xyz';
    const allowedOrigins = new Set([
        configuredOrigin,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
    ]);
    const requestOrigin = req.headers?.origin;
    const responseOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : configuredOrigin;

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function createHttpError(status: number, message: string): HttpError {
    const error = new Error(message) as HttpError;
    error.status = status;
    return error;
}

function parseBody(req: any) {
    if (!req.body) return {};
    if (typeof req.body !== 'string') return req.body;

    try {
        return JSON.parse(req.body);
    } catch {
        throw createHttpError(400, 'Invalid JSON request body.');
    }
}

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

function getSupabaseAdmin() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase product verification is not configured.');
    }

    return createClient(supabaseUrl, serviceRoleKey);
}

function moneyFromCents(cents: number) {
    return (Math.max(0, cents) / 100).toFixed(2);
}

function parseMoneyCents(value: unknown, fieldName: string) {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
        throw createHttpError(400, `${fieldName} must be a valid amount.`);
    }
    if (parsed < 0) {
        throw createHttpError(400, `${fieldName} cannot be negative.`);
    }
    return Math.round(parsed * 100);
}

function normalizeCheckoutItems(items: any[] = []): NormalizedCheckoutItem[] {
    if (!Array.isArray(items) || items.length === 0) {
        throw createHttpError(400, 'PayPal order requires at least one item.');
    }

    return items.map((item, index) => {
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

async function loadProductsForItems(items: NormalizedCheckoutItem[]) {
    const productIds = [...new Set(items.map(item => item.productId))];
    const { data, error } = await getSupabaseAdmin()
        .from('products')
        .select('id,name,price,category,archived,size_inventory')
        .in('id', productIds);

    if (error) {
        throw createHttpError(500, error.message || 'Unable to verify checkout products.');
    }

    const products = new Map<string, any>((data || []).map((product: any) => [String(product.id), product]));
    const missing = productIds.filter(id => !products.has(id));
    if (missing.length > 0) {
        throw createHttpError(409, `Checkout contains unavailable product(s): ${missing.join(', ')}.`);
    }

    return products;
}

function getExpectedUnitAmountCents(product: any, item: NormalizedCheckoutItem) {
    if (product?.archived) {
        throw createHttpError(409, `${product.name || 'This item'} is no longer available.`);
    }

    const basePriceCents = parseMoneyCents(product?.price, 'Product price');
    const category = String(product?.category || '').toLowerCase();
    const addOnCents = item.keychainClipOn && category === 'wallet' ? KEYCHAIN_CLIP_PRICE_CENTS : 0;

    if (item.keychainClipOn && category !== 'wallet') {
        throw createHttpError(409, `${product.name || 'This item'} does not support the keychain clip add-on.`);
    }

    const inventory = product?.size_inventory || {};
    if (inventory && Object.prototype.hasOwnProperty.call(inventory, item.selectedSize)) {
        const available = Number(inventory[item.selectedSize] || 0);
        if (available < item.quantity) {
            throw createHttpError(409, `${product.name || 'This item'} is no longer available in the requested quantity.`);
        }
    }

    return basePriceCents + addOnCents;
}

async function buildPayPalItems(items: NormalizedCheckoutItem[]) {
    const products = await loadProductsForItems(items);

    return items.map((item, index) => {
        const product = products.get(item.productId);
        const unitAmountCents = getExpectedUnitAmountCents(product, item);
        const name = String(product?.name || `Coalition Item ${index + 1}`).slice(0, 127);

        return {
            productId: item.productId,
            lineTotalCents: unitAmountCents * item.quantity,
            paypalItem: {
                name,
                quantity: String(item.quantity),
                category: 'PHYSICAL_GOODS',
                unit_amount: {
                    currency_code: CURRENCY_CODE,
                    value: moneyFromCents(unitAmountCents),
                },
            },
        };
    });
}

function getRequestId(prefix: string, value: unknown) {
    const normalized = String(value || `${prefix}_${Date.now()}`)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 96);
    return normalized || `${prefix}_${Date.now()}`;
}

async function getAccessToken() {
    const { clientId, clientSecret } = getPaypalCredentials();
    const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
        throw createHttpError(response.status || 502, data.error_description || data.error || 'Unable to authenticate with PayPal.');
    }

    return data.access_token as string;
}

async function createPaypalOrder(body: any) {
    const normalizedItems = normalizeCheckoutItems(Array.isArray(body.items) ? body.items : []);
    const lineItems = await buildPayPalItems(normalizedItems);
    const itemTotalCents = lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const shippingCents = parseMoneyCents(body.shipping || 0, 'Shipping');
    const discountCents = parseMoneyCents(body.discount || 0, 'Discount');

    if (discountCents > 0) {
        throw createHttpError(400, 'Store credit cannot be combined with PayPal yet. Turn off store credit or use it to cover the full order.');
    }

    if (shippingCents !== 0 && shippingCents !== 1000) {
        throw createHttpError(400, 'Invalid PayPal shipping amount.');
    }

    const orderTotalCents = itemTotalCents + shippingCents - discountCents;
    if (orderTotalCents <= 0) throw createHttpError(400, 'PayPal order total must be greater than zero.');

    const expectedTotalCents = body.expectedTotal === undefined ? orderTotalCents : parseMoneyCents(body.expectedTotal, 'Expected total');
    if (expectedTotalCents !== orderTotalCents) {
        throw createHttpError(409, 'PayPal order total changed. Refresh checkout and try again.');
    }

    const accessToken = await getAccessToken();
    const referenceId = String(body.referenceId || `coalition_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            'PayPal-Request-Id': getRequestId('create', referenceId),
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: referenceId,
                custom_id: referenceId,
                description: String(body.description || 'Coalition order').slice(0, 127),
                amount: {
                    currency_code: CURRENCY_CODE,
                    value: moneyFromCents(orderTotalCents),
                    breakdown: {
                        item_total: { currency_code: CURRENCY_CODE, value: moneyFromCents(itemTotalCents) },
                        shipping: { currency_code: CURRENCY_CODE, value: moneyFromCents(shippingCents) },
                        discount: { currency_code: CURRENCY_CODE, value: moneyFromCents(discountCents) },
                    },
                },
                items: lineItems.map(item => item.paypalItem),
            }],
        }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) {
        throw createHttpError(response.status || 502, data.message || data.error || 'Unable to create PayPal order.');
    }

    return { id: data.id, status: data.status, amount: moneyFromCents(orderTotalCents), referenceId };
}

async function capturePaypalOrder(body: any) {
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

    const data = await response.json().catch(() => ({}));
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

export default async function handler(req: any, res: any) {
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
        const body = parseBody(req);
        const action = String(body.action || '');

        if (action === 'create') {
            res.status(200).json(await createPaypalOrder(body));
            return;
        }

        if (action === 'capture') {
            res.status(200).json(await capturePaypalOrder(body));
            return;
        }

        res.status(400).json({ error: 'Invalid PayPal action.' });
    } catch (error: any) {
        const status = Number(error?.status || 500);
        console.error('[PayPal API]', error?.message || error);
        res.status(status).json({ error: error?.message || 'PayPal request failed.' });
    }
}
