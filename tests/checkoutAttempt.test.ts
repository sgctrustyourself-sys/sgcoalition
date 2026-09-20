// tests/checkoutAttempt.test.ts
//
// PIN for the duplicate-order route this file's subject closes.
//
// The order id the checkout sends is the server's dedupe key: acceptCheckout
// resolves an id that is already recorded to the order it wrote and skips
// pricing, payment verification, the store-credit debit, the stock decrement
// and the emails. That only holds if the CLIENT keeps one id per purchase —
// a fresh id on every submit turns a retry, a refresh, a replay or a second
// tab back into a second order and a second debit.
//
// So the contract pinned here is the client half of it:
//   • the SAME purchase keeps its id across calls and across tabs (localStorage);
//   • a purchase that CHANGED (items, size, quantity, add-on, coupon, shipping,
//     applied store credit, buyer) mints a new id instead of being deduped
//     into an order the shopper did not place;
//   • an id is never reused after its attempt is settled, and the PURCHASE path
//     stops reusing a record once its TTL has passed;
//   • the RECOVERY path does not, because a record only survives while its
//     attempt is unconfirmed — past the window a reload of the recovery page
//     used to mint a new id, which is a second order and a second debit;
//   • garbage in storage cannot break a checkout, and nothing here throws.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    clearCheckoutAttempt,
    getOrCreateOrderId,
    getOrCreateRecoveryOrderId,
    mintOrderId,
    CHECKOUT_ATTEMPT_TTL_MS,
    type CheckoutAttemptIdentity,
} from '../utils/checkoutAttempt';

const STORAGE_KEY = 'coalition_checkout_attempt';

const ITEMS = [{ id: 'prod-tee', selectedSize: 'M', quantity: 1, keychainClipOn: false }];

/** The identity of one purchase — copy overrides what a test changes. */
function purchase(overrides: Partial<CheckoutAttemptIdentity> = {}): CheckoutAttemptIdentity {
    return {
        userId: null,
        items: ITEMS,
        couponCode: null,
        shippingMethod: 'standard',
        shippingCost: 0,
        storeCreditApplied: 0,
        ...overrides,
    };
}

describe('checkout attempt identity', () => {
    beforeEach(() => { localStorage.clear(); });
    afterEach(() => { vi.useRealTimers(); });

    it('keeps one id for one purchase, so a retry cannot become a second order', () => {
        const first = getOrCreateOrderId(purchase());
        expect(getOrCreateOrderId(purchase())).toBe(first);
        expect(getOrCreateOrderId(purchase())).toBe(first);
    });

    it('shares that id with a second tab, and with a reload of the same purchase', () => {
        const tabA = getOrCreateOrderId(purchase());
        // A second tab shares localStorage, not the in-memory state — the same
        // purchase submitted from it must carry the SAME id, or the server sees
        // two orders and debits the buyer twice.
        const tabB = getOrCreateOrderId(purchase());
        expect(tabB).toBe(tabA);
    });

    it.each([
        ['a changed quantity', { items: [{ ...ITEMS[0], quantity: 2 }] }],
        ['a changed size', { items: [{ ...ITEMS[0], selectedSize: 'L' }] }],
        ['a different item', { items: [{ ...ITEMS[0], id: 'prod-other' }] }],
        ['a changed add-on', { items: [{ ...ITEMS[0], keychainClipOn: true }] }],
        ['a coupon', { couponCode: 'DROP-202608-C0G7' }],
        ['a changed shipping method', { shippingMethod: 'express' }],
        ['a changed shipping cost', { shippingCost: 12 }],
        ['applied store credit', { storeCreditApplied: 5 }],
        ['a different buyer', { userId: '9b2f8a5c-1d4e-4f6a-9c3b-7e8d2a1b4c5d' }],
        // Money-shaped, and measured as ignored: the method decides the
        // discount, a reprice changes what is charged, and the email is how a
        // guest is identified (a change used to 409 on the recorded row).
        ['a changed payment method', { paymentMethod: 'crypto' }],
        ['a repriced item', { items: [{ ...ITEMS[0], price: 30 }] }],
        ['a different guest email', { customerEmail: 'other@test.com' }],
    ] as Array<[string, Partial<CheckoutAttemptIdentity>]>)(
        'mints a new id for %s',
        (_label, change) => {
            const before = getOrCreateOrderId(purchase());
            expect(getOrCreateOrderId(purchase(change))).not.toBe(before);
        },
    );

    it('never reuses an attempt older than its TTL when the shopper is buying', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
        const before = getOrCreateOrderId(purchase());

        vi.setSystemTime(new Date(Date.now() + CHECKOUT_ATTEMPT_TTL_MS + 1000));
        expect(getOrCreateOrderId(purchase())).not.toBe(before);
    });

    it('reuses an attempt past its TTL when the shopper is recovering it', () => {
        // The measured money hole: the write landed but never answered (the 30s
        // abort), so the record stayed and nothing confirmed it. Reloading the
        // recovery page the copy recommends, more than the window later, minted
        // a NEW id — a second order and a second store-credit debit for one
        // purchase. A record that is still here is by definition unconfirmed,
        // so a recovery reuses it whatever its age.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
        const sent = getOrCreateOrderId(purchase({
            couponCode: 'SAVE10', storeCreditApplied: 5, paymentMethod: 'store_credit',
        }));

        vi.setSystemTime(new Date(Date.now() + CHECKOUT_ATTEMPT_TTL_MS * 4));
        // A recovery in a fresh tab cannot restate the coupon or the applied
        // credit — they live in that tab's sessionStorage — so it asks about the
        // purchase itself: this buyer, this basket.
        expect(getOrCreateRecoveryOrderId(purchase())).toBe(sent);
    });

    it('still mints a new id when the recovery is about a different purchase', () => {
        const sent = getOrCreateOrderId(purchase());
        expect(getOrCreateRecoveryOrderId(purchase({ items: [{ ...ITEMS[0], quantity: 3 }] }))).not.toBe(sent);
        expect(getOrCreateRecoveryOrderId(purchase({ items: [{ ...ITEMS[0], selectedSize: 'L' }] }))).not.toBe(sent);
        expect(getOrCreateRecoveryOrderId(purchase({ userId: '9b2f8a5c-1d4e-4f6a-9c3b-7e8d2a1b4c5d' }))).not.toBe(sent);
    });

    it('mints a new id when there is no attempt to recover', () => {
        expect(getOrCreateRecoveryOrderId(purchase())).toMatch(/^order_\d+_[a-z0-9]+$/);
    });

    it('mints a fresh id once the attempt is settled', () => {
        const before = getOrCreateOrderId(purchase());
        clearCheckoutAttempt();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(getOrCreateOrderId(purchase())).not.toBe(before);
    });

    it('recovers from corrupt stored state instead of blocking checkout', () => {
        localStorage.setItem(STORAGE_KEY, '{not-json');
        const id = getOrCreateOrderId(purchase());
        expect(id).toMatch(/^order_\d+_[a-z0-9]+$/);
        // A record missing its id/fingerprint is equally unusable.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint: 'x' }));
        expect(getOrCreateOrderId(purchase())).toMatch(/^order_\d+_[a-z0-9]+$/);
    });

    it('still yields an id when storage is blocked', () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(getOrCreateOrderId(purchase())).toMatch(/^order_\d+_[a-z0-9]+$/);
        getItem.mockRestore();
        setItem.mockRestore();
    });

    it('does not hand two buyers in the same millisecond the same id', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
        const ids = new Set(Array.from({ length: 500 }, () => mintOrderId()));
        expect(ids.size).toBe(500);
    });

    it('identifies the purchase itself, not the shape of its object', () => {
        const twoItems = [
            { id: 'prod-tee', selectedSize: 'M', quantity: 1 },
            { id: 'prod-mug', selectedSize: 'One Size', quantity: 2 },
        ];
        const first = getOrCreateOrderId(purchase({ items: twoItems }));
        // The same two lines in the other order (a re-render, a re-order of the
        // cart array) are still the same purchase — the id must not move.
        expect(getOrCreateOrderId(purchase({ items: [...twoItems].reverse() }))).toBe(first);
        expect(getOrCreateOrderId(purchase())).not.toBe(first);
    });
});
