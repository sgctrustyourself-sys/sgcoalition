// tests/soldStateOwnership.test.ts
//
// Guards "sold" as a fact with one owner per layer.
//
// Coalition_Grey_Wave_Wallet_2_2 sold on 2026-06-25 (INITIAL_ORDERS
// ORD-SG-GREYWAVE-22 — paid, cash, York PA, the same second as its 1/2 sibling),
// and both the seed and PRODUCT_LOCAL_OVERRIDES said so. The `products` row said
// the opposite: archived false, sold_at null, one in stock. useCatalog spreads the
// DB row over the seed, so the override was the only thing still calling it sold —
// which is exactly the shape of the bug: the storefront said "gone" while the order
// path, which refuses a product purely on `archived` (services/orderIntake.ts),
// would sell the same physical wallet again.
//
// Three invariants, cheapest first:
//   1. a recorded paid sale means the piece is unsellable in the seed
//   2. PRODUCT_LOCAL_OVERRIDES carries prose, never a second copy of the sold state
//   3. the regression itself: the pair's sold date is its order's timestamp, and
//      neither can be ordered
//
// The live half of this (the `products` row) cannot be asserted from here — a test
// that queried Supabase would be flaky and would need credentials. It was verified
// by reading the row back after the correction; what this file protects is that the
// two local copies can never drift into disagreeing again.

import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS, PRODUCT_LOCAL_OVERRIDES, INITIAL_ORDERS } from '../constants';

/** The fields that decide whether a piece can still be bought. */
const SOLD_STATE_FIELDS = ['archived', 'archivedAt', 'soldAt', 'sizes', 'sizeInventory'] as const;

const GREY_WAVE_2_2 = 'Coalition_Grey_Wave_Wallet_2_2';
const GREY_WAVE_1_2 = 'Coalition_Grey_Wave_Wallet_1_2';

const seedById = new Map(INITIAL_PRODUCTS.map((p) => [String(p.id), p as any]));
const orders = INITIAL_ORDERS as any[];

const orderFor = (productId: string) =>
    orders.find((o) => (o.items || []).some((i: any) => i.productId === productId));

/** Units still buyable across every size. */
const sellableStock = (product: any) =>
    Object.values(product?.sizeInventory || {}).reduce<number>((sum, n) => sum + Number(n || 0), 0);

describe('a sold piece is unsellable everywhere', () => {
    it('marks every product with a recorded paid sale as archived, sold and out of stock', () => {
        const paid = orders.filter((o) => o.paymentStatus === 'paid');
        expect(paid.length, 'the sale records are the evidence this test rests on').toBeGreaterThan(0);

        let checked = 0;
        for (const order of paid) {
            for (const item of order.items || []) {
                const seed = seedById.get(String(item.productId));
                // A product the table holds and the seed has never seen is out of this
                // file's reach; the seed is what it owns.
                if (!seed) continue;
                checked++;
                expect(
                    seed.archived,
                    `${item.productId} was paid for in ${order.orderNumber} and must not be listed as buyable`,
                ).toBe(true);
                expect(seed.soldAt, `${item.productId} has a paid sale and needs a soldAt`).toBeTruthy();
                expect(
                    sellableStock(seed),
                    `${item.productId} was paid for in ${order.orderNumber} and must have no stock left`,
                ).toBe(0);
            }
        }
        expect(checked, 'this must actually have inspected the ordered products').toBeGreaterThan(0);
    });

    it('never restates the sold state in an override, where it can drift from both owners', () => {
        for (const [id, override] of Object.entries(PRODUCT_LOCAL_OVERRIDES)) {
            for (const field of SOLD_STATE_FIELDS) {
                expect(
                    Object.hasOwn(override as object, field),
                    `${id} restates "${field}" — the products table owns the live state and INITIAL_PRODUCTS owns the fallback, so a copy here can only drift`,
                ).toBe(false);
            }
        }
    });
});

describe('the Grey Wave 2/2 regression', () => {
    it('has a paid sale record to anchor the sold date to', () => {
        const order = orderFor(GREY_WAVE_2_2);
        expect(order, 'the sale record is the evidence that this exact wallet is gone').toBeTruthy();
        expect(order.paymentStatus).toBe('paid');
        expect(order.createdAt, 'a sale without a timestamp cannot anchor anything').toBeTruthy();
    });

    it('dates the sale from its order, not from a hand-set stamp', () => {
        // The seed said 2026-07-24T00:00:00.000 while the order says 2026-06-25T02:40:12.191.
        const seed = seedById.get(GREY_WAVE_2_2) as any;
        const order = orderFor(GREY_WAVE_2_2);

        expect(seed.soldAt).toBe(order.createdAt);
        expect(seed.archivedAt).toBe(order.createdAt);
    });

    it('cannot be ordered: archived, with no stock in any size', () => {
        const seed = seedById.get(GREY_WAVE_2_2) as any;

        expect(seed.archived, 'services/orderIntake.ts refuses a sale on `archived` alone').toBe(true);
        expect(sellableStock(seed)).toBe(0);
    });

    it('still agrees with the 1/2 it sold alongside', () => {
        const one = seedById.get(GREY_WAVE_1_2) as any;
        const two = seedById.get(GREY_WAVE_2_2) as any;

        expect(two.soldAt).toBe(one.soldAt);
        expect(two.archivedAt).toBe(one.archivedAt);
        expect(two.sizeInventory).toEqual(one.sizeInventory);
        expect(two.archived).toBe(one.archived);
    });
});
