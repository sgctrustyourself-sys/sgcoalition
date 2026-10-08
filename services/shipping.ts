// services/shipping.ts
//
// Automatic shipping-label purchase. When the Stripe webhook confirms money
// moved for an order, this module buys the cheapest USPS Ground Advantage
// label through Shippo and emails the owner the printable PDF link.
//
// Failure semantics are money-safe and mirror api/stripe-webhook.ts:
//   - transient failures (Shippo 5xx/429, network, DB)      -> 'retryable'
//     (the webhook answers 500 and Stripe redelivers; the next attempt
//     no-ops through the claim row and retries the label)
//   - permanent failures (bad address, non-US, rate cap)     -> 'failed'
//     (the webhook answers 200 and emails the admin — retrying can never
//     fix these, so burning Stripe redeliveries would be wrong)
//   - neutral cases (already claimed, not paid, no config)   -> 'skipped'
//
// Double-buy protection lives in the `shipments` table (supabase/migrations/
// 20260930_create_shipments.sql): a deterministic row id (`shipment_<order_id>`)
// claimed via insert-ignore + a pending→buying CAS update. Exactly one worker
// can ever reach the Shippo purchase call for a given order.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SHIPPO_API = 'https://api.goshippo.com';
const DEFAULT_WEIGHT_OZ = 8; // padded mailer + wallet; calibrate after the first scale weigh-in
const DEFAULT_MAX_RATE_USD = 15; // refuse to buy above this — a fat-fingered address must not buy $30 postage

// ---- Result contract ------------------------------------------------------

export type LabelOutcome = 'purchased' | 'skipped' | 'retryable' | 'failed';

export interface LabelResult {
    outcome: LabelOutcome;
    /** Machine-readable reason — logged, emailed on permanent failures. */
    reason: string;
    shipment?: {
        trackingNumber: string;
        trackingUrl: string;
        labelUrl: string;
        rateCents: number;
        carrier: string;
        service: string;
    };
}

// ---- Shared helpers -------------------------------------------------------

function sb(): SupabaseClient {
    const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!u || !k) throw new Error('Supabase not configured.');
    return createClient(u, k);
}

function fromAddr(): string {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

function adminRcpt(): string[] {
    return (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || 'sgctrustyourself@gmail.com')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
}

function esc(v: unknown): string {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---- Order gating ---------------------------------------------------------

export interface ShippableOrderRow {
    id: string;
    order_number: string | null;
    payment_status: string | null;
    paid_amount: number | null;
    balance_due: number | null;
    total: number | null;
    shipping_address: Record<string, unknown> | null;
    shipping_info: Record<string, unknown> | null;
    items: Array<{ productName?: string; name?: string; selectedSize?: string; size?: string; quantity?: number }> | null;
    customer_name: string | null;
    customer_email: string | null;
}

/**
 * A webhook may fire while the order row still says pending (deposit
 * reconciliation flips paid_amount/balance_due, and legacy rows keep the old
 * status), so "paid" is: status paid, OR fully settled by amount. The webhook
 * only calls this module after reconcile succeeded, so this gate is about
 * deferring (skip) rather than distrusting the caller.
 */
export function isOrderPaid(order: ShippableOrderRow): boolean {
    const status = String(order.payment_status || '').toLowerCase();
    if (status === 'paid' || status === 'completed' || status === 'shipped' || status === 'delivered') return true;
    const paid = Number(order.paid_amount || 0);
    const due = Number(order.balance_due || 0);
    return paid > 0 && due <= 0;
}

interface NormalizedAddress {
    name: string; street1: string; street2: string; city: string; state: string; zip: string; country: string;
    phone: string; email: string;
}

/**
 * The order row stores the buyer's checkout address (with shippingMethod /
 * shippingCost riding along). Sparse addresses are possible: offline seeds and
 * older rows intentionally carry state-level data only — those must FAIL the
 * label purchase (permanent) rather than buy postage to a half-address.
 */
export function normalizeAddress(order: ShippableOrderRow): NormalizedAddress | null {
    const raw = (order.shipping_address || order.shipping_info || {}) as Record<string, unknown>;
    const get = (...keys: string[]): string => {
        for (const k of keys) {
            const v = raw[k];
            if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
        }
        return '';
    };
    const addr: NormalizedAddress = {
        name: get('name', 'customerName', 'customer_name') || order.customer_name || '',
        street1: get('address1', 'street1', 'line1'),
        street2: get('address2', 'street2', 'line2'),
        city: get('city'),
        state: get('state', 'region'),
        zip: get('zip', 'postal_code', 'postalCode'),
        country: get('country') || 'US',
        phone: get('phone', 'customerPhone'),
        email: get('email') || order.customer_email || '',
    };
    if (!addr.street1 || !addr.city || !addr.state || !addr.zip) return null;
    return addr;
}

// Checkout stores the buyer's country as a display string — the zip autofill
// writes 'United States' while older rows carry 'US'. Both must read as a US
// destination or every real US order would permanent-fail the label gate.
const US_COUNTRY_ALIASES = new Set([
    'us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america',
]);

export function shipToCountry(addr: NormalizedAddress): string {
    const raw = (addr.country || 'US').trim().toLowerCase();
    return US_COUNTRY_ALIASES.has(raw) ? 'US' : raw.toUpperCase();
}

// ---- Shippo rate selection ------------------------------------------------

export interface ShippoRate {
    objectId: string;
    amount: string;
    provider: string;
    servicelevel?: { token?: string; name?: string } | null;
    attributes?: string[];
}

export const GROUND_ADVANTAGE_TOKEN = 'usps_ground_advantage';

/**
 * Cheapest USPS Ground Advantage rate, within the spend cap. Ground Advantage
 * is the right default for a light padded mailer: tracked, cheapest tracked
 * USPS tier. A strict token match first (Shippo's servicelevel.token), then a
 * provider+tier fallback for API-shape drift — never a "cheapest of anything"
 * fallback, which could buy Priority Express prices for a $45 wallet.
 */
export function pickGroundAdvantageRate(rates: ShippoRate[], maxRateCents: number): ShippoRate | null {
    const candidates = rates.filter((r) => {
        const token = String(r.servicelevel?.token || '').toLowerCase();
        const provider = String(r.provider || '').toUpperCase();
        const name = String(r.servicelevel?.name || '').toUpperCase();
        return (
            token === GROUND_ADVANTAGE_TOKEN ||
            (provider === 'USPS' && (name.includes('GROUND ADVANTAGE') || name.includes('GROUND_ADVANTAGE')))
        );
    });
    const priced = candidates
        .map((r) => ({ rate: r, cents: Math.round(Number(r.amount) * 100) }))
        .filter((x) => Number.isFinite(x.cents) && x.cents > 0)
        .sort((a, b) => a.cents - b.cents);
    const cheapest = priced[0];
    if (!cheapest) return null;
    if (cheapest.cents > maxRateCents) return null;
    return cheapest.rate;
}

// ---- Shippo HTTP (fetch is global in the Node 24 runtime) -----------------

interface ShippoShipmentResponse { object_id?: string; rates?: ShippoRate[]; messages?: Array<{ source?: string; text?: string }>; }
interface ShippoTransactionResponse {
    object_id?: string;
    status?: string;
    tracking_number?: string;
    tracking_url_provider?: string;
    label_url?: string;
    rate?: string | { amount?: string; provider?: string; servicelevel?: { token?: string; name?: string } | null };
    messages?: Array<{ source?: string; text?: string }>;
}

function shippoHeaders(): Record<string, string> {
    return {
        Authorization: 'ShippoToken ' + String(process.env.SHIPPO_API_TOKEN || ''),
        'Content-Type': 'application/json',
    };
}

function isTransientStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

function describeShippoError(body: unknown, fallback: string): string {
    const b = body as { messages?: Array<{ source?: string; text?: string }> } | null;
    const msg = b?.messages?.map((m) => [m.source, m.text].filter(Boolean).join(': ')).find(Boolean);
    return String(msg || fallback).slice(0, 300);
}

// ---- Claim state machine (shipments table) --------------------------------

/**
 * Audit row first, claim later: the deterministic row is insert-ignored into
 * existence BEFORE the gates run, so every outcome (skip, permanent fail,
 * purchase) leaves a trace even on the first attempt. A pre-existing row
 * (Stripe redelivery, concurrent webhook delivery) is left untouched.
 */
async function ensureClaimRow(s: SupabaseClient, orderId: string): Promise<'ok' | 'db_error'> {
    const id = 'shipment_' + orderId;
    const ins = await s.from('shipments')
        .upsert({ id, order_id: orderId, status: 'pending' }, { onConflict: 'id', ignoreDuplicates: true })
        .select('id');
    if (ins.error) {
        // Missing table / schema cache / transient DB — retryable, not fatal.
        console.warn('[Shipping] claim row insert failed:', ins.error.message);
        return 'db_error';
    }
    return 'ok';
}

type ClaimPhase = 'claimed' | 'busy' | 'db_error';

/**
 * pending -> buying: exactly one worker wins the CAS. Losing means a
 * concurrent claim got there first and its purchase is already in flight —
 * or the row sits in failed/purchased (a terminal state that must never be
 * retried), which reads the same: skip.
 */
async function tryClaim(s: SupabaseClient, orderId: string): Promise<ClaimPhase> {
    const id = 'shipment_' + orderId;
    const upd = await s.from('shipments')
        .update({ status: 'buying', error_reason: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
    if (upd.error) {
        console.warn('[Shipping] claim CAS failed:', upd.error.message);
        return 'db_error';
    }
    if (!upd.data || upd.data.length === 0) return 'busy';
    return 'claimed';
}

async function revertClaimToPending(s: SupabaseClient, orderId: string): Promise<void> {
    const id = 'shipment_' + orderId;
    const r = await s.from('shipments')
        .update({ status: 'pending', error_reason: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'buying')
        .select('id');
    if (r.error) console.warn('[Shipping] claim revert failed:', r.error.message);
}

/**
 * Mark a terminal failure. `fromStatus` is the pre-failure state: gates run
 * before the claim (from 'pending'), purchase-time failures happen while
 * holding the claim (from 'buying').
 */
async function markClaimFailed(s: SupabaseClient, orderId: string, reason: string, fromStatus: 'pending' | 'buying'): Promise<void> {
    const id = 'shipment_' + orderId;
    const r = await s.from('shipments')
        .update({ status: 'failed', error_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', fromStatus)
        .select('id');
    if (r.error) console.warn('[Shipping] claim fail-mark failed:', r.error.message);
}

async function markClaimPurchased(
    s: SupabaseClient, orderId: string, payload: {
        carrier: string; service: string; tracking_number: string; tracking_url: string;
        label_url: string; rate_cents: number; shippo_transaction_id: string;
    },
): Promise<void> {
    const id = 'shipment_' + orderId;
    const r = await s.from('shipments')
        .update({ status: 'purchased', error_reason: null, updated_at: new Date().toISOString(), ...payload })
        .eq('id', id)
        .eq('status', 'buying')
        .select('id');
    if (r.error) console.warn('[Shipping] purchase persist failed (label IS bought):', r.error.message);
}

// ---- Admin email -----------------------------------------------------------

async function emailAdminLabel(order: ShippableOrderRow, bought: NonNullable<LabelResult['shipment']>, shipTo: NormalizedAddress): Promise<void> {
    try {
        const { resendClient } = await import('../api/_services.js');
        const items = (order.items || [])
            .map((i) => esc((i.productName || i.name || 'Item') + (i.selectedSize || i.size ? ' — ' + (i.selectedSize || i.size) : '') + ' × ' + (i.quantity || 1)))
            .join('<br>');
        const html =
            '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;color:#111827;">'
            + '<h2 style="letter-spacing:1px;text-transform:uppercase;">Shipping label purchased</h2>'
            + '<p>Order <strong>' + esc(order.order_number || order.id) + '</strong> is paid — print the label and ship.</p>'
            + '<p><a href="' + esc(bought.labelUrl) + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Open label PDF</a></p>'
            + '<table cellpadding="8" style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;width:100%;">'
            + '<tr><td style="background:#f9fafb;"><strong>Tracking</strong></td><td>' + esc(bought.trackingNumber) + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Service</strong></td><td>' + esc(bought.carrier + ' ' + bought.service) + ' — $' + (bought.rateCents / 100).toFixed(2) + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Ship to</strong></td><td>' + esc(shipTo.name) + '<br>' + esc([shipTo.street1, shipTo.street2].filter(Boolean).join(' ')) + '<br>' + esc(shipTo.city + ', ' + shipTo.state + ' ' + shipTo.zip) + '</td></tr>'
            + '<tr><td style="background:#f9fafb;"><strong>Items</strong></td><td>' + items + '</td></tr>'
            + '</table>'
            + '<p style="color:#6b7280;">Purchased automatically by the Stripe webhook. Mark the order shipped in Admin when it leaves.</p>'
            + '</div>';
        await resendClient().emails.send({
            from: fromAddr(),
            to: adminRcpt(),
            subject: 'ACTION REQUIRED: Print label for ' + (order.order_number || order.id),
            html,
        } as never);
    } catch (e) {
        // Never let an email failure affect the purchase outcome.
        console.warn('[Shipping] admin label email failed:', (e as Error)?.message || e);
    }
}

/**
 * Customer-facing shipping confirmation: order number, items, carrier, and a
 * clickable tracking link. Sent once per order by construction — the caller
 * only reaches this after a successful purchase, and the `purchased` claim row
 * makes any later attempt for the same order a skip. Fail-open: the postage is
 * bought, so an email failure is a logged warning, never a failed purchase.
 */
async function emailCustomerTracking(order: ShippableOrderRow, bought: NonNullable<LabelResult['shipment']>): Promise<void> {
    try {
        const to = String(order.customer_email || '').trim();
        if (!to || !to.includes('@')) return; // guest/manual orders may lack an email — the owner email still goes out
        const { resendClient } = await import('../api/_services.js');
        const items = (order.items || [])
            .map((i) => esc((i.productName || i.name || 'Item') + (i.selectedSize || i.size ? ' — ' + (i.selectedSize || i.size) : '') + ' × ' + (i.quantity || 1)))
            .join('<br>');
        const html =
            '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;">'
            + '<h1 style="letter-spacing:2px;">Coalition</h1>'
            + '<h2>Your order is on its way</h2>'
            + '<p>Hi ' + esc(order.customer_name || 'there') + ', a shipping label was created for order <strong>' + esc(order.order_number || order.id) + '</strong>.</p>'
            + '<table style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;width:100%;">'
            + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Tracking number</strong></td><td style="padding:12px;">' + esc(bought.trackingNumber) + '</td></tr>'
            + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Carrier</strong></td><td style="padding:12px;">' + esc(bought.carrier + ' ' + bought.service) + '</td></tr>'
            + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Items</strong></td><td style="padding:12px;">' + items + '</td></tr>'
            + '</table>'
            + (bought.trackingUrl ? '<p><a href="' + esc(bought.trackingUrl) + '" style="background:#111;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Track your package</a></p>' : '')
            + '<p style="color:#555;">Tracking may take a few hours to show movement after the carrier\'s first scan. Questions? <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a>.</p>'
            + '</div>';
        await resendClient().emails.send({
            from: fromAddr(),
            to: [to],
            subject: 'Your Coalition order is on its way — ' + (order.order_number || order.id),
            html,
        } as never);
        console.log('[Shipping] customer tracking email sent for ' + (order.order_number || order.id));
    } catch (e) {
        console.warn('[Shipping] customer tracking email failed:', (e as Error)?.message || e);
    }
}

// ---- Main entry ------------------------------------------------------------

/**
 * Buy a shipping label for a paid order — idempotent, money-safe. Call from
 * the Stripe webhook after reconcile succeeds. Never throws: every path
 * resolves to a LabelResult the caller can map to an HTTP status.
 */
export async function purchaseLabelForOrder(orderId: string): Promise<LabelResult> {
    const token = process.env.SHIPPO_API_TOKEN;
    if (!token) {
        // Deployment lag (env var not set yet) must not permanently fail the
        // order — treat as transient so the next webhook redelivery retries.
        return { outcome: 'skipped', reason: 'shippo_not_configured' };
    }

    // 1. Load the order.
    const s = sb();
    const { data: order, error } = await s.from('orders')
        .select('id,order_number,payment_status,paid_amount,balance_due,total,shipping_address,shipping_info,items,customer_name,customer_email')
        .eq('id', orderId)
        .maybeSingle();
    if (error) {
        console.warn('[Shipping] order lookup failed:', error.message);
        return { outcome: 'retryable', reason: 'order_lookup_failed' };
    }
    if (!order) return { outcome: 'skipped', reason: 'order_not_found' };
    const row = order as ShippableOrderRow;

    // 2. Audit row (insert-ignore) so every outcome below leaves a trace.
    if ((await ensureClaimRow(s, row.id)) === 'db_error') {
        return { outcome: 'retryable', reason: 'claim_db_error' };
    }

    // 3. Paid gate — a neutral SKIP, and deliberately NOT a claim: the row
    // stays 'pending' so a later legitimate attempt (retry, admin trigger)
    // can still claim and buy.
    if (!isOrderPaid(row)) {
        return { outcome: 'skipped', reason: 'not_paid' };
    }

    // 4. Permanent gates — no retry ever fixes these; record the reason.
    const shipTo = normalizeAddress(row);
    if (!shipTo) {
        await markClaimFailed(s, row.id, 'incomplete_shipping_address', 'pending');
        return { outcome: 'failed', reason: 'incomplete_shipping_address' };
    }
    if (shipToCountry(shipTo) !== 'US') {
        // Customs paperwork is a manual flow for now.
        await markClaimFailed(s, row.id, 'non_us_destination', 'pending');
        return { outcome: 'failed', reason: 'non_us_destination' };
    }

    // 5. Claim (idempotency guard — see tryClaim).
    const claim = await tryClaim(s, row.id);
    if (claim === 'db_error') return { outcome: 'retryable', reason: 'claim_db_error' };
    if (claim === 'busy') return { outcome: 'skipped', reason: 'already_claimed' };

    // 5. Create the Shippo shipment (rates).
    const maxRateCents = Math.round(Number(process.env.SHIPPO_MAX_RATE_USD || DEFAULT_MAX_RATE_USD) * 100);
    const weightOz = Number(process.env.SHIPPO_PARCEL_WEIGHT_OZ || DEFAULT_WEIGHT_OZ);
    let res: Response;
    try {
        res = await fetch(SHIPPO_API + '/shipments', {
            method: 'POST',
            headers: shippoHeaders(),
            body: JSON.stringify({
                address_from: {
                    name: process.env.SHIP_FROM_NAME || 'SG Coalition',
                    street1: process.env.SHIP_FROM_STREET1 || '',
                    city: process.env.SHIP_FROM_CITY || '',
                    state: process.env.SHIP_FROM_STATE || '',
                    zip: process.env.SHIP_FROM_ZIP || '',
                    country: 'US',
                    phone: process.env.SHIP_FROM_PHONE || '',
                },
                address_to: {
                    name: shipTo.name || 'Customer',
                    street1: shipTo.street1,
                    street2: shipTo.street2 || '',
                    city: shipTo.city,
                    state: shipTo.state,
                    zip: shipTo.zip,
                    country: 'US',
                    phone: shipTo.phone || '',
                    email: shipTo.email || '',
                },
                // Shippo expects a `parcels` ARRAY (singular key 400s:
                // {"parcels":["This field is required."]} — caught in live smoke).
                parcels: [{ length: '10', width: '7', height: '1', distance_unit: 'in', weight: String(weightOz), mass_unit: 'oz' }],
                shipment_date: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
                async: false,
            }),
        });
    } catch (e) {
        await revertClaimToPending(s, row.id);
        console.warn('[Shipping] shipment create network error:', (e as Error)?.message || e);
        return { outcome: 'retryable', reason: 'shippo_network_error' };
    }
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (isTransientStatus(res.status)) {
            await revertClaimToPending(s, row.id);
            return { outcome: 'retryable', reason: 'shippo_' + res.status };
        }
        const reason = describeShippoError(body, 'shippo_shipment_' + res.status);
        await markClaimFailed(s, row.id, reason, 'buying');
        return { outcome: 'failed', reason };
    }
    const shipment = (await res.json()) as ShippoShipmentResponse;
    const rate = pickGroundAdvantageRate(shipment.rates || [], maxRateCents);
    if (!rate) {
        await markClaimFailed(s, row.id, 'no_ground_advantage_rate_within_cap', 'buying');
        return { outcome: 'failed', reason: 'no_ground_advantage_rate_within_cap' };
    }

    // 6. Buy the label.
    let tRes: Response;
    try {
        tRes = await fetch(SHIPPO_API + '/transactions', {
            method: 'POST',
            headers: shippoHeaders(),
            body: JSON.stringify({ rate: rate.objectId, async: false, label_file_type: 'pdf_4x6' }),
        });
    } catch (e) {
        await revertClaimToPending(s, row.id);
        console.warn('[Shipping] transaction network error:', (e as Error)?.message || e);
        return { outcome: 'retryable', reason: 'shippo_network_error' };
    }
    if (!tRes.ok) {
        const body = await tRes.json().catch(() => null);
        if (isTransientStatus(tRes.status)) {
            await revertClaimToPending(s, row.id);
            return { outcome: 'retryable', reason: 'shippo_' + tRes.status };
        }
        const reason = describeShippoError(body, 'shippo_transaction_' + tRes.status);
        await markClaimFailed(s, row.id, reason, 'buying');
        return { outcome: 'failed', reason };
    }
    const txn = (await tRes.json()) as ShippoTransactionResponse;
    if (txn.status !== 'SUCCESS' || !txn.label_url) {
        const reason = describeShippoError(txn, 'shippo_transaction_' + String(txn.status || 'ERROR'));
        await markClaimFailed(s, row.id, reason, 'buying');
        return { outcome: 'failed', reason };
    }

    const rateObj = typeof txn.rate === 'object' && txn.rate !== null ? txn.rate : null;
    const carrier = String(rateObj?.provider || rate.provider || 'USPS');
    const service = String(rateObj?.servicelevel?.name || rate.servicelevel?.name || 'Ground Advantage');
    const rateCents = Math.round(Number(rateObj?.amount ?? rate.amount) * 100);
    const bought: NonNullable<LabelResult['shipment']> = {
        trackingNumber: String(txn.tracking_number || ''),
        trackingUrl: String(txn.tracking_url_provider || ''),
        labelUrl: String(txn.label_url),
        rateCents: Number.isFinite(rateCents) ? rateCents : 0,
        carrier,
        service,
    };

    // 7. Persist + notify. A persist failure must NOT read as retryable — the
    // postage is bought; a redelivery would skip at the claim row anyway.
    await markClaimPurchased(s, row.id, {
        carrier: bought.carrier,
        service: bought.service,
        tracking_number: bought.trackingNumber,
        tracking_url: bought.trackingUrl,
        label_url: bought.labelUrl,
        rate_cents: bought.rateCents,
        shippo_transaction_id: String(txn.object_id || ''),
    });
    // Both emails awaited, not fire-and-forget: Vercel can freeze the lambda
    // the moment the response returns, which would silently drop a void'd
    // send — and a pending promise would also race any test asserting on the
    // send. The buyer hears first, then the internal action driver. Both are
    // fail-open: the postage is bought, an email failure is a logged warning.
    await emailCustomerTracking(row, bought);
    await emailAdminLabel(row, bought, shipTo);

    console.log('[Shipping] label purchased for ' + (row.order_number || row.id) + ': ' + bought.trackingNumber + ' ($' + (bought.rateCents / 100).toFixed(2) + ')');
    return { outcome: 'purchased', reason: 'label_purchased', shipment: bought };
}
