import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs *before* vi.mock factories are evaluated, so the factory
// can safely close over our shared mock state without a ReferenceError.
const { couponRows, supabaseMock } = vi.hoisted(() => {
    const couponRows: Record<string, { used_count: number; max_uses: number | null }> = {};
    const supabaseMock = {
        from: (table: string) => ({
            select: () => ({
                eq: (_col: string, val: string) => ({
                    maybeSingle: async () => {
                        if (table === 'coupons') {
                            const row = couponRows[val];
                            return { data: row ? { ...row } : null, error: null };
                        }
                        return { data: null, error: null };
                    },
                    single: async () => Promise.resolve({ data: null, error: null }),
                }),
            }),
        }),
        rpc: async () => ({ data: null, error: null }),
    };
    return { couponRows, supabaseMock };
});

vi.mock('../services/supabase', () => ({ supabase: supabaseMock }));

vi.mock('../utils/referralSystem', () => ({
    getReferralStatsByCode: () => Promise.resolve(null),
}));

import {
    BADDIES_PROMO_CODE,
    EARLYACCESS_MAX_REDEMPTIONS,
    EARLYACCESS_PROMO_CODE,
    normalizePromoCode,
} from '../utils/promoCodes';
import {
    applyCouponCode,
    clearCouponCode,
    getAppliedCouponCode,
    validateCouponCode,
} from '../utils/couponSystem';

function setCouponRow(code: string, used: number, maxUses: number | null) {
    couponRows[code] = { used_count: used, max_uses: maxUses };
}

describe('couponSystem (no-gate validation + EARLYACCESS cap)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        Object.keys(couponRows).forEach(k => delete couponRows[k]);
    });

    afterEach(() => {
        sessionStorage.clear();
        localStorage.removeItem('referral_code');
    });

    it('BADDIES engine still returns 25% (no cap applied by the engine)', async () => {
        setCouponRow(BADDIES_PROMO_CODE, 0, null);

        const result = await validateCouponCode(BADDIES_PROMO_CODE);
        expect(result.valid).toBe(true);
        expect(result.discountPercentage).toBe(25);
    });

    it('EARLYACCESS validates with 10% off when 0 of 4 redemptions used', async () => {
        setCouponRow(EARLYACCESS_PROMO_CODE, 0, EARLYACCESS_MAX_REDEMPTIONS);

        const result = await validateCouponCode(EARLYACCESS_PROMO_CODE);
        expect(result.valid).toBe(true);
        expect(result.discountPercentage).toBe(10);
    });

    it('EARLYACCESS still validates with 10% when cap is 1 away from full', async () => {
        setCouponRow(EARLYACCESS_PROMO_CODE, EARLYACCESS_MAX_REDEMPTIONS - 1, EARLYACCESS_MAX_REDEMPTIONS);

        const result = await validateCouponCode(EARLYACCESS_PROMO_CODE);
        expect(result.discountPercentage).toBe(10);
    });

    it('EARLYACCESS validates but returns discount 0% once the cap is full', async () => {
        setCouponRow(EARLYACCESS_PROMO_CODE, EARLYACCESS_MAX_REDEMPTIONS, EARLYACCESS_MAX_REDEMPTIONS);

        const result = await validateCouponCode(EARLYACCESS_PROMO_CODE);
        expect(result.valid).toBe(true);
        expect(result.code).toBe('EARLYACCESS');
        expect(result.discountPercentage).toBe(0);
    });

    it('EARLYACCESS validates with 10% if no coupons row exists (pre-seed fallback)', async () => {
        const result = await validateCouponCode(EARLYACCESS_PROMO_CODE);
        expect(result.valid).toBe(true);
        expect(result.discountPercentage).toBe(10);
    });

    it('EARLYACCESS + BADDIES still both validate after normalization', async () => {
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

    it('applyCouponCode + getAppliedCouponCode round-trips the normalized code', async () => {
        applyCouponCode(':earlyaccess');
        expect(getAppliedCouponCode()).toBe('EARLYACCESS');
    });

    it('clearCouponCode wipes the sessionStorage referral slot', async () => {
        applyCouponCode('BADDIES');
        expect(getAppliedCouponCode()).toBe('BADDIES');
        clearCouponCode();
        expect(getAppliedCouponCode()).toBeNull();
    });

    it('getAppliedCouponCode also reads localStorage referral_code set via URL ?ref=', async () => {
        localStorage.setItem('referral_code', ':baddies');
        expect(getAppliedCouponCode()).toBe(normalizePromoCode('BADDIES'));
    });
});
