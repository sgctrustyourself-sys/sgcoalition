import { describe, expect, it } from 'vitest';
import {
    BADDIES_PROMO_CODE,
    EARLYACCESS_MAX_REDEMPTIONS,
    EARLYACCESS_PROMO_CODE,
    calculatePromoDiscountCents,
    getPromoCodeDiscount,
    normalizePromoCode,
} from '../utils/promoCodes';

describe('promoCodes', () => {
    it('normalizes the BADDIES code with or without a leading colon', () => {
        expect(normalizePromoCode(':baddies')).toBe(BADDIES_PROMO_CODE);
        expect(normalizePromoCode(' baddies ')).toBe(BADDIES_PROMO_CODE);
    });

    it('normalizes the EARLYACCESS code', () => {
        expect(normalizePromoCode(':earlyaccess')).toBe(EARLYACCESS_PROMO_CODE);
        expect(normalizePromoCode('EarlyAccess')).toBe(EARLYACCESS_PROMO_CODE);
    });

    it('applies the BADDIES 25% product discount at the engine level', () => {
        expect(getPromoCodeDiscount(':baddies')?.discountPercentage).toBe(25);
        expect(calculatePromoDiscountCents(6000, 'BADDIES')).toBe(1500);
    });

    it('applies the EARLYACCESS 10% public discount at the engine level', () => {
        expect(getPromoCodeDiscount('EARLYACCESS')?.discountPercentage).toBe(10);
        expect(calculatePromoDiscountCents(6000, 'EARLYACCESS')).toBe(600);
    });

    it('ignores unknown promo codes', () => {
        expect(getPromoCodeDiscount('unknown')).toBeNull();
        expect(calculatePromoDiscountCents(6000, 'unknown')).toBe(0);
    });


    it('exposes EARLYACCESS_MAX_REDEMPTIONS=4 as the engine-side cap constant', () => {
        expect(EARLYACCESS_MAX_REDEMPTIONS).toBe(4);
    });

});
