// Promo code engine. Both codes here are redeemable by anyone who knows them
// — there is no gating, private/public split, or per-recipient access flag.
// The privacy model is purely UI-driven: BADDIES is intentionally not mentioned
// anywhere on the public site. Listings (components/PromoBar, AnnouncementBar,
// pages/Checkout hint line) advertise EARLYACCESS instead.

export const BADDIES_PROMO_CODE = 'BADDIES';
export const BADDIES_DISCOUNT_PERCENTAGE = 25;

export const EARLYACCESS_PROMO_CODE = 'EARLYACCESS';
export const EARLYACCESS_DISCOUNT_PERCENTAGE = 10;
// Source of truth for the EARLYACCESS global cap is `coupons.max_uses` in
// Supabase (the api handlers bump it via the `increment_coupon_usage` RPC).
// This constant is mirrored here for client-side UX hints and tests — keep in
// sync with `scripts/upsertEarlyAccessCoupon.ts`.
export const EARLYACCESS_MAX_REDEMPTIONS = 4;

export type PromoCodeDiscount = {
    code: string;
    discountPercentage: number;
    label: string;
};

export const normalizePromoCode = (code: string | null | undefined): string => (
    String(code || '')
        .trim()
        .replace(/^:+/, '')
        .toUpperCase()
);

export const getPromoCodeDiscount = (code: string | null | undefined): PromoCodeDiscount | null => {
    const normalized = normalizePromoCode(code);

    if (normalized === BADDIES_PROMO_CODE) {
        return {
            code: BADDIES_PROMO_CODE,
            discountPercentage: BADDIES_DISCOUNT_PERCENTAGE,
            label: `${BADDIES_PROMO_CODE} ${BADDIES_DISCOUNT_PERCENTAGE}% off`,
        };
    }

    if (normalized === EARLYACCESS_PROMO_CODE) {
        return {
            code: EARLYACCESS_PROMO_CODE,
            discountPercentage: EARLYACCESS_DISCOUNT_PERCENTAGE,
            label: `${EARLYACCESS_PROMO_CODE} ${EARLYACCESS_DISCOUNT_PERCENTAGE}% off`,
        };
    }

    return null;
};

export const calculatePromoDiscountCents = (baseCents: number, code: string | null | undefined): number => {
    const promo = getPromoCodeDiscount(code);
    if (!promo) return 0;

    return Math.round(Math.max(0, baseCents) * (promo.discountPercentage / 100));
};

export const calculatePromoDiscountDollars = (baseDollars: number, code: string | null | undefined): number => (
    calculatePromoDiscountCents(Math.round(Math.max(0, baseDollars) * 100), code) / 100
);
