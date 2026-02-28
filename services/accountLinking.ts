import { supabase } from './supabase';

/**
 * Account Linking Service
 * Handles linking wallet addresses to Supabase auth users
 */

export interface LinkedAccount {
    id: string;
    wallet_address: string;
    user_id: string;
    linked_at: string;
}

/**
 * Check if a wallet address is linked to an email account
 */
export const getLinkedAccount = async (walletAddress: string): Promise<LinkedAccount | null> => {
    try {
        const { data, error } = await supabase
            .rpc('get_linked_user_id', { p_wallet_address: walletAddress });

        if (error) {
            console.error('Error checking linked account:', error);
            return null;
        }

        if (!data) return null;

        // Fetch full account details
        const { data: accountData, error: accountError } = await supabase
            .from('wallet_accounts')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single();

        if (accountError || !accountData) return null;

        return accountData;
    } catch (error) {
        console.error('Error in getLinkedAccount:', error);
        return null;
    }
};

/**
 * Link current user's wallet address to their email account
 */
export const linkWalletToCurrentUser = async (walletAddress: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data, error } = await supabase
            .rpc('link_wallet_to_user', { p_wallet_address: walletAddress });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};

/**
 * Helper: Unlink wallet if it's linked to the current user
 * This is used when "upgrading" a wallet-only account to an email account
 */
const unlinkIfLinkedToCurrentUser = async (walletAddress: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if linked to THIS user
    const { data: link } = await supabase
        .from('wallet_accounts')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('user_id', user.id)
        .single();

    if (link) {
        console.log('Unlinking wallet from current user before re-linking...');
        await supabase
            .from('wallet_accounts')
            .delete()
            .eq('wallet_address', walletAddress)
            .eq('user_id', user.id);
    }
};

/**
 * Create a new email account and link wallet
 */
export const createAccountAndLinkWallet = async (
    email: string,
    password: string,
    walletAddress: string
): Promise<{ success: boolean; error?: string; userId?: string }> => {
    try {
        // 1. If wallet is linked to CURRENT user, unlink it first (to allow transfer)
        await unlinkIfLinkedToCurrentUser(walletAddress);

        // 2. Create new Supabase auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    wallet_address: walletAddress
                },
                emailRedirectTo: window.location.origin
            }
        });

        if (authError) {
            return { success: false, error: authError.message };
        }

        if (!authData.user) {
            return { success: false, error: 'Failed to create user' };
        }

        // 3. Wait a moment for the session to be established
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 4. Directly insert into wallet_accounts table
        const { error: linkError } = await supabase
            .from('wallet_accounts')
            .insert({
                wallet_address: walletAddress,
                user_id: authData.user.id
            });

        if (linkError) {
            console.error('Error linking wallet:', linkError);
            return { success: false, error: 'Account created but wallet linking failed. Please try linking manually.' };
        }

        return { success: true, userId: authData.user.id };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};

/**
 * Link wallet to existing account (requires login)
 */
export const linkWalletToExistingAccount = async (
    email: string,
    password: string,
    walletAddress: string
): Promise<{ success: boolean; error?: string; userId?: string }> => {
    try {
        // 1. If wallet is linked to CURRENT user, unlink it first (to allow transfer)
        await unlinkIfLinkedToCurrentUser(walletAddress);

        // 2. Sign in to verify credentials
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return { success: false, error: 'Invalid email or password' };
        }

        if (!authData.user) {
            return { success: false, error: 'Login failed' };
        }

        // 3. Link wallet to authenticated user
        // We can use the direct insert here too for consistency, or the helper
        const { error: linkError } = await supabase
            .from('wallet_accounts')
            .insert({
                wallet_address: walletAddress,
                user_id: authData.user.id
            });

        if (linkError) {
            // If it failed (maybe already linked to THIS user?), check if it's actually fine
            if (linkError.code === '23505') { // Unique violation
                return { success: true, userId: authData.user.id };
            }
            return { success: false, error: linkError.message };
        }

        return { success: true, userId: authData.user.id };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};

/**
 * Unlink wallet from current user
 */
export const unlinkWallet = async (walletAddress: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('wallet_accounts')
            .delete()
            .eq('wallet_address', walletAddress);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error' };
    }
};

/**
 * Get all wallets linked to current user
 */
export const getLinkedWallets = async (): Promise<LinkedAccount[]> => {
    try {
        const { data, error } = await supabase
            .from('wallet_accounts')
            .select('*')
            .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        if (error) {
            console.error('Error fetching linked wallets:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getLinkedWallets:', error);
        return [];
    }
};
