// api/_handlers/create-whop-checkout-link.ts
//
// The PROMOTER channel. A promoter (creator, affiliate, reseller) sells a
// Coalition piece through their own Whop link and keeps 30% of that sale. The
// buyer on this path pays the NORMAL price — this is not a customer discount,
// it is a revenue split that Whop attributes to the promoter.
//
// It is deliberately NOT a second storefront checkout:
//   • the site checkout is Stripe (api/_handlers/create-payment-intent.ts),
//     and the member 30% discount lives there;
//   • a Whop checkout configuration sells ONE plan, so it cannot express a
//     mixed cart with sizes — a link is per product.
//
// Auth: admin-only. An open "make me a Whop link" endpoint with the
// account's API key behind it is an affiliate-fraud surface: anyone could
// mint links carrying somebody else's affiliate code.
//
// POST /api/create-whop-checkout-link
// Body: { productId, quantity?, affiliateCode? }
// Returns: { whopCheckoutUrl, whopCheckoutId, productId, affiliateCode, priceCents }
//
// Environment:
//   WHOP_API_KEY       the account API key (Bearer)
//   WHOP_ACCOUNT_ID    the company id, prefixed biz_
//   WHOP_PRODUCT_MAP   optional JSON map of site product id -> Whop product id
//                      e.g. {"prod_tee_above_as_below": "prod_xxxx"}
//   WHOP_DEFAULT_PRODUCT_ID  used when the map has no entry for the product
//   WHOP_AFFILIATE_CODE      default promoter code when the body omits one

import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '../_adminAuth.js';
import { createHttpError } from '../_helpers.js';
import { loadPaymentSettings } from '../../services/paymentSettings.js';
import type { ApiRequest, ApiResponse } from '../_types.js';

const WHOP_API_BASE = 'https://api.whop.com/api/v1';

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

/** The Whop product id that represents a given site product. */
function whopProductIdFor(productId: string): string | null {
    const raw = process.env.WHOP_PRODUCT_MAP;
    if (raw) {
        try {
            const map = JSON.parse(raw) as Record<string, string>;
            const mapped = map[productId];
            if (mapped) return mapped;
        } catch {
            console.warn('[whop-checkout] WHOP_PRODUCT_MAP is not valid JSON — ignoring it');
        }
    }
    return process.env.WHOP_DEFAULT_PRODUCT_ID || null;
}

export default withAdminAuth(async (req: ApiRequest, res: ApiResponse) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const admin = getSupabaseAdmin();
        if (!admin) throw createHttpError(503, 'Supabase admin credentials not configured.');

        // The owner can switch the whole promoter channel off from Admin ->
        // Command Center -> Payment Options. A disabled channel must not mint
        // links.
        const settings = await loadPaymentSettings(admin);
        if (!settings.whop) {
            throw createHttpError(409, 'The Whop promoter channel is turned off. Enable it in Admin -> Payment Options.');
        }

        const body = (req.body || {}) as Record<string, unknown>;
        const productId = String(body.productId || '').trim();
        if (!productId) throw createHttpError(400, 'productId is required.');

        const quantity = Math.max(1, Math.min(99, Number(body.quantity || 1)));
        const affiliateCode = String(body.affiliateCode || process.env.WHOP_AFFILIATE_CODE || '').trim() || null;

        const whopProductId = whopProductIdFor(productId);

        const accountId = String(process.env.WHOP_ACCOUNT_ID || '').trim();
        if (!accountId) throw createHttpError(503, 'WHOP_ACCOUNT_ID is not configured.');

        const apiKey = String(process.env.WHOP_API_KEY || '').trim();
        if (!apiKey) throw createHttpError(503, 'WHOP_API_KEY is not configured.');

        // The price is read from the site's own products table — NEVER from the
        // request body. A link whose amount the caller chose is a way to sell
        // Coalition product at any price, and the buyer's receipt would then
        // disagree with what the site charges.
        const { data: product, error: productError } = await admin
            .from('products')
            .select('id, name, price, archived')
            .eq('id', productId)
            .maybeSingle();
        if (productError) throw createHttpError(500, productError.message || 'Product lookup failed.');
        if (!product) throw createHttpError(404, 'Unknown product.');
        if (product.archived) throw createHttpError(409, 'That product is no longer available.');

        if (!whopProductId) {
            throw createHttpError(400, `No Whop product is mapped for "${productId}". Add it to WHOP_PRODUCT_MAP.`);
        }

        const unitCents = Math.round(Number(product.price || 0) * 100);
        const priceCents = unitCents * quantity;
        if (priceCents <= 0) throw createHttpError(409, 'That product has no price.');

        // Whop's API: POST /api/v1/checkout_configurations. A configuration
        // wraps a plan (what is being sold) and optionally attributes the sale
        // to an affiliate — the promoter.
        const whopResponse = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                account_id: accountId,
                mode: 'payment',
                plan: {
                    product_id: whopProductId,
                    plan_type: 'one_time',
                    currency: 'usd',
                    initial_price: priceCents / 100,
                    title: product.name,
                    ...(quantity > 1 ? { stock: quantity } : {}),
                },
                ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
                // So the buyer lands back on the site and the sale is traceable
                // to the Coalition product that generated it.
                metadata: { source: 'sgcoalition', product_id: productId, quantity },
                ...(process.env.WHOP_REDIRECT_URL ? { redirect_url: process.env.WHOP_REDIRECT_URL } : {}),
            }),
        });

        if (!whopResponse.ok) {
            const errorBody = await whopResponse.text().catch(() => 'Whop API error');
            console.error('[whop-checkout] Whop API error:', whopResponse.status, errorBody);
            throw createHttpError(502, `Whop API error (${whopResponse.status}): ${errorBody.slice(0, 300)}`);
        }

        const whopData = await whopResponse.json() as Record<string, any>;
        // Whop returns the shareable URL on the configuration and/or its plan.
        const checkoutUrl = String(whopData.url || whopData.purchase_url || whopData.checkout_url || '');
        if (!checkoutUrl) {
            throw createHttpError(502, 'Whop did not return a checkout URL.');
        }

        res.status(200).json({
            whopCheckoutUrl: checkoutUrl,
            whopCheckoutId: String(whopData.id || whopData.plan_id || ''),
            productId,
            quantity,
            affiliateCode,
            priceCents,
        });
    } catch (err: any) {
        const status = Number(err?.status || 500);
        const message = err?.message || 'Failed to create a Whop checkout link.';
        if (status >= 500) console.error('[whop-checkout] error:', err);
        res.status(status).json({ error: message });
    }
}, { cors: { methods: 'POST,OPTIONS' } });
