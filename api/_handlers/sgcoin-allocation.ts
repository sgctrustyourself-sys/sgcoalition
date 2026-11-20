// api/_handlers/sgcoin-allocation.ts
//
// GET /api/sgcoin-allocation — the SGCoin distribution fund's share of past
// sales, derived from completed orders.
//
// MOVED HERE, DELIBERATELY. This was api/admin/sgcoin-allocation.ts, where:
//
//   1. "admin auth" was a token LENGTH check — `token.length !== 43 && !== 11`
//      — so any 43-character string was an admin credential. It reads `orders`
//      with SUPABASE_SERVICE_ROLE_KEY and returns total revenue, so that was a
//      financial-data read for anyone who guessed the path.
//   2. It lived outside api/[...slug].ts. Vercel turns every file under api/
//      into its own function, so this never passed through withRateLimit and
//      was invisible to tests/securityInfrastructureReadiness.test.ts, which
//      only walks api/_handlers.
//   3. It threw at module scope when Supabase was unconfigured, so a
//      misconfigured deploy failed at import (500) rather than answering 503.
//
// The gate now comes from withAdminAuth (the one admin policy in
// api/_adminAuth.ts) and the budget from withRateLimit in the route table, so
// this file cannot forget either one. tests/securityInfrastructureReadiness
// .test.ts fails if a handler is added outside api/_handlers again.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError, type HttpError } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

/**
 * Percentage of sales routed to the SGCoin distribution fund.
 *
 * Read per request rather than at module scope so a deploy does not have to be
 * restarted to change it, and guarded because this number reaches `.toFixed()`
 * in the admin UI: `Number('')` is 0 and `Number('abc')` is NaN, and either one
 * serializes into a payload the caller cannot render.
 */
function allocationPercentage(): number {
    const configured = Number(process.env.VITE_SGCOIN_ALLOCATION_PERCENTAGE || '1');
    if (!Number.isFinite(configured) || configured < 0) return 1;
    return configured;
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const supabase = getSupabaseAdmin();

        // `*` is kept on purpose: the completion columns are not settled (the
        // reducer below already accepts both `total` and `total_amount`, and
        // both `payment_status` and `status`), and PostgREST fails the whole
        // request if a named column is missing.
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw createHttpError(500, error.message || 'Failed to fetch orders.');
        }

        const completed = (data || []).filter(
            (order: Record<string, unknown>) =>
                order.payment_status === 'paid' ||
                order.status === 'paid' ||
                order.paymentStatus === 'paid' ||
                order.status === 'completed',
        );

        const totalCents = completed.reduce((sum: number, order: Record<string, unknown>) => {
            const total = Number(order.total) || Number(order.total_amount) || 0;
            return sum + total;
        }, 0);

        const percentage = allocationPercentage();
        const allocationCents = Math.floor((totalCents * percentage) / 100);

        res.status(200).json({
            totalSales: totalCents,
            totalOrders: completed.length,
            sgcoinAllocationCents: allocationCents,
            allocationPercentage: percentage,
            note:
                `From $${(totalCents / 100).toLocaleString()} in past sales, ` +
                `${percentage}% (≈ $${(allocationCents / 100).toLocaleString()}) ` +
                'is allocated to the SGCoin distribution fund.',
        });
    } catch (error: unknown) {
        const httpError = error as Partial<HttpError>;
        const status = Number(httpError?.status || 500);
        console.error('[sgcoin-allocation]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Internal error' });
    }
}

// Every read here is an operator read, so the whole handler is wrapped: CORS,
// the OPTIONS short-circuit and the credential check all come from the gate.
export default withAdminAuth(handler);
