import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { calculateAboveAsBelowSetBonusCents } from '../../utils/aboveAsBelowSet';

interface HttpError extends Error {
    status?: number;
}

const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const DEFAULT_ORDER_NOTIFICATION_EMAIL = 'sgctrustyourself@gmail.com';
const CURRENCY_CODE = 'USD';
const KEYCHAIN_CLIP_PRICE_CENTS = 1000;
const MAX_PAYPAL_QUANTITY = 99;

type OrderSaveResult = {
    record: any;
    created: boolean;
};

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
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function createHttpError(status: number, message: string): HttpError {
    const error = new Error(message) as HttpError;
    error.status = status;
    return error;
}

function parseBody(req: any) {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            throw createHttpError(400, 'Invalid JSON request body.');
        }
    }
    return req.body;
}

function getSupabaseAdmin() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase order service is not configured.');
    }

    return createClient(supabaseUrl, serviceRoleKey);
}

function getBearerToken(req: any) {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

async function isAdminRequest(req: any) {
    const token = getBearerToken(req);
    if (!token) return false;

    const staticAdminToken = process.env.ADMIN_API_TOKEN;
    if (staticAdminToken && token === staticAdminToken) return true;

    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
        if (!supabaseUrl || !anonKey) return false;

        const authClient = createClient(supabaseUrl, anonKey);
        const adminClient = getSupabaseAdmin();
        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        const userId = userData?.user?.id;
        if (userError || !userId) return false;

        const { data, error } = await adminClient
            .from('admin_users')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

        return !error && Boolean(data);
    } catch {
        return false;
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
    if (!clientId || !clientSecret) throw createHttpError(503, 'PayPal server credentials are not configured.');
    return { clientId, clientSecret };
}

async function getPaypalAccessToken() {
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

function money(value: unknown) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return '0.00';
    return Math.max(0, parsed).toFixed(2);
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

function assertCentsEqual(actual: number, expected: number, message: string) {
    if (actual !== expected) {
        throw createHttpError(409, message);
    }
}

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getOrderNotificationRecipients() {
    return (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || DEFAULT_ORDER_NOTIFICATION_EMAIL)
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);
}

function getResendFromAddress() {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

async function sendResendEmail(resend: Resend, payload: any) {
    const result = await resend.emails.send({
        ...payload,
        from: getResendFromAddress(),
    });

    const error = (result as any)?.error;
    if (error) {
        throw new Error(error.message || 'Resend rejected the email request.');
    }

    return result;
}


async function verifyPayPalCapture(order: any, verification: any) {
    const paypalOrderId = String(verification?.paypalOrderId || order.paypalOrderId || order.paypal_order_id || '').trim();
    const paypalCaptureId = String(verification?.paypalCaptureId || order.paypalCaptureId || order.paymentReference || order.payment_reference || '').trim();

    if (!paypalOrderId || !paypalCaptureId) {
        throw createHttpError(400, 'PayPal verification IDs are required.');
    }

    const accessToken = await getPaypalAccessToken();
    const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw createHttpError(response.status || 502, data.message || data.error || 'Unable to verify PayPal order.');
    }

    const purchaseUnit = data.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.find((item: any) => item.id === paypalCaptureId);
    if (data.status !== 'COMPLETED' || capture?.status !== 'COMPLETED') {
        throw createHttpError(402, 'PayPal capture is not completed.');
    }

    if (purchaseUnit?.reference_id && order.id && purchaseUnit.reference_id !== order.id) {
        throw createHttpError(409, 'PayPal order reference does not match the submitted order.');
    }

    if (capture.amount?.currency_code !== CURRENCY_CODE || money(capture.amount?.value) !== money(order.total)) {
        throw createHttpError(409, 'PayPal capture amount does not match order total.');
    }

    return {
        paypalOrderId,
        paypalCaptureId,
        payerEmail: data.payer?.email_address || null,
    };
}

async function loadProductsForOrder(supabase: any, items: any[]) {
    const productIds = [...new Set(items.map(item => String(item.productId || '').trim()).filter(Boolean))];
    if (productIds.length === 0 || productIds.length !== items.length) {
        throw createHttpError(400, 'Every PayPal order item requires a product ID.');
    }

    const { data, error } = await supabase
        .from('products')
        .select('id,name,price,category,archived,size_inventory')
        .in('id', productIds);

    if (error) {
        throw createHttpError(500, error.message || 'Unable to verify checkout products.');
    }

    const products = new Map<string, any>((data || []).map((product: any) => [String(product.id), product]));
    const missing = productIds.filter(id => !products.has(id));
    if (missing.length > 0) {
        throw createHttpError(409, `Order contains unavailable product(s): ${missing.join(', ')}.`);
    }

    return products;
}

function getExpectedItemUnitCents(product: any, item: any) {
    if (product?.archived) {
        throw createHttpError(409, `${product.name || 'This item'} is no longer available.`);
    }

    const quantity = Number(item.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PAYPAL_QUANTITY) {
        throw createHttpError(400, `${item.productName || 'Order item'} has an invalid quantity.`);
    }

    const category = String(product?.category || '').toLowerCase();
    const basePriceCents = parseMoneyCents(product?.price, 'Product price');
    const addOnCents = item.keychainClipOn && category === 'wallet' ? KEYCHAIN_CLIP_PRICE_CENTS : 0;

    if (item.keychainClipOn && category !== 'wallet') {
        throw createHttpError(409, `${product.name || 'This item'} does not support the keychain clip add-on.`);
    }

    const selectedSize = String(item.selectedSize || 'One Size');
    const inventory = product?.size_inventory || {};
    if (inventory && Object.prototype.hasOwnProperty.call(inventory, selectedSize)) {
        const available = Number(inventory[selectedSize] || 0);
        if (available < quantity) {
            throw createHttpError(409, `${product.name || 'This item'} is no longer available in the requested quantity.`);
        }
    }

    return basePriceCents + addOnCents;
}

async function validatePayPalOrderRecord(supabase: any, record: any) {
    const items = normalizeOrderItems(Array.isArray(record.items) ? record.items : []);
    if (items.length === 0) throw createHttpError(400, 'PayPal order requires at least one item.');

    const products = await loadProductsForOrder(supabase, items);
    let subtotalCents = 0;

    const sanitizedItems = items.map(item => {
        const product = products.get(String(item.productId));
        const quantity = Math.max(1, Number(item.quantity || 1));
        const unitCents = getExpectedItemUnitCents(product, item);
        const lineCents = unitCents * quantity;

        assertCentsEqual(parseMoneyCents(item.price, 'Item price'), unitCents, 'PayPal item price does not match current product pricing.');
        assertCentsEqual(parseMoneyCents(item.total || Number(item.price || 0) * quantity, 'Item total'), lineCents, 'PayPal item total does not match current product pricing.');

        subtotalCents += lineCents;

        return {
            ...item,
            productName: product?.name || item.productName,
            name: product?.name || item.name,
            price: Number(moneyFromCents(unitCents)),
            basePrice: Number(product?.price || item.basePrice || 0),
            addOnPrice: item.keychainClipOn ? KEYCHAIN_CLIP_PRICE_CENTS / 100 : 0,
            total: Number(moneyFromCents(lineCents)),
        };
    });

    const shippingCents = parseMoneyCents(record.shipping_address?.shippingCost || 0, 'Shipping');
    const requestedDiscountCents = parseMoneyCents(record.discount || 0, 'Discount');
    // Same logic as paypal-order: server owns the set bonus, anything else
    // implies store credit abuse (since PayPal orders can't redeem SGCoin).
    const setBonusCents = calculateAboveAsBelowSetBonusCents(
        items.map(item => ({ productId: item.productId, quantity: item.quantity })),
    );
    const otherDiscountCents = Math.max(0, requestedDiscountCents - setBonusCents);
    if (otherDiscountCents > 0) {
        throw createHttpError(400, 'Store credit cannot be combined with PayPal yet. Turn off store credit or use it to cover the full order.');
    }
    const discountCents = setBonusCents;

    if (shippingCents !== 0 && shippingCents !== 1000) {
        throw createHttpError(400, 'Invalid PayPal shipping amount.');
    }

    const expectedTotalCents = subtotalCents + shippingCents - discountCents;
    assertCentsEqual(parseMoneyCents(record.subtotal, 'Order subtotal'), subtotalCents, 'PayPal subtotal does not match order items.');
    assertCentsEqual(parseMoneyCents(record.total, 'Order total'), expectedTotalCents, 'PayPal order total does not match order items.');

    return {
        ...record,
        items: sanitizedItems,
        subtotal: Number(moneyFromCents(subtotalCents)),
        discount: Number(moneyFromCents(discountCents)),
        total: Number(moneyFromCents(expectedTotalCents)),
        shipping_address: {
            ...(record.shipping_address || {}),
            shippingCost: Number(moneyFromCents(shippingCents)),
        },
    };
}

function normalizeOrderItems(items: any[] = []) {
    return items.map((item, index) => ({
        productId: item.productId || item.product_id || item.id || `item_${index}`,
        productName: item.productName || item.name || 'Product',
        productImage: item.productImage || item.image || '',
        selectedSize: item.selectedSize || item.size || 'One Size',
        quantity: Math.max(1, Number(item.quantity || 1)),
        price: Number(item.price || 0),
        basePrice: Number(item.basePrice || item.base_price || item.price || 0),
        addOnPrice: Number(item.addOnPrice || item.add_on_price || 0),
        keychainClipOn: Boolean(item.keychainClipOn || item.keychain_clip_on),
        addOnLabel: item.addOnLabel || item.add_on_label || undefined,
        total: Number(item.total || 0),
        name: item.name || item.productName || 'Product',
        image: item.image || item.productImage || '',
        size: item.size || item.selectedSize || 'One Size',
    }));
}

function toNullableUuid(value?: string | null) {
    const text = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
        ? text
        : null;
}

function toOrderRecord(order: any, paymentVerification?: any) {
    const items = normalizeOrderItems(Array.isArray(order.items) ? order.items : []);
    const paymentMethod = String(order.paymentMethod || order.payment_method || '').toLowerCase();
    const paymentReference = paymentVerification?.paypalCaptureId || order.paymentReference || order.payment_reference || null;
    const paypalOrderId = paymentVerification?.paypalOrderId || order.paypalOrderId || null;

    return {
        id: order.id || `order_${Date.now()}`,
        order_number: order.orderNumber || order.order_number || `ORD-${Date.now()}`,
        user_id: toNullableUuid(order.userId || order.user_id),
        is_guest: Boolean(order.isGuest ?? order.is_guest ?? !order.userId),
        customer_name: String(order.customerName || order.customer_name || 'Customer'),
        customer_email: String(order.customerEmail || order.customer_email || ''),
        customer_phone: String(order.customerPhone || order.customer_phone || ''),
        items,
        subtotal: Number(order.subtotal || 0),
        tax: Number(order.tax || 0),
        discount: Number(order.discount || 0),
        total: Number(order.total || 0),
        payment_method: paymentMethod || 'unknown',
        payment_status: order.paymentStatus || order.payment_status || 'pending',
        payment_reference: paymentReference,
        paypal_order_id: paypalOrderId,
        order_type: order.orderType || order.order_type || 'online',
        shipping_address: order.shippingAddress || order.shipping_address || null,
        notes: order.notes || '',
        created_at: order.createdAt || order.created_at || new Date().toISOString(),
        paid_at: order.paidAt || order.paid_at || null,
        sg_coin_reward: Number(order.sgCoinReward || order.sg_coin_reward || 0),
    };
}

function toEmailOrder(record: any) {
    return {
        id: record.order_number || record.id,
        customerName: record.customer_name,
        customerEmail: record.customer_email,
        items: normalizeOrderItems(record.items).map(item => ({
            name: item.productName,
            size: item.selectedSize,
            quantity: item.quantity,
            price: item.price,
        })),
        total: Number(record.total || 0),
        paymentMethod: record.payment_method,
        shippingMethod: 'standard',
        shippingCost: record.shipping_address?.shippingCost || 0,
        sgCoinReward: Number(record.sg_coin_reward || 0),
    };
}

function isOptionalPaymentColumnError(error: any) {
    const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return text.includes('payment_reference')
        || text.includes('paypal_order_id')
        || text.includes('schema cache')
        || text.includes('column');
}

function toLegacyOrderRecord(record: any) {
    const legacyRecord = { ...record };
    const reference = legacyRecord.payment_reference;
    const paypalOrderId = legacyRecord.paypal_order_id;

    delete legacyRecord.payment_reference;
    delete legacyRecord.paypal_order_id;

    const paymentNotes = [
        reference ? `Payment reference: ${reference}` : '',
        paypalOrderId ? `PayPal order ID: ${paypalOrderId}` : '',
    ].filter(Boolean).join('\n');

    if (paymentNotes) {
        legacyRecord.notes = [legacyRecord.notes, paymentNotes].filter(Boolean).join('\n');
    }

    return legacyRecord;
}

async function findExistingPayPalOrder(supabase: any, record: any) {
    if (record.payment_method !== 'paypal') return null;

    if (record.paypal_order_id) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('paypal_order_id', record.paypal_order_id)
            .maybeSingle();

        if (error) {
            if (isOptionalPaymentColumnError(error)) {
                throw createHttpError(503, 'Order schema is missing PayPal payment columns. Apply the PayPal order migration before accepting live PayPal orders.');
            }
            throw createHttpError(500, error.message || 'Failed to check existing PayPal order.');
        }
        if (data) return data;
    }

    if (record.payment_reference) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('payment_reference', record.payment_reference)
            .maybeSingle();

        if (error) {
            if (isOptionalPaymentColumnError(error)) {
                throw createHttpError(503, 'Order schema is missing PayPal payment columns. Apply the PayPal order migration before accepting live PayPal orders.');
            }
            throw createHttpError(500, error.message || 'Failed to check existing PayPal capture.');
        }
        if (data) return data;
    }

    return null;
}

function validateExistingPaymentMatch(existing: any, record: any) {
    if (money(existing.total) !== money(record.total)) {
        throw createHttpError(409, 'Existing PayPal order total does not match this checkout attempt.');
    }
    if (existing.payment_reference && record.payment_reference && existing.payment_reference !== record.payment_reference) {
        throw createHttpError(409, 'Existing PayPal capture does not match this checkout attempt.');
    }
}

async function upsertOrderRecord(supabase: any, record: any, options: { requirePaymentColumns?: boolean } = {}): Promise<OrderSaveResult> {
    const existing = await findExistingPayPalOrder(supabase, record);
    if (existing) {
        validateExistingPaymentMatch(existing, record);
        return { record: existing, created: false };
    }

    const result = await supabase
        .from('orders')
        .upsert(record, { onConflict: 'id' })
        .select()
        .single();

    if (!result.error) return { record: result.data || record, created: true };

    if (isOptionalPaymentColumnError(result.error)) {
        if (options.requirePaymentColumns) {
            throw createHttpError(503, 'Order schema is missing PayPal payment columns. Apply the PayPal order migration before accepting live PayPal orders.');
        }

        const legacyRecord = toLegacyOrderRecord(record);
        const retry = await supabase
            .from('orders')
            .upsert(legacyRecord, { onConflict: 'id' })
            .select()
            .single();

        if (!retry.error) return { record: retry.data || legacyRecord, created: true };
        throw createHttpError(500, retry.error.message || 'Failed to save order.');
    }

    throw createHttpError(500, result.error.message || 'Failed to save order.');
}

async function sendOrderEmail(record: any) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !record.customer_email) return;

    const resend = new Resend(apiKey);
    const order = toEmailOrder(record);
    const itemsHtml = order.items.map((item: any) => `
        <tr>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
                <strong>${item.name}</strong><br>
                <span style="color:#6b7280;font-size:14px;">Size: ${item.size} - Qty: ${item.quantity}</span>
            </td>
            <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(item.price).toFixed(2)}</td>
        </tr>
    `).join('');

    await sendResendEmail(resend, {
        to: [order.customerEmail],
        subject: `Order Confirmation - ${order.id}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;">
                <h1 style="letter-spacing:2px;text-transform:uppercase;">Coalition</h1>
                <h2>Order Confirmed</h2>
                <p>Thank you for your purchase, ${order.customerName || 'valued customer'}.</p>
                <p><strong>Order:</strong> ${order.id}</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    ${itemsHtml}
                    <tr>
                        <td style="padding:12px;background:#f9fafb;"><strong>Total</strong></td>
                        <td style="padding:12px;background:#f9fafb;text-align:right;"><strong>$${Number(order.total).toFixed(2)}</strong></td>
                    </tr>
                </table>
                <p style="margin-top:24px;color:#555;">Your order will be processed within 1-2 business days.</p>
                <p style="color:#555;">Need help? Contact <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a>.</p>
            </div>
        `,
    });
}

async function sendAdminOrderEmail(record: any) {
    const apiKey = process.env.RESEND_API_KEY;
    const recipients = getOrderNotificationRecipients();
    if (!apiKey || recipients.length === 0) return;

    const resend = new Resend(apiKey);
    const items = normalizeOrderItems(record.items);
    const shipping = record.shipping_address || {};
    const paymentReference = record.payment_reference || record.notes?.match(/Payment reference:\s*([^\n]+)/)?.[1] || '';
    const paypalOrderId = record.paypal_order_id || record.notes?.match(/PayPal order ID:\s*([^\n]+)/)?.[1] || '';
    const itemsHtml = items.map(item => {
        const unitPrice = Number(item.price || 0);
        const quantity = Math.max(1, Number(item.quantity || 1));
        return `
        <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
                <strong>${escapeHtml(item.productName)}</strong><br>
                <span style="color:#6b7280;font-size:13px;">Size: ${escapeHtml(item.selectedSize)} - Qty: ${escapeHtml(quantity)}</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$${unitPrice.toFixed(2)}</td>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$${(unitPrice * quantity).toFixed(2)}</td>
        </tr>
    `;
    }).join('');

    await sendResendEmail(resend, {
        to: recipients,
        subject: `ACTION REQUIRED: Prepare Coalition order ${record.order_number}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:28px;background:#ffffff;color:#111827;">
                <h1 style="margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">Order Ready To Fulfill</h1>
                <p style="margin:0 0 24px;color:#6b7280;">A paid order was placed on sgcoalition.xyz. Prepare, pack, and ship the items below.</p>
                <div style="background:#111827;color:#ffffff;border-radius:8px;padding:18px;margin-bottom:24px;">
                    <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Fulfillment Summary</div>
                    <div style="font-size:28px;font-weight:bold;margin-top:4px;">${escapeHtml(record.order_number)}</div>
                    <div style="margin-top:8px;">Total: <strong>$${Number(record.total || 0).toFixed(2)}</strong> | Payment: <strong>${escapeHtml(record.payment_method)} / ${escapeHtml(record.payment_status)}</strong></div>
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Order</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(record.order_number)}</td></tr>
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Total</strong></td><td style="padding:12px;text-align:right;">$${Number(record.total || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Payment</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(record.payment_method)} / ${escapeHtml(record.payment_status)}</td></tr>
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Shipping</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(shipping.shippingMethod || 'standard')} ($${Number(shipping.shippingCost || 0).toFixed(2)})</td></tr>
                    ${paymentReference ? `<tr><td style="padding:12px;background:#f9fafb;"><strong>Payment Ref</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(paymentReference)}</td></tr>` : ''}
                    ${paypalOrderId ? `<tr><td style="padding:12px;background:#f9fafb;"><strong>PayPal Order</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(paypalOrderId)}</td></tr>` : ''}
                </table>

                <h2 style="font-size:18px;margin:0 0 10px;">Customer</h2>
                <p style="margin:0 0 20px;line-height:1.6;">
                    ${escapeHtml(record.customer_name)}<br>
                    <a href="mailto:${escapeHtml(record.customer_email)}">${escapeHtml(record.customer_email)}</a><br>
                    ${escapeHtml(record.customer_phone || '')}
                </p>

                <h2 style="font-size:18px;margin:0 0 10px;">Ship To</h2>
                <p style="margin:0 0 20px;line-height:1.6;">
                    ${escapeHtml(shipping.address1 || '')}<br>
                    ${escapeHtml(shipping.city || '')}${shipping.city && shipping.state ? ', ' : ''}${escapeHtml(shipping.state || '')} ${escapeHtml(shipping.zip || '')}<br>
                    ${escapeHtml(shipping.country || '')}
                </p>

                <h2 style="font-size:18px;margin:0 0 10px;">Items</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                        <th align="left" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Item</th>
                        <th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Unit</th>
                        <th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Line</th>
                    </tr>
                    ${itemsHtml}
                </table>
                <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:16px;margin-bottom:24px;">
                    <strong>Next step:</strong> Pull the items, verify size/quantity, pack the order, then update the admin dashboard when it ships.
                </div>

                <p style="margin-top:24px;">
                    <a href="https://sgcoalition.xyz/#/admin" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Admin Dashboard</a>
                </p>
            </div>
        `,
    });
}

async function createOrder(req: any) {
    const body = parseBody(req);
    const order = body.order;
    if (!order) throw createHttpError(400, 'Order is required.');

    const supabase = getSupabaseAdmin();
    const paymentMethod = String(order.paymentMethod || order.payment_method || '').toLowerCase();
    let paymentVerification = null;
    let record = toOrderRecord(order);

    if (paymentMethod === 'paypal') {
        record = await validatePayPalOrderRecord(supabase, record);
        paymentVerification = await verifyPayPalCapture(record, body.verification);
        record = {
            ...record,
            payment_method: 'paypal',
            payment_status: 'paid',
            payment_reference: paymentVerification.paypalCaptureId,
            paypal_order_id: paymentVerification.paypalOrderId,
            paid_at: record.paid_at || new Date().toISOString(),
        };
    }

    const saveResult = await upsertOrderRecord(supabase, record, { requirePaymentColumns: paymentMethod === 'paypal' });

    if (saveResult.created) {
        try {
            await sendOrderEmail(saveResult.record);
        } catch (emailError) {
            console.warn('[Order API] Confirmation email failed:', emailError);
        }

        try {
            await sendAdminOrderEmail(saveResult.record);
        } catch (emailError) {
            console.warn('[Order API] Admin order notification failed:', emailError);
        }
    }

    return saveResult.record || record;
}

async function listOrders(req: any) {
    if (!(await isAdminRequest(req))) throw createHttpError(401, 'Admin authorization required.');

    const { data, error } = await getSupabaseAdmin()
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw createHttpError(500, error.message || 'Failed to fetch orders.');
    return data || [];
}

async function updateOrder(req: any) {
    if (!(await isAdminRequest(req))) throw createHttpError(401, 'Admin authorization required.');

    const body = parseBody(req);
    const id = String(body.id || '').trim();
    if (!id || !body.updates) throw createHttpError(400, 'Order ID and updates are required.');

    const { data, error } = await getSupabaseAdmin()
        .from('orders')
        .update(body.updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw createHttpError(500, error.message || 'Failed to update order.');
    return data;
}

export default async function handler(req: any, res: any) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'POST') {
            res.status(200).json(await createOrder(req));
            return;
        }

        if (req.method === 'GET') {
            res.status(200).json(await listOrders(req));
            return;
        }

        if (req.method === 'PATCH') {
            res.status(200).json(await updateOrder(req));
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        const status = Number(error?.status || 500);
        console.error('[Order API]', error?.message || error);
        res.status(status).json({ error: error?.message || 'Order request failed.' });
    }
}
