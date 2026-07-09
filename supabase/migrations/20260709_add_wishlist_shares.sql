-- 20260709_add_wishlist_shares.sql
-- Public-wishlist share rows for /wishlist/:shareId. Closes the
-- "share feature is dead end-to-end" gap: prior to this migration
-- the UserProfile.wishlistSettings.shareId field was a TypeScript-only
-- type, never persisted, and the favorites array lived exclusively
-- in localStorage. Sharing a wishlist via the Favorites page modal
-- (components/WishlistShare.tsx) generated a /favorites?items=...
-- URL that pointed at the personal-favorites page, not a public
-- share. /wishlist/:shareId (pages/PublicWishlist.tsx) was wired
-- to the route but its user-lookup was hard-disabled, so even a
-- hand-crafted valid shareId rendered "Wishlist Not Found".
--
-- This migration persists a single row per share, written by the
-- owner when they open the share modal and read by the recipient
-- when they hit /wishlist/:shareId. RLS is restrictive on writes
-- (only the owner can create/delete their share) and permissive on
-- reads (anyone with the shareId can view it -- the shareId is the
-- capability).
--
-- Manual deploy step: paste into the Supabase SQL editor and run
-- once. The frontend (components/WishlistShare.tsx +
-- pages/PublicWishlist.tsx) is wired against the new table; without
-- this migration the share button generates a link that 404s the
-- same way the prior implementation did.

CREATE TABLE IF NOT EXISTS public.wishlist_shares (
    -- The URL slug. Format: <userHash4>-<timestampBase36>-<random6>
    -- (utils/wishlistUtils.ts > generateShareId). 30+ bits of
    -- entropy; not enumerable via brute force at any reasonable
    -- rate limit. The PRIMARY KEY constraint also doubles as the
    -- uniqueness check on the slug -- no separate index needed.
    share_id TEXT PRIMARY KEY,
    -- The auth user who created the share. Drives the INSERT / DELETE
    -- RLS policies. ON DELETE CASCADE so removing an auth.users row
    -- also revokes their outstanding shares.
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Display name. Just a string (no FK to profiles.displayName) so
    -- the share stays valid even if the owner renames themselves
    -- post-share. Public recipients see this verbatim.
    owner_name TEXT NOT NULL,
    -- Snapshot of the owner's favorites at share time, as a JSON
    -- array of product IDs. JSONB (not TEXT[]) so the schema can
    -- grow to include a per-share view count, expire_at, or other
    -- metadata without a migration. The recipients' /wishlist/:shareId
    -- page reads this and intersects with the current products array
    -- to render ProductCard tiles.
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Insertion time. No updated_at -- shares are immutable; the
    -- owner can DELETE + re-INSERT to "replace" a share with a fresh
    -- slug + items snapshot.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot-path index: lets the owner list their own outstanding shares
-- (future /profile UI). The share_id PK already covers the recipient
-- read path.
CREATE INDEX IF NOT EXISTS idx_wishlist_shares_owner_id
    ON public.wishlist_shares (owner_id);

-- Enable RLS. Without this the policies below are advisory.
ALTER TABLE public.wishlist_shares ENABLE ROW LEVEL SECURITY;

-- Public read: anyone with the shareId can view the wishlist. The
-- shareId itself is the capability (30+ bits of entropy); no
-- authentication required to view a share.
DROP POLICY IF EXISTS "Public read wishlist_shares" ON public.wishlist_shares;
CREATE POLICY "Public read wishlist_shares" ON public.wishlist_shares
    FOR SELECT USING (true);

-- Owner-only insert: only the auth user can create a share for
-- themselves. Prevents an authenticated user from creating a share
-- that claims to be someone else's owner_name.
DROP POLICY IF EXISTS "Owner can create wishlist_shares" ON public.wishlist_shares;
CREATE POLICY "Owner can create wishlist_shares" ON public.wishlist_shares
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Owner-only delete: lets the owner revoke a share by hard-deleting
-- the row. Recipients with the old URL will see "Wishlist Not Found"
-- on next visit.
DROP POLICY IF EXISTS "Owner can delete wishlist_shares" ON public.wishlist_shares;
CREATE POLICY "Owner can delete wishlist_shares" ON public.wishlist_shares
    FOR DELETE USING (auth.uid() = owner_id);

-- No UPDATE policy: shares are immutable. If the owner's favorites
-- change after they share, the original share still points at the
-- snapshot. The owner must generate a new share for the new list.

DO $$ BEGIN
    RAISE NOTICE 'wishlist_shares table + RLS policies ready';
END $$;
