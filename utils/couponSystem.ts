import { supabase } from '../services/supabase';
import { getReferralStatsByCode } from './referralSystem';
import { getPromoCodeDiscount, normalizePromoCode } from './promoCodes';

type CouponValidationResult = {
    valid: boolean;
    error?: string;
    referrerName?: string;
    code?: string;
    discountPercentage?: number;
    type?: 'promo' | 'referral';
};

/**
 * Validate if a coupon code exists as a promo or referral code. Both BADDIES
 * and EARLYACCESS validate like any normal code — anyone with the code can
 * apply it. Visibility / gating is the responsibility of the public UI, not
 * this validation path.
 */
export const validateCouponCode = async (code: string): Promise<CouponValidationResult> => {
    try {
        const normalizedCode = normalizePromoCode(code);

        if (!normalizedCode) {
            return { valid: false, error: 'Please enter a coupon code' };
        }

        const promo = getPromoCodeDiscount(normalizedCode);
        if (promo) {
            return {
                valid: true,
                code: promo.code,
                discountPercentage: promo.discountPercentage,
                type: 'promo',
            };
        }

        // Check if code exists in referral_stats
        const stats = await getReferralStatsByCode(normalizedCode);

        if (!stats) {
            return { valid: false, error: 'Invalid coupon code' };
        }

        // Get referrer's name for display
        const { data: userData } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', stats.user_id)
            .single();

        const referrerName = userData?.full_name || userData?.email || 'a referrer';

        return {
            valid: true,
            code: normalizedCode,
            referrerName,
            type: 'referral',
        };
    } catch (error) {
        console.error('Error validating coupon code:', error);
        return { valid: false, error: 'Failed to validate code' };
    }
};

/**
 * Apply a coupon code (store in sessionStorage for tracking)
 */
export const applyCouponCode = (code: string): void => {
    sessionStorage.setItem('referralCode', normalizePromoCode(code));
};

/**
 * Get currently applied coupon/referral code
 */
export const getAppliedCouponCode = (): string | null => {
    // Check both sessionStorage (from coupon input) and localStorage (from URL)
    const code = sessionStorage.getItem('referralCode') || localStorage.getItem('referral_code');
    return code ? normalizePromoCode(code) : null;
};

/**
 * Clear applied coupon code
 */
export const clearCouponCode = (): void => {
    sessionStorage.removeItem('referralCode');
    localStorage.removeItem('referral_code');
};
