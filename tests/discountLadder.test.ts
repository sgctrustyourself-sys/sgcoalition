// tests/discountLadder.test.ts
//
// The discount ladder — one promotional discount per order, never stacked.
//
// The store can carry four separate markdowns at once:
//   • the Above-as-Below set bonus   (a bundle PRICE, applied first)
//   • the member discount            (30% off, signed-in account holders)
//   • an admin coupon               (a code the shopper types)
//   • the SGCoin crypto incentive    (pay with USDC)
// plus store credit, which is the buyer's own money and is always honored.
//
// Before the ladder existed, a member could apply a coupon AND pay with
// crypto AND have store credit, and the order priced itself down to $0. This
// suite pins the precedence so that can never come back:
//
//   member discount  >  coupon  >  crypto incentive
//
// and asserts the invariant directly: the applied promotional discount never
// exceeds the base it was taken from, for every combination in the matrix.

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock helpers — chainable Supabase stubs (mirrors orderIntake.test.ts)
// ---------------------------------------------------------------------------

function chain(resolution: unknown) {
    const q: Record<string, any> = {};
    q.maybeSingle = vi.fn().mockResolvedValue(resolution);
    q.single = vi.fn().mockResolvedValue(resolution);
    q.select = vi.fn(() => q);
    q.in = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.then = vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolution).then(onFulfilled));
    return q;
}

const mockSupabaseFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: mockSupabaseFrom })),
}));

vi.mock('stripe', () => ({
    default: vi.fn(function (this: any) {
        this.paymentIntents = { retrieve: vi.fn() };
    }),
}));

vi.mock('resend', () => ({
    Resend: vi.fn(function (this: any) {
        this.emails = { send: vi.fn() };
    }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MEMBER_ID = '9b2f8a5c-1d4e-4f6a-9c3b-7e8d2a1b4c5d';
const GUEST_ID = null;

/** A plain $75 tee. */
const TEE = {
    id: 'prod-tee', name: 'Test Tee', price: 75, category: 'shirt',
    archived: false, size_inventory: { M: 10 },
};
/** The two pieces that earn the $30 Above-as-Below set bonus. */
const SET_TEE = {
    id: 'prod_tee_above_as_below', name: 'Above as Below Tee', price: 75, category: 'shirt',
    archived: false, size_inventory: { M: 10 },
};
const SET_SHORTS = {
    id: 'prod_shorts_above_as_below', name: 'Above as Below Shorts', price: 75, category: 'shirt',
    archived: false, size_inventory: { M: 10 },
};

/** A 25%-off admin coupon, no minimum. */
const COUPON_25 = {
    code: 'SAVE25', discount_type: 'percent', discount_value: 25,
    min_order_value: 0, max_uses: null, used_count: 0, end_date: null, is_active: true,
};

/** A coupon the shopper cannot use (past its minimum). */
const COUPON_MIN_100 = {
    code: 'BIGSPEND', discount_type: 'percent', discount_value: 40,
    min_order_value: 100, max_uses: null, used_count: 0, end_date: null, is_active: true,
};

let resolvePricing: typeof import('../services/orderIntake').resolvePricing;
let MEMBER_DISCOUNT_RATE: number;
let MEMBER_PROMO_ENDS_AT: string;

/**
 * The member discount is a PROMOTION with an end date
 * (utils/memberDiscount.ts), and the pricing authority reads the wall clock
 * to decide whether it is still running. These tests therefore pin the clock
 * to a moment inside the window, so they assert the PROMOTION's behaviour
 * rather than today's date - without this they would start failing the
 * morning the promotion ends.
 */
const INSIDE_THE_PROMO = new Date('2026-10-20T12:00:00Z');
const AFTER_THE_PROMO = new Date('2026-11-02T12:00:00Z');

/** Point the Supabase mock at a product set + a coupon row. */
function stub(products: unknown[], coupon: unknown = null) {
    mockSupabaseFrom.mockImplementation((table: string) =>
        table === 'coupons'
            ? chain({ data: coupon, error: null })
            : chain({ data: products, error: null }),
    );
}

const teeItem = [{ productId: 'prod-tee', selectedSize: 'M', quantity: 1, keychainClipOn: false }];
const setItems = [
    { productId: 'prod_tee_above_as_below', selectedSize: 'M', quantity: 1, keychainClipOn: false },
    { productId: 'prod_shorts_above_as_below', selectedSize: 'M', quantity: 1, keychainClipOn: false },
];

beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const mod = await import('../services/orderIntake');
    resolvePricing = mod.resolvePricing;
    const shared = await import('../utils/memberDiscount');
    MEMBER_DISCOUNT_RATE = shared.MEMBER_DISCOUNT_RATE;
    MEMBER_PROMO_ENDS_AT = shared.MEMBER_PROMO_ENDS_AT;
});

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    // The crypto incentive is ON for this suite so the ladder can be seen
    // choosing between it and the other offers.
    process.env.VITE_SGCOIN_DISCOUNT_ENABLED = 'true';
    process.env.VITE_SGCOIN_DISCOUNT_PERCENTAGE = '10';
    // Pin the clock INSIDE the member promotion window. Only Date is faked,
    // so nothing else in the suite is affected by the fake timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(INSIDE_THE_PROMO);
});

afterEach(() => {
    vi.useRealTimers();
    delete process.env.VITE_SGCOIN_DISCOUNT_ENABLED;
    delete process.env.VITE_SGCOIN_DISCOUNT_PERCENTAGE;
});

// =========================================================================
// The member discount itself
// =========================================================================

describe('member discount', () => {
    it('is 30% of the item total for a signed-in account holder', async () => {
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, undefined, 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(2250); // 30% of $75
        expect(p.totalCents).toBe(5250);
    });

    it('does not apply to a guest', async () => {
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, undefined, 0, GUEST_ID);
        expect(p.memberDiscountCents).toBe(0);
        expect(p.totalCents).toBe(7500);
    });

    it('does not apply to a non-UUID user id (a client cannot claim a discount)', async () => {
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, undefined, 0, 'user-1');
        expect(p.memberDiscountCents).toBe(0);
        expect(p.totalCents).toBe(7500);
    });

    it('applies on every payment method', async () => {
        for (const method of ['stripe', 'crypto', 'cashapp', 'store_credit']) {
            stub([TEE]);
            const p = await resolvePricing(teeItem, 0, 0, method, 0, undefined, 0, MEMBER_ID);
            expect(p.memberDiscountCents, method).toBe(2250);
        }
    });
});

// =========================================================================
// The ladder — one promotional discount per order
// =========================================================================

describe('discount ladder: member > coupon > crypto', () => {
    it('a member with a coupon gets the member discount, NOT the coupon', async () => {
        stub([TEE], COUPON_25);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, 'SAVE25', 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(2250);
        expect(p.couponDiscountCents).toBe(0);
        expect(p.couponSuppressed).toBe(true);
        expect(p.totalCents).toBe(5250);
    });

    it('a member paying with crypto gets the member discount, NOT the crypto incentive', async () => {
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'crypto', 0, undefined, 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(2250);
        expect(p.cryptoDiscountCents).toBe(0);
        expect(p.cryptoDiscountSuppressed).toBe(true);
        expect(p.totalCents).toBe(5250);
    });

    it('a member with a coupon paying with crypto gets ONLY the member discount', async () => {
        stub([TEE], COUPON_25);
        const p = await resolvePricing(teeItem, 0, 0, 'crypto', 0, 'SAVE25', 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(2250);
        expect(p.couponDiscountCents).toBe(0);
        expect(p.cryptoDiscountCents).toBe(0);
        expect(p.couponSuppressed).toBe(true);
        expect(p.cryptoDiscountSuppressed).toBe(true);
        expect(p.totalCents).toBe(5250);
    });

    it('a guest with a coupon gets the coupon', async () => {
        stub([TEE], COUPON_25);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, 'SAVE25', 0, GUEST_ID);
        expect(p.couponDiscountCents).toBe(1875); // 25% of $75
        expect(p.memberDiscountCents).toBe(0);
        expect(p.totalCents).toBe(5625);
    });

    it('a guest with a coupon paying with crypto gets the coupon, NOT the crypto incentive', async () => {
        stub([TEE], COUPON_25);
        const p = await resolvePricing(teeItem, 0, 0, 'crypto', 0, 'SAVE25', 0, GUEST_ID);
        expect(p.couponDiscountCents).toBe(1875);
        expect(p.cryptoDiscountCents).toBe(0);
        expect(p.cryptoDiscountSuppressed).toBe(true);
        expect(p.totalCents).toBe(5625);
    });

    it('a guest paying with crypto and no coupon gets the crypto incentive', async () => {
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'crypto', 0, undefined, 0, GUEST_ID);
        expect(p.cryptoDiscountCents).toBe(750); // 10% of $75
        expect(p.memberDiscountCents).toBe(0);
        expect(p.couponDiscountCents).toBe(0);
        expect(p.totalCents).toBe(6750);
    });

    it('a member whose coupon is under the order minimum is not blocked by it', async () => {
        // The coupon needs a $100 minimum and this cart is $75. For a guest
        // that is a hard 409; for a member the order is already claimed by
        // the member discount, so the purchase must still go through.
        stub([TEE], COUPON_MIN_100);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, 'BIGSPEND', 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(2250);
        expect(p.totalCents).toBe(5250);
    });

    it('a guest whose coupon is under the order minimum is still refused', async () => {
        stub([TEE], COUPON_MIN_100);
        await expect(
            resolvePricing(teeItem, 0, 0, 'stripe', 0, 'BIGSPEND', 0, GUEST_ID),
        ).rejects.toThrow(/minimum order/i);
    });
});

// =========================================================================
// The bundle price is the base, not another markdown on top
// =========================================================================

describe('the set bonus is a price, not a stacked markdown', () => {
    it('a member discount is 30% of the BUNDLE price, not of the list total', async () => {
        stub([SET_TEE, SET_SHORTS]);
        const p = await resolvePricing(setItems, 0, 0, 'stripe', 0, undefined, 0, MEMBER_ID);
        // List $150 - $30 set bonus = $120 bundle price. 30% of $120 = $36.
        expect(p.memberDiscountCents).toBe(3600);
        expect(p.totalCents).toBe(8400); // $150 - $30 - $36
    });

    it('a guest buying the set pays the bundle price', async () => {
        stub([SET_TEE, SET_SHORTS]);
        const p = await resolvePricing(setItems, 0, 0, 'stripe', 0, undefined, 0, GUEST_ID);
        expect(p.memberDiscountCents).toBe(0);
        expect(p.totalCents).toBe(12000);
    });
});

// =========================================================================
// Store credit is honored on top — it is the buyer's own money
// =========================================================================

describe('store credit', () => {
    it('applies after the member discount', async () => {
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 1000, undefined, 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(2250);
        expect(p.storeCreditCents).toBe(1000);
        expect(p.totalCents).toBe(4250);
    });

    it('is capped at what the order actually owes', async () => {
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 99999, undefined, 0, MEMBER_ID);
        expect(p.storeCreditCents).toBe(5250); // the whole post-discount total
        expect(p.totalCents).toBe(0);
    });
});

// =========================================================================
// The invariant: exactly one promotional discount, never more
// =========================================================================

describe('the no-double-discount invariant', () => {
    const combinations: Array<{
        name: string;
        userId: string | null;
        method: string;
        coupon: string | null;
        credit: number;
        items: typeof teeItem;
        products: unknown[];
    }> = [
        { name: 'member + coupon + crypto + credit', userId: MEMBER_ID, method: 'crypto', coupon: 'SAVE25', credit: 5000, items: teeItem, products: [TEE] },
        { name: 'member + coupon + card + credit', userId: MEMBER_ID, method: 'stripe', coupon: 'SAVE25', credit: 5000, items: teeItem, products: [TEE] },
        { name: 'guest + coupon + crypto + credit', userId: GUEST_ID, method: 'crypto', coupon: 'SAVE25', credit: 5000, items: teeItem, products: [TEE] },
        { name: 'guest + crypto + credit', userId: GUEST_ID, method: 'crypto', coupon: null, credit: 5000, items: teeItem, products: [TEE] },
        { name: 'member + credit on the set', userId: MEMBER_ID, method: 'stripe', coupon: 'SAVE25', credit: 5000, items: setItems, products: [SET_TEE, SET_SHORTS] },
    ];

    for (const c of combinations) {
        it(`${c.name}: at most ONE promotional discount is applied`, async () => {
            stub(c.products, c.coupon ? COUPON_25 : null);
            const p = await resolvePricing(c.items, 5, 0, c.method, c.credit, c.coupon ?? undefined, 0, c.userId);

            const applied = [
                p.memberDiscountCents,
                p.couponDiscountCents,
                p.cryptoDiscountCents,
            ].filter((v) => v > 0);
            expect(applied.length, 'exactly one promotional discount').toBe(1);

            // And the applied discount never exceeds the base it came from.
            const base = p.itemTotalCents + p.shippingCents;
            expect(applied[0]).toBeLessThanOrEqual(base);

            // Store credit can only ever reduce the total to zero, never
            // below it.
            expect(p.totalCents).toBeGreaterThanOrEqual(0);
            expect(p.totalCents).toBe(
                Math.max(0, base - p.setBonusCents - applied[0] - p.storeCreditCents),
            );
        });
    }

    it('the member rate is 30%', () => {
        expect(MEMBER_DISCOUNT_RATE).toBe(0.30);
    });
});

// =========================================================================
// The promotion has an end date
// =========================================================================

describe('the member promotion window', () => {
    it('stops applying the discount once the window closes', async () => {
        vi.setSystemTime(AFTER_THE_PROMO);
        stub([TEE]);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, undefined, 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(0);
        expect(p.totalCents).toBe(7500);
    });

    it('a closed window hands the order back to the coupon', async () => {
        vi.setSystemTime(AFTER_THE_PROMO);
        stub([TEE], COUPON_25);
        const p = await resolvePricing(teeItem, 0, 0, 'stripe', 0, 'SAVE25', 0, MEMBER_ID);
        expect(p.memberDiscountCents).toBe(0);
        expect(p.couponDiscountCents).toBe(1875);
        expect(p.couponSuppressed).toBe(false);
        expect(p.totalCents).toBe(5625);
    });

    it('the window is dated in the future of this suite', () => {
        expect(Date.parse(MEMBER_PROMO_ENDS_AT)).toBeGreaterThan(INSIDE_THE_PROMO.getTime());
    });
});
