// services/trustCircle.ts
// The Trusted Few / Trust Circle partner-program data layer.
// Mirrors services/customInquiry.ts: client-side Supabase writes gated by
// RLS. Internal table names stay referral_*; only copy changes user-side.
import { supabase } from './supabase.js';

export type PartnerTier = 'trusted_few' | 'trust_circle';

export interface TrustCircleMembership {
    user_id: string;
    referral_code: string;
    partner_tier: PartnerTier;
    trust_circle_commission_rate: number | null;
    invited_at: string | null;
    circle_member_since: string | null;
}

export interface TrustCircleApplicationInput {
    whyJoin: string;
    whatYouCreate: string;
    platforms: string[];
    handles: { instagram?: string; tiktok?: string; youtube?: string; x?: string };
    audienceSize?: string;
    portfolioUrl?: string;
}

export interface TrustCircleApplication {
    id: string;
    user_id: string;
    status: 'pending' | 'approved' | 'declined';
    why_join: string;
    what_you_create: string;
    platforms: string[];
    handles: Record<string, string>;
    audience_size: string | null;
    portfolio_url: string | null;
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_note: string | null;
}

export const TRUST_CIRCLE_FLAT_RATE = 20;

// MetaMask users (uid starts with user_eth_) can't have a referral_stats row
// (user_id is a UUID FK to auth.users) — same short-circuit as referralSystem.
export async function getMembership(userId: string): Promise<TrustCircleMembership | null> {
    if (!userId || userId.startsWith('user_eth_')) return null;
    const { data, error } = await supabase
        .from('referral_stats')
        .select('user_id, referral_code, partner_tier, trust_circle_commission_rate, invited_at, circle_member_since')
        .eq('user_id', userId)
        .single();
    if (error || !data) return null;
    return data as TrustCircleMembership;
}

export async function submitApplication(
    input: TrustCircleApplicationInput,
    userId: string,
): Promise<{ success: boolean; error?: string; application?: TrustCircleApplication }> {
    if (!userId) return { success: false, error: 'Sign in to apply.' };

    // One pending application per user.
    const { data: existing } = await supabase
        .from('trust_circle_applications')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    if (existing) return { success: false, error: 'You already have a pending application.' };

    const { data, error } = await supabase
        .from('trust_circle_applications')
        .insert([{
            user_id: userId,
            status: 'pending',
            why_join: input.whyJoin,
            what_you_create: input.whatYouCreate,
            platforms: input.platforms,
            handles: input.handles,
            audience_size: input.audienceSize || null,
            portfolio_url: input.portfolioUrl || null,
        }])
        .select()
        .single();

    if (error || !data) {
        console.error('Error submitting trust circle application:', error);
        return { success: false, error: 'Failed to submit application. Please try again.' };
    }
    return { success: true, application: data as TrustCircleApplication };
}

export async function getMyApplication(userId: string): Promise<TrustCircleApplication | null> {
    if (!userId) return null;
    const { data, error } = await supabase
        .from('trust_circle_applications')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    return (data as TrustCircleApplication) || null;
}

export async function getApplications(): Promise<TrustCircleApplication[]> {
    const { data, error } = await supabase
        .from('trust_circle_applications')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching trust circle applications:', error);
        return [];
    }
    return (data as TrustCircleApplication[]) || [];
}

export async function reviewApplication(
    id: string,
    approve: boolean,
    note: string | null,
    adminId: string,
): Promise<{ success: boolean; error?: string }> {
    // 1. Stamp the application verdict.
    const { data: app, error: appError } = await supabase
        .from('trust_circle_applications')
        .update({
            status: approve ? 'approved' : 'declined',
            reviewed_at: new Date().toISOString(),
            reviewed_by: adminId || null,
            review_note: note || null,
        })
        .eq('id', id)
        .select()
        .single();
    if (appError || !app) {
        console.error('Error reviewing application:', appError);
        return { success: false, error: 'Failed to update application.' };
    }

    // 2. On approve, flip the member tier + flat rate atomically.
    if (approve) {
        const { error: statsError } = await supabase
            .from('referral_stats')
            .update({
                partner_tier: 'trust_circle',
                trust_circle_commission_rate: TRUST_CIRCLE_FLAT_RATE,
                circle_member_since: new Date().toISOString(),
            })
            .eq('user_id', app.user_id);
        if (statsError) {
            console.error('Error promoting member:', statsError);
            return { success: false, error: 'Application approved but promotion failed.' };
        }
    }
    return { success: true };
}

export async function inviteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({ invited_at: new Date().toISOString() })
        .eq('user_id', userId);
    if (error) {
        console.error('Error inviting user:', error);
        return { success: false, error: 'Failed to send invite.' };
    }
    return { success: true };
}

export async function acceptInvite(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({
            partner_tier: 'trust_circle',
            trust_circle_commission_rate: TRUST_CIRCLE_FLAT_RATE,
            circle_member_since: new Date().toISOString(),
            invited_at: null,
        })
        .eq('user_id', userId);
    if (error) {
        console.error('Error accepting invite:', error);
        return { success: false, error: 'Failed to accept invite.' };
    }
    return { success: true };
}

export async function declineInvite(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({ invited_at: null })
        .eq('user_id', userId);
    if (error) {
        console.error('Error declining invite:', error);
        return { success: false, error: 'Failed to decline invite.' };
    }
    return { success: true };
}

export async function revokeMember(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('referral_stats')
        .update({
            partner_tier: 'trusted_few',
            trust_circle_commission_rate: null,
            circle_member_since: null,
            invited_at: null,
        })
        .eq('user_id', userId);
    if (error) {
        console.error('Error revoking member:', error);
        return { success: false, error: 'Failed to revoke membership.' };
    }
    return { success: true };
}

export async function issueDropVoucher(memberUserId: string, couponCode: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('drop_vouchers')
        .insert([{ member_user_id: memberUserId, coupon_code: couponCode, status: 'issued' }]);
    if (error) {
        console.error('Error issuing drop voucher:', error);
        return { success: false, error: 'Failed to issue voucher.' };
    }
    return { success: true };
}
