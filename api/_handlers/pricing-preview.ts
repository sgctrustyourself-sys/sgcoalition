import { resolvePricing, type PricingItem, HttpError } from '../../services/orderIntake.js';
import { calculateAboveAsBelowSetBonusCents } from '../../utils/aboveAsBelowSet.js';

export default async function handler(req: any, res: any) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
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
        const { items, shippingCost, paymentMethod, couponCode } = req.body;

        const pricingItems: PricingItem[] = Array.isArray(items) ? items.map((i: any) => ({
            productId: String(i.productId || ''),
            selectedSize: String(i.selectedSize || 'One Size'),
            quantity: Math.max(1, Number(i.quantity || 1)),
            keychainClipOn: Boolean(i.keychainClipOn),
        })) : [];

        if (!pricingItems.length) {
            res.status(400).json({ error: 'At least one item required.' });
            return;
        }

        const pm = String(paymentMethod || 'paypal');

        const pricing = await resolvePricing(
            pricingItems,
            Number(shippingCost || 0),
            0, // client discount — preview only, no store credit
            pm,
            0, // no store credit in preview
            couponCode ? String(couponCode) : undefined,
        );

        // Compute the set bonus independently so the UI can split
        // "Above as Below set bonus" from "Crypto Discount" in the
        // order summary. resolvePricing combines them into one
        // discountCents value; the client needs both for display.
        const setBonusCents = calculateAboveAsBelowSetBonusCents(
            pricingItems.map(i => ({ productId: i.productId, quantity: i.quantity }))
        );

        // discountCents = setBonus + otherDisc + coupon + storeCredit.
        // The UI needs each component on its own line, so the crypto-specific
        // remainder is discountCents minus the pieces that have their own
        // display lines (set bonus and coupon). For non-crypto payment
        // methods otherDisc is zeroed, so this correctly yields 0 instead of
        // leaking the coupon amount into a fake "Crypto Discount" line.
        const cryptoDiscountCents = Math.max(
            0,
            pricing.discountCents - setBonusCents - pricing.couponDiscountCents,
        );

        res.status(200).json({
            itemTotalCents: pricing.itemTotalCents,
            shippingCents: pricing.shippingCents,
            setBonusCents,
            cryptoDiscountCents,
            couponDiscountCents: pricing.couponDiscountCents,
            couponCode: pricing.couponCode,
            discountCents: pricing.discountCents,
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
