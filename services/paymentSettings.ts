// services/paymentSettings.ts
//
// Single source of truth for which payment options are shown to customers at
// checkout. The shop owner flips these live from the admin Command Center
// (PaymentOptionsCard -> PATCH /api/payment-settings); this module reads the
// singleton payment_settings row for both the serverless handlers
// (create-payment-intent, paypal-order) and the API layer.
//
// FAILURE SEMANTICS: any read failure (table missing, migration not applied,
// transient DB error) falls back to ALL-ENABLED. A settings outage must
// never silently lock customers out of checkout — the flip side of the
// health-monitor design (degrade safe, not degrade broken).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PaymentSettings {
    card: boolean;
    paypal: boolean;
    klarna: boolean;
    crypto: boolean;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
    card: true,
    paypal: true,
    klarna: true,
    crypto: true,
};

export async function loadPaymentSettings(supabase: SupabaseClient): Promise<PaymentSettings> {
    try {
        const { data } = await supabase
            .from('payment_settings')
            .select('card_enabled, paypal_enabled, klarna_enabled, crypto_enabled')
            .eq('id', 1)
            .maybeSingle();

        if (!data) return { ...DEFAULT_PAYMENT_SETTINGS };

        return {
            card: data.card_enabled !== false,
            paypal: data.paypal_enabled !== false,
            klarna: data.klarna_enabled !== false,
            crypto: data.crypto_enabled !== false,
        };
    } catch (error) {
        console.warn('[payment-settings] read failed — defaulting to all enabled:', error);
        return { ...DEFAULT_PAYMENT_SETTINGS };
    }
}
