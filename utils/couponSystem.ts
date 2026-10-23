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
 * Validate an admin-created coupon from the `coupons` table (client-side
 * fast-fail for UX — the SERVER is authoritative at pricing time via
 * resolvePricing). Returns the coupon row when valid so the UI can show
 * the discount; min_order_value is checked by the server against the
 * server-computed base, so it's deliberately not enforced here.
 */
export const validateDiscountCoupon = async (
    code: string,
): Promise<{ valid: boolean; error?: string; coupon?: { code: string; discount_type: 'percent' | 'fixed'; discount_value: number } }> => {
    try {
        const trimmed = String(code || '').trim().toUpperCase();
        if (!trimmed) return { valid: false, error: 'Please enter a coupon code' };

        const { data, error } = await supabase
            .from('coupons')
            .select('code, discount_type, discount_value, min_order_value, max_uses, used_count, end_date, is_active')
            .eq('code', trimmed)
            .maybeSingle();

        if (error || !data) return { valid: false }; // not a coupon → fall through to referral codes
        if (!data.is_active) return { valid: false, error: 'This coupon is no longer active.' };
        if (data.end_date && new Date(data.end_date).getTime() < Date.now()) return { valid: false, error: 'This coupon has expired.' };
        if (data.max_uses != null && (data.used_count || 0) >= data.max_uses) return { valid: false, error: 'This coupon has reached its usage limit.' };

        return {
            valid: true,
            coupon: {
                code: data.code,
                discount_type: data.discount_type as 'percent' | 'fixed',
                discount_value: Number(data.discount_value || 0),
            },
        };
    } catch (error) {
        console.error('Error validating discount coupon:', error);
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
