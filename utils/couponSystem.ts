import { supabase } from '../services/supabase';
import { getReferralStatsByCode } from './referralSystem';

/**
 * Validate if a coupon code exists as a referral code
 */
export const validateCouponCode = async (code: string): Promise<{ valid: boolean; error?: string; referrerName?: string }> => {
    try {
        if (!code || code.trim() === '') {
            return { valid: false, error: 'Please enter a coupon code' };
        }

        // Check if code exists in referral_stats
        const stats = await getReferralStatsByCode(code.toUpperCase());

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
            referrerName
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
