import { supabase } from '../services/supabase.js';
import { getReferralStatsByCode } from './referralSystem.js';

/**
 * Validate if a coupon code exists as a referral code.
 *
 * `currentUserId` is optional for backward compatibility, but passing the
 * signed-in user is what enables the self-referral block. The block is
 * also enforced server-side in the `track_referral_event` RPC for the
 * events that matter (signup, purchase); this is the fast-fail at the
 * coupon-input layer so users get an immediate error message.
 */
export const validateCouponCode = async (
    code: string,
    currentUserId?: string
): Promise<{ valid: boolean; error?: string; referrerName?: string }> => {
    try {
        if (!code || code.trim() === '') {
            return { valid: false, error: 'Please enter a coupon code' };
        }

        // Check if code exists in referral_stats
        const stats = await getReferralStatsByCode(code.toUpperCase());

        if (!stats) {
            return { valid: false, error: 'Invalid coupon code' };
        }

        // Self-referral block: a logged-in user cannot use their own code.
        if (currentUserId && stats.user_id === currentUserId) {
            return { valid: false, error: "You can't use your own referral code" };
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
 * Get currently applied coupon/referral code.
 * Re-export of `getActiveReferralCode` from utils/referralSystem so the
 * storage-lifecycle lives in one place.
 */
export { getActiveReferralCode as getAppliedCouponCode } from './referralSystem.js';

/**
 * Clear applied coupon code
 */
export const clearCouponCode = (): void => {
    sessionStorage.removeItem('referralCode');
};
