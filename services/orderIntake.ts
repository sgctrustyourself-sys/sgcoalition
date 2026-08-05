// services/orderIntake.ts
// Deep Order intake module — single ownership of pricing, verification,
// persistence, idempotency, email, and provider-neutral reconciliation.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { calculateAboveAsBelowSetBonusCents } from '../utils/aboveAsBelowSet.js';
import { resolvePaymentState } from '../utils/orderDepositNotes.js';
import type {
    OrderRow, OrderItemRow, OrderSaveResult, PayPalCaptureConfirmation,
    PayPalOAuthResponse, PayPalOrderResponse, ProductRow,
} from '../api/_types.js';

const PAYPAL_LIVE = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX = 'https://api-m.sandbox.paypal.com';
const CURRENCY = 'USD';
const KEYCHAIN_CLIP_CENTS = 1000;
const MAX_QTY = 99;
const ADMIN_EMAIL = 'sgctrustyourself@gmail.com';

// ---- Custom error type ----
export class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
function err(s: number, m: string): HttpError { return new HttpError(s, m); }

// ---- Shared helpers ----
function money(v: unknown): string { const n = Number(v || 0); return Number.isFinite(n) ? Math.max(0, n).toFixed(2) : '0.00'; }
function c2d(cents: number): string { return (Math.max(0, cents) / 100).toFixed(2); }
function toCents(v: unknown, label: string): number {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) throw err(400, label + ' must be valid.');
    if (n < 0) throw err(400, label + ' cannot be negative.');
    return Math.round(n * 100);
}
function esc(v: unknown): string { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function uuid(v?: string | null): string | null { const t = String(v || '').trim(); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t) ? t : null; }

function sb(): SupabaseClient {
    const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!u || !k) throw err(503, 'Supabase not configured.');
    return createClient(u, k);
}

// ---- PayPal helpers ----
function ppBase(): string {
    const e = process.env.PAYPAL_API_BASE_URL?.trim();
    if (e) return e.replace(/\/$/, '');
    return (process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'live').toLowerCase() === 'sandbox' ? PAYPAL_SANDBOX : PAYPAL_LIVE;
}
function ppCreds() {
    const c = (process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || '').trim();
    const s = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
    if (!c || !s) throw err(503, 'PayPal credentials not configured.');
    return { clientId: c, clientSecret: s };
}
async function ppToken(): Promise<string> {
    const { clientId, clientSecret } = ppCreds();
    const r = await fetch(ppBase() + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const d = await r.json().catch(() => ({})) as PayPalOAuthResponse;
    if (!r.ok || !d.access_token) throw err(r.status || 502, d.error_description || d.error || 'PayPal auth failed');
    return d.access_token;
}

// ---- Email helpers ----
function fromAddr(): string { return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>'; }
function adminRcpt(): string[] { return (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || ADMIN_EMAIL).split(',').map(e => e.trim()).filter(Boolean); }
function formatAddr(addr: Record<string, unknown> | null | undefined): string {
    if (!addr) return '';
    const a = addr as any;
    const lines = [a.address1 || '', (a.city || '') + (a.city && a.state ? ', ' : '') + (a.state || '') + ' ' + (a.zip || ''), a.country || ''];
    return lines.filter(Boolean).map(l => esc(l)).join('<br>');
}

// =========================================================================
// 1. PRICING AUTHORITY
// =========================================================================

export interface PricingItem { productId: string; selectedSize: string; quantity: number; keychainClipOn: boolean; }

export interface PriceSnapshot {
    itemTotalCents: number; shippingCents: number; discountCents: number; storeCreditCents: number; totalCents: number;
    items: Array<{ productId: string; productName: string; selectedSize: string; quantity: number; unitCents: number; lineCents: number; basePriceDollars: number; addOnCents: number; keychainClipOn: boolean; }>;
}

async function loadProducts(ids: string[]): Promise<Map<string, ProductRow>> {
    const { data, error } = await sb().from('products').select('id,name,price,category,archived,size_inventory').in('id', ids);
    if (error) throw err(500, error.message || 'Product lookup failed.');
    const m = new Map<string, ProductRow>(((data as ProductRow[] | null) || []).map(p => [String(p.id), p]));
    const miss = ids.filter(id => !m.has(id));
    if (miss.length) throw err(409, 'Unavailable: ' + miss.join(', '));
    return m;
}

export async function resolvePricing(items: PricingItem[], shippingDollars: number, clientDiscountDollars: number, paymentMethod: string, storeCreditCents: number = 0): Promise<PriceSnapshot> {
    if (!items.length) throw err(400, 'At least one item required.');
    const products = await loadProducts([...new Set(items.map(i => i.productId))]);
    let itemTotalCents = 0;
    const resolved: PriceSnapshot['items'] = [];
    for (const it of items) {
        const p = products.get(it.productId);
        if (p?.archived) throw err(409, (p.name || 'Item') + ' no longer available.');
        const qty = Math.max(1, Number(it.quantity));
        if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw err(400, 'Invalid qty for ' + (p?.name || 'item'));
        const cat = String(p?.category || '').toLowerCase();
        const base = toCents(p?.price, 'Product price');
        const addon = it.keychainClipOn && cat === 'wallet' ? KEYCHAIN_CLIP_CENTS : 0;
        if (it.keychainClipOn && cat !== 'wallet') throw err(409, (p?.name || 'Item') + ' does not support clip add-on.');
        const unit = base + addon;
        const line = unit * qty;
        const inv = (p?.size_inventory ?? {}) as Record<string, number>;
        if (inv && Object.hasOwn(inv, it.selectedSize) && (inv[it.selectedSize] || 0) < qty)
            throw err(409, (p?.name || 'Item') + ' size ' + it.selectedSize + ' insufficient.');
        itemTotalCents += line;
        resolved.push({ productId: it.productId, productName: p?.name || it.productId, selectedSize: it.selectedSize, quantity: qty, unitCents: unit, lineCents: line, basePriceDollars: Number(p?.price || 0), addOnCents: addon, keychainClipOn: it.keychainClipOn });
    }
    const shipCents = toCents(shippingDollars, 'Shipping');
    if (shipCents !== 0 && shipCents !== 500 && shipCents !== 1000) throw err(400, 'Shipping must be 0, 5, or 10.');
    const setBonus = calculateAboveAsBelowSetBonusCents(items.map(i => ({ productId: i.productId, quantity: i.quantity })));
    const otherDisc = Math.max(0, toCents(clientDiscountDollars, 'Discount') - setBonus);
    // Crypto/store_credit discounts (passed via clientDiscountDollars) only
    // apply to non-PayPal/Stripe methods. Store credit itself is handled
    // via the separate storeCreditCents param and applies to ALL methods.
    // The returned storeCreditCents is capped to the actual amount used —
    // if credit exceeds the pre-credit total, the excess is ignored.
    const rawScCents = Math.max(0, Math.round(Number(storeCreditCents) || 0));
    const preCreditTotal = itemTotalCents + shipCents - setBonus - (paymentMethod === 'paypal' || paymentMethod === 'stripe' ? 0 : otherDisc);
    const scCents = Math.min(rawScCents, Math.max(0, preCreditTotal));
    const discCents = setBonus + (paymentMethod === 'paypal' || paymentMethod === 'stripe' ? 0 : otherDisc) + scCents;
    const totalCents = Math.max(0, itemTotalCents + shipCents - discCents);
    return { itemTotalCents, shippingCents: shipCents, discountCents: discCents, storeCreditCents: scCents, totalCents, items: resolved };
}

// =========================================================================
// 2. PAYMENT VERIFICATION
// =========================================================================

export type PaymentEvidence =
    | { method: 'paypal'; paypalOrderId: string; paypalCaptureId: string; referenceId: string }
    | { method: 'stripe'; paymentIntentId: string }
    | { method: 'crypto' | 'store_credit' };

export interface VerifiedPayment { method: string; paymentReference: string; paypalOrderId: string | null; paidAt: string | null; }

async function verifyPP(paypalOrderId: string, paypalCaptureId: string, refId: string, expectedDollars: string): Promise<PayPalCaptureConfirmation> {
    const tok = await ppToken();
    const r = await fetch(ppBase() + '/v2/checkout/orders/' + encodeURIComponent(paypalOrderId), { headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } });
    const d: PayPalOrderResponse = await r.json().catch(() => ({}));
    if (!r.ok) throw err(r.status || 502, d.message || d.error || 'PayPal verify failed.');
    const pu = d.purchase_units?.[0];
    const cap = pu?.payments?.captures?.find((c: any) => c.id === paypalCaptureId);
    if (d.status !== 'COMPLETED' || cap?.status !== 'COMPLETED') throw err(402, 'PayPal capture not completed.');
    if (pu?.reference_id && refId && pu.reference_id !== refId) throw err(409, 'PayPal reference mismatch.');
    if (cap.amount?.currency_code !== CURRENCY || money(cap.amount?.value) !== expectedDollars) throw err(409, 'PayPal amount mismatch.');
    return { paypalOrderId, paypalCaptureId, payerEmail: d.payer?.email_address || null };
}

async function verifySPI(pi: string, expectedCents: number): Promise<void> {
    const k = process.env.STRIPE_SECRET_KEY;
    if (!k) throw err(503, 'Stripe not configured.');
    const ref = String(pi || '').trim();
    if (!ref.startsWith('pi_')) throw err(400, 'Valid Stripe reference required.');
    try {
        const s = new Stripe(k);
        const i = await s.paymentIntents.retrieve(ref);
        if (i.status !== 'succeeded') throw err(402, 'Stripe payment not completed.');
        if (i.amount_received !== expectedCents) throw err(409, 'Stripe amount mismatch.');
    } catch (e: any) { if (e?.status) throw e; throw err(502, e?.message || 'Stripe verify failed.'); }
}

export async function verifyPayment(evidence: PaymentEvidence, expectedTotalCents: number): Promise<VerifiedPayment> {
    const now = new Date().toISOString();
    if (evidence.method === 'paypal') {
        await verifyPP(evidence.paypalOrderId, evidence.paypalCaptureId, evidence.referenceId, c2d(expectedTotalCents));
        return { method: 'paypal', paymentReference: evidence.paypalCaptureId, paypalOrderId: evidence.paypalOrderId, paidAt: now };
    }
    if (evidence.method === 'stripe') {
        await verifySPI(evidence.paymentIntentId, expectedTotalCents);
        return { method: 'stripe', paymentReference: evidence.paymentIntentId, paypalOrderId: null, paidAt: now };
    }
    return { method: evidence.method, paymentReference: '', paypalOrderId: null, paidAt: evidence.method !== 'crypto' ? now : null };
}

// =========================================================================
// 3. IDEMPOTENT PERSISTENCE
// =========================================================================

function isColErr(e: any): boolean {
    const t = (e?.code + ' ' + e?.message + ' ' + e?.details).toLowerCase();
    return t.includes('payment_reference') || t.includes('paypal_order_id') || t.includes('schema cache') || t.includes('column');
}
function legacyRow(r: OrderRow): any {
    const ref = r.payment_reference, pid = r.paypal_order_id;
    const l: any = { ...r }; delete l.payment_reference; delete l.paypal_order_id; delete l.paid_amount; delete l.balance_due;
    const n = [ref ? 'Payment reference: ' + ref : '', pid ? 'PayPal order ID: ' + pid : ''].filter(Boolean).join('\n');
    if (n) l.notes = [l.notes, n].filter(Boolean).join('\n');
    return l;
}
async function findDup(s: SupabaseClient, r: OrderRow): Promise<OrderRow | null> {
    for (const f of ['paypal_order_id', 'payment_reference'] as const) {
        if (!r[f]) continue;
        const { data, error } = await s.from('orders').select('*').eq(f, r[f]).maybeSingle();
        if (error) { if (isColErr(error)) throw err(503, 'Schema missing payment columns.'); throw err(500, error.message); }
        if (data) return data as OrderRow;
    }
    return null;
}

export async function persistOrder(record: OrderRow): Promise<OrderSaveResult> {
    const s = sb();
    const existing = await findDup(s, record);
    if (existing) {
        if (money(existing.total) !== money(record.total)) throw err(409, 'Duplicate order total mismatch.');
        return { record: existing, created: false };
    }
    const r = await s.from('orders').upsert(record, { onConflict: 'id' }).select().single();
    if (!r.error) return { record: (r.data as OrderRow) || record, created: true };
    if (isColErr(r.error)) {
        const l = await s.from('orders').upsert(legacyRow(record), { onConflict: 'id' }).select().single();
        if (!l.error) return { record: (l.data as OrderRow) || legacyRow(record), created: true };
        throw err(500, l.error.message || 'Legacy save failed.');
    }
    throw err(500, r.error.message || 'Save failed.');
}

// =========================================================================
// 4. EMAIL ORCHESTRATION
// =========================================================================

async function sendCust(rec: OrderRow): Promise<void> {
    const key = process.env.RESEND_API_KEY; if (!key || !rec.customer_email) return;
    const r = new Resend(key);
    const items = (rec.items || []).map((i: any) => '<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb;"><strong>' + esc(i.productName || i.name) + '</strong><br><span style="color:#6b7280;font-size:14px;">Size: ' + esc(i.selectedSize || i.size) + ' - Qty: ' + (i.quantity || 1) + '</span></td><td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">$' + Number(i.price || 0).toFixed(2) + '</td></tr>').join('');
    const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;"><h1 style="letter-spacing:2px;">Coalition</h1><h2>Order Confirmed</h2><p>Thank you, ' + esc(rec.customer_name) + '.</p><p>Order: ' + esc(rec.order_number) + '</p><table style="border:1px solid #e5e7eb;border-radius:8px;">' + items + '<tr><td style="padding:12px;background:#f9fafb;"><b>Total</b></td><td style="padding:12px;background:#f9fafb;text-align:right;"><b>$' + Number(rec.total || 0).toFixed(2) + '</b></td></tr></table><p style="color:#555;">Processed 1-2 days. Contact <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a>.</p></div>';
    const result = await r.emails.send({ from: fromAddr(), to: [rec.customer_email], subject: 'Order Confirmation - ' + rec.order_number, html } as any);
    if ((result as any)?.error) throw new Error((result as any).error.message);
}
async function sendAdm(rec: OrderRow): Promise<void> {
    const key = process.env.RESEND_API_KEY; const rcpts = adminRcpt(); if (!key || !rcpts.length) return;
    const r = new Resend(key);
    const shipping = (rec.shipping_address || {}) as Record<string, unknown>;
    const payRef = rec.payment_reference || '';
    const ppId = rec.paypal_order_id || '';
    const itemsRows = (rec.items || []).map((i: any) => {
        const up = Number(i.price || 0); const q = Math.max(1, Number(i.quantity || 1));
        return '<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;"><strong>' + esc(i.productName || i.name) + '</strong><br><span style="color:#6b7280;font-size:13px;">Size: ' + esc(i.selectedSize || i.size) + ' - Qty: ' + q + '</span></td><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$' + up.toFixed(2) + '</td><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$' + (up * q).toFixed(2) + '</td></tr>';
    }).join('');
    const payRefRow = payRef ? '<tr><td style="padding:12px;background:#f9fafb;"><strong>Payment Ref</strong></td><td style="padding:12px;text-align:right;">' + esc(payRef) + '</td></tr>' : '';
    const ppRow = ppId ? '<tr><td style="padding:12px;background:#f9fafb;"><strong>PayPal Order</strong></td><td style="padding:12px;text-align:right;">' + esc(ppId) + '</td></tr>' : '';
    const html = '<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:28px;background:#fff;color:#111827;"><h1 style="margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">Order Ready To Fulfill</h1><p style="margin:0 0 24px;color:#6b7280;">A paid order was placed on sgcoalition.xyz. Prepare, pack, and ship the items below.</p><div style="background:#111827;color:#fff;border-radius:8px;padding:18px;margin-bottom:24px;"><div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Fulfillment Summary</div><div style="font-size:28px;font-weight:bold;margin-top:4px;">' + esc(rec.order_number) + '</div><div style="margin-top:8px;">Total: <strong>$' + Number(rec.total || 0).toFixed(2) + '</strong> | Payment: <strong>' + esc(rec.payment_method) + ' / ' + esc(rec.payment_status) + '</strong></div></div><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;"><tr><td style="padding:12px;background:#f9fafb;"><strong>Order</strong></td><td style="padding:12px;text-align:right;">' + esc(rec.order_number) + '</td></tr><tr><td style="padding:12px;background:#f9fafb;"><strong>Total</strong></td><td style="padding:12px;text-align:right;">$' + Number(rec.total || 0).toFixed(2) + '</td></tr><tr><td style="padding:12px;background:#f9fafb;"><strong>Payment</strong></td><td style="padding:12px;text-align:right;">' + esc(rec.payment_method) + ' / ' + esc(rec.payment_status) + '</td></tr><tr><td style="padding:12px;background:#f9fafb;"><strong>Shipping</strong></td><td style="padding:12px;text-align:right;">' + esc(shipping.shippingMethod || 'standard') + ' ($' + Number(shipping.shippingCost || 0).toFixed(2) + ')</td></tr>' + payRefRow + ppRow + '</table><h2 style="font-size:18px;margin:0 0 10px;">Customer</h2><p style="margin:0 0 20px;line-height:1.6;">' + esc(rec.customer_name) + '<br><a href="mailto:' + esc(rec.customer_email) + '">' + esc(rec.customer_email) + '</a><br>' + esc(rec.customer_phone || '') + '</p><h2 style="font-size:18px;margin:0 0 10px;">Ship To</h2><p style="margin:0 0 20px;line-height:1.6;">' + formatAddr(rec.shipping_address as any) + '</p><h2 style="font-size:18px;margin:0 0 10px;">Items</h2><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><th align="left" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Item</th><th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Unit</th><th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Line</th></tr>' + itemsRows + '</table><div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:16px;margin-bottom:24px;"><strong>Next step:</strong> Pull the items, verify size/quantity, pack the order, then update the admin dashboard when it ships.</div><p style="margin-top:24px;"><a href="https://sgcoalition.xyz/#/admin" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Admin Dashboard</a></p></div>';
    const result = await r.emails.send({ from: fromAddr(), to: rcpts, subject: 'ACTION REQUIRED: Prepare Coalition order ' + rec.order_number, html } as any);
    if ((result as any)?.error) throw new Error((result as any).error.message);
}

export async function sendOrderEmails(record: OrderRow): Promise<void> {
    try { await sendCust(record); } catch (e) { console.warn('[OrderIntake] Cust email failed:', e); }
    try { await sendAdm(record); } catch (e) { console.warn('[OrderIntake] Admin email failed:', e); }
}

// =========================================================================
// 5. MAIN ENTRY POINT
// =========================================================================

export interface CheckoutAttempt {
    items: Array<{ productId: string; selectedSize: string; quantity: number; keychainClipOn?: boolean }>;
    clientSubtotal: number; clientDiscount: number; clientTotal: number;
    shippingDollars: number; shippingMethod?: string;
    paymentEvidence: PaymentEvidence;
    orderId?: string; orderNumber?: string;
    userId?: string | null; customerName: string; customerEmail: string; customerPhone?: string; isGuest?: boolean; facebookUsername?: string | null;
    shippingAddress?: Record<string, unknown> | null;
    sgCoinReward?: number; notes?: string;
}

export interface AcceptCheckoutResult { order: OrderRow; created: boolean; }

export async function acceptCheckout(attempt: CheckoutAttempt): Promise<AcceptCheckoutResult> {
    const pricing = await resolvePricing(
        attempt.items.map(i => ({ productId: i.productId, selectedSize: i.selectedSize, quantity: i.quantity, keychainClipOn: Boolean(i.keychainClipOn) })),
        attempt.shippingDollars, attempt.clientDiscount, attempt.paymentEvidence.method);
    if (attempt.clientTotal !== undefined) {
        const cc = toCents(attempt.clientTotal, 'Client total');
        if (cc !== pricing.totalCents) console.warn('[OrderIntake] Total mismatch: client=' + cc + 'c server=' + pricing.totalCents + 'c');
    }
    const payment = await verifyPayment(attempt.paymentEvidence, pricing.totalCents);
    const now = new Date().toISOString();
    const oid = attempt.orderId || ('order_' + Date.now());
    const onum = attempt.orderNumber || ('ORD-' + Date.now());
    const row: OrderRow = {
        id: oid, order_number: onum, user_id: uuid(attempt.userId), is_guest: Boolean(attempt.isGuest ?? !attempt.userId),
        customer_name: String(attempt.customerName || 'Customer'), customer_email: String(attempt.customerEmail || ''),
        customer_phone: String(attempt.customerPhone || ''),
        items: pricing.items.map(pi => ({ productId: pi.productId, productName: pi.productName, productImage: '', selectedSize: pi.selectedSize, quantity: pi.quantity, price: Number(c2d(pi.unitCents)), basePrice: pi.basePriceDollars, addOnPrice: pi.keychainClipOn ? KEYCHAIN_CLIP_CENTS / 100 : 0, keychainClipOn: pi.keychainClipOn, addOnLabel: pi.keychainClipOn ? 'Keychain Clip (+$10)' : undefined, total: Number(c2d(pi.lineCents)), name: pi.productName, image: '', size: pi.selectedSize } satisfies OrderItemRow)),
        subtotal: Number(c2d(pricing.itemTotalCents)), tax: 0, discount: Number(c2d(pricing.discountCents)),
        total: Number(c2d(pricing.totalCents)),
        payment_method: payment.method, payment_status: payment.method === 'crypto' ? 'pending' : 'paid',
        payment_reference: payment.paymentReference || null, paypal_order_id: payment.paypalOrderId, order_type: 'online',
        shipping_address: (attempt.shippingAddress || null) as OrderRow['shipping_address'],
        notes: attempt.notes || '', created_at: now, paid_at: payment.paidAt || null,
        facebook_username: attempt.facebookUsername || null,
        sg_coin_reward: Number(attempt.sgCoinReward || 0),
        paid_amount: 0, balance_due: 0, // resolved below via resolvePaymentState
    };
    // Resolve partial-payment state from notes (e.g. "DEP $30 paid / BAL $10 owes")
    // or infer from payment_status. This preserves the admin backfill workflow where
    // deposit markers in notes override the default full-payment computation.
    const totalDollars = Number(c2d(pricing.totalCents));
    const paymentState = resolvePaymentState(attempt.notes, payment.method === 'crypto' ? 'pending' : 'paid', totalDollars);
    row.paid_amount = paymentState.paidAmount;
    row.balance_due = paymentState.balanceDue;

    const saved = await persistOrder(row);
    if (saved.created && payment.method !== 'crypto') void sendOrderEmails(saved.record);
    return { order: saved.record, created: saved.created };
}

// =========================================================================
// 6. PROVIDER-NEUTRAL RECONCILIATION
// =========================================================================

export interface ReconcileResult { success: boolean; error?: string; balancePaid?: number; newTotalPaid?: number; }

export async function reconcilePayment(orderId: string): Promise<ReconcileResult> {
    const s = sb();
    const { data: o, error: fe } = await s.from('orders').select('id,balance_due,total,payment_status,paid_amount').eq('id', orderId).maybeSingle();
    if (fe || !o) return { success: false, error: 'Order not found: ' + orderId };
    const bd = Number(o.balance_due ?? 0), pa = Number(o.paid_amount ?? 0), tot = Number(o.total ?? 0);
    if (String(o.payment_status ?? '') !== 'pending') return { success: true };
    if (bd <= 0) return { success: true };
    const { data, error } = await s.rpc('reconcile_balance_payment', { p_order_id: orderId });
    if (error) return { success: false, error: error.message };
    const r = data as { success: boolean; error?: string; balance_paid?: number; new_total_paid?: number } | null;
    if (r?.success) { console.log('[OrderIntake] Reconciled ' + orderId + ': $' + pa + ' + $' + bd + ' = $' + tot); return { success: true, balancePaid: r.balance_paid, newTotalPaid: r.new_total_paid }; }
    return { success: false, error: r?.error || 'RPC failed' };
}
