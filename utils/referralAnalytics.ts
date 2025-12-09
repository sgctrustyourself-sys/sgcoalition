// Referral Analytics Tracking
import { supabase } from '../services/supabase';

export interface ReferralAnalytics {
    id: string;
    referral_code: string;
    referrer_id: string;
    event_type: 'click' | 'view' | 'signup' | 'purchase';
    visitor_ip?: string;
    user_agent?: string;
    referrer_url?: string;
    converted_to_sale: boolean;
    created_at: string;
}

export interface ReferrerPerformance {
    user_id: string;
    referral_code: string;
    user_name?: string;
    user_email?: string;
    total_clicks: number;
    total_views: number;
    total_signups: number;
    total_purchases: number;
    successful_referrals: number;
    conversion_rate: number;
    total_earnings: number;
    current_tier: number;
    current_commission_rate: number;
}

// Track a referral link click/view/signup/purchase
export const trackReferralEvent = async (
    referralCode: string,
    eventType: 'click' | 'view' | 'signup' | 'purchase',
    userId?: string
): Promise<void> => {
    try {
        // Call the Supabase RPC function to track the event and update stats
        const { error } = await supabase.rpc('track_referral_event', {
            p_referral_code: referralCode,
            p_event_type: eventType,
            p_user_id: userId || null,
            p_visitor_ip: null, // Could be populated server-side if needed
            p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            p_referrer_url: typeof window !== 'undefined' ? (document.referrer || window.location.href) : null
        });

        if (error) {
            console.error('Error tracking referral event:', error);
        } else {
            console.log(`[Referral Analytics] Tracked ${eventType} for code: ${referralCode}`);
        }
    } catch (error) {
        console.error('Error tracking referral event:', error);
    }
};

// Get analytics for a specific referrer
export const getReferrerAnalytics = async (userId: string): Promise<{
    clicks: number;
    views: number;
    signups: number;
    purchases: number;
    conversionRate: number;
}> => {
    try {
        const { data: analytics } = await supabase
            .from('referral_analytics')
            .select('event_type')
            .eq('referrer_id', userId);

        if (!analytics) return { clicks: 0, views: 0, signups: 0, purchases: 0, conversionRate: 0 };

        const clicks = analytics.filter(a => a.event_type === 'click').length;
        const views = analytics.filter(a => a.event_type === 'view').length;
        const signups = analytics.filter(a => a.event_type === 'signup').length;
        const purchases = analytics.filter(a => a.event_type === 'purchase').length;
        const conversionRate = clicks > 0 ? (purchases / clicks) * 100 : 0;

        return { clicks, views, signups, purchases, conversionRate };
    } catch (error) {
        console.error('Error fetching referrer analytics:', error);
        return { clicks: 0, views: 0, signups: 0, purchases: 0, conversionRate: 0 };
    }
};

// Get top performing referrers (for admin)
export const getTopReferrers = async (limit = 10): Promise<ReferrerPerformance[]> => {
    try {
        const { data, error } = await supabase
            .from('referral_stats')
            .select(`
        user_id,
        referral_code,
        total_clicks,
        total_views,
        successful_referrals,
        conversion_rate,
        total_earnings,
        current_tier,
        current_commission_rate
      `)
            .order('total_earnings', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Enrich with user data
        const enriched = await Promise.all(
            (data || []).map(async (stat) => {
                const { data: analytics } = await supabase
                    .from('referral_analytics')
                    .select('event_type')
                    .eq('referrer_id', stat.user_id);

                const signups = analytics?.filter(a => a.event_type === 'signup').length || 0;
                const purchases = analytics?.filter(a => a.event_type === 'purchase').length || 0;

                return {
                    ...stat,
                    total_signups: signups,
                    total_purchases: purchases
                };
            })
        );

        return enriched;
    } catch (error) {
        console.error('Error fetching top referrers:', error);
        return [];
    }
};

// Get detailed analytics for admin dashboard
export const getDetailedReferrerStats = async (): Promise<{
    totalReferrers: number;
    totalClicks: number;
    totalViews: number;
    totalSignups: number;
    totalPurchases: number;
    totalCommissionsPaid: number;
    totalCommissionsPending: number;
    averageConversionRate: number;
}> => {
    try {
        // Get aggregate stats
        const { data: stats } = await supabase
            .from('referral_stats')
            .select('total_clicks, total_views, conversion_rate, paid_earnings, pending_earnings');

        const { data: analytics } = await supabase
            .from('referral_analytics')
            .select('event_type');

        if (!stats || !analytics) {
            return {
                totalReferrers: 0,
                totalClicks: 0,
                totalViews: 0,
                totalSignups: 0,
                totalPurchases: 0,
                totalCommissionsPaid: 0,
                totalCommissionsPending: 0,
                averageConversionRate: 0
            };
        }

        const totalClicks = stats.reduce((sum, s) => sum + (s.total_clicks || 0), 0);
        const totalViews = stats.reduce((sum, s) => sum + (s.total_views || 0), 0);
        const totalCommissionsPaid = stats.reduce((sum, s) => sum + (s.paid_earnings || 0), 0);
        const totalCommissionsPending = stats.reduce((sum, s) => sum + (s.pending_earnings || 0), 0);
        const averageConversionRate = stats.reduce((sum, s) => sum + (s.conversion_rate || 0), 0) / stats.length;

        const totalSignups = analytics.filter(a => a.event_type === 'signup').length;
        const totalPurchases = analytics.filter(a => a.event_type === 'purchase').length;

        return {
            totalReferrers: stats.length,
            totalClicks,
            totalViews,
            totalSignups,
            totalPurchases,
            totalCommissionsPaid,
            totalCommissionsPending,
            averageConversionRate
        };
    } catch (error) {
        console.error('Error fetching detailed stats:', error);
        return {
            totalReferrers: 0,
            totalClicks: 0,
            totalViews: 0,
            totalSignups: 0,
            totalPurchases: 0,
            totalCommissionsPaid: 0,
            totalCommissionsPending: 0,
            averageConversionRate: 0
        };
    }
};
