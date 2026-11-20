// api/_handlers/payment-settings.ts
//
// Read + mutate the payment_settings singleton row (which payment options
// customers see at checkout).
//
//   GET   /api/payment-settings   — public. Returns the enabled flags. The
//         checkout calls this on mount to hide options the owner turned off.
//   PATCH /api/payment-settings   — admin only (Bearer token ===
//         ADMIN_API_TOKEN, same pattern as admin-products). Accepts a
//         partial { <flag>_enabled: boolean } body.
//
// Failure semantics: GET degrades to all-enabled (see
// services/paymentSettings.ts), so checkout never breaks if the table is
// missing.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import {
    createHttpError,
    parseBody,
    setCorsHeaders,
} from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';
import {
    loadPaymentSettings,
    DEFAULT_PAYMENT_SETTINGS,
    type PaymentSettings,
} from '../../services/paymentSettings.js';
import {
    isValidAddress,
    loadMerchantCryptoConfig,
    MAX_CRYPTO_WINDOW_HOURS,
    MIN_CRYPTO_WINDOW_HOURS,
    type MerchantCryptoConfig,
} from '../../services/cryptoWatcher.js';

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }
    return createClient(supabaseUrl, serviceRoleKey);
}

// body flag name -> settings key. Only these are writable. (The legacy
// `paypal_enabled` DB column is deliberately not exposed — PayPal checkout
// was removed from the product.)
const FLAG_TO_KEY: Record<string, keyof PaymentSettings> = {
    card_enabled: 'card',
    klarna_enabled: 'klarna',
    cashapp_enabled: 'cashapp',
    crypto_enabled: 'crypto',
    whop_enabled: 'whop',
};

// Wire shape shared by GET and PATCH responses so the admin card and the
// checkout client read one contract. The crypto merchant fields ride along
// so the checkout learns the receiving address without a second round-trip:
// crypto_merchant_address is '' when the owner never set one (clients fall
// back to the founder wallet); crypto_window_hours is the payment window
// in hours the verify endpoint enforces.
function toWire(settings: PaymentSettings, crypto: MerchantCryptoConfig) {
    return {
        card_enabled: settings.card,
        klarna_enabled: settings.klarna,
        cashapp_enabled: settings.cashapp,
        crypto_enabled: settings.crypto,
        whop_enabled: settings.whop,
        crypto_merchant_address: crypto.merchantAddressConfigured ? crypto.merchantAddress : '',
        crypto_window_hours: crypto.windowHours,
    };
}

export interface MerchantSettingsPatch {
    cryptoMerchantAddress?: string;
    cryptoWindowHours?: number;
}

async function saveSettings(patch: Partial<PaymentSettings> & MerchantSettingsPatch): Promise<PaymentSettings> {
    const supabase = getSupabaseAdmin();
    const row: Record<string, boolean | string | number> = {};
    for (const [flag, key] of Object.entries(FLAG_TO_KEY)) {
        if (patch[key] !== undefined) row[flag] = patch[key];
    }
    if (patch.cryptoMerchantAddress !== undefined) row.crypto_merchant_address = patch.cryptoMerchantAddress;
    if (patch.cryptoWindowHours !== undefined) row.crypto_window_hours = patch.cryptoWindowHours;

    const { data, error } = await supabase
        .from('payment_settings')
        .upsert({ id: 1, ...row }, { onConflict: 'id' })
        .select('card_enabled, klarna_enabled, cashapp_enabled, crypto_enabled, whop_enabled')
        .single();

    if (error || !data) {
        throw createHttpError(500, error?.message || 'Failed to save payment settings.');
    }

    // Same `?? DEFAULT` rule the checkout's reader uses (services/
    // paymentSettings.ts) — one rule, so the admin card and the live
    // checkout can never show a different set of options.
    return {
        card: data.card_enabled ?? DEFAULT_PAYMENT_SETTINGS.card,
        klarna: data.klarna_enabled ?? DEFAULT_PAYMENT_SETTINGS.klarna,
        cashapp: data.cashapp_enabled ?? DEFAULT_PAYMENT_SETTINGS.cashapp,
        crypto: data.crypto_enabled ?? DEFAULT_PAYMENT_SETTINGS.crypto,
        whop: data.whop_enabled ?? DEFAULT_PAYMENT_SETTINGS.whop,
    };
}

// The admin branch of this handler: changing these flags changes which payment
// methods shoppers can use, so it is wrapped rather than checked inline. Errors
// it throws propagate to the single formatter in the handler below.
const adminSettings = withAdminAuth(async (req: ApiRequest, res: ApiResponse) => {
    const body = parseBody(req) as Record<string, unknown>;
    const patch: Partial<PaymentSettings> & MerchantSettingsPatch = {};
    let found = false;

    for (const [flag, key] of Object.entries(FLAG_TO_KEY)) {
        if (body[flag] === undefined) continue;
        if (typeof body[flag] !== 'boolean') {
            res.status(400).json({ error: `${flag} must be a boolean.` });
            return;
        }
        patch[key] = body[flag] as boolean;
        found = true;
    }

    // Merchant crypto config: receiving address ('' clears back to the
    // founder-wallet fallback) and payment window in hours.
    if (body.crypto_merchant_address !== undefined) {
        const addr = String(body.crypto_merchant_address || '').trim();
        if (addr !== '' && !isValidAddress(addr)) {
            res.status(400).json({ error: 'crypto_merchant_address must be a 0x Polygon address or empty.' });
            return;
        }
        patch.cryptoMerchantAddress = addr;
        found = true;
    }
    if (body.crypto_window_hours !== undefined) {
        const hours = Number(body.crypto_window_hours);
        if (!Number.isInteger(hours) || hours < MIN_CRYPTO_WINDOW_HOURS || hours > MAX_CRYPTO_WINDOW_HOURS) {
            res.status(400).json({ error: `crypto_window_hours must be an integer ${MIN_CRYPTO_WINDOW_HOURS}-${MAX_CRYPTO_WINDOW_HOURS}.` });
            return;
        }
        patch.cryptoWindowHours = hours;
        found = true;
    }

    if (!found) {
        res.status(400).json({ error: 'At least one payment option flag is required.' });
        return;
    }

    const supabase = getSupabaseAdmin();
    const settings = await saveSettings(patch);
    res.status(200).json(toWire(settings, await loadMerchantCryptoConfig(supabase)));
});

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Public: the checkout reads which payment options are enabled
        // (plus the crypto merchant config for the receiving address).
        if (req.method === 'GET') {
            const supabase = getSupabaseAdmin();
            const settings = await loadPaymentSettings(supabase);
            res.status(200).json(toWire(settings, await loadMerchantCryptoConfig(supabase)));
            return;
        }

        if (req.method === 'PATCH' || req.method === 'POST') {
            await adminSettings(req, res);
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[payment-settings]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Payment settings request failed.' });
    }
}
