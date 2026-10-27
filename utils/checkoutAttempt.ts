// One owner for checkout attempt identity.
//
// The client sends this id as the order id, and the server records it as the
// order's primary key, so a retry, a replay, a refresh or a second tab that
// carries the SAME attempt resolves to the order already recorded — no second
// write, no second store-credit debit, no second confirmation email.
//
// There are two ways to ask for that id, because the question differs:
//
//   resolveCheckoutAttempt     "I am BUYING this" — the checkout's submit path.
//   getOrCreateRecoveryOrderId "did the attempt I already sent land?" — the
//                             /order/success recovery paths.
//
// The purchase path identifies an attempt by everything its price depends on
// (buyer, items and their prices, coupon, shipping, applied credit, payment
// method), so any real change to the purchase mints a new id instead of being
// deduped into an order the shopper did not place.
//
// That path used to ALSO require the record to be younger than a 30-minute
// window, which reopened the hole the id exists to close: an
// unanswered-but-landed write (the 30s abort in utils/fetchWithTimeout.ts)
// leaves the record behind, and a reload after the window re-submitted under a
// NEW id — a second order and a second debit for one purchase (measured). The
// window is gone rather than widened, because a clock cannot tell a record
// whose attempt is SETTLED from one whose attempt is still open and only the
// server can: the checkout reuses the attempt whatever its age and asks the
// server whether it already produced an order (recordedOrderNumber below). A
// settled attempt is resolved to that order, never written again, so
// re-submitting cannot place or charge the purchase twice — and the record it
// resolved stays until the confirmation page consumes it, which is what lets a
// genuinely NEW identical purchase mint a fresh id.
//
// The recovery path asks about the purchase (who + what), not about the price
// knobs a recovery page cannot always restate, so a fresh tab (no
// sessionStorage) still matches. It can safely reuse the recorded attempt at
// any age for the same reason the age bound could go: a record only survives
// while its attempt is UNCONFIRMED — pages/OrderSuccess.tsx and
// pages/Checkout.tsx clear it the moment an order is recorded — so a record
// that is hanging around is exactly the attempt a recovery is about.
//
// The record is shared across tabs on purpose (localStorage, not sessionStorage).

import { fetchWithTimeout } from './fetchWithTimeout.js';

const STORAGE_KEY = 'coalition_checkout_attempt';

export interface CheckoutAttemptIdentity {
    userId?: string | null;
    items: Array<{ id: string; selectedSize?: string; quantity?: number; keychainClipOn?: boolean; price?: number }>;
    couponCode?: string | null;
    shippingMethod?: string;
    shippingCost?: number;
    /** Dollars of store credit applied — it moves the amount owed too. */
    storeCreditApplied?: number;
    /** It decides the discount, so it moves the amount owed too. */
    paymentMethod?: string;
    /**
     * How a guest is identified — the server refuses a row recorded for another
     * buyer, so a changed email is a new attempt rather than a 409.
     */
    customerEmail?: string | null;
}

interface StoredAttempt {
    id: string;
    fingerprint: string;
    basket: string;
}

/**
 * Collision-resistant: two buyers checking out in the same millisecond must not
 * share an id, because the server treats a repeat of an id as the same order.
 */
export function mintOrderId(): string {
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `order_${Date.now()}_${random}`;
}

/**
 * What makes two submissions the same purchase for the PURCHASE path: every
 * attribute the amount owed depends on. A change to any of them is a different
 * purchase, and must not be deduped into the order the previous one placed.
 */
function attemptFingerprint(identity: CheckoutAttemptIdentity): string {
    return JSON.stringify([
        identity.userId || '',
        identity.items
            .map(i => [i.id, i.selectedSize || '', Number(i.quantity) || 1, Boolean(i.keychainClipOn), Number(i.price) || 0])
            .sort(),
        identity.couponCode || '',
        identity.shippingMethod || '',
        Number(identity.shippingCost) || 0,
        Number(identity.storeCreditApplied) || 0,
        identity.paymentMethod || '',
        identity.customerEmail || '',
    ]);
}

/**
 * What makes two submissions the same purchase for the RECOVERY path: the buyer
 * and the basket. The price knobs are deliberately not part of it — a recovery
 * page may not be able to restate them (they live in per-tab sessionStorage) and
 * a mismatch would mint a new id, which is the second order this path exists to
 * prevent. The server still has the last word on the buyer: a record belonging
 * to someone else is refused rather than returned.
 */
function basketFingerprint(identity: CheckoutAttemptIdentity): string {
    return JSON.stringify([
        identity.userId || '',
        identity.items
            .map(i => [i.id, i.selectedSize || '', Number(i.quantity) || 1, Boolean(i.keychainClipOn)])
            .sort(),
    ]);
}

function storage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        // Storage disabled (private mode policies, server render) — mint per call.
        return null;
    }
}

function resolveAttemptId(identity: CheckoutAttemptIdentity, match: 'purchase' | 'basket'): { id: string; fromRecord: boolean } {
    const fingerprint = attemptFingerprint(identity);
    const basket = basketFingerprint(identity);
    const ls = storage();
    if (ls) {
        try {
            const raw = ls.getItem(STORAGE_KEY);
            if (raw) {
                const stored = JSON.parse(raw) as StoredAttempt;
                const same = match === 'basket'
                    ? stored?.basket === basket
                    : stored?.fingerprint === fingerprint;
                // Any age, deliberately: this record survives only while its
                // attempt is unconfirmed, and whether it is SETTLED is the
                // server's answer (recordedOrderNumber), not the clock's.
                if (stored?.id && same) return { id: stored.id, fromRecord: true };
            }
        } catch {
            // Corrupt record: fall through and mint a new attempt.
        }
    }
    const id = mintOrderId();
    if (ls) {
        try {
            ls.setItem(STORAGE_KEY, JSON.stringify({ id, fingerprint, basket } satisfies StoredAttempt));
        } catch {
            // Storage full or blocked — the id is still valid for this attempt.
        }
    }
    return { id, fromRecord: false };
}

/**
 * Which id to send when the shopper is buying: the attempt already in flight for
 * the same purchase (in any tab), or a fresh one — and whether it came from a
 * record, which is what tells the checkout to ask the server whether that
 * attempt is already settled before it writes anything.
 */
export interface CheckoutAttemptDecision {
    id: string;
    fromRecord: boolean;
}

/**
 * The attempt to send when the shopper is buying. Call this at the moment of
 * writing, then ask recordedOrderNumber about `id` when `fromRecord` is true.
 */
export function resolveCheckoutAttempt(identity: CheckoutAttemptIdentity): CheckoutAttemptDecision {
    return resolveAttemptId(identity, 'purchase');
}

/**
 * The id to send when the shopper is chasing an attempt they already submitted
 * (pages/OrderSuccess.tsx, whose copy tells them to reload and check): the
 * recorded attempt's id, whatever its age. See this module's header for why a
 * record that is still here is by definition still unconfirmed.
 */
export function getOrCreateRecoveryOrderId(identity: CheckoutAttemptIdentity): string {
    return resolveAttemptId(identity, 'basket').id;
}

/** The attempt is settled (an order was recorded) or abandoned. */
export function clearCheckoutAttempt(): void {
    const ls = storage();
    if (!ls) return;
    try {
        ls.removeItem(STORAGE_KEY);
    } catch {
        // Nothing to clear.
    }
}

/** Who an attempt belongs to — the same pair the server scopes a recorded row by. */
export interface CheckoutAttemptBuyer {
    userId?: string | null;
    customerEmail?: string | null;
}

/**
 * Ask the server whether the attempt this browser already sent has produced an
 * order. Returns its order number when it has, and null when it has not — which
 * is also the answer when the lookup itself could not be answered, or when the
 * attempt belongs to someone else. All three nulls mean the same thing to the
 * caller: reuse the id and write, because the server's own dedupe on that id is
 * the last word either way. Never throws: a lookup that fails must not be able
 * to stop a checkout, which is why this is the one call here that swallows its
 * error rather than surfacing it.
 */
export async function recordedOrderNumber(
    attemptId: string,
    buyer: CheckoutAttemptBuyer,
): Promise<string | null> {
    try {
        const response = await fetchWithTimeout('/api/order-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: attemptId,
                userId: buyer.userId || undefined,
                customerEmail: buyer.customerEmail || undefined,
            }),
        });
        if (!response.ok) return null;
        const payload = await response.json().catch(() => null) as { orderNumber?: unknown } | null;
        const number = payload && typeof payload.orderNumber === 'string' ? payload.orderNumber.trim() : '';
        return number || null;
    } catch {
        return null;
    }
}
