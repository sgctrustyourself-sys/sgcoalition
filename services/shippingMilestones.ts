// services/shippingMilestones.ts
//
// Tracking-milestone emails, driven by Shippo track webhooks
// (api/shippo-webhook.ts). The label-purchase email in services/shipping.ts
// says "a label was created"; THIS module sends the two emails that reflect
// reality on the ground:
//
//   - first carrier scan (IN_TRANSIT / OUT_FOR_DELIVERY / ATTEMPTED)
//       -> "your order has shipped" (once per order)
//   - DELIVERED
//       -> "delivered — enjoy" (once per order)
//
// Exactly-once is the same claim pattern as the label purchase: per-milestone
// timestamp columns on the shipments row (shipped_email_sent_at /
// delivered_email_sent_at), claimed with a CAS update that only matches when
// the column is still NULL. Shippo retries failed webhook deliveries — a
// redelivery loses the claim and no-ops. Fail-open: like everything in the
// shipping flow, an email failure is a logged warning; the webhook still
// answers 200 so Shippo does not retry a send that will never succeed.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Shippo's normalized tracking statuses. The "package is actually moving"
// milestones — USPS acceptance scans surface as IN_TRANSIT, and a package can
// jump straight to OUT_FOR_DELIVERY or a delivery attempt in short hauls.
const SHIPPED_STATUSES = new Set(['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ATTEMPTED']);

export type MilestoneAction = 'shipped_email' | 'delivered_email' | 'carrier_issue_email' | 'none';

export interface TrackingUpdate {
    carrier: string;
    trackingNumber: string;
    status: string;
    statusDetails?: string;
    statusDate?: string;
    eta?: string;
    /** Structured location when the carrier provides one (pickup points). */
    location?: { city?: string; state?: string; zip?: string };
}

/**
 * EXCEPTION subtypes worth a customer pickup email: the carrier is HOLDING
 * the package for collection (post office, access point, parcel locker) or
 * left a notice after a failed attempt. Carriers return unclaimed packages
 * to sender after a holding period, so these are genuinely time-sensitive —
 * unlike weather/customs delays, which stay admin-only (a template would be
 * wrong there).
 */
const PICKUP_PATTERN = /held|pick.?up|access point|post office|parcel (point|shop|locker)|locker|notice left|collect/i;

export function isHeldForPickup(statusDetails?: string): boolean {
    return Boolean(statusDetails && PICKUP_PATTERN.test(statusDetails));
}

export interface MilestoneResult {
    action: MilestoneAction;
    reason: string;
    /** True when the caller should answer 5xx so Shippo redelivers the event. */
    retryable?: boolean;
}

function sb(): SupabaseClient {
    const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!u || !k) throw new Error('Supabase not configured.');
    return createClient(u, k);
}

function fromAddr(): string {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

function esc(v: unknown): string {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

interface ShipmentRow {
    id: string;
    order_id: string;
    tracking_number: string | null;
    tracking_url: string | null;
    shipped_email_sent_at: string | null;
    delivered_email_sent_at: string | null;
}

interface OrderRow {
    id: string;
    order_number: string | null;
    customer_name: string | null;
    customer_email: string | null;
    items: Array<{ productName?: string; name?: string; selectedSize?: string; size?: string; quantity?: number }> | null;
}

/**
 * Claim one milestone timestamp: the update only matches while the column is
 * NULL, so exactly one caller (webhook delivery, redelivery, concurrent
 * carrier event) wins and may send.
 */
type ClaimOutcome = 'win' | 'lose' | 'error';

async function claimMilestone(
    s: SupabaseClient,
    shipmentId: string,
    column: 'shipped_email_sent_at' | 'delivered_email_sent_at' | 'carrier_issue_email_sent_at',
): Promise<ClaimOutcome> {
    const r = await s.from('shipments')
        .update({ [column]: new Date().toISOString() })
        .eq('id', shipmentId)
        .is(column, null)
        .select('id');
    if (r.error) {
        // Transient DB: answer retryable so Shippo redelivers and the claim
        // retries — collapsing this into "already sent" would silently lose
        // the milestone email on the first blip. A duplicate email is worse
        // than a late one, but a LOST one is worst of all.
        console.warn('[ShippingMilestones] claim failed:', r.error.message);
        return 'error';
    }
    return Array.isArray(r.data) && r.data.length > 0 ? 'win' : 'lose';
}

function itemsLine(order: OrderRow): string {
    return (order.items || [])
        .map((i) => esc((i.productName || i.name || 'Item') + (i.selectedSize || i.size ? ' — ' + (i.selectedSize || i.size) : '') + ' × ' + (i.quantity || 1)))
        .join('<br>');
}

async function sendMilestoneEmail(
    order: OrderRow,
    shipment: ShipmentRow,
    milestone: 'shipped' | 'delivered',
    ev: TrackingUpdate,
): Promise<void> {
    const to = String(order.customer_email || '').trim();
    if (!to || !to.includes('@')) {
        console.log('[ShippingMilestones] no buyer email on order ' + (order.order_number || order.id) + ' — milestone skipped');
        return;
    }
    try {
        const { resendClient } = await import('../api/_services.js');
        const tracking = esc(shipment.tracking_url || '');
        const trackButton = tracking
            ? '<p><a href="' + tracking + '" style="background:#111;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Track your package</a></p>'
            : '';
        let html: string;
        let subject: string;
        if (milestone === 'shipped') {
            const eta = ev.eta ? '<p style="color:#555;">Estimated delivery: <strong>' + esc(ev.eta) + '</strong> (carrier estimate).</p>' : '';
            subject = 'Your Coalition order has shipped — ' + (order.order_number || order.id);
            html =
                '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;">'
                + '<h1 style="letter-spacing:2px;">Coalition</h1>'
                + '<h2>Your order is on the move</h2>'
                + '<p>Hi ' + esc(order.customer_name || 'there') + ' — the carrier scanned your package for order <strong>' + esc(order.order_number || order.id) + '</strong> and it is on its way.</p>'
                + '<table style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;width:100%;">'
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Tracking</strong></td><td style="padding:12px;">' + esc(ev.trackingNumber) + ' (' + esc(ev.carrier) + ')</td></tr>'
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Items</strong></td><td style="padding:12px;">' + itemsLine(order) + '</td></tr>'
                + '</table>'
                + eta
                + trackButton
                + '<p style="color:#555;">Tracking updates follow as the carrier scans along the route. Questions? <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a>.</p>'
                + '</div>';
        } else {
            subject = 'Delivered — enjoy your Coalition order';
            html =
                '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;">'
                + '<h1 style="letter-spacing:2px;">Coalition</h1>'
                + '<h2>Delivered</h2>'
                + '<p>Hi ' + esc(order.customer_name || 'there') + ' — your order <strong>' + esc(order.order_number || order.id) + '</strong> was marked delivered by ' + esc(ev.carrier) + '. If anything is off, reach out within 48 hours and we will make it right.</p>'
                + '<table style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;width:100%;">'
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Items</strong></td><td style="padding:12px;">' + itemsLine(order) + '</td></tr>'
                + '</table>'
                + '<p><a href="https://sgcoalition.xyz/#/shop" style="background:#111;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Shop the latest</a></p>'
                + '<p style="color:#555;">Coalition is action. Trust Yourself. <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a></p>'
                + '</div>';
        }
        await resendClient().emails.send({ from: fromAddr(), to: [to], subject, html } as never);
        console.log('[ShippingMilestones] ' + milestone + ' email sent for ' + (order.order_number || order.id));
    } catch (e) {
        // Fail-open: the milestone is claimed; a redelivery will no-op, so a
        // failed send stays failed. Log loudly for the operator.
        console.warn('[ShippingMilestones] ' + milestone + ' email failed:', (e as Error)?.message || e);
    }
}

/**
 * Carrier-issue pair: one proactive customer service email + one admin alert
 * with the follow-up checklist. Both fail-open individually.
 */
async function sendCarrierIssueEmails(
    order: OrderRow,
    shipment: ShipmentRow,
    issue: 'failure' | 'expired',
    ev: TrackingUpdate,
): Promise<void> {
    const details = ev.statusDetails ? esc(ev.statusDetails) : '';
    try {
        const to = String(order.customer_email || '').trim();
        if (to && to.includes('@')) {
            const { resendClient } = await import('../api/_services.js');
            const headline = issue === 'failure'
                ? 'There was a delivery problem with your order'
                : 'A quick update on your order\'s delivery';
            const body = issue === 'failure'
                ? 'The carrier let us know delivery did not go through for order <strong>' + esc(order.order_number || order.id) + '</strong>.' + (details ? ' The carrier\'s note: "' + details + '".' : '')
                : 'The shipping label for order <strong>' + esc(order.order_number || order.id) + '</strong> was created, but the carrier never scanned it, so tracking has lapsed.' + (details ? ' The carrier\'s note: "' + details + '".' : '');
            const html =
                '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;">'
                + '<h1 style="letter-spacing:2px;">Coalition</h1>'
                + '<h2>' + headline + '</h2>'
                + '<p>Hi ' + esc(order.customer_name || 'there') + ' — ' + body + '</p>'
                + '<p>We are on it. We will either get the package moving again or resend it — and if it can\'t be delivered, you\'ll be made whole. No action needed from you unless we ask.</p>'
                + '<table style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;width:100%;">'
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Tracking</strong></td><td style="padding:12px;">' + esc(ev.trackingNumber) + ' (' + esc(ev.carrier) + ')</td></tr>'
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Items</strong></td><td style="padding:12px;">' + itemsLine(order) + '</td></tr>'
                + '</table>'
                + '<p style="color:#555;">Questions? Reply straight to <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a> — a person reads it.</p>'
                + '</div>';
            await resendClient().emails.send({
                from: fromAddr(),
                to: [to],
                subject: (issue === 'failure' ? 'Delivery issue with your Coalition order — ' : 'Update on your Coalition order — ') + (order.order_number || order.id),
                html,
            } as never);
            console.log('[ShippingMilestones] carrier-issue customer email sent for ' + (order.order_number || order.id));
        }
    } catch (e) {
        console.warn('[ShippingMilestones] carrier-issue customer email failed:', (e as Error)?.message || e);
    }

    try {
        const key = process.env.RESEND_API_KEY;
        const rcpts = (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || 'sgctrustyourself@gmail.com')
            .split(',').map((e) => e.trim()).filter(Boolean);
        if (!key || !rcpts.length) return;
        const { resendClient } = await import('../api/_services.js');
        const adminUrl = 'https://sgcoalition.xyz/#/admin?tab=orders&q=' + encodeURIComponent(shipment.order_id);
        const shippoUrl = 'https://app.goshippo.com/shipments/';
        const checklist = issue === 'failure'
            ? ['Check the carrier\'s status details in Shippo (returned to sender? held? refused?)', 'Contact the buyer if the carrier note is unclear', 'Reship with a fresh label (Buy Label in Admin) or refund — your call']
            : ['The label was never scanned — likely lost in pre-transit', 'Decide: void the label in Shippo for a refund, or wait a few more days', 'Reship with a fresh label (Buy Label in Admin) if the buyer is waiting'];
        const html =
            '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;color:#111827;">'
            + '<h2 style="letter-spacing:1px;text-transform:uppercase;">Carrier ' + esc(issue) + ' — follow-up required</h2>'
            + '<p>Order <strong>' + esc(order.order_number || order.id) + '</strong> (' + esc(shipment.order_id + ')') + ' — tracking <code>' + esc(ev.trackingNumber) + '</code> (' + esc(ev.carrier) + ').</p>'
            + (details ? '<p>Carrier note: "' + details + '"' + (ev.statusDate ? ' (' + esc(ev.statusDate) + ')' : '') + '.</p>' : '')
            + '<ul>' + checklist.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>'
            + '<p><a href="' + adminUrl + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-right:12px;">Open order in Admin</a>'
            + '<a href="' + shippoUrl + '" style="background:#f3f4f6;color:#111827;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Open Shippo</a></p>'
            + '<p style="color:#6b7280;">The customer has been emailed once about this. Repeated carrier events for this label will not re-notify anyone.</p>'
            + '</div>';
        await resendClient().emails.send({
            from: fromAddr(),
            to: rcpts,
            subject: 'ACTION REQUIRED: carrier ' + issue + ' for ' + (order.order_number || order.id),
            html,
        } as never);
    } catch (e) {
        console.warn('[ShippingMilestones] carrier-issue admin alert failed:', (e as Error)?.message || e);
    }
}

/**
 * Held-for-pickup pair: a time-sensitive customer email carrying the pickup
 * location (from the carrier's own note), plus an admin alert. Fail-open.
 */
async function sendPickupEmails(
    order: OrderRow,
    shipment: ShipmentRow,
    details: string,
    ev: TrackingUpdate,
): Promise<void> {
    try {
        const to = String(order.customer_email || '').trim();
        if (to && to.includes('@')) {
            const { resendClient } = await import('../api/_services.js');
            const locBits = [ev.location?.city, ev.location?.state, ev.location?.zip].filter(Boolean).map(esc);
            const locationHtml = locBits.length
                ? '<tr><td style="padding:12px;background:#f9fafb;"><strong>Pickup location</strong></td><td style="padding:12px;">' + locBits.join(', ') + '</td></tr>'
                : '';
            const html =
                '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;color:#111;">'
                + '<h1 style="letter-spacing:2px;">Coalition</h1>'
                + '<h2>Action needed: your package is waiting for pickup</h2>'
                + '<p>Hi ' + esc(order.customer_name || 'there') + ' — the carrier could not hand-deliver order <strong>' + esc(order.order_number || order.id) + '</strong> and is holding it for you.</p>'
                + '<table style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;width:100%;">'
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Where</strong></td><td style="padding:12px;">' + esc(details) + '</td></tr>'
                + locationHtml
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Tracking</strong></td><td style="padding:12px;">' + esc(ev.trackingNumber) + ' (' + esc(ev.carrier) + ')</td></tr>'
                + '<tr><td style="padding:12px;background:#f9fafb;"><strong>Items</strong></td><td style="padding:12px;">' + itemsLine(order) + '</td></tr>'
                + '</table>'
                + '<p><strong>Please pick it up soon and bring ID</strong> — carriers return unclaimed packages to us after their holding period, and we would rather it be in your hands.</p>'
                + (shipment.tracking_url ? '<p><a href="' + esc(shipment.tracking_url) + '" style="background:#111;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">View carrier tracking</a></p>' : '')
                + '<p style="color:#555;">Bring a photo ID and the notice (if one was left). Questions? <a href="mailto:sgctrustyourself@gmail.com">sgctrustyourself@gmail.com</a></p>'
                + '</div>';
            await resendClient().emails.send({
                from: fromAddr(),
                to: [to],
                subject: 'Action needed: pick up your Coalition package — ' + (order.order_number || order.id),
                html,
            } as never);
            console.log('[ShippingMilestones] pickup customer email sent for ' + (order.order_number || order.id));
        }
    } catch (e) {
        console.warn('[ShippingMilestones] pickup customer email failed:', (e as Error)?.message || e);
    }

    try {
        const key = process.env.RESEND_API_KEY;
        const rcpts = (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || 'sgctrustyourself@gmail.com')
            .split(',').map((e) => e.trim()).filter(Boolean);
        if (!key || !rcpts.length) return;
        const { resendClient } = await import('../api/_services.js');
        const adminUrl = 'https://sgcoalition.xyz/#/admin?tab=orders&q=' + encodeURIComponent(shipment.order_id);
        const html =
            '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;color:#111827;">'
            + '<h2 style="letter-spacing:1px;text-transform:uppercase;">Package held for pickup</h2>'
            + '<p>Order <strong>' + esc(order.order_number || order.id) + '</strong> (' + esc(shipment.order_id) + ') — tracking <code>' + esc(ev.trackingNumber) + '</code> (' + esc(ev.carrier) + ') is held for pickup.</p>'
            + '<p>Carrier note: "' + esc(details) + '"</p>'
            + '<p>The buyer has been emailed the pickup location. If it is not collected in time the carrier will return it — watch tracking, then handle the return in Shippo.</p>'
            + '<p><a href="' + adminUrl + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Open order in Admin</a></p>'
            + '</div>';
        await resendClient().emails.send({
            from: fromAddr(),
            to: rcpts,
            subject: 'Heads up: package held for pickup — ' + (order.order_number || order.id),
            html,
        } as never);
    } catch (e) {
        console.warn('[ShippingMilestones] pickup admin alert failed:', (e as Error)?.message || e);
    }
}

/**
 * Non-pickup EXCEPTION (weather, customs, address notes): admin alert only —
 * the customer email would need a human's judgment on the carrier's note.
 */
async function notifyAdminCarrierException(
    order: OrderRow,
    shipment: ShipmentRow,
    details: string,
    ev: TrackingUpdate,
): Promise<void> {
    try {
        const key = process.env.RESEND_API_KEY;
        const rcpts = (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || 'sgctrustyourself@gmail.com')
            .split(',').map((e) => e.trim()).filter(Boolean);
        if (!key || !rcpts.length) return;
        const { resendClient } = await import('../api/_services.js');
        const adminUrl = 'https://sgcoalition.xyz/#/admin?tab=orders&q=' + encodeURIComponent(shipment.order_id);
        const html =
            '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;color:#111827;">'
            + '<h2 style="letter-spacing:1px;text-transform:uppercase;">Carrier exception — review</h2>'
            + '<p>Order <strong>' + esc(order.order_number || order.id) + '</strong> (' + esc(shipment.order_id) + ') — tracking <code>' + esc(ev.trackingNumber) + '</code> (' + esc(ev.carrier) + ').</p>'
            + '<p>Carrier note: "' + esc(details || '(no details)') + '"' + (ev.statusDate ? ' (' + esc(ev.statusDate) + ')' : '') + '</p>'
            + '<p>The customer has NOT been auto-emailed for this one — the note needs a human read before contacting them.</p>'
            + '<p><a href="' + adminUrl + '" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Open order in Admin</a></p>'
            + '</div>';
        await resendClient().emails.send({
            from: fromAddr(),
            to: rcpts,
            subject: 'Review: carrier exception for ' + (order.order_number || order.id),
            html,
        } as never);
    } catch (e) {
        console.warn('[ShippingMilestones] exception admin alert failed:', (e as Error)?.message || e);
    }
}

/**
 * Handle one Shippo tracking-status update. Never throws — callers answer
 * HTTP from the returned result. Unknown tracking numbers (another Shippo
 * account's labels, probe traffic that passed the token check) resolve to
 * action 'none' rather than an error.
 */
export async function handleTrackingUpdate(ev: TrackingUpdate): Promise<MilestoneResult> {
    const status = String(ev.status || '').trim().toUpperCase();
    const s = sb();

    const found = await s.from('shipments')
        .select('id,order_id,tracking_number,tracking_url,shipped_email_sent_at,delivered_email_sent_at')
        .eq('tracking_number', ev.trackingNumber)
        .maybeSingle();
    if (found.error) {
        console.warn('[ShippingMilestones] shipment lookup failed:', found.error.message);
        return { action: 'none', reason: 'lookup_failed', retryable: true };
    }
    const shipment = (found.data || null) as ShipmentRow | null;
    if (!shipment) return { action: 'none', reason: 'unknown_tracking_number' };

    const orderRes = await s.from('orders')
        .select('id,order_number,customer_name,customer_email,items')
        .eq('id', shipment.order_id)
        .maybeSingle();
    if (orderRes.error || !orderRes.data) {
        console.warn('[ShippingMilestones] order lookup failed for ' + shipment.order_id);
        return { action: 'none', reason: 'order_not_found' };
    }
    const order = orderRes.data as OrderRow;

    if (status === 'DELIVERED') {
        const claim = await claimMilestone(s, shipment.id, 'delivered_email_sent_at');
        if (claim === 'error') return { action: 'none', reason: 'claim_failed', retryable: true };
        if (claim === 'lose') return { action: 'none', reason: 'delivered_already_sent' };
        await sendMilestoneEmail(order, shipment, 'delivered', ev);
        return { action: 'delivered_email', reason: 'delivered' };
    }

    if (SHIPPED_STATUSES.has(status)) {
        const claim = await claimMilestone(s, shipment.id, 'shipped_email_sent_at');
        if (claim === 'error') return { action: 'none', reason: 'claim_failed', retryable: true };
        if (claim === 'lose') return { action: 'none', reason: 'shipped_already_sent' };
        await sendMilestoneEmail(order, shipment, 'shipped', ev);
        return { action: 'shipped_email', reason: status.toLowerCase() };
    }

    // Carrier trouble: FAILURE (delivery failed / returned to sender) and
    // EXPIRED (label never scanned, tracking lapsed). One-time proactive
    // customer email + an actionable admin alert, both under the same claim
    // idempotency — repeated carrier events for the same label never spam
    // anyone. UNKNOWN/INFO_RECEIVED stay silent.
    if (status === 'FAILURE' || status === 'EXPIRED') {
        const issue = status === 'FAILURE' ? 'failure' : 'expired';
        const claim = await claimMilestone(s, shipment.id, 'carrier_issue_email_sent_at');
        if (claim === 'error') return { action: 'none', reason: 'claim_failed', retryable: true };
        if (claim === 'lose') return { action: 'none', reason: 'carrier_issue_already_sent' };
        await sendCarrierIssueEmails(order, shipment, issue, ev);
        console.warn('[ShippingMilestones] carrier ' + status + ' for ' + ev.trackingNumber + ' (' + shipment.order_id + ') — customer + admin notified, operator follow-up required');
        return { action: 'carrier_issue_email', reason: issue };
    }

    // EXCEPTION: Shippo's catch-all for carrier exceptions. Held-for-pickup
    // subtypes are time-sensitive (carriers return unclaimed packages to
    // sender) -> the customer gets a pickup email with the location from the
    // carrier's note. Other flavors (weather, customs, address notes) alert
    // the admin only — a template email would be wrong there. The claim is
    // shared with FAILURE/EXPIRED (one carrier-issue notice per label).
    if (status === 'EXCEPTION') {
        const details = ev.statusDetails || '';
        if (isHeldForPickup(details)) {
            const claim = await claimMilestone(s, shipment.id, 'carrier_issue_email_sent_at');
            if (claim === 'error') return { action: 'none', reason: 'claim_failed', retryable: true };
            if (claim === 'lose') return { action: 'none', reason: 'carrier_issue_already_sent' };
            await sendPickupEmails(order, shipment, details, ev);
            console.warn('[ShippingMilestones] EXCEPTION held-for-pickup for ' + ev.trackingNumber + ' (' + shipment.order_id + ') — customer + admin notified');
            return { action: 'carrier_issue_email', reason: 'exception_held_for_pickup' };
        }
        console.warn('[ShippingMilestones] EXCEPTION (non-pickup) for ' + ev.trackingNumber + ' (' + shipment.order_id + '): ' + details + ' — admin alert only');
        await notifyAdminCarrierException(order, shipment, details, ev);
        return { action: 'none', reason: 'exception_admin_alerted' };
    }

    return { action: 'none', reason: 'status_' + (status.toLowerCase() || 'missing') };
}
