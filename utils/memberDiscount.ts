/**
 * ── The member discount is a PROMOTION, not a permanent price ─────────────
 *
 * A signed-in account holder gets MEMBER_DISCOUNT_RATE off the item total
 * until MEMBER_PROMO_ENDS_AT. The pricing authority
 * (services/orderIntake.ts → resolvePricing) and every display surface read
 * this module, so the advertised price and the charged price can never
 * disagree about whether the promotion is still running.
 *
 * The window closes at the end of October 2026 in the shop's timezone
 * (America/New_York, UTC-4 while EDT is in effect):
 * 2026-11-01T03:59:59.999Z = 2026-10-31 23:59:59.999 EDT.
 *
 * To run it "a little later", move MEMBER_PROMO_ENDS_AT. Nothing else changes:
 * the server stops applying the discount, the crossed-out price disappears
 * from the storefront, the "log in to unlock" invites go away, and checkout
 * stops advertising the crypto incentive as suppressed.
 */

export const MEMBER_DISCOUNT_RATE = 0.30;

/** Exclusive end of the member promotion (ISO-8601, UTC). */
export const MEMBER_PROMO_ENDS_AT = '2026-11-01T03:59:59.999Z';

/**
 * True while the member promotion is running.
 *
 * `now` is injectable so the window itself can be tested without freezing the
 * clock; production callers pass nothing.
 */
export function isMemberPromoActive(now: Date | number = Date.now()): boolean {
    const t = now instanceof Date ? now.getTime() : now;
    const end = Date.parse(MEMBER_PROMO_ENDS_AT);
    return Number.isFinite(t) && Number.isFinite(end) && t < end;
}

/**
 * The member price for `basePrice`, or null when the promotion is not running.
 *
 * Membership is the caller's decision — this answers only "what does a member
 * pay while the promotion lasts?". Rounded to cents the same way the pricing
 * authority rounds, so the display and the charge agree.
 */
export function getMemberPrice(basePrice: number, now: Date | number = Date.now()): number | null {
    if (!isMemberPromoActive(now)) return null;
    if (!Number.isFinite(basePrice) || basePrice <= 0) return null;
    return Math.round(basePrice * (1 - MEMBER_DISCOUNT_RATE) * 100) / 100;
}
