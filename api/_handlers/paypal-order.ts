import { createClient } from '@supabase/supabase-js';
import { calculateAboveAsBelowSetBonusCents } from '../../utils/aboveAsBelowSet';
import { calculatePromoDiscountCents } from '../../utils/promoCodes';
import type {
    ApiRequest,
    ApiResponse,
    PayPalCaptureOrderInput,
    PayPalCreateOrderInput,
    PayPalNormalizedCheckoutItem,
    PayPalOrderResponse,
    PayPalPurchaseUnit,
    PayPalCapture,
    PayPalPayer,
    ProductRow,
    ResendEmailPayload,
    SupabaseClient,
} from '../_types';
import { setCorsHeaders, createHttpError, parseBody, type HttpError, LOCAL_DEV_ORIGINS } from '../_helpers';

type NormalizedCheckoutItem = PayPalNormalizedCheckoutItem;

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

function getPaypalCredentials(): { clientId: string; clientSecret: string } {
    const clientId = (process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || '').trim();
    const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();

    if (!clientId || !clientSecret) {
        throw createHttpError(503, 'PayPal server credentials are not configured.');
    }

    return { clientId, clientSecret };
}

function getSupabaseAdmin(): SupabaseClient {
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

interface RawCheckoutItem {
    productId?: unknown;
    product_id?: unknown;
    id?: unknown;
    quantity?: unknown;
    selectedSize?: unknown;
    size?: unknown;
    keychainClipOn?: unknown;
    keychain_clip_on?: unknown;
    [key: string]: unknown;
}

function normalizeCheckoutItems(items: unknown[] = []): NormalizedCheckoutItem[] {
    if (!Array.isArray(items) || items.length === 0) {
        throw createHttpError(400, 'PayPal order requires at least one item.');
    }

    return (items as RawCheckoutItem[]).map((item, index) => {
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

    const products = new Map<string, ProductRow>(((data ?? []) as ProductRow[]).map((product: ProductRow) => [String(product.id), product]));
    const missing = productIds.filter(id => !products.has(id));
    if (missing.length > 0) {
        throw createHttpError(409, `Checkout contains unavailable product(s): ${missing.join(', ')}.`);
    }

    return products;
}

function getExpectedUnitAmountCents(product: ProductRow | undefined, item: NormalizedCheckoutItem): number {
    if (!product || product.archived) {
        throw createHttpError(409, `${product?.name || 'This item'} is no longer available.`);
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

async function createPaypalOrder(body: PayPalCreateOrderInput): Promise<{ id: string; status: string; amount: string; referenceId: string }> {
    const normalizedItems = normalizeCheckoutItems(Array.isArray(body.items) ? body.items : []);
    const lineItems = await buildPayPalItems(normalizedItems);
    const itemTotalCents = lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const shippingCents = parseMoneyCents(body.shipping || 0, 'Shipping');
    const requestedDiscountCents = parseMoneyCents(body.discount || 0, 'Discount');
    // Server is the source of truth for cart discounts: re-derive them from
    // the cart contents and submitted promo code regardless of what the client
    // sent. Anything beyond legitimate discounts is treated as store-credit
    // abuse and rejected.
    const setBonusCents = calculateAboveAsBelowSetBonusCents(
        normalizedItems.map(item => ({ productId: item.productId, quantity: item.quantity })),
    );
    const promoDiscountCents = calculatePromoDiscountCents(Math.max(0, itemTotalCents - setBonusCents), body.couponCode);
    const allowedDiscountCents = setBonusCents + promoDiscountCents;
    const otherDiscountCents = Math.max(0, requestedDiscountCents - allowedDiscountCents);
    if (otherDiscountCents > 0) {
        throw createHttpError(400, 'Store credit cannot be combined with PayPal yet. Turn off store credit or use it to cover the full order.');
    }
    const discountCents = allowedDiscountCents;

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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { originWhitelist: LOCAL_DEV_ORIGINS, methods: 'POST,OPTIONS' });

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
    } catch (error: unknown) {
        const httpError = error as HttpError | null;
        const status = Number(httpError?.status || 500);
        console.error('[PayPal API]', httpError?.message ?? String(error));
        res.status(status).json({ error: httpError?.message || 'PayPal request failed.' });
    }
}
