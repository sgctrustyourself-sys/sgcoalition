-- ============================================================================
-- 20260704_add_instagram_username_to_orders.sql
-- ----------------------------------------------------------------------------
-- Mirrors the 20260702 orders.facebook_username column for Instagram handles.
-- Used by the offline-sale attribution flow (admin "attribute order to
-- Instagram" tool, future) and by scripts/upsertFriiqyWholesale.ts to stamp
-- the @friiqy handle on the wholesale + True Religion S1 deals (the same
-- buyer across both rows).
--
-- Idempotent - re-running is safe. Mirrors the ALTER + COMMENT pattern from
-- 20260702_add_customer_profile_rewards.sql.
--
-- Privacy contract (matches Recently Ordered Live Map):
--   * customer_email + instagram_username + facebook_username live only on
--     the orders row, never surfaced on the live map or admin view. The
--     live map only renders city + state.
-- ============================================================================

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS instagram_username TEXT;

COMMENT ON COLUMN public.orders.instagram_username IS
    'Instagram handle (without @) the maintainer attributed this order to. Mirrors orders.facebook_username (added 20260702); both are admin-attributed, never set by the customer. Used by the marketing-contacts reconciliation flow to join offline sales to the buyer''s Instagram account. Stamped by scripts/upsertFriiqyWholesale.ts for the @friiqy wholesale (2026-05-22) and the True Religion S1 jeans (2024-02-14).';

DO $$ BEGIN RAISE NOTICE 'orders.instagram_username ready'; END $$;
