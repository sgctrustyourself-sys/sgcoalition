// Custom Referral Code Editor
// Allows users to customize their code ONCE

import { supabase } from '../services/supabase';

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

        // Check if user has already customized
        const { data: currentStats } = await supabase
            .from('referral_stats')
            .select('code_customized, referral_code')
            .eq('user_id', userId)
            .single();

        if (!currentStats) {
            return { success: false, error: 'Referral stats not found' };
        }

        if (currentStats.code_customized) {
            return { success: false, error: 'You have already customized your referral code once' };
        }

        // Check if code is already taken
        const { data: existingCode } = await supabase
            .from('referral_stats')
            .select('referral_code')
            .eq('referral_code', formattedCode)
            .maybeSingle();

        if (existingCode) {
            return { success: false, error: 'This code is already taken. Please try another.' };
        }

        // Update the code
        const { error: updateError } = await supabase
            .from('referral_stats')
            .update({
                referral_code: formattedCode,
                code_customized: true,
                code_customized_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateError) {
            console.error('Error updating referral code:', updateError);
            return { success: false, error: 'Failed to update code. Please try again.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error customizing referral code:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
};
