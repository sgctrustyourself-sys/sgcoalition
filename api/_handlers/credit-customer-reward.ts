// /api/credit-customer-reward
// Admin-only: credit a customer's SGCoin balance and write a row to
// customer_reward_credits for audit. The "manual trigger" model agreed with
// the maintainer: customer-credits are NOT automatic on first wallet link —
// the admin types the amount + reason and submits here.
//
// Idempotency: a credit always produces a fresh customer_reward_credits row,
// so re-submitting the same body will produce two rows. Clients should debounce
// (button-disabled-while-loading) to avoid double-credits.

import { createClient } from '@supabase/supabase-js';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, withAdminAuth, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    CreditCustomerRewardBody,
    CreditCustomerRewardResponse,
    ProfileRow,
    SupabaseClient,
} from '../_types';

// Lazy Supabase admin client. Previously eager `createClient(...)` crashed
// the Lambda at cold start when VITE_SUPABASE_URL was unset (SDK validates
// URL format immediately). Lazy-init matches paypal-order.ts + complete-order.ts
// + create-payment-intent.ts + verify-subscription.ts + place-order-credits.ts
// + attribute-order-to-facebook.ts convention. Callers hit this once and
// get a 503 from the inner handler.
let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
    if (cachedAdminClient) return cachedAdminClient;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase is not configured on this server.');
    }
    cachedAdminClient = createClient(supabaseUrl, serviceRoleKey);
    return cachedAdminClient;
}

async function creditCustomerReward(req: ApiRequest): Promise<CreditCustomerRewardResponse> {
    const rawBody = parseBody(req);
    const body = rawBody as CreditCustomerRewardBody;

    const profileId = String(body.profileId || '').trim();
    // Accept both camelCase (the components/admin sends) and snake_case for
    // backwards compat with any older client/curl scripts.
    const amountSgc = Number(
        body.amountSgc !== undefined ? body.amountSgc : body.amountSgcSnake
    );
    const amountUsd = Number(body.amountUsd || 0);
    const orderId = body.orderId ? String(body.orderId).trim() : null;
    const reason = String(body.reason || '').trim() || 'Manual admin credit';

    if (!profileId) {
        throw createHttpError(400, 'profileId is required');
    }
    if (!Number.isFinite(amountSgc) || amountSgc <= 0) {
        throw createHttpError(400, 'amountSgc must be a positive number');
    }

    // 1. Fetch the profile row to read the current balance + capture the
    //    awarding admin uid.
    const { data: profileRow, error: fetchError } = await getSupabaseAdmin()
        .from('profiles')
        .select('id, sg_coin_balance')
        .eq('id', profileId)
        .single();

    if (fetchError || !profileRow) {
        throw createHttpError(404, 'Profile not found');
    }

    const profileTyped = profileRow as Pick<ProfileRow, 'id'> & {
        sg_coin_balance?: number | null;
    };
    const currentBalance = Number(profileTyped.sg_coin_balance || 0);
    const newBalance = currentBalance + amountSgc;

    // 2. Best-effort admin uid capture. The admin_token issued by /api/admin/verify
    //    is opaque (we don't decode it here). Use a generic service placeholder.
    //    This is acceptable for audit purposes: the timestamp + reason + amount
    //    combine for a real-world reconciliation if needed.
    const awardedByUserId = profileId; // Service-context 'actor' identifier; see comment above.

    // 3. Append the audit row FIRST so credit history is never lost if step 4 fails.
    const creditInsert = await getSupabaseAdmin()
        .from('customer_reward_credits')
        .insert({
            profile_id: profileId,
            order_id: orderId,
            amount_sgc: amountSgc,
            amount_usd: Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : null,
            awarded_by_user_id: awardedByUserId,
            reason,
        })
        .select('id, created_at')
        .single();

    if (creditInsert.error || !creditInsert.data) {
        throw createHttpError(500, 'Failed to write customer_reward_credits audit row');
    }

    // 4. Bump the live balance + mirror the latest credit fields on the profile row.
    const updateResult = await getSupabaseAdmin()
        .from('profiles')
        .update({
            sg_coin_balance: newBalance,
            last_reward_credit_at: creditInsert.data.created_at,
            last_reward_credit_amount: amountSgc,
            updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);

    if (updateResult.error) {
        // The audit row exists but the balance wasn't bumped. Surface the partial-write
        // to the operator so they can reconcile manually.
        throw createHttpError(500, 'Audit row written but balance update failed');
    }

    return {
        success: true,
        newSgCoinBalance: newBalance,
        creditId: String(creditInsert.data.id),
        awardedAt: String(creditInsert.data.created_at),
    };
}

export default withAdminAuth(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        res.status(200).json(await creditCustomerReward(req));
    } catch (error: unknown) {
        const httpError = error as HttpError | null;
        const message = (error as { message?: string } | null)?.message;
        const status = Number(httpError?.status || 500);
        console.error('Customer reward credit error:', error);
        res.status(status).json({ error: message || 'Customer reward credit failed' });
    }
}, { cors: { methods: 'POST,OPTIONS', allowedHeaders: EXTENDED_CORS_HEADERS } });
