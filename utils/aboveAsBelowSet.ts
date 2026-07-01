// Auto-applied cart discount for the Above as Below tee + shorts combination.
// Complements the standalone `prod_set_above_as_below` set SKU so shoppers can
// either buy the set directly or add both individual pieces and still receive
// the same $30 saving. Lives in `utils/` (not under `api/_handlers/`) so the
// same source-of-truth is shared by the React UI (Checkout / Cart / CartDrawer)
// and the Vercel Lambda handlers (paypal-order, complete-order). Keeping the
// math on both sides of the network prevents the storefront total from drifting
// away from the amount PayPal / Stripe actually captures.

export const ABOVE_AS_BELOW_TEE_ID = 'prod_tee_above_as_below';
export const ABOVE_AS_BELOW_SHORTS_ID = 'prod_shorts_above_as_below';
// One-shot auto-applied bonus for the Above-as-Below tee+shorts set. Caps at
// $30 per cart — extra quantities of either piece do not stack additional
// bonuses, matching the spirit of the original $120 bundle SKU we replaced.
export const ABOVE_AS_BELOW_SET_BONUS_CENTS = 3000;

export type SetBonusItemInput = {
    productId?: string;
    id?: string;
    quantity?: number;
};

function extractProductId(item: SetBonusItemInput): string {
    return String(item?.productId || item?.id || '').trim();
}

/**
 * Total bonus in cents the inputs have earned. One-shot $30 cap: any cart
 * containing at least one of each Above-as-Below piece earns the bonus once,
 * regardless of quantity — buying two tees + two shorts still saves only $30.
 * Tolerates either `{productId, quantity}` objects (the realistic cart shape)
 * or a flat array of product ID strings (back-compat for callers without
 * quantities handy).
 */
export function calculateAboveAsBelowSetBonusCents(items: SetBonusItemInput[] | string[] = []): number {
    if (items.length === 0) return 0;
    let hasTee = false;
    let hasShorts = false;
    for (const item of items) {
        const id = typeof item === 'string' ? item : extractProductId(item as SetBonusItemInput);
        if (id === ABOVE_AS_BELOW_TEE_ID) hasTee = true;
        else if (id === ABOVE_AS_BELOW_SHORTS_ID) hasShorts = true;
        if (hasTee && hasShorts) break;
    }
    return hasTee && hasShorts ? ABOVE_AS_BELOW_SET_BONUS_CENTS : 0;
}
