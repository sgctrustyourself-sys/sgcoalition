// Referral System Core Utilities
import { supabase } from '../services/supabase';

// Commission tier configuration
export const COMMISSION_TIERS = [
    { tier: 1, minReferrals: 0, maxReferrals: 1, rate: 5 },
    { tier: 2, minReferrals: 2, maxReferrals: 4, rate: 10 },
    { tier: 3, minReferrals: 5, maxReferrals: 9, rate: 15 },
    { tier: 4, minReferrals: 10, maxReferrals: 19, rate: 20 },
    { tier: 5, minReferrals: 20, maxReferrals: 49, rate: 25 },
    { tier: 6, minReferrals: 50, maxReferrals: 99, rate: 30 },
    { tier: 7, minReferrals: 100, maxReferrals: 199, rate: 35 },
    { tier: 8, minReferrals: 200, maxReferrals: Infinity, rate: 40 }
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
export const updateReferralStats = async (userId: string): Promise<void> => {
    try {
        // Get all completed referrals
        const { data: referrals, error: fetchError } = await supabase
            .from('referrals')
            .select('*')
            .eq('referrer_id', userId)
            .eq('status', 'completed');

        if (fetchError) throw fetchError;

        const successfulReferrals = referrals?.length || 0;
        const totalEarnings = referrals?.reduce((sum, r) => sum + (r.commission_earned || 0), 0) || 0;

        // Get pending earnings
        const { data: pendingReferrals } = await supabase
            .from('referrals')
            .select('commission_earned')
            .eq('referrer_id', userId)
            .eq('status', 'completed');

        const pendingEarnings = pendingReferrals?.reduce((sum, r) => sum + (r.commission_earned || 0), 0) || 0;

        // Get paid earnings
        const { data: paidReferrals } = await supabase
            .from('referrals')
            .select('commission_earned')
            .eq('referrer_id', userId)
            .eq('status', 'paid');

        const paidEarnings = paidReferrals?.reduce((sum, r) => sum + (r.commission_earned || 0), 0) || 0;

        // Calculate new tier
        const tierInfo = calculateCommissionTier(successfulReferrals);

        // Update stats
        const { error: updateError } = await supabase
            .from('referral_stats')
            .update({
                successful_referrals: successfulReferrals,
                current_tier: tierInfo.tier,
                current_commission_rate: tierInfo.rate,
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

// Generate shareable referral link
export const generateReferralLink = (referralCode: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/#/?ref=${referralCode}`;
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

// Clear stored referral code
export const clearReferralCode = (): void => {
    localStorage.removeItem('referral_code');
    localStorage.removeItem('referral_timestamp');
};
