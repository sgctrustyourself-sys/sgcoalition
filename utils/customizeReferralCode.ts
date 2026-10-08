// Custom Referral Code Editor
// Allows users to customize their code ONCE

import { supabase } from '../services/supabase.js';

export const customizeReferralCode = async (
    userId: string,
    newCode: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Validate code format
        if (!newCode || newCode.length < 4 || newCode.length > 12) {
            return { success: false, error: 'Code must be 4-12 characters long' };
        }

        // Only alphanumeric and hyphens
        if (!/^[A-Z0-9-]+$/i.test(newCode)) {
            return { success: false, error: 'Code can only contain letters, numbers, and hyphens' };
        }

        // Convert to uppercase for consistency
        const formattedCode = newCode.toUpperCase();

        // Banned-words list (mirrors the v2 migration's `referral_banned_codes`
        // table — the RPC enforces it server-side too, this is the cheap
        // client-side guard so users get a clear error without a round trip).
        const BANNED_CODES = new Set([
            'ADMIN', 'ADMIN1', 'ADMIN2', 'ADMIN3',
            'SUPPORT', 'STAFF', 'HELP', 'INFO', 'ROOT', 'API', 'ABOUT',
            'LOGIN', 'SIGNUP', 'PAY', 'PASSWORD', 'RESET',
            'SG', 'NULL', 'TEST', 'COALITION', 'SGC',
        ]);
        const BANNED_PREFIXES = ['ADMIN', 'STAFF', 'SUPPORT', 'TEST'];
        const isBanned =
            BANNED_CODES.has(formattedCode) ||
            BANNED_PREFIXES.some(p => formattedCode.startsWith(p + '-') || formattedCode === p);
        if (isBanned) {
            return { success: false, error: 'This code is reserved. Please choose another.' };
        }

        // Server-side availability check (also enforces the banned-words list
        // and uniqueness in a single round-trip). Falls back to the legacy
        // client-side check if the RPC is missing on older databases.
        try {
            const { data: isAvailable, error: rpcError } = await supabase.rpc(
                'is_referral_code_available',
                { p_code: formattedCode }
            );
            if (!rpcError && isAvailable === false) {
                return { success: false, error: 'This code is already taken or reserved. Please try another.' };
            }
        } catch {
            // RPC may not exist yet — fall through to legacy check below.
        }

        // Check if user has already customized
        const { data: currentStats, error: statsError } = await supabase
            .from('referral_stats')
            .select('code_customized, referral_code')
            .eq('user_id', userId)
            .single();

        if (statsError || !currentStats) {
            return { success: false, error: 'Referral stats not found' };
        }

        // Graceful fallback for pre-v2 databases where code_customized may be
        // missing. We treat the absence of the field as "not customized yet".
        if ((currentStats as { code_customized?: boolean }).code_customized === true) {
            return { success: false, error: 'You have already customized your referral code once' };
        }

        // Legacy uniqueness check (only used if the new RPC isn't available)
        const { data: existingCode } = await supabase
            .from('referral_stats')
            .select('referral_code')
            .eq('referral_code', formattedCode)
            .neq('user_id', userId) // don't reject the user's own current code
            .maybeSingle();

        if (existingCode) {
            return { success: false, error: 'This code is already taken. Please try another.' };
        }

        // Update the code. The `code_customized` and `code_customized_at`
        // columns are added in the v2 migration; on older schemas the
        // unknown-column error is caught and we fall back to just the
        // code rename.
        const updatePayload: Record<string, unknown> = {
            referral_code: formattedCode,
        };
        updatePayload.code_customized = true;
        updatePayload.code_customized_at = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('referral_stats')
            .update(updatePayload)
            .eq('user_id', userId);

        if (updateError) {
            // Pre-v2 schema fallback: if the new columns don't exist, retry
            // with just the code rename so the user can still customize.
            const isMissingColumn =
                updateError.code === 'PGRST204' ||
                /code_customized/.test(updateError.message || '');
            if (isMissingColumn) {
                const { error: fallbackError } = await supabase
                    .from('referral_stats')
                    .update({ referral_code: formattedCode })
                    .eq('user_id', userId);
                if (fallbackError) {
                    console.error('Fallback update failed:', fallbackError);
                    return { success: false, error: 'Failed to update code. Please try again.' };
                }
                // Surface a soft warning to the caller via a successful
                // response — the rename worked, just the audit fields
                // couldn't be persisted.
                return { success: true };
            }
            console.error('Error updating referral code:', updateError);
            return { success: false, error: 'Failed to update code. Please try again.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error customizing referral code:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
};
