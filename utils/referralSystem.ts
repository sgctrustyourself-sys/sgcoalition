// Referral System Core Utilities
import { supabase } from '../services/supabase';

// Commission tier configuration
// Exponential progression so the FIRST successful sale immediately bumps the
// referrer from 5% to 10%. Hard-coded bounds must stay in sync with the
// `track_referral_event` RPC tier-recomputation block in the v2 migration.
export const COMMISSION_TIERS = [
    { tier: 1, minReferrals: 0, maxReferrals: 0, rate: 5 },
    { tier: 2, minReferrals: 1, maxReferrals: 2, rate: 10 },
    { tier: 3, minReferrals: 3, maxReferrals: 6, rate: 15 },
    { tier: 4, minReferrals: 7, maxReferrals: 14, rate: 20 },
    { tier: 5, minReferrals: 15, maxReferrals: 29, rate: 25 },
    { tier: 6, minReferrals: 30, maxReferrals: 49, rate: 30 },
    { tier: 7, minReferrals: 50, maxReferrals: 99, rate: 35 },
    { tier: 8, minReferrals: 100, maxReferrals: Infinity, rate: 40 }
];

export interface ReferralStats {
    user_id: string;
    referral_code: string;
    total_referrals: number;
    successful_referrals: number;
    current_tier: number;
    current_commission_rate: number;
    total_earnings: number;
    pending_earnings: number;
    paid_earnings: number;
    total_clicks?: number;
    total_views?: number;
    conversion_rate?: number;
    code_customized?: boolean;
    code_customized_at?: string | null;
    last_referral_ip?: string | null;
    last_referral_event_at?: string | null;
    updated_at: string;
}

export interface Referral {
    id: string;
    referrer_id: string;
    referral_code: string;
    referred_user_id?: string;
    order_id?: string;
    order_total?: number;
    commission_earned?: number;
    commission_rate?: number;
    status: 'pending' | 'completed' | 'paid';
    created_at: string;
    completed_at?: string;
}

// Calculate commission tier based on successful referrals
export const calculateCommissionTier = (successfulReferrals: number) => {
    const tier = COMMISSION_TIERS.find(
        t => successfulReferrals >= t.minReferrals && successfulReferrals <= t.maxReferrals
    ) || COMMISSION_TIERS[0];

    const nextTier = COMMISSION_TIERS.find(t => t.tier === tier.tier + 1);
    const referralsToNextTier = nextTier ? nextTier.minReferrals - successfulReferrals : 0;

    return {
        ...tier,
        nextTier,
        referralsToNextTier,
        progress: nextTier
            ? ((successfulReferrals - tier.minReferrals) / (nextTier.minReferrals - tier.minReferrals)) * 100
            : 100
    };
};

// Get user's referral stats
export const getReferralStats = async (userId: string): Promise<ReferralStats | null> => {
    try {
        const { data, error } = await supabase
            .from('referral_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching referral stats:', error);
        return null;
    }
};

// Get referral stats by code
export const getReferralStatsByCode = async (code: string): Promise<ReferralStats | null> => {
    try {
        const { data, error } = await supabase
            .from('referral_stats')
            .select('*')
            .eq('referral_code', code)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching referral stats by code:', error);
        return null;
    }
};

// Get user's referral history
export const getReferralHistory = async (userId: string): Promise<Referral[]> => {
    try {
        const { data, error } = await supabase
            .from('referrals')
            .select('*')
            .eq('referrer_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching referral history:', error);
        return [];
    }
};

// Track a new referral (when someone uses a referral code)
export const trackReferral = async (
    referralCode: string,
    referredUserId?: string
): Promise<{ success: boolean; referralId?: string }> => {
    try {
        // Get referrer's stats
        const stats = await getReferralStatsByCode(referralCode);
        if (!stats) {
            return { success: false };
        }

        // Self-referral guard: a user cannot create a referral row pointing
        // at themselves, even if the caller passes their own id directly.
        // The server-side `track_referral_event` RPC also enforces this for
        // signup/purchase events.
        if (referredUserId && referredUserId === stats.user_id) {
            return { success: false };
        }

        // Create referral record
        const { data, error } = await supabase
            .from('referrals')
            .insert({
                referrer_id: stats.user_id,
                referral_code: referralCode,
                referred_user_id: referredUserId,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // Update total referrals count
        await supabase
            .from('referral_stats')
            .update({
                total_referrals: stats.total_referrals + 1
            })
            .eq('user_id', stats.user_id);

        return { success: true, referralId: data.id };
    } catch (error) {
        console.error('Error tracking referral:', error);
        return { success: false };
    }
};

// Complete a referral (when referred user makes a purchase)
export const completeReferral = async (
    referralId: string,
    orderId: string,
    orderTotal: number
): Promise<{ success: boolean; commissionEarned?: number }> => {
    try {
        // Get the referral
        const { data: referral, error: fetchError } = await supabase
            .from('referrals')
            .select('*, referral_stats!inner(*)')
            .eq('id', referralId)
            .single();

        if (fetchError) throw fetchError;

        // Calculate commission
        const commissionRate = referral.referral_stats.current_commission_rate;
        const commissionEarned = (orderTotal * commissionRate) / 100;

        // Update referral record
        const { error: updateError } = await supabase
            .from('referrals')
            .update({
                order_id: orderId,
                order_total: orderTotal,
                commission_earned: commissionEarned,
                commission_rate: commissionRate,
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', referralId);

        if (updateError) throw updateError;

        // Update referral stats
        await updateReferralStats(referral.referrer_id);

        return { success: true, commissionEarned };
    } catch (error) {
        console.error('Error completing referral:', error);
        return { success: false };
    }
};

// Update user's referral stats (recalculate tier, earnings, etc.)
//
// Bug fix: prior implementation queried `status = 'completed'` three times —
// once for `totalEarnings` and once for `pendingEarnings` — which made those
// two numbers identical. Correct semantics:
//   - `pendingEarnings` = commissions earned but not yet paid out (status='completed')
//   - `paidEarnings`    = commissions already paid out       (status='paid')
//   - `totalEarnings`   = pending + paid
//
// We also use a single round-trip for both buckets to halve query count.
export const updateReferralStats = async (userId: string): Promise<void> => {
    try {
        // Single query for the two buckets we need to sum.
        const { data: referrals, error: fetchError } = await supabase
            .from('referrals')
            .select('commission_earned, status')
            .eq('referrer_id', userId)
            .in('status', ['completed', 'paid']);

        if (fetchError) throw fetchError;

        let pendingEarnings = 0;
        let paidEarnings = 0;
        for (const r of referrals || []) {
            const amt = r.commission_earned || 0;
            if (r.status === 'paid') paidEarnings += amt;
            else if (r.status === 'completed') pendingEarnings += amt;
        }
        const totalEarnings = pendingEarnings + paidEarnings;
        const successfulReferrals = (referrals || []).filter(r => r.status === 'completed' || r.status === 'paid').length;

        // NOTE: tier/rate recompute intentionally NOT done here. The
        // `track_referral_event` RPC is the single source of truth for the
        // commission tier (see supabase/migrations/20260711_referral_v2_columns_and_rpc.sql).
        // Keeping two copies of the table in sync is a footgun, so this
        // client function only refreshes earnings + successful-referral
        // counters — the next analytics event will pull the tier back in line.
        // `calculateCommissionTier` is still imported and used by the
        // dashboard for instant read-side display between events.

        // Update stats
        const { error: updateError } = await supabase
            .from('referral_stats')
            .update({
                successful_referrals: successfulReferrals,
                total_earnings: totalEarnings,
                pending_earnings: pendingEarnings,
                paid_earnings: paidEarnings
            })
            .eq('user_id', userId);

        if (updateError) throw updateError;
    } catch (error) {
        console.error('Error updating referral stats:', error);
    }
};

const buildReferralUrl = (referralCode: string, path: string): string => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(normalizedPath, window.location.origin);
    url.searchParams.set('ref', referralCode);
    return url.toString();
};

// Generate shareable referral link
export const generateReferralLink = (referralCode: string): string => {
    return buildReferralUrl(referralCode, '/');
};

export const generateProductReferralLink = (referralCode: string, productId: string): string => {
    return buildReferralUrl(referralCode, `/product/${productId}`);
};

// Store referral code in localStorage (from URL parameter)
export const storeReferralCode = (code: string): void => {
    localStorage.setItem('referral_code', code);
    localStorage.setItem('referral_timestamp', Date.now().toString());
};

// Get stored referral code (valid for 30 days)
export const getStoredReferralCode = (): string | null => {
    const code = localStorage.getItem('referral_code');
    const timestamp = localStorage.getItem('referral_timestamp');

    if (!code || !timestamp) return null;

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const isExpired = Date.now() - parseInt(timestamp) > thirtyDays;

    if (isExpired) {
        localStorage.removeItem('referral_code');
        localStorage.removeItem('referral_timestamp');
        return null;
    }

    return code;
};

/**
 * Single source of truth for "what referral code should this checkout use?"
 * sessionStorage wins (the user just typed/pasted it in the coupon box), but
 * the URL/auto-captured localStorage entry is the fallback. Mirrors the
 * layering used by `utils/couponSystem.getAppliedCouponCode` so the two
 * stay in sync.
 */
export const getActiveReferralCode = (): string | null => {
    if (typeof window === 'undefined') return null;
    return (
        sessionStorage.getItem('referralCode') ||
        localStorage.getItem('referral_code')
    );
};

// Clear stored referral code
export const clearReferralCode = (): void => {
    localStorage.removeItem('referral_code');
    localStorage.removeItem('referral_timestamp');
};
