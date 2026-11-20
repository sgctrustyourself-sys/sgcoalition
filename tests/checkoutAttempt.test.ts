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
//   • the SAME purchase keeps its id across calls, across tabs (localStorage)
//     and across ANY amount of time — the 30-minute window that used to expire
//     is what reopened the hole it was meant to close, so the SERVER answers
//     "is this attempt already recorded?" (recordedOrderNumber) instead of a
//     clock;
//   • a purchase that CHANGED (items, size, quantity, add-on, coupon, shipping,
//     applied store credit, buyer, payment method, item price, guest email)
//     mints a new id instead of being deduped into an order the shopper did
//     not place;
//   • that read is buyer-scoped, bounded, and never throws: a refused, slow or
//     unreadable answer means "not settled" — reuse the id and let the write
//     path's own dedupe decide — so a lookup problem cannot lose a checkout;
//   • an id is never reused once its attempt is settled;
//   • the RECOVERY path reuses the recorded attempt at any age, because a
//     record only survives while its attempt is unconfirmed;
//   • garbage in storage cannot break a checkout, and nothing here throws.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    clearCheckoutAttempt,
    resolveCheckoutAttempt,
    getOrCreateRecoveryOrderId,
    recordedOrderNumber,
    mintOrderId,
    type CheckoutAttemptIdentity,
} from '../utils/checkoutAttempt';
import { ORDER_WRITE_TIMEOUT_MS } from '../utils/fetchWithTimeout';

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
        const first = resolveCheckoutAttempt(purchase()).id;
        expect(resolveCheckoutAttempt(purchase()).id).toBe(first);
        expect(resolveCheckoutAttempt(purchase()).id).toBe(first);
    });

    it('shares that id with a second tab, and with a reload of the same purchase', () => {
        const tabA = resolveCheckoutAttempt(purchase()).id;
        // A second tab shares localStorage, not the in-memory state — the same
        // purchase submitted from it must carry the SAME id, or the server sees
        // two orders and debits the buyer twice.
        const tabB = resolveCheckoutAttempt(purchase()).id;
        expect(tabB).toBe(tabA);
    });

    it('says whether the id came from a record, which is what the checkout asks about', () => {
        // Nothing recorded yet: there is no attempt to ask the server about, so
        // the very first submit of a purchase makes no lookup at all.
        expect(resolveCheckoutAttempt(purchase()).fromRecord).toBe(false);
        // A record this browser already sent is reused — and flagged, so the
        // checkout asks whether that attempt is settled before writing.
        expect(resolveCheckoutAttempt(purchase()).fromRecord).toBe(true);
        clearCheckoutAttempt();
        expect(resolveCheckoutAttempt(purchase()).fromRecord).toBe(false);
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
        ['a changed payment method', { paymentMethod: 'crypto' }],
        ['a repriced item', { items: [{ ...ITEMS[0], price: 30 }] }],
        ['a different guest email', { customerEmail: 'other@test.com' }],
    ] as Array<[string, Partial<CheckoutAttemptIdentity>]>)(
        'mints a new id for %s',
        (_label, change) => {
            const before = resolveCheckoutAttempt(purchase()).id;
            expect(resolveCheckoutAttempt(purchase(change)).id).not.toBe(before);
        },
    );

    it('keeps the same id for the same purchase however long ago it was sent', () => {
        // The measured money hole, and the reason the window is gone: the write
        // landed but never answered (the 30s abort), so the record stayed
        // unconfirmed. A reload after the window in which the checkout would
        // still reuse it minted a NEW id — a second order and a second
        // store-credit debit for one purchase. Whether that record is settled is
        // the SERVER's answer now (recordedOrderNumber), not a function of the
        // clock, so the id survives any amount of age.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
        const sent = resolveCheckoutAttempt(purchase()).id;

        vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1000));
        const later = resolveCheckoutAttempt(purchase());
        expect(later.id).toBe(sent);
        expect(later.fromRecord).toBe(true);
    });

    it('reuses a recorded attempt however old it is when the shopper is recovering it', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
        const sent = resolveCheckoutAttempt(purchase({
            couponCode: 'SAVE10', storeCreditApplied: 5, paymentMethod: 'store_credit',
        })).id;

        vi.setSystemTime(new Date(Date.now() + 4 * 60 * 60 * 1000));
        // A recovery in a fresh tab cannot restate the coupon or the applied
        // credit — they live in that tab's sessionStorage — so it asks about the
        // purchase itself: this buyer, this basket.
        expect(getOrCreateRecoveryOrderId(purchase())).toBe(sent);
    });

    it('still mints a new id when the recovery is about a different purchase', () => {
        const sent = resolveCheckoutAttempt(purchase()).id;
        expect(getOrCreateRecoveryOrderId(purchase({ items: [{ ...ITEMS[0], quantity: 3 }] }))).not.toBe(sent);
        expect(getOrCreateRecoveryOrderId(purchase({ items: [{ ...ITEMS[0], selectedSize: 'L' }] }))).not.toBe(sent);
        expect(getOrCreateRecoveryOrderId(purchase({ userId: '9b2f8a5c-1d4e-4f6a-9c3b-7e8d2a1b4c5d' }))).not.toBe(sent);
    });

    it('mints a new id when there is no attempt to recover', () => {
        expect(getOrCreateRecoveryOrderId(purchase())).toMatch(/^order_\d+_[a-z0-9]+$/);
    });

    it('mints a fresh id once the attempt is settled', () => {
        const before = resolveCheckoutAttempt(purchase()).id;
        clearCheckoutAttempt();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(resolveCheckoutAttempt(purchase()).id).not.toBe(before);
    });

    it('recovers from corrupt stored state instead of blocking checkout', () => {
        localStorage.setItem(STORAGE_KEY, '{not-json');
        const id = resolveCheckoutAttempt(purchase()).id;
        expect(id).toMatch(/^order_\d+_[a-z0-9]+$/);
        // A record missing its id/fingerprint is equally unusable.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint: 'x' }));
        expect(resolveCheckoutAttempt(purchase()).id).toMatch(/^order_\d+_[a-z0-9]+$/);
    });

    it('still yields an id when storage is blocked', () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(resolveCheckoutAttempt(purchase()).id).toMatch(/^order_\d+_[a-z0-9]+$/);
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
        const first = resolveCheckoutAttempt(purchase({ items: twoItems })).id;
        // The same two lines in the other order (a re-render, a re-order of the
        // cart array) are still the same purchase — the id must not move.
        expect(resolveCheckoutAttempt(purchase({ items: [...twoItems].reverse() })).id).toBe(first);
        expect(resolveCheckoutAttempt(purchase()).id).not.toBe(first);
    });
});

// =========================================================================
// The read that replaced the clock
// =========================================================================

// The checkout no longer guesses whether the attempt it already sent is
// settled — it asks. Everything here is about that answer being safe to act on:
// it names the order when there is one, it carries the buyer so the server can
// scope the answer, it is bounded, and NO failure of it can stop a checkout
// (each failure returns null, which reuses the id and lets the server's own
// dedupe have the last word).
describe('checkout attempt lookup', () => {
    beforeEach(() => { localStorage.clear(); });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    const respond = (body: unknown, ok = true, status = 200) =>
        vi.fn(async () => ({ ok, status, json: async () => body }));

    it('answers with the recorded order number, and null when nothing is recorded', async () => {
        vi.stubGlobal('fetch', respond({ recorded: true, orderNumber: 'ORD-RECORDED-1' }));
        await expect(recordedOrderNumber('order_1758300000000_ab12cd34', { userId: 'u1' }))
            .resolves.toBe('ORD-RECORDED-1');

        vi.stubGlobal('fetch', respond({ recorded: false, orderNumber: null }));
        await expect(recordedOrderNumber('order_1758300000000_ab12cd34', { userId: 'u1' }))
            .resolves.toBeNull();
    });

    it('sends the attempt id and the buyer, so the server can scope the answer', async () => {
        const fetchFn = respond({ recorded: false, orderNumber: null });
        vi.stubGlobal('fetch', fetchFn);

        await recordedOrderNumber('order_1758300000000_ab12cd34', {
            userId: '9b2f8a5c-1d4e-4f6a-9c3b-7e8d2a1b4c5d',
            customerEmail: 'buyer@example.com',
        });

        const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
        expect(String(url)).toBe('/api/order-attempt');
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({
            id: 'order_1758300000000_ab12cd34',
            userId: '9b2f8a5c-1d4e-4f6a-9c3b-7e8d2a1b4c5d',
            customerEmail: 'buyer@example.com',
        });
    });

    it('cannot stop a checkout: a refused, unreadable or failing lookup is "not settled"', async () => {
        vi.stubGlobal('fetch', respond({}, false, 500));
        await expect(recordedOrderNumber('order_1_abcd', {})).resolves.toBeNull();

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true, status: 200, json: async () => { throw new Error('not json'); },
        })));
        await expect(recordedOrderNumber('order_1_abcd', {})).resolves.toBeNull();

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        await expect(recordedOrderNumber('order_1_abcd', {})).resolves.toBeNull();

        // A 200 with a body that answers nothing is the same "not settled".
        vi.stubGlobal('fetch', respond({ recorded: true }));
        await expect(recordedOrderNumber('order_1_abcd', {})).resolves.toBeNull();
    });

    it('is bounded, so a lookup that never answers cannot hold the pay button indefinitely', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
            // A real fetch rejects on abort; a stub ignoring the signal could
            // not tell a bounded call from a hang.
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })));

        const pending = recordedOrderNumber('order_1_abcd', {});
        await vi.advanceTimersByTimeAsync(ORDER_WRITE_TIMEOUT_MS + 1000);
        await expect(pending).resolves.toBeNull();
    });
});
