import { supabase } from '../services/supabase';
import { getReferralStatsByCode } from './referralSystem';

/**
 * Validate if a coupon code exists as a referral code
 */
export const validateCouponCode = async (code: string): Promise<{ valid: boolean; error?: string; referrerName?: string; discount?: { type: string; value: number } }> => {
    try {
        if (!code || code.trim() === '') {
            return { valid: false, error: 'Please enter a coupon code' };
        }

        const normalizedCode = code.toUpperCase();

        // 1. Try Native Coupon (Priority)
        const { data: couponData, error: couponError } = await supabase
            .rpc('validate_coupon', { coupon_code: normalizedCode });

        if (couponData && couponData.valid) {
            return {
                valid: true,
                referrerName: 'Special Offer',
                discount: {
                    type: couponData.type,
                    value: couponData.value
                }
            };
        }

        // 2. Fallback to Referral System
        const stats = await getReferralStatsByCode(normalizedCode);

        if (stats) {
            // Get referrer's name for display
            const { data: userData } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', stats.user_id)
                .single();

            const referrerName = userData?.full_name || userData?.email || 'a referrer';

            return {
                valid: true,
                referrerName,
                discount: {
                    type: 'fixed', // Standard referral is $10 fixed (hardcoded for legacy)
                    value: 10
                }
            };
        }

        return { valid: false, error: 'Invalid coupon or referral code' };

    } catch (error) {
        console.error('Error validating coupon code:', error);
        return { valid: false, error: 'Failed to validate code' };
    }
};

/**
 * Apply a coupon code (store in sessionStorage for tracking)
 */
export const applyCouponCode = (code: string): void => {
    sessionStorage.setItem('referralCode', code.toUpperCase());
};

/**
 * Get currently applied coupon/referral code
 */
export const getAppliedCouponCode = (): string | null => {
    // Check both sessionStorage (from coupon input) and localStorage (from URL)
    return sessionStorage.getItem('referralCode') || localStorage.getItem('referral_code');
};

/**
 * Clear applied coupon code
 */
export const clearCouponCode = (): void => {
    sessionStorage.removeItem('referralCode');
};
