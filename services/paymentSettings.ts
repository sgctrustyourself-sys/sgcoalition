// services/paymentSettings.ts
//
// Single source of truth for which payment options are shown to customers at
// checkout. The shop owner flips these live from the admin Command Center
// (PaymentOptionsCard -> PATCH /api/payment-settings); this module reads the
// singleton payment_settings row for both the serverless handlers
// (create-payment-intent) and the API layer.
//
// FAILURE SEMANTICS: any read failure (table missing, migration not applied,
// transient DB error) falls back to ALL-ENABLED. A settings outage must
// never silently lock customers out of checkout — the flip side of the
// health-monitor design (degrade safe, not degrade broken).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PaymentSettings {
    card: boolean;
    klarna: boolean;
    cashapp: boolean;
    crypto: boolean;
}

// NOTE: PayPal checkout was removed from the product; the legacy
// `paypal_enabled` DB column is simply ignored. Klarna defaults OFF —
// Klarna/Pay in 4 is the 'pay later' option the owner asked to hide.
// Card + Cash App + Crypto are the working primary paths. The owner can
// re-enable any flag live from the admin Command Center without a redeploy.
export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
    card: true,
    klarna: false,
    cashapp: true,
    crypto: true,
};

export async function loadPaymentSettings(supabase: SupabaseClient): Promise<PaymentSettings> {
    try {
        const { data } = await supabase
            .from('payment_settings')
            .select('card_enabled, klarna_enabled, cashapp_enabled, crypto_enabled')
            .eq('id', 1)
            .maybeSingle();

        if (!data) return { ...DEFAULT_PAYMENT_SETTINGS };

        return {
            card: data.card_enabled !== false,
            klarna: data.klarna_enabled !== false,
            cashapp: data.cashapp_enabled !== false,
            crypto: data.crypto_enabled !== false,
        };
    } catch (error) {
        console.warn('[payment-settings] read failed — defaulting to all enabled:', error);
        return { ...DEFAULT_PAYMENT_SETTINGS };
    }
}
