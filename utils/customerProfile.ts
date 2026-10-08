// utils/customerProfile.ts
//
// Customer Profile Builder — aggregates a unified customer profile from
// orders, referrals, social accounts, and profile data. Also provides
// updateLifetimeStats() which increments the profiles table after each
// successful order so the admin can see lifetime spend + order count.
//
// WHY THIS EXISTS
//   The `profiles` table has `lifetime_spend_usd` and `lifetime_orders`
//   columns (see api/_types.ts > ProfileRow) but nothing was incrementing
//   them after checkout. The admin UserManager component shows profiles
//   but has no enriched view that combines orders + referrals + socials.
//   This utility closes both gaps.

import { supabase } from '../services/supabase.js';
import { mapToRequest, type PayoutRequest } from '../services/payoutRequest.js';

export interface CustomerProfile {
    userId: string;
    displayName: string;
    email: string | null;
    walletAddress: string | null;
    isVIP: boolean;
    storeCredit: number;
    sgCoinBalance: number;
    lifetimeSpendUsd: number;
    lifetimeOrders: number;
    customerNotes: string | null;
    // Enriched data
    orderCount: number;
    totalSpend: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    favoriteCategories: string[];
    socialAccounts: Array<{
        platform: string;
        username: string;
        verified: boolean;
    }>;
    referralCode: string | null;
    referralStats: {
        totalReferrals: number;
        successfulReferrals: number;
        totalEarnings: number;
        currentTier: number;
    } | null;
    // SGCoin PAYOUT (crypto-withdrawal) aggregation + raw rows. See
    // services/payoutRequest.ts for the source RPC wrappers + the schema in
    // supabase/migrations/20260716_create_sgcoin_payout_requests.sql.
    payoutStats: {
        totalRequested: number;
        pendingCount: number;
        completedCount: number;
        rejectedCount: number;
        lastStatus: PayoutRequest['status'] | null;
        lastAmount: number | null;
        lastDate: string | null;
    };
    payoutRequests: PayoutRequest[];
    // Anonymous buyer tracking (for orders with no auth user)
    anonymousOrderCount: number;
    anonymousTotalSpend: number;
}

// Build a unified customer profile by aggregating data from multiple tables.
// If userId is a MetaMask uid (starts with 'user_eth_'), returns a partial
// profile with just wallet + crypto data since those users have no DB rows.
export const buildCustomerProfile = async (userId: string): Promise<CustomerProfile | null> => {
    if (!userId) return null;

    const isMetaMaskUser = userId.startsWith('user_eth_');

    try {
        // Server-side filter: fetch only this user's orders by user_id.
        // Email-based matching would require the admin API (anon key can't
        // read auth.users), so we filter by user_id only — which covers
        // all authenticated checkouts. Guest orders are tracked separately
        // via buildCustomerProfileByEmail.
        // Promise.all schema (matters for tests/_helpers/supabaseClientMock.ts
        // which consumes outcomes in FIFO registration order):
        //   [0] profiles, [1] orders, [2] socials, [3] referral_stats,
        //   [4] sgcoin_payout_requests (new — see services/payoutRequest.ts).
        const [profileRes, ordersRes, socialsRes, referralStatsRes, payoutsRes] = await Promise.all([
            isMetaMaskUser ? Promise.resolve({ data: null, error: null }) : supabase
                .from('profiles')
                .select('is_vip, store_credit, sg_coin_balance, lifetime_spend_usd, lifetime_orders, customer_notes')
                .eq('id', userId)
                .maybeSingle(),
            isMetaMaskUser
                ? Promise.resolve({ data: [], error: null })
                : supabase
                    .from('orders')
                    .select('id, total, created_at, items, payment_status, user_id')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false }),
            isMetaMaskUser ? Promise.resolve({ data: null, error: null }) : supabase
                .from('social_accounts')
                .select('platform, username, verified')
                .eq('user_id', userId),
            isMetaMaskUser ? Promise.resolve({ data: null, error: null }) : supabase
                .from('referral_stats')
                .select('referral_code, total_referrals, successful_referrals, total_earnings, current_tier')
                .eq('user_id', userId)
                .maybeSingle(),
            // 5) sgcoin_payout_requests — customer's crypto-withdrawal history.
            // MetaMask users resolve to [] because wallet-only auth has no
            // payout_requests rows. The MyMask check below is harmless so
            // we leave it as a defensive short-circuit.
            isMetaMaskUser ? Promise.resolve({ data: [], error: null }) : supabase
                .from('sgcoin_payout_requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
        ]);

        const profile = profileRes.data;
        const userOrders = ordersRes.data || [];
        const socials = socialsRes.data || [];
        const referralStats = referralStatsRes.data;
        // Map payoutsRes rows (snake_case DB -> camelCase PayoutRequest).
        // The union type is loose on purpose so that an unknown future column
        // (e.g. operator_tax_id) does not fail this build — it lands as
        // undefined on the object and the consumer can choose to surface it.
        // Delegate the snake_case → camelCase mapping to the canonical helper
        // in services/payoutRequest.ts (was previously duplicated inline here\;
        // see commit 2026-07-16 PAYOUTS REFACTOR for context). Single source
        // of truth so future DB column additions propagate without drift.
        const userPayouts: PayoutRequest[] = (payoutsRes?.data || []).map(mapToRequest);
        // Aggregate stats. `lastXxx` fields reflect the most-recent row,
        // i.e. payoutRequests[0] because the SQL query orders created_at DESC.
        // `totalRequested` is purely informational (admin visibility) — it is
        // the sum of amounts across ALL statuses regardless of whether the
        // underlying sg_coin_balance has been decremented yet. Only the
        // `approve_payout_request` RPC (Pending -> Approved transition)
        // atomically decrements sg_coin_balance via FOR UPDATE row lock; the
        // reject path refunds automatically. So do NOT reconcile this metric
        // against sg_coin_balance — use `getPayoutRequestStats()` from
        // services/payoutRequest.ts for ledger-grade concern.
        const payoutStats = {
            totalRequested: userPayouts.reduce((s: number, p: PayoutRequest) => s + Number(p.amount || 0), 0),
            pendingCount: userPayouts.filter((p: PayoutRequest) => p.status === 'pending').length,
            completedCount: userPayouts.filter((p: PayoutRequest) => p.status === 'completed').length,
            rejectedCount: userPayouts.filter((p: PayoutRequest) => p.status === 'rejected').length,
            lastStatus: userPayouts[0]?.status || null,
            lastAmount: userPayouts[0]?.amount ?? null,
            lastDate: userPayouts[0]?.createdAt || null,
        };

        // Calculate enriched order data
        const paidOrders = userOrders.filter((o: any) =>
            ['paid', 'completed', 'shipped', 'delivered'].includes(String(o.payment_status || '').toLowerCase())
        );
        const totalSpend = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
        const firstOrderDate = paidOrders.length > 0
            ? paidOrders[paidOrders.length - 1]?.created_at || null
            : null;
        const lastOrderDate = paidOrders.length > 0
            ? paidOrders[0]?.created_at || null
            : null;

        // Extract most-purchased product IDs (as a proxy for preferences)
        const productCount = new Map<string, number>();
        for (const order of paidOrders) {
            const items = Array.isArray(order.items) ? order.items : [];
            for (const item of items) {
                const productId = item.productId || item.product_id || '';
                if (productId) {
                    productCount.set(productId, (productCount.get(productId) || 0) + 1);
                }
            }
        }
        const favoriteCategories = Array.from(productCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);

        return {
            userId,
            displayName: isMetaMaskUser ? `Wallet ${userId.slice(-8)}` : 'Customer',
            email: null, // email-based matching requires admin API; use buildCustomerProfileByEmail for guest lookups
            walletAddress: isMetaMaskUser ? userId.replace('user_eth_', '') : null,
            isVIP: profile?.is_vip || false,
            storeCredit: profile?.store_credit || 0,
            sgCoinBalance: profile?.sg_coin_balance || 0,
            lifetimeSpendUsd: profile?.lifetime_spend_usd || 0,
            lifetimeOrders: profile?.lifetime_orders || 0,
            customerNotes: profile?.customer_notes || null,
            orderCount: paidOrders.length,
            totalSpend,
            firstOrderDate,
            lastOrderDate,
            favoriteCategories,
            socialAccounts: (socials || []).map((s: any) => ({
                platform: s.platform,
                username: s.username,
                verified: s.verified,
            })),
            referralCode: referralStats?.referral_code || null,
            referralStats: referralStats ? {
                totalReferrals: referralStats.total_referrals || 0,
                successfulReferrals: referralStats.successful_referrals || 0,
                totalEarnings: referralStats.total_earnings || 0,
                currentTier: referralStats.current_tier || 1,
            } : null,
            payoutStats,
            payoutRequests: userPayouts,
            // Anonymous orders are tracked via buildCustomerProfileByEmail;
            // this profile only covers authenticated user_id matches.
            anonymousOrderCount: 0,
            anonymousTotalSpend: 0,
        };
    } catch (error) {
        console.error('Error building customer profile:', error);
        return null;
    }
};

// Update lifetime stats on the profiles table after a successful order.
// Uses a read-then-write pattern because Supabase JS client doesn't support
// atomic increment. RLS on profiles allows users to update their own row,
// and the service-role key (used by the API handler) bypasses RLS entirely.
//
// This is called from AppContext.addOrder after a successful checkout.
// It's fire-and-forget — a failure here should NOT block the order flow.
export const updateLifetimeStats = async (
    userId: string,
    orderTotal: number,
): Promise<void> => {
    if (!userId || userId.startsWith('user_eth_')) return;

    try {
        // Read current values
        const { data: profile, error: readError } = await supabase
            .from('profiles')
            .select('lifetime_spend_usd, lifetime_orders')
            .eq('id', userId)
            .maybeSingle();

        if (readError) {
            console.error('Error reading profile for lifetime stats update:', readError);
            return;
        }

        const currentSpend = profile?.lifetime_spend_usd || 0;
        const currentOrders = profile?.lifetime_orders || 0;

        // Write incremented values
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                lifetime_spend_usd: currentSpend + orderTotal,
                lifetime_orders: currentOrders + 1,
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating lifetime stats:', updateError);
        }
    } catch (error) {
        console.error('Error in updateLifetimeStats:', error);
    }
};

// Build a customer profile from an email address (for guest orders).
// This aggregates all orders matching the email, regardless of auth user.
// Used by the admin to look up guest buyers and identify verified customers.
export const buildCustomerProfileByEmail = async (email: string): Promise<{
    email: string;
    orderCount: number;
    totalSpend: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    isVerifiedBuyer: boolean;
}> => {
    if (!email) return { email: '', orderCount: 0, totalSpend: 0, firstOrderDate: null, lastOrderDate: null, isVerifiedBuyer: false };

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, total, created_at, payment_status')
            .eq('customer_email', email)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const paidOrders = (orders || []).filter((o: any) =>
            ['paid', 'completed', 'shipped', 'delivered'].includes(String(o.payment_status || '').toLowerCase())
        );
        const totalSpend = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

        return {
            email,
            orderCount: paidOrders.length,
            totalSpend,
            firstOrderDate: paidOrders.length > 0 ? paidOrders[paidOrders.length - 1]?.created_at || null : null,
            lastOrderDate: paidOrders.length > 0 ? paidOrders[0]?.created_at || null : null,
            isVerifiedBuyer: paidOrders.length > 0,
        };
    } catch (error) {
        console.error('Error building customer profile by email:', error);
        return { email, orderCount: 0, totalSpend: 0, firstOrderDate: null, lastOrderDate: null, isVerifiedBuyer: false };
    }
};
