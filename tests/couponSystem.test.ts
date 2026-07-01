import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock supabase + referralSystem so couponSystem can be imported in isolation.
vi.mock('../services/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: null, error: null }),
                }),
            }),
        }),
    },
}));

vi.mock('../utils/referralSystem', () => ({
    getReferralStatsByCode: () => Promise.resolve(null),
}));

import {
    BADDIES_PROMO_CODE,
    EARLYACCESS_PROMO_CODE,
    normalizePromoCode,
} from '../utils/promoCodes';
import {
    applyCouponCode,
    clearCouponCode,
    getAppliedCouponCode,
    validateCouponCode,
} from '../utils/couponSystem';

describe('couponSystem (no-gate validation)', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
        localStorage.removeItem('referral_code');
    });

    it('validateCouponCode accepts BADDIES for anyone (no access gate)', async () => {
        const result = await validateCouponCode(BADDIES_PROMO_CODE);
        expect(result.valid).toBe(true);
        expect(result.code).toBe('BADDIES');
        expect(result.discountPercentage).toBe(25);
        expect(result.type).toBe('promo');
    });

    it('validateCouponCode accepts EARLYACCESS for anyone', async () => {
        const result = await validateCouponCode(EARLYACCESS_PROMO_CODE);
        expect(result.valid).toBe(true);
        expect(result.code).toBe('EARLYACCESS');
        expect(result.discountPercentage).toBe(10);
    });

    it('validateCouponCode applies both BADDIES and EARLYACCESS after normalization', async () => {
        expect((await validateCouponCode(':baddies')).valid).toBe(true);
        expect((await validateCouponCode(' earlyaccess ')).valid).toBe(true);
    });

    it('validateCouponCode rejects empty input with the prompt-style message', async () => {
        const result = await validateCouponCode('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Please enter a coupon code');
    });

    it('validateCouponCode rejects truly unknown codes', async () => {
        const result = await validateCouponCode('NOT_A_REAL_CODE');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid coupon code');
    });

    it('applyCouponCode + getAppliedCouponCode round-trips the normalized code', () => {
        applyCouponCode(':earlyaccess');
        expect(getAppliedCouponCode()).toBe('EARLYACCESS');
    });

    it('clearCouponCode wipes the sessionStorage referral slot', () => {
        applyCouponCode('BADDIES');
        expect(getAppliedCouponCode()).toBe('BADDIES');
        clearCouponCode();
        expect(getAppliedCouponCode()).toBeNull();
    });

    it('getAppliedCouponCode also reads localStorage referral_code set via URL ?ref=', () => {
        localStorage.setItem('referral_code', ':baddies');
        expect(getAppliedCouponCode()).toBe(normalizePromoCode('BADDIES'));
    });
});
