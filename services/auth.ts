import { supabase } from './supabase';

export const signInWithDiscord = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
            redirectTo: `${window.location.origin}/`,
        },
    });
    return { data, error };
};

export const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
};

export const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });
    return { data, error };
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

export const resetPasswordForEmail = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/update-password`,
    });
    return { data, error };
};

export const updatePassword = async (password: string) => {
    const { data, error } = await supabase.auth.updateUser({
        password,
    });
    return { data, error };
};

export const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
};
