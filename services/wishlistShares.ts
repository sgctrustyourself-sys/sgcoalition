// services/wishlistShares.ts
//
// Server-bound helpers for the public.wishlist_shares table
// (supabase/migrations/20260709_add_wishlist_shares.sql). The table stores
// one row per share: a shareId slug, an owner_id FK, an owner_name
// snapshot, the items array (product IDs at share time), and a created_at
// timestamp. RLS policies:
//   - SELECT: USING (true) -- anyone with the shareId can view it
//   - INSERT: WITH CHECK (auth.uid() = owner_id) -- only the owner can
//     create a share for themselves
//   - DELETE: USING (auth.uid() = owner_id) -- only the owner can
//     revoke their own share
//
// No UPDATE policy: shares are immutable. To "update" a share the owner
// must DELETE the old row and INSERT a new one (handled by the
// lazy-generate flow in components/WishlistShare.tsx).
//
// All helpers use the user-scoped Supabase client (services/supabase.ts),
// which carries the auth.uid() token implicitly. The service role key is
// NEVER used here -- these helpers run in the user's browser context
// where the row-level policies are the only thing standing between
// User A and User B's shares.

import { supabase } from './supabase';

/**
 * Row shape for public.wishlist_shares, mirroring the columns in the
 * migration. Kept in this file (not types.ts) because the type is only
 * used by components/WishlistShare.tsx and the readiness test -- not
 * part of the public domain model.
 */
export interface WishlistShare {
    share_id: string;
    owner_id: string;
    owner_name: string;
    items: string[];
    created_at: string;
}

/**
 * Fetch every share owned by the given user, newest first.
 *
 * IMPORTANT: the wishlist_shares SELECT RLS policy is `USING (true)`
 * (intentionally permissive -- any recipient with a shareId can view
 * the share). That means a raw SELECT * returns EVERY share in the
 * table, including other users' shares. The owner-scoping MUST happen
 * in the WHERE clause, NOT in the RLS. The explicit `.eq('owner_id',
 * userId)` filter is the only thing preventing User A from seeing
 * User B's shareIds, owner_names, items arrays, and timestamps.
 *
 * The companion readiness test
 * (tests/wishlistSharesReadiness.test.ts) locks this filter so a
 * future "simplify the query" refactor cannot silently regress to a
 * privacy leak.
 *
 * The caller (components/WishlistShare.tsx) passes `user.uid` from
 * the AppContext. If the user is not signed in, the caller MUST NOT
 * invoke this helper -- the param is required to enforce the filter.
 *
 * Returns an empty array if the user has no shares. Throws on network
 * / RLS errors so the caller can show an explicit error UI.
 */
export async function listMyShares(userId: string): Promise<WishlistShare[]> {
    if (!userId) {
        // Defensive: callers MUST pass a userId. Calling without one
        // would skip the .eq() filter and return every share in the
        // table -- the privacy bug this whole param is here to
        // prevent. Throw loudly rather than silently leak.
        throw new Error('listMyShares requires a userId to scope the query to the owner.');
    }
    const { data, error } = await supabase
        .from('wishlist_shares')
        .select('share_id, owner_id, owner_name, items, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
    if (error) {
        throw new Error(error.message || 'Failed to load your shared wishlists.');
    }
    return (data ?? []) as WishlistShare[];
}

/**
 * Hard-delete a share by share_id. The RLS DELETE policy is
 * `USING (auth.uid() = owner_id)`, so:
 *   - Deleting a share owned by the current user: 1 row removed, no
 *     error returned.
 *   - Deleting a share owned by someone else: 0 rows removed, NO error
 *     returned (Supabase returns success because the WHERE filter
 *     silently matched nothing). This is the RLS-correct behavior.
 *   - Deleting a shareId that doesn't exist: 0 rows removed, NO error
 *     returned. Idempotent.
 *
 * Throws on network errors only. The caller should treat a successful
 * return as "the share is gone or wasn't yours to delete" -- the
 * happy-path UI is the same in both cases (refetch the list, the row
 * will be missing either way).
 */
export async function deleteShare(shareId: string): Promise<void> {
    const { error } = await supabase
        .from('wishlist_shares')
        .delete()
        .eq('share_id', shareId);
    if (error) {
        throw new Error(error.message || 'Failed to delete share.');
    }
}
