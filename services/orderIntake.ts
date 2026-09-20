// services/orderIntake.ts
// Deep Order intake module — single ownership of pricing, verification,
// persistence, idempotency, email, and provider-neutral reconciliation.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resendClient, stripeClient } from '../api/_services.js';
import { calculateAboveAsBelowSetBonusCents } from '../utils/aboveAsBelowSet.js';
import { resolveCryptoDiscountCents } from '../utils/cryptoDiscount.js';
import { resolvePaymentState } from '../utils/orderDepositNotes.js';
import type {
    OrderRow, OrderItemRow, OrderSaveResult, ProductRow,
} from '../api/_types.js';

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
    couponDiscountCents: number; couponCode: string | null;
    // Method-specific crypto (SGCoin) discount, split out so the checkout
    // order summary can render its own line. Always 0 for card (Stripe).
    cryptoDiscountCents: number;
    items: Array<{ productId: string; productName: string; selectedSize: string; quantity: number; unitCents: number; lineCents: number; basePriceDollars: number; addOnCents: number; keychainClipOn: boolean; }>;
}

export interface CouponRow {
    code: string; discount_type: 'percent' | 'fixed'; discount_value: number;
    min_order_value: number; max_uses: number | null; used_count: number;
    end_date: string | null; is_active: boolean;
}

// ---- Coupon helpers (admin-created coupons from the `coupons` table) ----

async function loadCoupon(code: string | null | undefined): Promise<CouponRow | null> {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return null;
    const { data, error } = await sb().from('coupons')
        .select('code,discount_type,discount_value,min_order_value,max_uses,used_count,end_date,is_active')
        .eq('code', c)
        .maybeSingle();
    if (error) throw err(500, error.message || 'Coupon lookup failed.');
    return (data as CouponRow) || null;
}

function couponDiscountCentsOf(coupon: CouponRow, baseCents: number): number {
    if (baseCents <= 0) return 0;
    const value = Math.max(0, Number(coupon.discount_value || 0));
    if (coupon.discount_type === 'percent') {
        return Math.min(baseCents, Math.round(baseCents * Math.min(100, value) / 100));
    }
    return Math.min(baseCents, Math.round(value * 100));
}

/** Validate a coupon against the `coupons` table; throws on invalid. */
async function validateCoupon(code: string | null | undefined, baseCents: number): Promise<{ coupon: CouponRow; discountCents: number } | null> {
    if (!String(code || '').trim()) return null;
    const coupon = await loadCoupon(code);
    if (!coupon) throw err(400, 'Invalid coupon code.');
    if (!coupon.is_active) throw err(409, 'This coupon is no longer active.');
    if (coupon.end_date && new Date(coupon.end_date).getTime() < Date.now()) throw err(409, 'This coupon has expired.');
    if (coupon.max_uses != null && (coupon.used_count || 0) >= coupon.max_uses) throw err(409, 'This coupon has reached its usage limit.');
    const minCents = Math.round(Number(coupon.min_order_value || 0) * 100);
    if (baseCents < minCents) throw err(409, 'This coupon requires a minimum order of $' + Number(coupon.min_order_value || 0).toFixed(2) + '.');
    return { coupon, discountCents: couponDiscountCentsOf(coupon, baseCents) };
}

async function loadProducts(ids: string[]): Promise<Map<string, ProductRow>> {
    const { data, error } = await sb().from('products').select('id,name,price,category,archived,size_inventory').in('id', ids);
    if (error) throw err(500, error.message || 'Product lookup failed.');
    const m = new Map<string, ProductRow>(((data as ProductRow[] | null) || []).map(p => [String(p.id), p]));
    const miss = ids.filter(id => !m.has(id));
    // String() matters: Array.join renders undefined/null as an EMPTY string, so
    // a payload that omits productId used to surface as a bare
    // "Unavailable: " with no clue which item was at fault.
    if (miss.length) throw err(409, 'Unavailable: ' + miss.map(id => String(id)).join(', '));
    return m;
}

// storeCreditAppliedCents: store credit the server ALREADY applied when the
// PaymentIntent was charged (create-payment-intent recomputes it from the
// profile and returns the applied amount). complete-order forwards it so the
// order's re-pricing matches the charged amount exactly instead of failing
// verification with "Stripe amount mismatch". Capped against the requested
// store-credit path below, and re-verified against the live profile balance
// in acceptCheckout, so a stale client value can never over-credit.
// ---- Crypto (SGCoin) discount -------------------------------------------
// The shared helper lives in utils/cryptoDiscount.ts (client-safe — the
// checkout UI imports the SAME calculation for its badge, so the advertised
// offer and the server math can never disagree). resolvePricing consumes it
// for the `crypto` method only.

// ---- Store credit: the single owner of "how much credit this buyer has" ----
//
// Both pricing steps that offer store credit read the balance through here —
// create-payment-intent (the card intent) and pricing-preview (every method's
// displayed price). Keeping the read in one place is what makes the card path
// and the manual paths (crypto, Cash App, the free/store-credit path) apply the
// SAME balance: before this, only the card intent applied it, so crypto and
// Cash App showed the credit option while pricing the buyer at full price.
// Display-only by itself — resolvePricing caps the credit and acceptCheckout
// re-verifies it against the live balance before anything is debited.
export async function loadStoreCreditCents(userId: string | null | undefined): Promise<number> {
    const id = String(userId || '').trim();
    if (!id) return 0;
    const { data } = await sb()
        .from('profiles')
        .select('store_credit')
        .eq('id', id)
        .maybeSingle();
    return Math.max(0, Math.round(Number((data as { store_credit?: number } | null)?.store_credit || 0) * 100));
}

export async function resolvePricing(items: PricingItem[], shippingDollars: number, clientDiscountDollars: number, paymentMethod: string, storeCreditCents: number = 0, couponCode?: string | null, storeCreditAppliedCents: number = 0): Promise<PriceSnapshot> {
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
    // Crypto discount (SGCoin incentive): applies to the `crypto` method
    // ONLY — card (Stripe) never sees it, matching the rule that the crypto
    // discount cannot combine with external processors. Gated on the same
    // env flag the checkout UI badge reads, so the advertised offer and the
    // server math can never disagree. Capped at $10 so large carts stay
    // bounded. Computed on the post-set-bonus payable base.
    const basePayableCents = Math.max(0, itemTotalCents + shipCents - setBonus);
    const cryptoDiscountCents = paymentMethod === 'crypto'
        ? resolveCryptoDiscountCents(items.map(i => ({ productId: i.productId, quantity: i.quantity, price: (products.get(i.productId)?.price || 0) })), shippingDollars, setBonus)
        : 0;
    // Crypto/store_credit discounts (passed via clientDiscountDollars) only
    // apply to non-card methods. Store credit itself is handled
    // via the separate storeCreditCents param and applies to ALL methods.
    // The returned storeCreditCents is capped to the actual amount used —
    // if credit exceeds the pre-credit total, the excess is ignored.
    const rawScCents = Math.max(0, Math.round(Number(storeCreditCents) || 0));
    // Server-stated credit (already charged into a PaymentIntent upstream)
    // is authoritative when present; the requested amount is the fallback.
    const statedAppliedCents = Math.max(0, Math.round(Number(storeCreditAppliedCents) || 0));
    // The coupon base is the pre-coupon payable total (after set bonus and
    // the method-specific crypto discount). Coupon discounts apply to ALL
    // payment methods — they're an explicit discount the customer applied.
    const couponBaseCents = Math.max(0, itemTotalCents + shipCents - setBonus - cryptoDiscountCents - (paymentMethod === 'stripe' ? 0 : otherDisc));
    const couponApplied = await validateCoupon(couponCode, couponBaseCents);
    const couponDiscountCents = couponApplied?.discountCents || 0;
    const preCreditTotal = Math.max(0, couponBaseCents - couponDiscountCents);
    const scCents = Math.min(statedAppliedCents > 0 ? statedAppliedCents : rawScCents, preCreditTotal);
    const discCents = setBonus + cryptoDiscountCents + (paymentMethod === 'stripe' ? 0 : otherDisc) + couponDiscountCents + scCents;
    const totalCents = Math.max(0, itemTotalCents + shipCents - discCents);
    return { itemTotalCents, shippingCents: shipCents, discountCents: discCents, storeCreditCents: scCents, cryptoDiscountCents, totalCents, couponDiscountCents, couponCode: couponApplied?.coupon.code || null, items: resolved };
}

// =========================================================================
// 2. PAYMENT VERIFICATION
// =========================================================================

export type PaymentEvidence =
    | { method: 'stripe'; paymentIntentId: string }
    | { method: 'crypto' | 'cashapp' | 'store_credit' };

export interface VerifiedPayment { method: string; paymentReference: string; paidAt: string | null; }

async function verifySPI(pi: string, expectedCents: number): Promise<void> {
    const k = process.env.STRIPE_SECRET_KEY;
    if (!k) throw err(503, 'Stripe not configured.');
    const ref = String(pi || '').trim();
    if (!ref.startsWith('pi_')) throw err(400, 'Valid Stripe reference required.');
    try {
        const s = stripeClient();
        const i = await s.paymentIntents.retrieve(ref);
        if (i.status !== 'succeeded') throw err(402, 'Stripe payment not completed.');
        if (i.amount_received !== expectedCents) throw err(409, 'Stripe amount mismatch.');
    } catch (e: any) { if (e?.status) throw e; throw err(502, e?.message || 'Stripe verify failed.'); }
}

export async function verifyPayment(evidence: PaymentEvidence, expectedTotalCents: number): Promise<VerifiedPayment> {
    const now = new Date().toISOString();
    if (evidence.method === 'stripe') {
        await verifySPI(evidence.paymentIntentId, expectedTotalCents);
        return { method: 'stripe', paymentReference: evidence.paymentIntentId, paidAt: now };
    }
    // Manual methods (crypto, cashapp) are verified by the operator off-
    // platform and stay pending until confirmed — paidAt stays null.
    return { method: evidence.method, paymentReference: '', paidAt: evidence.method !== 'crypto' && evidence.method !== 'cashapp' ? now : null };
}

// =========================================================================
// 3. IDEMPOTENT PERSISTENCE
// =========================================================================

function isColErr(e: any): boolean {
    const t = (e?.code + ' ' + e?.message + ' ' + e?.details).toLowerCase();
    return t.includes('payment_reference') || t.includes('schema cache') || t.includes('column');
}
function legacyRow(r: OrderRow): any {
    const ref = r.payment_reference;
    const l: any = { ...r }; delete l.payment_reference; delete l.paypal_order_id; delete l.paid_amount; delete l.balance_due;
    const n = [ref ? 'Payment reference: ' + ref : ''].filter(Boolean).join('\n');
    if (n) l.notes = [l.notes, n].filter(Boolean).join('\n');
    return l;
}
async function findDup(s: SupabaseClient, r: OrderRow): Promise<OrderRow | null> {
    for (const f of ['payment_reference'] as const) {
        if (!r[f]) continue;
        const { data, error } = await s.from('orders').select('*').eq(f, r[f]).maybeSingle();
        if (error) { if (isColErr(error)) throw err(503, 'Schema missing payment columns.'); throw err(500, error.message); }
        if (data) return data as OrderRow;
    }
    return null;
}

interface BuyerIdentity { user_id?: string | null; customer_email?: string | null; }

// The order id is a checkout attempt id minted by the CLIENT
// (utils/checkoutAttempt.ts), so a row recorded under it is this checkout's
// order only when it is this buyer's. Without that check the id would be a
// handle for reading back — the checkout response returns this row — or
// overwriting another customer's order, and it is unauthenticated input.
//
// A row with a user_id belongs to an ACCOUNT, so only that account may read it
// back: an anonymous attempt stating the account holder's email used to fall
// through to the email comparison below and return their order (measured). The
// email comparison is therefore only for guest rows, which have no account to
// check against — a guest is whoever states that email.
function sameBuyer(a: BuyerIdentity, b: BuyerIdentity): boolean {
    const au = uuid(a.user_id), bu = uuid(b.user_id);
    if (au) return au === bu;
    const ae = String(a.customer_email || '').trim().toLowerCase();
    const be = String(b.customer_email || '').trim().toLowerCase();
    return Boolean(ae) && ae === be;
}

// The order recorded under an attempt id, if this attempt already produced one.
async function findRecordedOrder(orderId: string, buyer: BuyerIdentity): Promise<OrderRow | null> {
    const { data, error } = await sb().from('orders').select('*').eq('id', orderId).maybeSingle();
    if (error) { if (isColErr(error)) throw err(503, 'Schema missing payment columns.'); throw err(500, error.message); }
    if (!data) return null;
    const row = data as OrderRow;
    if (!sameBuyer(row, buyer)) throw err(409, 'Order id already recorded for a different customer.');
    return row;
}

export async function persistOrder(record: OrderRow): Promise<OrderSaveResult> {
    const s = sb();
    const existing = await findDup(s, record);
    if (existing) {
        if (money(existing.total) !== money(record.total)) throw err(409, 'Duplicate order total mismatch.');
        return { record: existing, created: false };
    }
    // Claim the id atomically — INSERT … ON CONFLICT (id) DO NOTHING RETURNING.
    // A recorded id is never overwritten, and the request that loses the race
    // is told so by an EMPTY returned set: without that, two concurrent
    // submissions of one attempt (a retry racing a second tab) would both be
    // "created" and would both debit the buyer's store credit. Same lesson as
    // the credit CAS below — a write awaited without reading what it changed
    // cannot tell a no-op from a success.
    const r = await s.from('orders').upsert(record, { onConflict: 'id', ignoreDuplicates: true }).select();
    let claimed: OrderRow[];
    if (!r.error) claimed = (r.data as OrderRow[] | null) || [];
    else if (isColErr(r.error)) {
        const l = await s.from('orders').upsert(legacyRow(record), { onConflict: 'id', ignoreDuplicates: true }).select();
        if (l.error) throw err(500, l.error.message || 'Legacy save failed.');
        claimed = (l.data as OrderRow[] | null) || [];
    } else throw err(500, r.error.message || 'Save failed.');
    if (claimed.length > 0) return { record: claimed[0], created: true };
    // A twin already recorded this attempt: report THE row that was recorded,
    // never our own — created:false is what stops the caller debiting again.
    const twin = await findRecordedOrder(record.id, record);
    if (!twin) throw err(500, 'Order id was already recorded but the row could not be read back.');
    if (money(twin.total) !== money(record.total)) throw err(409, 'Duplicate order total mismatch.');
    return { record: twin, created: false };
}

// =========================================================================
// 4. EMAIL ORCHESTRATION
// =========================================================================

async function sendCust(rec: OrderRow): Promise<void> {
    const key = process.env.RESEND_API_KEY; if (!key || !rec.customer_email) return;
    const r = resendClient();
    const items = (rec.items || []).map((i: any) => '<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb;"><strong>' + esc(i.productName || i.name) + '</strong><br><span style="color:#6b7280;font-size:14px;">Size: ' + esc(i.selectedSize || i.size) + ' - Qty: ' + (i.quantity || 1) + '</span></td><td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">$' + Number(i.price || 0).toFixed(2) + '</td></tr>').join('');
    const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;"><h1 style="letter-spacing:2px;">Coalition</h1><h2>Order Confirmed</h2><p>Thank you, ' + esc(rec.customer_name) + '.</p><p>Order: ' + esc(rec.order_number) + '</p><table style="border:1px solid #e5e7eb;border-radius:8px;">' + items + '<tr><td style="padding:12px;background:#f9fafb;"><b>Total</b></td><td style="padding:12px;background:#f9fafb;text-align:right;"><b>$' + Number(rec.total || 0).toFixed(2) + '</b></td></tr></table><p style="color:#555;">Processed 1-2 days. Contact <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a>.</p></div>';
    const result = await r.emails.send({ from: fromAddr(), to: [rec.customer_email], subject: 'Order Confirmation - ' + rec.order_number, html } as any);
    if ((result as any)?.error) throw new Error((result as any).error.message);
}
async function sendAdm(rec: OrderRow): Promise<void> {
    const key = process.env.RESEND_API_KEY; const rcpts = adminRcpt(); if (!key || !rcpts.length) return;
    const r = resendClient();
    const shipping = (rec.shipping_address || {}) as Record<string, unknown>;
    const payRef = rec.payment_reference || '';
    const itemsRows = (rec.items || []).map((i: any) => {
        const up = Number(i.price || 0); const q = Math.max(1, Number(i.quantity || 1));
        return '<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;"><strong>' + esc(i.productName || i.name) + '</strong><br><span style="color:#6b7280;font-size:13px;">Size: ' + esc(i.selectedSize || i.size) + ' - Qty: ' + q + '</span></td><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$' + up.toFixed(2) + '</td><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$' + (up * q).toFixed(2) + '</td></tr>';
    }).join('');
    const payRefRow = payRef ? '<tr><td style="padding:12px;background:#f9fafb;"><strong>Payment Ref</strong></td><td style="padding:12px;text-align:right;">' + esc(payRef) + '</td></tr>' : '';
    const html = '<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:28px;background:#fff;color:#111827;"><h1 style="margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">Order Ready To Fulfill</h1><p style="margin:0 0 24px;color:#6b7280;">A paid order was placed on sgcoalition.xyz. Prepare, pack, and ship the items below.</p><div style="background:#111827;color:#fff;border-radius:8px;padding:18px;margin-bottom:24px;"><div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Fulfillment Summary</div><div style="font-size:28px;font-weight:bold;margin-top:4px;">' + esc(rec.order_number) + '</div><div style="margin-top:8px;">Total: <strong>$' + Number(rec.total || 0).toFixed(2) + '</strong> | Payment: <strong>' + esc(rec.payment_method) + ' / ' + esc(rec.payment_status) + '</strong></div></div><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;"><tr><td style="padding:12px;background:#f9fafb;"><strong>Order</strong></td><td style="padding:12px;text-align:right;">' + esc(rec.order_number) + '</td></tr><tr><td style="padding:12px;background:#f9fafb;"><strong>Total</strong></td><td style="padding:12px;text-align:right;">$' + Number(rec.total || 0).toFixed(2) + '</td></tr><tr><td style="padding:12px;background:#f9fafb;"><strong>Payment</strong></td><td style="padding:12px;text-align:right;">' + esc(rec.payment_method) + ' / ' + esc(rec.payment_status) + '</td></tr><tr><td style="padding:12px;background:#f9fafb;"><strong>Shipping</strong></td><td style="padding:12px;text-align:right;">' + esc(shipping.shippingMethod || 'standard') + ' ($' + Number(shipping.shippingCost || 0).toFixed(2) + ')</td></tr>' + payRefRow + '</table><h2 style="font-size:18px;margin:0 0 10px;">Customer</h2><p style="margin:0 0 20px;line-height:1.6;">' + esc(rec.customer_name) + '<br><a href="mailto:' + esc(rec.customer_email) + '">' + esc(rec.customer_email) + '</a><br>' + esc(rec.customer_phone || '') + '</p><h2 style="font-size:18px;margin:0 0 10px;">Ship To</h2><p style="margin:0 0 20px;line-height:1.6;">' + formatAddr(rec.shipping_address as any) + '</p><h2 style="font-size:18px;margin:0 0 10px;">Items</h2><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><th align="left" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Item</th><th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Unit</th><th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Line</th></tr>' + itemsRows + '</table><div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:16px;margin-bottom:24px;"><strong>Next step:</strong> Pull the items, verify size/quantity, pack the order, then update the admin dashboard when it ships.</div><p style="margin-top:24px;"><a href="https://sgcoalition.xyz/#/admin" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Admin Dashboard</a></p></div>';
    const result = await r.emails.send({ from: fromAddr(), to: rcpts, subject: 'ACTION REQUIRED: Prepare Coalition order ' + rec.order_number, html } as any);
    if ((result as any)?.error) throw new Error((result as any).error.message);
}

// One-click triage: the admin orders view accepts ?tab=orders&q=<id> (search
// matches the raw order id), so this link lands pre-filtered on the exact row.
// Owned here so every ops alert reaches the same place.
function adminOrderUrl(orderId: string): string {
    return 'https://sgcoalition.xyz/#/admin?tab=orders&q=' + encodeURIComponent(orderId);
}

// Ops alert: money moved (payment_intent.succeeded) but the order could not
// be reconciled. Fire-and-forget — an email failure must never affect the
// webhook's HTTP response, which controls Stripe retry behavior.
export async function notifyAdminReconcileFailure(orderId: string, paymentIntentId: string, reason: string, willRetry: boolean, eventId?: string | null): Promise<void> {
    try {
        const key = process.env.RESEND_API_KEY;
        const rcpts = adminRcpt();
        if (!key || !rcpts.length) return;
        const r = resendClient();
        const adminUrl = adminOrderUrl(orderId);
        const stripeUrl = 'https://dashboard.stripe.com/payments/' + encodeURIComponent(paymentIntentId);
        const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;color:#111827;">'
            + '<h2 style="letter-spacing:1px;text-transform:uppercase;">Webhook reconcile failed</h2>'
            + '<p>A <strong>payment_intent.succeeded</strong> event arrived for sgcoalition.xyz but the order could not be reconciled automatically. Money has moved — resolve manually in the Stripe dashboard and Admin &rarr; Orders.</p>'
            + '<p><a href="' + esc(adminUrl) + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-right:12px;">Triage order in Admin</a>'
            + '<a href="' + esc(stripeUrl) + '" style="background:#f3f4f6;color:#111827;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">View payment in Stripe</a></p>'
            + '<table cellpadding="8" style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">'
            + '<tr><td style="background:#f9fafb;"><strong>Order ID</strong></td><td><code>' + esc(orderId) + '</code></td></tr>'
            + (eventId ? '<tr><td style="background:#f9fafb;"><strong>Stripe event</strong></td><td><code>' + esc(eventId) + '</code></td></tr>' : '')
            + '<tr><td style="background:#f9fafb;"><strong>PaymentIntent</strong></td><td><code>' + esc(paymentIntentId) + '</code></td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Reason</strong></td><td>' + esc(reason) + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Retry</strong></td><td>' + (willRetry ? 'Stripe will redeliver (transient failure)' : 'Permanently unreconcilable — Stripe was told NOT to retry') + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Time (UTC)</strong></td><td>' + esc(new Date().toISOString()) + '</td></tr>'
            + '</table>'
            + '<p style="color:#6b7280;">Match the Stripe payment to an order before fulfilling. If the order never appears in Admin, the webhook arrived before the order write — wait for Stripe\'s retry (transient) or create/verify it manually.</p>'
            + '</div>';
        await r.emails.send({ from: fromAddr(), to: rcpts, subject: 'ACTION REQUIRED: webhook reconcile failed for ' + orderId, html } as any);
    } catch (e) {
        console.warn('[OrderIntake] Reconcile-failure alert email failed:', e);
    }
}

// Ops alert: the order was recorded with store credit applied but the buyer's
// balance was NOT debited in full. That is the one outcome this path must
// never reach quietly — the buyer keeps the credit AND the discount — and it
// happens when the balance moves between the re-verify above and the debit
// write, so the operator has to reconcile it by hand. Same delivery and
// one-click triage as the webhook reconcile alert; it never throws, so it
// cannot change the checkout response.
export async function notifyAdminCreditDebitFailure(orderId: string, userId: string, appliedCents: number, debitedCents: number, reason: string): Promise<void> {
    try {
        const key = process.env.RESEND_API_KEY;
        const rcpts = adminRcpt();
        if (!key || !rcpts.length) return;
        const r = resendClient();
        const shortfallCents = Math.max(0, appliedCents - debitedCents);
        const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;color:#111827;">'
            + '<h2 style="letter-spacing:1px;text-transform:uppercase;">Store credit debit did not land</h2>'
            + '<p>Order <code>' + esc(orderId) + '</code> was recorded with <strong>$' + c2d(appliedCents) + '</strong> of store credit applied but only <strong>$' + c2d(debitedCents) + '</strong> was debited from the buyer\'s balance. The buyer currently keeps $' + c2d(shortfallCents) + ' they did not spend, while the order is discounted as if they had.</p>'
            + '<p><a href="' + esc(adminOrderUrl(orderId)) + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Triage order in Admin</a></p>'
            + '<table cellpadding="8" style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">'
            + '<tr><td style="background:#f9fafb;"><strong>Order ID</strong></td><td><code>' + esc(orderId) + '</code></td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>User ID</strong></td><td><code>' + esc(userId) + '</code></td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Credit applied</strong></td><td>$' + c2d(appliedCents) + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Actually debited</strong></td><td>$' + c2d(debitedCents) + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Reason</strong></td><td>' + esc(reason) + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Time (UTC)</strong></td><td>' + esc(new Date().toISOString()) + '</td></tr>'
            + '</table>'
            + '<p style="color:#6b7280;">Debit the remaining $' + c2d(shortfallCents) + ' in Admin &rarr; Customers (store credit) or collect it from the buyer before fulfilling. Do not fulfil on the discounted total alone.</p>'
            + '</div>';
        await r.emails.send({ from: fromAddr(), to: rcpts, subject: 'ACTION REQUIRED: store credit not debited for ' + orderId, html } as any);
    } catch (e) {
        console.warn('[OrderIntake] Store-credit debit alert email failed:', e);
    }
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
    couponCode?: string | null;
    // Store credit the payment-creation step already applied and charged
    // (Stripe intents). acceptCheckout re-verifies it against the live
    // profile balance and debits the profile exactly once per order.
    serverCreditCents?: number;
}

export interface AcceptCheckoutResult { order: OrderRow; created: boolean; }

export async function acceptCheckout(attempt: CheckoutAttempt): Promise<AcceptCheckoutResult> {
    // A repeat of an attempt that already produced an order is a READ, never a
    // second sale. This runs before pricing, payment verification and the
    // store-credit debit on purpose: the re-verify below compares the credit
    // the attempt states against the LIVE balance, which this attempt's own
    // first write already spent — so a replay that reached it would be declined
    // (409) on a balance it spent itself instead of being shown the order it
    // already owns. Retry, refresh, replay and second tab all land here.
    if (attempt.orderId) {
        const prior = await findRecordedOrder(attempt.orderId, { user_id: attempt.userId, customer_email: attempt.customerEmail });
        if (prior) return { order: prior, created: false };
    }

    // Store credit: create-payment-intent applies + debits the intent amount
    // from the live profile and forwards the applied amount here. Re-verify
    // against the CURRENT profile balance before re-pricing — the intent may
    // be older than the balance (another order spent credit in between), and
    // a stale value must not resurrect spent credit. If the balance can no
    // longer cover the stated credit the order is declined (409) rather than
    // silently repriced: the buyer already paid the discounted amount.
    const statedCreditCents = Math.max(0, Math.round(Number(attempt.serverCreditCents) || 0));
    let serverCreditCents = 0;
    if (statedCreditCents > 0 && attempt.userId && uuid(attempt.userId)) {
        const { data: profile, error: profileErr } = await sb()
            .from('profiles')
            .select('store_credit')
            .eq('id', attempt.userId)
            .maybeSingle();
        if (profileErr) throw err(500, profileErr.message || 'Profile lookup failed.');
        const balanceCents = Math.round(Number(profile?.store_credit || 0) * 100);
        if (balanceCents < statedCreditCents) {
            throw err(409, 'Store credit balance has changed since payment started. Contact support.');
        }
        serverCreditCents = statedCreditCents;
    }

    const pricing = await resolvePricing(
        attempt.items.map(i => ({ productId: i.productId, selectedSize: i.selectedSize, quantity: i.quantity, keychainClipOn: Boolean(i.keychainClipOn) })),
        attempt.shippingDollars, attempt.clientDiscount, attempt.paymentEvidence.method, 0, attempt.couponCode, serverCreditCents);
    if (attempt.clientTotal !== undefined) {
        const cc = toCents(attempt.clientTotal, 'Client total');
        if (cc !== pricing.totalCents) console.warn('[OrderIntake] Total mismatch: client=' + cc + 'c server=' + pricing.totalCents + 'c');
    }
    const payment = await verifyPayment(attempt.paymentEvidence, pricing.totalCents);
    const now = new Date().toISOString();
    const oid = attempt.orderId || ('order_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10));
    const onum = attempt.orderNumber || ('ORD-' + Date.now());
    const row: OrderRow = {
        id: oid, order_number: onum, user_id: uuid(attempt.userId), is_guest: Boolean(attempt.isGuest ?? !attempt.userId),
        customer_name: String(attempt.customerName || 'Customer'), customer_email: String(attempt.customerEmail || ''),
        customer_phone: String(attempt.customerPhone || ''),
        items: pricing.items.map(pi => ({ productId: pi.productId, productName: pi.productName, productImage: '', selectedSize: pi.selectedSize, quantity: pi.quantity, price: Number(c2d(pi.unitCents)), basePrice: pi.basePriceDollars, addOnPrice: pi.keychainClipOn ? KEYCHAIN_CLIP_CENTS / 100 : 0, keychainClipOn: pi.keychainClipOn, addOnLabel: pi.keychainClipOn ? 'Keychain Clip (+$10)' : undefined, total: Number(c2d(pi.lineCents)), name: pi.productName, image: '', size: pi.selectedSize } satisfies OrderItemRow)),
        subtotal: Number(c2d(pricing.itemTotalCents)), tax: 0, discount: Number(c2d(pricing.discountCents)),
        total: Number(c2d(pricing.totalCents)),
        // Legacy NOT NULL column (predates the refactor) — mirrors total.
        total_amount: Number(c2d(pricing.totalCents)),
        payment_method: payment.method, payment_status: payment.method === 'crypto' || payment.method === 'cashapp' ? 'pending' : 'paid',
        payment_reference: payment.paymentReference || null, paypal_order_id: null, order_type: 'online',
        shipping_address: (attempt.shippingAddress || null) as OrderRow['shipping_address'],
        // The production orders table requires NOT NULL shipping_info (the
        // column predates the refactor and is still live). Writing only
        // shipping_address made every insert fail with a NOT NULL violation
        // after the order-intake refactor — which is why all checkout paths
        // (Stripe, crypto) stopped creating orders. Mirror the
        // shipping address into both columns.
        shipping_info: (attempt.shippingAddress || null) as OrderRow['shipping_address'],
        notes: [attempt.notes || '', pricing.couponCode && pricing.couponDiscountCents > 0
            ? 'Coupon: ' + pricing.couponCode + ' (-$' + c2d(pricing.couponDiscountCents) + ')'
            : '', pricing.storeCreditCents > 0
            ? 'Store credit applied: -$' + c2d(pricing.storeCreditCents)
            : '', pricing.cryptoDiscountCents > 0
            ? 'Crypto discount (' + Math.min(100, Number(process.env.VITE_SGCOIN_DISCOUNT_PERCENTAGE || 10)) + '%): -$' + c2d(pricing.cryptoDiscountCents)
            : ''].filter(Boolean).join('\n'),
        created_at: now, paid_at: payment.paidAt || null,
        facebook_username: attempt.facebookUsername || null,
        sg_coin_reward: Number(attempt.sgCoinReward || 0),
        paid_amount: 0, balance_due: 0, // resolved below via resolvePaymentState
    };
    // Resolve partial-payment state from notes (e.g. "DEP $30 paid / BAL $10 owes")
    // or infer from payment_status. This preserves the admin backfill workflow where
    // deposit markers in notes override the default full-payment computation.
    const totalDollars = Number(c2d(pricing.totalCents));
    const paymentState = resolvePaymentState(attempt.notes, payment.method === 'crypto' || payment.method === 'cashapp' ? 'pending' : 'paid', totalDollars);
    row.paid_amount = paymentState.paidAmount;
    row.balance_due = paymentState.balanceDue;

    const saved = await persistOrder(row);

    // Store credit was applied → debit the buyer's profile balance exactly
    // once per order. The balance re-verification above ran BEFORE
    // persistOrder, so a profile that spent its credit mid-checkout fails
    // closed before any money lands. The write itself is guarded by a CAS on
    // store_credit >= the amount taken — a concurrent spend between the check
    // and the write no-ops.
    //
    // A no-op must never be silent: the order is already recorded at the
    // discounted total, so a lost race leaves the buyer holding credit they
    // did not spend AND the discount. `.select('id')` is what makes that
    // observable — without it PostgREST reports `error: null` for an update
    // that matched nothing — and the shortfall is escalated to the operator
    // through the same alert channel as a webhook reconcile failure.
    if (saved.created && serverCreditCents > 0 && attempt.userId && uuid(attempt.userId)) {
        try {
            const { data: curProfile, error: curErr } = await sb()
                .from('profiles')
                .select('store_credit')
                .eq('id', attempt.userId)
                .maybeSingle();
            // A balance that cannot be READ is a failed debit, never a $0 one.
            // Coercing a failed read to zero used to write `store_credit: 0` —
            // the CAS `.gte('store_credit', 0)` matches any row — destroying
            // the buyer's whole balance while the order kept its discount and
            // the alert claimed the buyer still held the credit. Fail instead;
            // the catch below reports it.
            if (curErr || !curProfile) {
                throw new Error(curErr?.message || 'Store-credit balance could not be read.');
            }
            const currentCents = Math.round(Number(curProfile.store_credit || 0) * 100);
            const debitCents = Math.min(serverCreditCents, currentCents);
            const { data: debited, error: debitErr } = await sb()
                .from('profiles')
                .update({ store_credit: (currentCents - debitCents) / 100 })
                .eq('id', attempt.userId)
                .gte('store_credit', debitCents / 100)
                .select('id');
            if (debitErr) throw new Error(debitErr.message);
            // PostgREST answers a .select() with the matched rows, so an empty
            // array is a CAS miss: the balance shrank below the amount taken
            // between the re-read and the write. A non-array shape is not
            // judged (a real .select() always answers with rows).
            const matchedNothing = Array.isArray(debited) && debited.length === 0;
            // Second, narrower branch of the same race: the re-read itself
            // already saw less than the order was priced with, so the CAS
            // matches and takes what is left — a short debit either way.
            const shortOfWhatTheOrderUsed = debitCents < serverCreditCents;
            if (matchedNothing || shortOfWhatTheOrderUsed) {
                // A no-op update took nothing off the balance, so the amount
                // actually debited is zero — not the amount we tried to take.
                const debitedCents = matchedNothing ? 0 : debitCents;
                const reason = matchedNothing
                    ? 'The conditional update matched no row — the balance changed between the re-verification and the debit.'
                    : 'The balance was lower than the credit the order was priced with when the debit ran.';
                console.error('[OrderIntake] Store credit not debited in full: order=' + saved.record.id
                    + ' applied=' + c2d(serverCreditCents) + ' debited=' + c2d(debitedCents) + ' — ' + reason);
                await notifyAdminCreditDebitFailure(saved.record.id, attempt.userId, serverCreditCents, debitedCents, reason);
            }
        } catch (e) {
            // Whatever stopped the debit — a failed write, an unreadable
            // balance — the order is already recorded at the discounted total
            // and NOTHING was taken off the buyer's balance, so this is the
            // same money event as a lost race and goes out on the same channel.
            // The alert never throws, so the checkout response cannot fail here.
            const reason = 'The debit did not run: ' + ((e as Error)?.message || e);
            console.error('[OrderIntake] Store credit debit failed: order=' + saved.record.id
                + ' applied=' + c2d(serverCreditCents) + ' — ' + reason);
            await notifyAdminCreditDebitFailure(saved.record.id, attempt.userId, serverCreditCents, 0, reason);
        }
    }

    // Inventory reservation (oversell guard). Pricing VALIDATED stock above,
    // but nothing decremented it server-side — two concurrent buyers of a
    // stock-1 piece could both pass validation. After a CREATED order on a
    // PAID method, each purchased size line is decremented. Pending manual
    // methods (crypto/cashapp) intentionally skip the decrement: the buyer
    // may never actually pay, and the operator's manual order flow can
    // already deduct at fulfillment time.
    const isPaidNow = payment.method !== 'crypto' && payment.method !== 'cashapp';
    if (saved.created && isPaidNow) {
        for (const pi of pricing.items) {
            const { data: curProduct } = await sb()
                .from('products')
                .select('size_inventory')
                .eq('id', pi.productId)
                .maybeSingle();
            // Defensive shape handling: the PostgREST select returns
            // size_inventory as an object; some drivers/proxies (and older
            // clients) may hand back an array of rows instead.
            const rawInv = (curProduct as { size_inventory?: unknown } | null)?.size_inventory;
            const inv = (rawInv && typeof rawInv === 'object' && !Array.isArray(rawInv)
                ? rawInv
                : (Array.isArray(rawInv) && rawInv[0]?.size_inventory) || {}) as Record<string, number>;
            if (!Object.hasOwn(inv, pi.selectedSize)) continue;
            const currentQty = Number(inv[pi.selectedSize] || 0);
            if (currentQty <= 0) {
                throw err(409, (pi.productName || pi.productId) + ' size ' + pi.selectedSize + ' just sold out. Please remove it and try again.');
            }
            const { error: decErr } = await sb()
                .from('products')
                .update({ size_inventory: { ...inv, [pi.selectedSize]: currentQty - pi.quantity } })
                .eq('id', pi.productId)
                .gte('size_inventory->>' + pi.selectedSize, String(pi.quantity));
            if (decErr || currentQty - pi.quantity < 0) {
                throw err(409, (pi.productName || pi.productId) + ' size ' + pi.selectedSize + ' just sold out. Please remove it and try again.');
            }
            if (currentQty - pi.quantity <= 0) {
                console.log('[OrderIntake] Sold out flag: ' + pi.productId + ' size ' + pi.selectedSize + ' hit 0 after order ' + saved.record.id);
            }
            console.log('[OrderIntake] Inventory: ' + pi.productId + ' size ' + pi.selectedSize + ' ' + currentQty + ' -> ' + (currentQty - pi.quantity) + ' (order ' + saved.record.id + ')');
        }
    }

    // Redeemed a coupon → count the usage exactly once per order. Optimistic
    // CAS on used_count so a concurrent checkout can't double-count; if the
    // counter moved, the increment no-ops (log only — never fail the order).
    if (saved.created && pricing.couponCode && pricing.couponDiscountCents > 0) {
        try {
            const { data: curRow } = await sb().from('coupons').select('used_count').eq('code', pricing.couponCode).maybeSingle();
            const cur = Number((curRow as CouponRow | null)?.used_count || 0);
            const { error: incErr } = await sb().from('coupons')
                .update({ used_count: cur + 1 })
                .eq('code', pricing.couponCode)
                .eq('used_count', cur);
            if (incErr) console.warn('[OrderIntake] Coupon usage increment failed:', incErr.message);
        } catch (e) {
            console.warn('[OrderIntake] Coupon usage increment failed:', (e as Error)?.message || e);
        }
    }

    if (saved.created && payment.method !== 'crypto') void sendOrderEmails(saved.record);
    return { order: saved.record, created: saved.created };
}

// =========================================================================
// 6. PROVIDER-NEUTRAL RECONCILIATION
// =========================================================================

// permanent=true: retrying can never fix it (order genuinely absent) —
// callers (the Stripe webhook) must NOT ask Stripe to redeliver.
// Absence of permanent: transient (DB/network) — retrying is correct.
export interface ReconcileResult { success: boolean; error?: string; permanent?: boolean; notFound?: boolean; balancePaid?: number; newTotalPaid?: number; }

export async function reconcilePayment(orderId: string): Promise<ReconcileResult> {
    const s = sb();
    const { data: o, error: fe } = await s.from('orders').select('id,balance_due,total,payment_status,paid_amount').eq('id', orderId).maybeSingle();
    if (fe) return { success: false, error: fe.message || 'Order lookup failed.' };
    if (!o) return { success: false, error: 'Order not found: ' + orderId, permanent: true, notFound: true };
    const bd = Number(o.balance_due ?? 0), pa = Number(o.paid_amount ?? 0), tot = Number(o.total ?? 0);
    if (String(o.payment_status ?? '') !== 'pending') return { success: true };
    if (bd <= 0) return { success: true };
    const { data, error } = await s.rpc('reconcile_balance_payment', { p_order_id: orderId });
    if (error) return { success: false, error: error.message }; // transport/DB error — transient
    const r = data as { success: boolean; error?: string; balance_paid?: number; new_total_paid?: number } | null;
    if (r?.success) { console.log('[OrderIntake] Reconciled ' + orderId + ': $' + pa + ' + $' + bd + ' = $' + tot); return { success: true, balancePaid: r.balance_paid, newTotalPaid: r.new_total_paid }; }
    // RPC responded with a business rejection (e.g. balance mismatch, status
    // changed under FOR UPDATE). Retrying cannot change the outcome — flag it
    // permanent so the webhook alerts instead of burning Stripe retries.
    return { success: false, error: r?.error || 'RPC failed', permanent: true };
}
