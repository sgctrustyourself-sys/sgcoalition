// tests/shippingMilestones.test.ts
//
// Tests for services/shippingMilestones.ts — the Shippo tracking-webhook
// milestone emails. The contract under test:
//   - shipped (first scan) and delivered emails are sent EXACTLY ONCE per
//     order: the per-milestone claim columns gate every path
//   - a lost claim (redelivery) sends nothing
//   - a failed claim (DB error) sends nothing — Shippo retries
//   - statuses that are not milestones (INFO_RECEIVED, FAILURE, UNKNOWN)
//     send nothing
//   - unknown tracking numbers are 'none', never errors
//   - fail-open: a Resend failure never throws
//
// Supabase + Resend are mocked at the module boundary.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSupabaseFrom = vi.fn();
const mockResendSend = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: mockSupabaseFrom })),
}));

vi.mock('resend', () => ({
    Resend: vi.fn(function (this: any) {
        return { emails: { send: mockResendSend } };
    }),
}));

import { handleTrackingUpdate, isHeldForPickup } from '../services/shippingMilestones';
import type { TrackingUpdate } from '../services/shippingMilestones';

const SHIPMENT = {
    id: 'shipment_order_1',
    order_id: 'order_1',
    tracking_number: '9400111899560000000000',
    tracking_url: 'https://tools.usps.com/track?t=9400111899560000000000',
    shipped_email_sent_at: null as string | null,
    delivered_email_sent_at: null as string | null,
};

const ORDER = {
    id: 'order_1',
    order_number: 'ORD-1',
    customer_name: 'Test Buyer',
    customer_email: 'buyer@test.com',
    items: [{ productName: "Coalition 'Parts' Wallet 3/4", selectedSize: 'One Size', quantity: 1 }],
};

const TRACKING = {
    order_id: 'order_1',
    address_to: { city: 'Baltimore', state: 'MD' },
    carrier: 'usps',
    tracking_number: '9400111899560000000000',
    tracking_status: { status: 'IN_TRANSIT', status_details: 'Arrived at USPS facility', status_date: '2026-10-05T12:00:00Z' },
    eta: '2026-10-08',
};

function withEnv() {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.RESEND_API_KEY = 're_test_key';
}
function clearEnv() {
    for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']) delete process.env[k];
}

/**
 * Supabase stub: tracking-number lookup returns the shipment, order lookup
 * returns the order, and each milestone claim is a CAS that succeeds only
 * while the corresponding fixture column is still null (mirroring the
 * .is(col, null) contract).
 */
function stubDb(opts: {
    shipmentFound?: boolean;
    lookupError?: { message: string } | null;
    orderFound?: boolean;
    noCustomerEmail?: boolean;
    claimShipped?: 'win' | 'lose' | 'error';
    claimDelivered?: 'win' | 'lose' | 'error';
    claimCarrierIssue?: 'win' | 'lose' | 'error';
} = {}) {
    const shipmentRow = { ...SHIPMENT };
    const orderRow = { ...ORDER, customer_email: opts.noCustomerEmail ? '' : ORDER.customer_email };
    const claimState = {
        shipped: opts.claimShipped ?? 'win',
        delivered: opts.claimDelivered ?? 'win',
        carrierIssue: opts.claimCarrierIssue ?? 'win',
    };
    mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'shipments') {
            return {
                select: () => ({
                    eq: () => ({
                        maybeSingle: () => Promise.resolve(
                            opts.lookupError
                                ? { data: null, error: opts.lookupError }
                                : { data: opts.shipmentFound === false ? null : shipmentRow, error: null },
                        ),
                    }),
                }),
                update: (patch: Record<string, unknown>) => ({
                    eq: () => ({
                        is: (_col: string, _v: null) => ({
                            select: () => Promise.resolve((() => {
                                if ('shipped_email_sent_at' in patch) {
                                    if (claimState.shipped === 'error') return { data: null, error: { message: 'db down' } };
                                    if (claimState.shipped === 'lose') return { data: [], error: null };
                                    return { data: [{ id: SHIPMENT.id }], error: null };
                                }
                                if ('delivered_email_sent_at' in patch) {
                                    if (claimState.delivered === 'error') return { data: null, error: { message: 'db down' } };
                                    if (claimState.delivered === 'lose') return { data: [], error: null };
                                    return { data: [{ id: SHIPMENT.id }], error: null };
                                }
                                if ('carrier_issue_email_sent_at' in patch) {
                                    if (claimState.carrierIssue === 'error') return { data: null, error: { message: 'db down' } };
                                    if (claimState.carrierIssue === 'lose') return { data: [], error: null };
                                    return { data: [{ id: SHIPMENT.id }], error: null };
                                }
                                return { data: [], error: null };
                            })()),
                        }),
                    }),
                }),
            };
        }
        // orders
        return {
            select: () => ({
                eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: opts.orderFound === false ? null : orderRow, error: null }),
                }),
            }),
        };
    });
}

function ev(status: string): TrackingUpdate {
    return { carrier: 'USPS', trackingNumber: '9400111899560000000000', status, eta: '2026-10-08' };
}

describe('handleTrackingUpdate', () => {
    beforeEach(() => {
        mockSupabaseFrom.mockReset();
        mockResendSend.mockReset();
        mockResendSend.mockResolvedValue({ data: { id: 'email_x' }, error: null });
        withEnv();
    });
    afterEach(clearEnv);

    it('first IN_TRANSIT scan claims the milestone and sends the shipped email', async () => {
        stubDb();
        const r = await handleTrackingUpdate(ev('IN_TRANSIT'));
        expect(r).toEqual({ action: 'shipped_email', reason: 'in_transit' });
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const mail = mockResendSend.mock.calls[0][0];
        expect(mail.to).toEqual(['buyer@test.com']);
        expect(mail.subject).toContain('has shipped');
        expect(mail.html).toContain('9400111899560000000000');
        expect(mail.html).toContain('Track your package');
    });

    it('OUT_FOR_DELIVERY counts as shipped (short-haul first scan)', async () => {
        stubDb({ claimShipped: 'win' });
        const r = await handleTrackingUpdate(ev('OUT_FOR_DELIVERY'));
        expect(r.action).toBe('shipped_email');
    });

    it('a redelivery after the shipped email was already sent sends nothing', async () => {
        stubDb({ claimShipped: 'lose' });
        const r = await handleTrackingUpdate(ev('IN_TRANSIT'));
        expect(r).toEqual({ action: 'none', reason: 'shipped_already_sent' });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('a failed claim does not send and is marked retryable (Shippo retries)', async () => {
        stubDb({ claimShipped: 'error' });
        const r = await handleTrackingUpdate(ev('IN_TRANSIT'));
        expect(r).toEqual({ action: 'none', reason: 'claim_failed', retryable: true });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('a failed shipment lookup is marked retryable', async () => {
        stubDb({ lookupError: { message: 'connection reset' } });
        const r = await handleTrackingUpdate(ev('IN_TRANSIT'));
        expect(r).toEqual({ action: 'none', reason: 'lookup_failed', retryable: true });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('DELIVERED claims and sends the delivery email with the shop link', async () => {
        stubDb();
        const r = await handleTrackingUpdate(ev('DELIVERED'));
        expect(r).toEqual({ action: 'delivered_email', reason: 'delivered' });
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const mail = mockResendSend.mock.calls[0][0];
        expect(mail.subject).toContain('Delivered');
        expect(mail.html).toContain('sgcoalition.xyz/#/shop');
        expect(mail.html).toContain('Trust Yourself');
    });

    it('a second DELIVERED event sends nothing', async () => {
        stubDb({ claimDelivered: 'lose' });
        const r = await handleTrackingUpdate(ev('DELIVERED'));
        expect(r).toEqual({ action: 'none', reason: 'delivered_already_sent' });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('statuses that are not milestones send nothing', async () => {
        for (const status of ['INFO_RECEIVED', 'UNKNOWN', '']) {
            stubDb();
            const r = await handleTrackingUpdate(ev(status));
            expect(r.action).toBe('none');
        }
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    // CARRIER ISSUE — FAILURE / EXPIRED get a one-time proactive customer
    // email + admin alert (same claim idempotency as the milestone emails).
    it('FAILURE claims the carrier-issue milestone and emails customer + admin', async () => {
        stubDb();
        const r = await handleTrackingUpdate({ ...ev('FAILURE'), statusDetails: 'Returned to sender — address unavailable' });
        expect(r).toEqual({ action: 'carrier_issue_email', reason: 'failure' });
        expect(mockResendSend).toHaveBeenCalledTimes(2);
        const customer = mockResendSend.mock.calls[0][0];
        expect(customer.to).toEqual(['buyer@test.com']);
        expect(customer.subject).toContain('Delivery issue');
        expect(customer.html).toContain('Returned to sender');
        expect(customer.html).toContain('you\'ll be made whole');
        const admin = mockResendSend.mock.calls[1][0];
        expect(admin.subject).toContain('ACTION REQUIRED: carrier failure');
        expect(admin.html).toContain('Returned to sender');
        expect(admin.html).toContain('/#/admin?tab=orders&q=order_1');
        expect(admin.html).toContain('Reship with a fresh label');
    });

    it('EXPIRED emails a lapsed-label note with the expired-specific checklist', async () => {
        stubDb();
        const r = await handleTrackingUpdate(ev('EXPIRED'));
        expect(r).toEqual({ action: 'carrier_issue_email', reason: 'expired' });
        expect(mockResendSend).toHaveBeenCalledTimes(2);
        expect(mockResendSend.mock.calls[0][0].subject).toContain('Update on your Coalition order');
        expect(mockResendSend.mock.calls[1][0].html).toContain('void the label in Shippo for a refund');
    });

    it('a second carrier event for the same label re-notifies no one', async () => {
        stubDb({ claimCarrierIssue: 'lose' });
        const r = await handleTrackingUpdate(ev('FAILURE'));
        expect(r).toEqual({ action: 'none', reason: 'carrier_issue_already_sent' });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('a failed carrier-issue claim is retryable, not silent', async () => {
        stubDb({ claimCarrierIssue: 'error' });
        const r = await handleTrackingUpdate(ev('EXPIRED'));
        expect(r).toEqual({ action: 'none', reason: 'claim_failed', retryable: true });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('an order with no buyer email still alerts the admin on a carrier issue', async () => {
        stubDb({ noCustomerEmail: true });
        const r = await handleTrackingUpdate(ev('FAILURE'));
        expect(r.action).toBe('carrier_issue_email');
        expect(mockResendSend).toHaveBeenCalledTimes(1); // admin only
        expect(mockResendSend.mock.calls[0][0].subject).toContain('ACTION REQUIRED');
    });

    // EXCEPTION — Shippo's catch-all. Held-for-pickup subtypes are
    // time-sensitive and get the customer pickup email with the location;
    // other flavors alert the admin only.
    it('EXCEPTION held-for-pickup emails the customer with the pickup location + admin', async () => {
        stubDb();
        const r = await handleTrackingUpdate({
            ...ev('EXCEPTION'),
            statusDetails: 'Held at USPS pickup point - awaiting collection',
            location: { city: 'Baltimore', state: 'MD', zip: '21201' },
        });
        expect(r).toEqual({ action: 'carrier_issue_email', reason: 'exception_held_for_pickup' });
        expect(mockResendSend).toHaveBeenCalledTimes(2);
        const customer = mockResendSend.mock.calls[0][0];
        expect(customer.subject).toContain('pick up your Coalition package');
        expect(customer.html).toContain('Held at USPS pickup point');
        expect(customer.html).toContain('Baltimore, MD, 21201');
        expect(customer.html).toContain('bring ID');
        const admin = mockResendSend.mock.calls[1][0];
        expect(admin.subject).toContain('held for pickup');
        expect(admin.html).toContain('The buyer has been emailed the pickup location');
    });

    it('EXCEPTION notice-left flavor matches the pickup pattern', async () => {
        stubDb();
        const r = await handleTrackingUpdate({
            ...ev('EXCEPTION'),
            statusDetails: 'Notice left - customer can collect at access point',
        });
        expect(r.reason).toBe('exception_held_for_pickup');
        expect(mockResendSend).toHaveBeenCalledTimes(2);
    });

    it('EXCEPTION non-pickup (weather) alerts the admin only — no customer email', async () => {
        stubDb();
        const r = await handleTrackingUpdate({
            ...ev('EXCEPTION'),
            statusDetails: 'Delivery delayed due to severe weather conditions',
        });
        expect(r).toEqual({ action: 'none', reason: 'exception_admin_alerted' });
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        expect(mockResendSend.mock.calls[0][0].subject).toContain('Review: carrier exception');
        expect(mockResendSend.mock.calls[0][0].html).toContain('has NOT been auto-emailed');
    });

    it('EXCEPTION with empty details alerts the admin only', async () => {
        stubDb();
        const r = await handleTrackingUpdate(ev('EXCEPTION'));
        expect(r).toEqual({ action: 'none', reason: 'exception_admin_alerted' });
        expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it('a second held-for-pickup event re-notifies no one (shared claim)', async () => {
        stubDb({ claimCarrierIssue: 'lose' });
        const r = await handleTrackingUpdate({
            ...ev('EXCEPTION'),
            statusDetails: 'Held at post office - awaiting pickup',
        });
        expect(r).toEqual({ action: 'none', reason: 'carrier_issue_already_sent' });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('isHeldForPickup matches the carrier phrases and rejects the rest', () => {
        for (const phrase of ['Held at post office', 'available for pickup', 'Held at Access Point', 'Parcel locker delivery attempted', 'Notice left', 'collect at parcel shop']) {
            expect(isHeldForPickup(phrase)).toBe(true);
        }
        for (const phrase of ['severe weather delay', 'customs clearance required', 'address incomplete', undefined]) {
            expect(isHeldForPickup(phrase)).toBe(false);
        }
    });

    it('an unknown tracking number is none, not an error', async () => {
        stubDb({ shipmentFound: false });
        const r = await handleTrackingUpdate(ev('IN_TRANSIT'));
        expect(r).toEqual({ action: 'none', reason: 'unknown_tracking_number' });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('an order that no longer exists is none', async () => {
        stubDb({ orderFound: false });
        const r = await handleTrackingUpdate(ev('DELIVERED'));
        expect(r).toEqual({ action: 'none', reason: 'order_not_found' });
    });

    it('a Resend failure is fail-open (no throw, milestone stays claimed)', async () => {
        stubDb();
        mockResendSend.mockRejectedValue(new Error('resend 503'));
        const r = await handleTrackingUpdate(ev('IN_TRANSIT'));
        expect(r.action).toBe('shipped_email');
    });

    it('parses the real Shippo track payload shape (nested tracking_status)', async () => {
        stubDb();
        // The webhook handler flattens the Shippo envelope before calling us;
        // this pins that the flattened TrackingUpdate contract is honored.
        const flattened = {
            carrier: 'USPS',
            trackingNumber: TRACKING.tracking_number,
            status: TRACKING.tracking_status.status,
            statusDetails: TRACKING.tracking_status.status_details,
            statusDate: TRACKING.tracking_status.status_date,
            eta: TRACKING.eta,
        };
        const r = await handleTrackingUpdate(flattened);
        expect(r.action).toBe('shipped_email');
        const mail = mockResendSend.mock.calls[0][0];
        expect(mail.html).toContain('Estimated delivery');
    });
});
