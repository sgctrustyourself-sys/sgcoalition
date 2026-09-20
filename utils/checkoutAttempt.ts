// One owner for checkout attempt identity.
//
// The client sends this id as the order id, and the server records it as the
// order's primary key, so a retry, a replay, a refresh or a second tab that
// carries the SAME attempt resolves to the order already recorded — no second
// write, no second store-credit debit, no second confirmation email. An attempt
// is identified by what is being bought and what the buyer is being asked to
// pay (buyer, items, coupon, shipping), so any real change to the purchase
// mints a new id instead of being deduped into an earlier order.
//
// The record is shared across tabs on purpose (localStorage, not sessionStorage)
// and expires, so a later identical purchase is never mistaken for the earlier
// one. A confirmed order clears it (pages/OrderSuccess.tsx).

const STORAGE_KEY = 'coalition_checkout_attempt';

/** An attempt older than this cannot be the one being retried. */
export const CHECKOUT_ATTEMPT_TTL_MS = 30 * 60 * 1000;

export interface CheckoutAttemptIdentity {
    userId?: string | null;
    items: Array<{ id: string; selectedSize?: string; quantity?: number; keychainClipOn?: boolean }>;
    couponCode?: string | null;
    shippingMethod?: string;
    shippingCost?: number;
    /** Dollars of store credit applied — it moves the amount owed too. */
    storeCreditApplied?: number;
}

interface StoredAttempt {
    id: string;
    fingerprint: string;
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

/** What makes two submissions the same purchase (and therefore the same order). */
function attemptFingerprint(identity: CheckoutAttemptIdentity): string {
    return JSON.stringify([
        identity.userId || '',
        identity.items
            .map(i => [i.id, i.selectedSize || '', Number(i.quantity) || 1, Boolean(i.keychainClipOn)])
            .sort(),
        identity.couponCode || '',
        identity.shippingMethod || '',
        Number(identity.shippingCost) || 0,
        Number(identity.storeCreditApplied) || 0,
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

/**
 * The id to send for this attempt: the one already in flight for the same
 * purchase (in any tab), or a fresh one. Call this at the moment of writing.
 */
export function getOrCreateOrderId(identity: CheckoutAttemptIdentity): string {
    const fingerprint = attemptFingerprint(identity);
    const now = Date.now();
    const ls = storage();
    if (ls) {
        try {
            const raw = ls.getItem(STORAGE_KEY);
            if (raw) {
                const stored = JSON.parse(raw) as StoredAttempt;
                const fresh = typeof stored?.at === 'number' && now - stored.at < CHECKOUT_ATTEMPT_TTL_MS;
                if (stored?.id && stored.fingerprint === fingerprint && fresh) return stored.id;
            }
        } catch {
            // Corrupt record: fall through and mint a new attempt.
        }
    }
    const id = mintOrderId();
    if (ls) {
        try {
            ls.setItem(STORAGE_KEY, JSON.stringify({ id, fingerprint, at: now } satisfies StoredAttempt));
        } catch {
            // Storage full or blocked — the id is still valid for this attempt.
        }
    }
    return id;
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
