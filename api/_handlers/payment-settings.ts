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
import {
    loadPaymentSettings,
    type PaymentSettings,
} from '../../services/paymentSettings.js';

function getBearerToken(req: ApiRequest): string | null {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

function isAuthorized(req: ApiRequest): boolean {
    const token = getBearerToken(req);
    if (!token) return false;
    const adminToken = (process.env.ADMIN_API_TOKEN || '').trim();
    return adminToken.length > 0 && token === adminToken;
}

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }
    return createClient(supabaseUrl, serviceRoleKey);
}

// body flag name -> settings key. Only these are writable.
const FLAG_TO_KEY: Record<string, keyof PaymentSettings> = {
    card_enabled: 'card',
    paypal_enabled: 'paypal',
    klarna_enabled: 'klarna',
    crypto_enabled: 'crypto',
};

// Wire shape shared by GET and PATCH responses so the admin card and the
// checkout client read one contract.
function toWire(settings: PaymentSettings) {
    return {
        card_enabled: settings.card,
        paypal_enabled: settings.paypal,
        klarna_enabled: settings.klarna,
        crypto_enabled: settings.crypto,
    };
}

async function saveSettings(patch: Partial<PaymentSettings>): Promise<PaymentSettings> {
    const supabase = getSupabaseAdmin();
    const row: Record<string, boolean> = {};
    for (const [flag, key] of Object.entries(FLAG_TO_KEY)) {
        if (patch[key] !== undefined) row[flag] = patch[key];
    }

    const { data, error } = await supabase
        .from('payment_settings')
        .upsert({ id: 1, ...row }, { onConflict: 'id' })
        .select('card_enabled, paypal_enabled, klarna_enabled, crypto_enabled')
        .single();

    if (error || !data) {
        throw createHttpError(500, error?.message || 'Failed to save payment settings.');
    }

    return {
        card: data.card_enabled !== false,
        paypal: data.paypal_enabled !== false,
        klarna: data.klarna_enabled !== false,
        crypto: data.crypto_enabled !== false,
    };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method === 'GET') {
            const settings = await loadPaymentSettings(getSupabaseAdmin());
            res.status(200).json(toWire(settings));
            return;
        }

        if (req.method === 'PATCH' || req.method === 'POST') {
            if (!isAuthorized(req)) {
                res.status(401).json({ error: 'Admin authorization required.' });
                return;
            }

            const body = parseBody(req) as Record<string, unknown>;
            const patch: Partial<PaymentSettings> = {};
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

            if (!found) {
                res.status(400).json({ error: 'At least one payment option flag is required.' });
                return;
            }

            res.status(200).json(toWire(await saveSettings(patch)));
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
