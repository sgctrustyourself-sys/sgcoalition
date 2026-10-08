// utils/cryptoDiscount.ts
//
// Single source of truth for the method-specific crypto (SGCoin) discount.
// Imported by BOTH the client bundle (Checkout.tsx badge gating — must stay
// free of Node-only imports like services/orderIntake.ts, which pulls in the
// Stripe/Resend SDKs) and the serverless pricing authority (orderIntake.ts →
// resolvePricing), so the advertised offer and the charged amount can never
// disagree.
//
// Applies to the `crypto` method ONLY (never card/Stripe), gated on the
// same env flag the checkout UI badge reads, capped at $10 so large carts
// stay bounded.

export const MAX_CRYPTO_DISCOUNT_CENTS = 1000; // $10 cap, mirrors the legacy intent-handler cap

// Tolerant env reader that works in every runtime the helper lands in.
// EXCLUSIVE, not cascading: when a real `process` exists (Vercel functions,
// vitest/node tests) process.env is the ONLY source — it is the runtime
// authority and vitest tests mutate it with delete. import.meta.env is a
// static build-time snapshot (vite loads .env into it even in node), so
// consulting it in node would resurrect values a test deleted. It is only
// consulted where `process` does not exist at all — the browser bundle.
function readDiscountEnv(name: string): string {
    try {
        if (typeof process !== 'undefined' && (process as unknown as { env?: Record<string, string> })?.env) {
            return String((process as unknown as { env: Record<string, string | undefined> }).env[name] ?? '');
        }
    } catch { /* guarded — fall through to import.meta.env */ }
    try {
        const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
        if (metaEnv && Object.prototype.hasOwnProperty.call(metaEnv, name)) {
            return String(metaEnv[name] ?? '');
        }
    } catch { /* import.meta unavailable in this runtime */ }
    return '';
}

/** True when the SGCoin incentive is enabled (tolerant: quotes/trim/case). */
export function isCryptoDiscountEnabled(): boolean {
    const v = readDiscountEnv('VITE_SGCOIN_DISCOUNT_ENABLED').trim().replace(/^["']|["']$/g, '').toLowerCase();
    return v === 'true' || v === '1';
}

/**
 * Crypto (SGCoin) discount in cents for the given items.
 * `items` entries carry `price` (unit dollars) + `quantity`; `setBonusCents`
 * is subtracted from the payable base before the percentage applies.
 */
export function resolveCryptoDiscountCents(
    items: Array<{ productId: string; quantity: number; price?: number }>,
    shippingDollars: number,
    setBonusCents = 0,
): number {
    if (!isCryptoDiscountEnabled()) return 0;
    const itemTotalCents = items.reduce(
        (sum, it) => sum + Math.max(0, Math.round(Number(it.price ?? 0) * 100)) * Math.max(1, Math.round(Number(it.quantity || 1))),
        0,
    );
    const basePayableCents = Math.max(0, itemTotalCents + Math.round(Number(shippingDollars || 0) * 100) - setBonusCents);
    return Math.min(MAX_CRYPTO_DISCOUNT_CENTS, Math.round(basePayableCents * Math.min(100, Number(readDiscountEnv('VITE_SGCOIN_DISCOUNT_PERCENTAGE') || 10)) / 100));
}
