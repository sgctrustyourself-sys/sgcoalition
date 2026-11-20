import { supabase } from './supabase.js';

export const signInWithDiscord = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
            redirectTo: `${window.location.origin}/#/tutorial/welcome`,
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

/**
 * The contact details captured when a member creates an account.
 *
 * The 30% member discount doubles as an acquisition offer, so signing up
 * leaves us holding a usable CONTACT — not just an email. These are written
 * into the Supabase auth user metadata and copied onto the `profiles` row by
 * the trigger in supabase/migrations/20261021_add_member_contact_fields.sql.
 */
export interface SignupContact {
    phone?: string;
    addressLine1?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
    addressCountry?: string;
}

export const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    contact: SignupContact = {},
) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                // Blank strings are dropped rather than stored: the profile
                // trigger treats an empty value as "not captured" and keeps
                // whatever is already on the profile.
                ...(contact.phone?.trim() ? { phone: contact.phone.trim() } : {}),
                ...(contact.addressLine1?.trim() ? { address_line1: contact.addressLine1.trim() } : {}),
                ...(contact.addressCity?.trim() ? { address_city: contact.addressCity.trim() } : {}),
                ...(contact.addressState?.trim() ? { address_state: contact.addressState.trim() } : {}),
                ...(contact.addressZip?.trim() ? { address_zip: contact.addressZip.trim() } : {}),
                ...(contact.addressCountry?.trim() ? { address_country: contact.addressCountry.trim() } : {}),
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
        redirectTo: window.location.origin,
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
