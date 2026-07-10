import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { calculateAboveAsBelowSetBonusCents } from '../../utils/aboveAsBelowSet.js';

interface HttpError extends Error {
    status?: number;
}

const CURRENCY_CODE = 'usd';
const KEYCHAIN_CLIP_PRICE_CENTS = 1000;
const MAX_QUANTITY = 99;

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY is missing -- /api/stripe-checkout will return 503.');
}
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any })
    : null;

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
    try { return JSON.parse(req.body); } catch { throw createHttpError(400, 'Invalid JSON request body.'); }
}

function getSupabaseAdmin() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) throw createHttpError(503, 'Supabase product verification is not configured.');
    return createClient(supabaseUrl, serviceRoleKey);
}

function parseMoneyCents(value: unknown, fieldName: string) {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) throw createHttpError(400, `${fieldName} must be a valid amount.`);
    if (parsed < 0) throw createHttpError(400, `${fieldName} cannot be negative.`);
    return Math.round(parsed * 100);
}

function normalizeCheckoutItems(items: any[] = []) {
    if (!Array.isArray(items) || items.length === 0) throw createHttpError(400, 'Stripe checkout requires at least one item.');
    return items.map((item, index) => {
        const productId = String(item.productId || item.product_id || item.id || '').trim();
        if (!productId) throw createHttpError(400, `Item ${index + 1} is missing a product ID.`);
        const quantity = Number(item.quantity || 1);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
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

async function loadProductsForItems(items: any[]) {
    const productIds = [...new Set(items.map((item: any) => item.productId))];
    const { data, error } = await getSupabaseAdmin()
        .from('products')
        .select('id,name,price,category,archived,size_inventory,images')
        .in('id', productIds);
    if (error) throw createHttpError(500, error.message || 'Unable to verify checkout products.');
    const products = new Map<string, any>((data || []).map((p: any) => [String(p.id), p]));
    const missing = productIds.filter((id: string) => !products.has(id));
    if (missing.length > 0) throw createHttpError(409, `Checkout contains unavailable product(s): ${missing.join(', ')}.`);
    return products;
}

function getExpectedUnitAmountCents(product: any, item: any) {
    if (product?.archived) throw createHttpError(409, `${product.name || 'This item'} is no longer available.`);
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

export default async function handler(req: any, res: any) {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!stripe) { res.status(503).json({ error: 'Stripe server credentials are not configured.' }); return; }

    try {
        const body = parseBody(req);
        const normalizedItems = normalizeCheckoutItems(body.items);
        const products = await loadProductsForItems(normalizedItems);

        const origin = (process.env.VITE_APP_URL || 'https://sgcoalition.xyz').replace(/\/$/, '');
        let itemTotalCents = 0;
        const lineItems: any[] = normalizedItems.map((item, index) => {
            const product = products.get(item.productId);
            const unitAmountCents = getExpectedUnitAmountCents(product, item);
            itemTotalCents += unitAmountCents * item.quantity;
            const name = String(product?.name || `Coalition Item ${index + 1}`).slice(0, 127);
            const imageUrl = Array.isArray(product?.images) && product.images.length > 0
                ? (String(product.images[0]).startsWith('/') ? `${origin}${product.images[0]}` : product.images[0])
                : undefined;
            return {
                price_data: {
                    currency: CURRENCY_CODE,
                    product_data: {
                        name,
                        description: `Size: ${item.selectedSize}${item.keychainClipOn ? ' - Keychain clip-on' : ''}`.slice(0, 500),
                        ...(imageUrl ? { images: [String(imageUrl).slice(0, 2000)] } : {}),
                    },
                    unit_amount: unitAmountCents,
                },
                quantity: item.quantity,
            };
        });

        const shippingCents = parseMoneyCents(body.shipping || 0, 'Shipping');
        const requestedDiscountCents = parseMoneyCents(body.discount || 0, 'Discount');
        const setBonusCents = calculateAboveAsBelowSetBonusCents(
            normalizedItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );
        const otherDiscountCents = Math.max(0, requestedDiscountCents - setBonusCents);
        if (otherDiscountCents > 0) {
            throw createHttpError(400, 'Store credit cannot be combined with Stripe yet. Turn off store credit or use it to cover the full order.');
        }
        const orderTotalCents = itemTotalCents + shippingCents - setBonusCents;
        const expectedTotalCents = body.expectedTotal === undefined ? orderTotalCents : parseMoneyCents(body.expectedTotal, 'Expected total');
        if (expectedTotalCents !== orderTotalCents) {
            throw createHttpError(409, 'Order total changed. Refresh checkout and try again.');
        }
        if (shippingCents > 0) {
            lineItems.push({
                price_data: {
                    currency: CURRENCY_CODE,
                    product_data: { name: shippingCents === 1000 ? 'Express Shipping' : 'Standard Shipping' },
                    unit_amount: shippingCents,
                },
                quantity: 1,
            });
        }

        const discounts: any[] = [];
        if (setBonusCents > 0) {
            const coupon = await stripe.coupons.create({
                amount_off: setBonusCents,
                currency: CURRENCY_CODE,
                duration: 'once',
                name: 'Above As Below Set Bonus',
            });
            discounts.push({ coupon: coupon.id });
        }

        const metadata = {
            userId: body.userId || '',
            orderSeed: JSON.stringify(body.orderSeed || {}),
            shippingInfo: JSON.stringify(body.shippingInfo || {}),
            shippingMethod: body.shippingMethod || 'standard',
            items: JSON.stringify(body.items || []),
        };

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            ...(discounts.length > 0 ? { discounts } : {}),
            metadata,
            success_url: `${origin}/#/order/success?session_id={CHECKOUT_SESSION_ID}&payment_method=card&shippingMethod=${encodeURIComponent(metadata.shippingMethod)}&shippingCost=${(shippingCents / 100).toFixed(2)}`,
            cancel_url: `${origin}/#/checkout`,
        });

        res.status(200).json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
        const status = Number(error?.status || 500);
        console.error('[Stripe Checkout API]', error?.message || error);
        res.status(status).json({ error: error?.message || 'Stripe request failed.' });
    }
}
