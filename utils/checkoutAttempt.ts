// One owner for checkout attempt identity.
//
// The client sends this id as the order id, and the server records it as the
// order's primary key, so a retry, a replay, a refresh or a second tab that
// carries the SAME attempt resolves to the order already recorded — no second
// write, no second store-credit debit, no second confirmation email.
//
// There are two ways to ask for that id, because the question differs:
//
//   getOrCreateOrderId        "I am BUYING this" — the checkout's submit path.
//   getOrCreateRecoveryOrderId "did the attempt I already sent land?" — the
//                             /order/success recovery paths.
//
// The purchase path identifies an attempt by everything its price depends on
// (buyer, items and their prices, coupon, shipping, applied credit, payment
// method), so any real change to the purchase mints a new id instead of being
// deduped into an order the shopper did not place — and a later identical
// purchase is not captured by a stale record either, because that path stops
// reusing a record once it is older than CHECKOUT_ATTEMPT_TTL_MS.
//
// That age bound is what used to reopen the hole it exists to close: an
// unanswered-but-landed write (the 30s abort in utils/fetchWithTimeout.ts)
// leaves the record behind, and a reload after the window re-submitted under a
// NEW id — a second order and a second debit for one purchase. The recovery
// path therefore ignores the age: it reuses the recorded attempt for the same
// buyer and basket however old it is. It can safely do that because a record
// only survives while the attempt is UNCONFIRMED — pages/OrderSuccess.tsx and
// pages/Checkout.tsx clear it the moment an order is recorded — so a record
// that is hanging around is exactly the attempt a recovery is about. It asks
// about the purchase (who + what), not about the price knobs a recovery page
// cannot always restate, so a fresh tab (no sessionStorage) still matches.
//
// The record is shared across tabs on purpose (localStorage, not sessionStorage).

const STORAGE_KEY = 'coalition_checkout_attempt';

/** An attempt older than this cannot be the one being retried. */
export const CHECKOUT_ATTEMPT_TTL_MS = 30 * 60 * 1000;

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
    at: number;
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

function resolveAttemptId(identity: CheckoutAttemptIdentity, ageBound: 'purchase' | 'ignore'): string {
    const fingerprint = attemptFingerprint(identity);
    const basket = basketFingerprint(identity);
    const now = Date.now();
    const ls = storage();
    if (ls) {
        try {
            const raw = ls.getItem(STORAGE_KEY);
            if (raw) {
                const stored = JSON.parse(raw) as StoredAttempt;
                const fresh = typeof stored?.at === 'number' && now - stored.at < CHECKOUT_ATTEMPT_TTL_MS;
                const same = ageBound === 'ignore'
                    ? stored?.basket === basket
                    : stored?.fingerprint === fingerprint;
                // The purchase path also requires freshness: past the window a
                // record must not capture a purchase the shopper is starting now.
                if (stored?.id && same && (fresh || ageBound === 'ignore')) return stored.id;
            }
        } catch {
            // Corrupt record: fall through and mint a new attempt.
        }
    }
    const id = mintOrderId();
    if (ls) {
        try {
            ls.setItem(STORAGE_KEY, JSON.stringify({ id, fingerprint, basket, at: now } satisfies StoredAttempt));
        } catch {
            // Storage full or blocked — the id is still valid for this attempt.
        }
    }
    return id;
}

/**
 * The id to send when the shopper is buying: the one already in flight for the
 * same purchase (in any tab), or a fresh one. Call this at the moment of writing.
 */
export function getOrCreateOrderId(identity: CheckoutAttemptIdentity): string {
    return resolveAttemptId(identity, 'purchase');
}

/**
 * The id to send when the shopper is chasing an attempt they already submitted
 * (pages/OrderSuccess.tsx, whose copy tells them to reload and check): the
 * recorded attempt's id, whatever its age. See this module's header for why the
 * age bound cannot apply here.
 */
export function getOrCreateRecoveryOrderId(identity: CheckoutAttemptIdentity): string {
    return resolveAttemptId(identity, 'ignore');
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
