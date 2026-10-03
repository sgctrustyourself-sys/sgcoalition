// tests/shippingLabel.test.ts
//
// Gate suite for services/shipping.ts — the automatic label-purchase module.
//
// The money-safety contract under test:
//   - exactly one label purchase per order (claim row insert-ignore + CAS),
//     so Stripe webhook redeliveries can never buy postage twice
//   - permanent failures (bad address, non-US, rate cap) never read as retryable
//   - transient failures (Shippo 5xx/429, network, DB) DO read as retryable
//   - the cheapest USPS Ground Advantage rate within the spend cap is the
//     only thing ever bought
//
// Supabase, Resend, and global fetch are mocked at the module boundary.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE importing the service
// ---------------------------------------------------------------------------

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

import {
    isOrderPaid,
    normalizeAddress,
    shipToCountry,
    pickGroundAdvantageRate,
    purchaseLabelForOrder,
    GROUND_ADVANTAGE_TOKEN,
} from '../services/shipping';
import type { ShippableOrderRow, ShippoRate } from '../services/shipping';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function orderRow(overrides: Partial<ShippableOrderRow> = {}): ShippableOrderRow {
    return {
        id: 'order_test_1',
        order_number: 'ORD-TEST-1',
        payment_status: 'paid',
        paid_amount: 45,
        balance_due: 0,
        total: 45,
        shipping_address: {
            name: 'Test Buyer',
            address1: '1 Coalition Way',
            city: 'Baltimore',
            state: 'MD',
            zip: '21201',
            country: 'US',
        },
        shipping_info: null,
        items: [{ productName: "Coalition 'Parts' Wallet 3/4", selectedSize: 'One Size', quantity: 1 }],
        customer_name: 'Test Buyer',
        customer_email: 'buyer@test.com',
        ...overrides,
    };
}

const RATE_GA_45: ShippoRate = { objectId: 'rate_ga_45', amount: '4.55', provider: 'USPS', servicelevel: { token: GROUND_ADVANTAGE_TOKEN, name: 'USPS Ground Advantage' } };
const RATE_GA_60: ShippoRate = { objectId: 'rate_ga_60', amount: '6.10', provider: 'USPS', servicelevel: { token: GROUND_ADVANTAGE_TOKEN, name: 'USPS Ground Advantage' } };
const RATE_PRIORITY: ShippoRate = { objectId: 'rate_prio', amount: '9.40', provider: 'USPS', servicelevel: { token: 'usps_priority', name: 'USPS Priority Mail' } };

function ok(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
}
function bad(status: number, body: unknown) {
    return { ok: false, status, json: async () => body };
}

const TXN_SUCCESS = {
    object_id: 'txn_1',
    status: 'SUCCESS',
    tracking_number: '9400111899560000000000',
    tracking_url_provider: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899560000000000',
    label_url: 'https://shippo-delivery.s3.amazonaws.com/label_test.pdf',
    rate: { amount: '4.55', provider: 'USPS', servicelevel: { name: 'USPS Ground Advantage' } },
};

function shipOk(rates: ShippoRate[]) {
    return ok({ object_id: 'shp_1', rates });
}

// ---------------------------------------------------------------------------
// Supabase chain stubs
// ---------------------------------------------------------------------------

interface ShipOpts {
    upsert?: { data: unknown; error: { message: string } | null };
    cas?: { data: unknown; error: { message: string } | null };
}

function stubSupabase(order: unknown, orderError: { message: string } | null = null, ship: ShipOpts = {}) {
    const upsertSelect = vi.fn(() => Promise.resolve(ship.upsert ?? { data: [{ id: 'shipment_order_test_1' }], error: null }));
    const casSelect = vi.fn(() => Promise.resolve(ship.cas ?? { data: [{ id: 'shipment_order_test_1' }], error: null }));
    const shipments = {
        upsert: vi.fn(() => ({ select: upsertSelect })),
        update: vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn(() => ({ select: casSelect })),
            })),
        })),
    };
    const orders = {
        select: () => ({
            eq: () => ({
                maybeSingle: () => Promise.resolve(orderError ? { data: null, error: orderError } : { data: order, error: null }),
            }),
        }),
    };
    mockSupabaseFrom.mockImplementation((table: string) => (table === 'orders' ? orders : shipments));
    return { shipments, upsertSelect, casSelect };
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function withEnv() {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.SHIPPO_API_TOKEN = 'shippo_test_key';
    process.env.SHIP_FROM_NAME = 'SG Coalition';
    process.env.SHIP_FROM_STREET1 = '100 Ship From St';
    process.env.SHIP_FROM_CITY = 'York';
    process.env.SHIP_FROM_STATE = 'PA';
    process.env.SHIP_FROM_ZIP = '17401';
    process.env.RESEND_API_KEY = 're_test_key';
}
function clearEnv() {
    for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SHIPPO_API_TOKEN', 'SHIP_FROM_NAME', 'SHIP_FROM_STREET1', 'SHIP_FROM_CITY', 'SHIP_FROM_STATE', 'SHIP_FROM_ZIP', 'SHIP_FROM_PHONE', 'RESEND_API_KEY', 'SHIPPO_MAX_RATE_USD', 'SHIPPO_PARCEL_WEIGHT_OZ']) {
        delete process.env[k];
    }
}

// =========================================================================
// Pure helpers
// =========================================================================

describe('isOrderPaid', () => {
    it('paid status', () => {
        expect(isOrderPaid(orderRow())).toBe(true);
    });
    it('settled by amounts even with a legacy pending status', () => {
        expect(isOrderPaid(orderRow({ payment_status: 'pending', paid_amount: 45, balance_due: 0 }))).toBe(true);
    });
    it('unsettled deposit is not paid', () => {
        expect(isOrderPaid(orderRow({ payment_status: 'pending', paid_amount: 20, balance_due: 25 }))).toBe(false);
    });
    it('nothing paid is not paid', () => {
        expect(isOrderPaid(orderRow({ payment_status: 'pending', paid_amount: 0, balance_due: 0 }))).toBe(false);
    });
});

describe('normalizeAddress', () => {
    it('reads the checkout address shape', () => {
        const a = normalizeAddress(orderRow())!;
        expect(a.street1).toBe('1 Coalition Way');
        expect(a.city).toBe('Baltimore');
        expect(a.zip).toBe('21201');
        expect(a.country).toBe('US');
    });
    it('falls back to shipping_info and aliases', () => {
        const a = normalizeAddress(orderRow({
            shipping_address: null,
            shipping_info: { street1: '9 Old Field Rd', city: 'York', state: 'PA', postal_code: '17401' },
        }))!;
        expect(a.street1).toBe('9 Old Field Rd');
        expect(a.zip).toBe('17401');
    });
    it('returns null for a sparse (state-level only) address', () => {
        expect(normalizeAddress(orderRow({ shipping_address: { city: 'Baltimore', state: 'MD' } }))).toBeNull();
    });
    it('returns null when there is no address at all', () => {
        expect(normalizeAddress(orderRow({ shipping_address: null, shipping_info: null }))).toBeNull();
    });
});

describe('shipToCountry', () => {
    it('defaults to US and uppercases', () => {
        const a = normalizeAddress(orderRow())!;
        expect(shipToCountry(a)).toBe('US');
        const b = normalizeAddress(orderRow({ shipping_address: { address1: '1 St', city: 'Toronto', state: 'ON', zip: 'M5V', country: 'ca' } }))!;
        expect(shipToCountry(b)).toBe('CA');
    });
    it('reads checkout display strings as US (regression: zip autofill writes United States)', () => {
        for (const raw of ['United States', 'united states of america', 'USA', 'U.S.']) {
            const a = normalizeAddress(orderRow({ shipping_address: { address1: '1 St', city: 'York', state: 'PA', zip: '17401', country: raw } }))!;
            expect(shipToCountry(a)).toBe('US');
        }
    });
});

describe('pickGroundAdvantageRate', () => {
    it('picks the cheapest Ground Advantage rate', () => {
        const r = pickGroundAdvantageRate([RATE_GA_60, RATE_GA_45, RATE_PRIORITY], 1500)!;
        expect(r.objectId).toBe('rate_ga_45');
    });
    it('never falls back to a non-Ground-Advantage service', () => {
        expect(pickGroundAdvantageRate([RATE_PRIORITY], 1500)).toBeNull();
    });
    it('refuses a rate above the spend cap', () => {
        expect(pickGroundAdvantageRate([RATE_GA_45], 400)).toBeNull();
    });
    it('matches the provider+tier fallback shape', () => {
        const shape = { objectId: 'r1', amount: '5.00', provider: 'usps', servicelevel: { name: 'Ground Advantage' } };
        expect(pickGroundAdvantageRate([shape], 1500)!.objectId).toBe('r1');
    });
});

// =========================================================================
// purchaseLabelForOrder
// =========================================================================

describe('purchaseLabelForOrder', () => {
    beforeEach(() => {
        mockSupabaseFrom.mockReset();
        mockResendSend.mockReset();
        mockResendSend.mockResolvedValue({ data: { id: 'email_x' }, error: null });
        vi.stubGlobal('fetch', vi.fn());
        withEnv();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        clearEnv();
    });

    it('skips when Shippo is not configured (deployment lag is transient)', async () => {
        delete process.env.SHIPPO_API_TOKEN;
        stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'skipped', reason: 'shippo_not_configured' }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('purchases the cheapest Ground Advantage label and emails the owner', async () => {
        stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockResolvedValueOnce(shipOk([RATE_GA_60, RATE_GA_45, RATE_PRIORITY]));
        fetchMock.mockResolvedValueOnce(ok(TXN_SUCCESS));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result.outcome).toBe('purchased');
        expect(result.shipment!.trackingNumber).toBe('9400111899560000000000');
        expect(result.shipment!.rateCents).toBe(455);
        // The bought rate is the cheap GA one, not merely the cheapest of anything.
        const txnCall = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
        expect(txnCall.rate).toBe('rate_ga_45');
        expect(txnCall.label_file_type).toBe('pdf_4x6');
        // Shippo's shipments endpoint requires a `parcels` ARRAY — a singular
        // `parcel` key 400s with {"parcels":["This field is required."]}
        // (caught in the first live smoke run).
        const shipCall = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
        expect(Array.isArray(shipCall.parcels)).toBe(true);
        expect(shipCall.parcels[0].weight).toBe('8');
        expect(shipCall.parcels[0].mass_unit).toBe('oz');
        // Shipment row lands in 'purchased'.
        expect(mockSupabaseFrom).toHaveBeenCalledWith('shipments');
        // Two emails: the buyer's tracking confirmation first, then the owner's
        // action driver with the printable label link.
        expect(mockResendSend).toHaveBeenCalledTimes(2);
        const customerMail = mockResendSend.mock.calls[0][0];
        expect(customerMail.to).toEqual(['buyer@test.com']);
        expect(customerMail.subject).toContain('on its way');
        expect(customerMail.html).toContain('9400111899560000000000');
        expect(customerMail.html).toContain('Track your package');
        const adminMail = mockResendSend.mock.calls[1][0];
        expect(adminMail.html).toContain('label_test.pdf');
        expect(adminMail.subject).toContain('Print label');
    });

    it('a customer with no email on the order still gets their label — owner email only', async () => {
        stubSupabase(orderRow({ customer_email: '' }));
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockResolvedValueOnce(shipOk([RATE_GA_45]));
        fetchMock.mockResolvedValueOnce(ok(TXN_SUCCESS));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result.outcome).toBe('purchased');
        expect(mockResendSend).toHaveBeenCalledTimes(1); // admin only
        expect(mockResendSend.mock.calls[0][0].subject).toContain('Print label');
    });

    it('an email failure never reads as a failed purchase (fail-open)', async () => {
        stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockResolvedValueOnce(shipOk([RATE_GA_45]));
        fetchMock.mockResolvedValueOnce(ok(TXN_SUCCESS));
        mockResendSend.mockRejectedValue(new Error('resend 503'));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result.outcome).toBe('purchased');
        expect(result.shipment!.labelUrl).toContain('label_test.pdf');
    });

    it('never buys twice: a held claim short-circuits before Shippo', async () => {
        // The audit row exists (insert-ignore no-op) and the CAS loses — the
        // row is 'buying'/'purchased' from an earlier attempt, not 'pending'.
        stubSupabase(orderRow(), null, { upsert: { data: [], error: null }, cas: { data: [], error: null } });
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'skipped', reason: 'already_claimed' }));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('skips when a concurrent worker holds the claim (CAS loss)', async () => {
        stubSupabase(orderRow(), null, { cas: { data: [], error: null } });
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'skipped', reason: 'already_claimed' }));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('classifies a claim DB error (e.g. missing table) as retryable', async () => {
        stubSupabase(orderRow(), null, { upsert: { data: null, error: { message: 'relation "shipments" does not exist' } } });

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'retryable', reason: 'claim_db_error' }));
    });

    it('rate cap is a permanent failure — no purchase attempt', async () => {
        process.env.SHIPPO_MAX_RATE_USD = '4';
        const { shipments } = stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockResolvedValueOnce(shipOk([RATE_GA_45]));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'failed', reason: 'no_ground_advantage_rate_within_cap' }));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mockResendSend).not.toHaveBeenCalled(); // webhook layer emails, not the service
        const failMark = shipments.update.mock.calls.at(-1)![0];
        expect(failMark.status).toBe('failed');
    });

    it('a sparse address is a permanent failure before any Shippo call', async () => {
        const { shipments } = stubSupabase(orderRow({ shipping_address: { city: 'Baltimore', state: 'MD' } }));
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'failed', reason: 'incomplete_shipping_address' }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(shipments.update.mock.calls.at(-1)![0].status).toBe('failed');
    });

    it('a non-US destination is a permanent failure (manual customs flow)', async () => {
        const { shipments } = stubSupabase(orderRow({ shipping_address: { address1: '1 St', city: 'Toronto', state: 'ON', zip: 'M5V', country: 'CA' } }));
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'failed', reason: 'non_us_destination' }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(shipments.update.mock.calls.at(-1)![0].status).toBe('failed');
    });

    it('an unpaid order is skipped, not failed', async () => {
        const { shipments } = stubSupabase(orderRow({ payment_status: 'pending', paid_amount: 0, balance_due: 45 }));
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'skipped', reason: 'not_paid' }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(shipments.update).not.toHaveBeenCalled(); // no claim taken — a later attempt can still buy
    });

    it('Shippo 500 is retryable and the claim reverts to pending', async () => {
        const { shipments } = stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockResolvedValueOnce(bad(500, { messages: [{ source: 'Shippo', text: 'internal error' }] }));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'retryable', reason: 'shippo_500' }));
        const revert = shipments.update.mock.calls.at(-1)![0];
        expect(revert.status).toBe('pending');
    });

    it('Shippo 400 (bad address) is a permanent failure with the carrier reason', async () => {
        const { shipments } = stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockResolvedValueOnce(bad(400, { messages: [{ source: 'USPS', text: 'Address not found' }] }));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result.outcome).toBe('failed');
        expect(result.reason).toContain('Address not found');
        expect(shipments.update.mock.calls.at(-1)![0].status).toBe('failed');
    });

    it('a network error to Shippo is retryable', async () => {
        stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockRejectedValueOnce(new Error('socket hang up'));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result).toEqual(expect.objectContaining({ outcome: 'retryable', reason: 'shippo_network_error' }));
    });

    it('a non-SUCCESS transaction is a permanent failure', async () => {
        const { shipments } = stubSupabase(orderRow());
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
        fetchMock.mockResolvedValueOnce(shipOk([RATE_GA_45]));
        fetchMock.mockResolvedValueOnce(ok({ object_id: 'txn_2', status: 'ERROR', messages: [{ source: 'USPS', text: 'label buy failed' }] }));

        const result = await purchaseLabelForOrder('order_test_1');

        expect(result.outcome).toBe('failed');
        expect(result.reason).toContain('label buy failed');
        expect(shipments.update.mock.calls.at(-1)![0].status).toBe('failed');
    });
});
