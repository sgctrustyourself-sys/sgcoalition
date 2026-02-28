import { supabase } from './supabase';

export interface SocialAccount {
    id: string;
    user_id: string;
    platform: 'instagram' | 'twitter' | 'tiktok';
    username: string;
    verified: boolean;
    linked_at: string;
    reward_sent: boolean;
    reward_sent_at?: string;
    notes?: string;
}

/**
 * Link a social media account for the current user
 */
export const linkSocialAccount = async (
    platform: 'instagram' | 'twitter' | 'tiktok',
    username: string,
    walletAddress?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Remove @ symbol if present
        const cleanUsername = username.replace('@', '').trim();

        if (!cleanUsername) {
            return { success: false, error: 'Username is required' };
        }

        // Check if already linked
        const { data: existing } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', platform)
            .single();

        if (existing) {
            // Update existing username and wallet
            const { error } = await supabase
                .from('social_accounts')
                .update({
                    username: cleanUsername,
                    wallet_address: walletAddress || null
                })
                .eq('user_id', user.id)
                .eq('platform', platform);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        }

        // Insert new link
        const { error } = await supabase
            .from('social_accounts')
            .insert({
                user_id: user.id,
                platform,
                username: cleanUsername,
                wallet_address: walletAddress || null
            });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};

/**
 * Get social accounts for current user
 */
export const getSocialAccounts = async (): Promise<SocialAccount[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return [];

        const { data, error } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching social accounts:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getSocialAccounts:', error);
        return [];
    }
};

/**
 * Get a specific social account for current user
 */
export const getSocialAccount = async (
    platform: 'instagram' | 'twitter' | 'tiktok'
): Promise<SocialAccount | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        const { data, error } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', platform)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found
                return null;
            }
            console.error('Error fetching social account:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in getSocialAccount:', error);
        return null;
    }
};

/**
 * Unlink a social media account
 */
export const unlinkSocialAccount = async (
    platform: 'instagram' | 'twitter' | 'tiktok'
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('social_accounts')
            .delete()
            .eq('user_id', user.id)
            .eq('platform', platform);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};

/**
 * Admin: Get all pending Instagram links (reward not sent)
 */
export const getPendingInstagramLinks = async (): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('social_accounts')
            .select(`
                *,
                user:user_id (
                    email
                ),
                wallet:wallet_accounts!user_id (
                    wallet_address
                )
            `)
            .eq('platform', 'instagram')
            .eq('reward_sent', false)
            .order('linked_at', { ascending: false });

        if (error) {
            console.error('Error fetching pending links:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getPendingInstagramLinks:', error);
        return [];
    }
};

/**
 * Admin: Mark reward as sent
 */
export const markRewardSent = async (
    accountId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('social_accounts')
            .update({
                reward_sent: true,
                reward_sent_at: new Date().toISOString(),
                notes: notes || null
            })
            .eq('id', accountId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};
