import { loadStoreCreditCents, resolvePricing, type PricingItem, HttpError } from '../../services/orderIntake.js';
import { calculateAboveAsBelowSetBonusCents } from '../../utils/aboveAsBelowSet.js';
import type { ApiRequest, ApiResponse } from '../_types.js';

// Cart line and body as the checkout posts them. Price authority stays in
// resolvePricing(); this only names the fields the handler reads.
type PreviewItem = {
    productId?: string;
    selectedSize?: string;
    quantity?: number;
    keychainClipOn?: boolean;
};

interface PricingPreviewBody {
    items?: PreviewItem[];
    shippingCost?: number;
    paymentMethod?: string;
    couponCode?: string;
    useStoreCredit?: boolean;
    userId?: string | null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition-five.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { items, shippingCost, paymentMethod, couponCode, useStoreCredit, userId } = (req.body ?? {}) as PricingPreviewBody;

        const pricingItems: PricingItem[] = Array.isArray(items) ? items.map((i) => ({
            productId: String(i.productId || ''),
            selectedSize: String(i.selectedSize || 'One Size'),
            quantity: Math.max(1, Number(i.quantity || 1)),
            keychainClipOn: Boolean(i.keychainClipOn),
        })) : [];

        if (!pricingItems.length) {
            res.status(400).json({ error: 'At least one item required.' });
            return;
        }

        const pm = String(paymentMethod || 'card');

        // Store credit is priced in for EVERY method, exactly as the order path
        // prices it. The balance is read server-side (never taken from the
        // client) so the amount a shopper is shown — and, for crypto/Cash App,
        // the amount they are asked to send — is the amount the order will be
        // recorded and debited at. resolvePricing caps it against the order and
        // acceptCheckout re-verifies it against the live balance before debiting.
        const storeCreditCents = useStoreCredit ? await loadStoreCreditCents(userId) : 0;

        // The buyer's identity is forwarded so the account-holder (member)
        // discount is priced exactly as the order path prices it: a guest
        // (no userId) gets nothing, an account holder gets 30% off the item
        // total. create-payment-intent and acceptCheckout already forward it
        // — without it here the summary showed a bigger total than the one
        // the order was actually charged.
        const pricing = await resolvePricing(
            pricingItems,
            Number(shippingCost || 0),
            0, // client discount — the method discount is computed below
            pm,
            storeCreditCents,
            couponCode ? String(couponCode) : undefined,
            0, // storeCreditAppliedCents — the preview prices the credit itself
            userId ? String(userId) : null,
        );

        // Compute the set bonus independently so the UI can split
        // "Above as Below set bonus" from "Crypto Discount" in the
        // order summary. resolvePricing combines them into one
        // discountCents value; the client needs both for display.
        const setBonusCents = calculateAboveAsBelowSetBonusCents(
            pricingItems.map(i => ({ productId: i.productId, quantity: i.quantity }))
        );

        // discountCents = setBonus + memberDiscount + cryptoDiscount +
        // otherDisc + coupon + storeCredit. The UI renders each component on
        // its own line, so the crypto (SGCoin) discount comes straight from
        // the pricing authority (already method-gated: always 0 for
        // card/Stripe) instead of a remainder that could leak the coupon into
        // a fake "Crypto Discount" line — and the member discount gets its
        // own "Member discount (30% off)" line.
        const cryptoDiscountCents = pricing.cryptoDiscountCents;

        res.status(200).json({
            itemTotalCents: pricing.itemTotalCents,
            shippingCents: pricing.shippingCents,
            setBonusCents,
            cryptoDiscountCents,
            memberDiscountCents: pricing.memberDiscountCents,
            cryptoDiscountSuppressed: pricing.cryptoDiscountSuppressed,
            couponSuppressed: pricing.couponSuppressed,
            couponDiscountCents: pricing.couponDiscountCents,
            couponCode: pricing.couponCode,
            discountCents: pricing.discountCents,
            // The credit actually applied (capped to the pre-credit total), so
            // the summary renders the server's number instead of the client's
            // estimate and the order request can forward the same amount.
            storeCreditCents: pricing.storeCreditCents,
            totalCents: pricing.totalCents,
            items: pricing.items,
        });
    } catch (e: unknown) {
        const he = e as HttpError;
        const status = he?.status || 500;
        const message = he?.message || 'Pricing preview failed.';
        console.error('[Pricing Preview] error:', message);
        res.status(status).json({ error: message });
    }
}
