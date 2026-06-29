-- =============================================================================
-- supabase/migrations/20260701_add_archive_note_to_products.sql
-- -----------------------------------------------------------------------------
-- Adds the `archive_note` TEXT column to public.products so the operator-authored
-- story shown beneath the buy button on sold/archived PDPs lives in the DB
-- alongside the rest of the catalog. Previously sourced from
-- constants.ts PRODUCT_LOCAL_OVERRIDES (constants.ts:375) which made it a hidden
-- local-only override that admins had to grep through code to change.
--
-- Companion UI: components/admin/ProductManager.tsx Founder's Note field on
-- archived PDPs is sourced through context/AppContext.tsx mapper ->
-- `archiveNote: item.archive_note ?? PRODUCT_LOCAL_OVERRIDES[item.id]?.archiveNote`.
--
-- ROLLOUT
--   1. Apply this SQL in Supabase SQL Editor (idempotent on second run).
--   2. Existing rows stay NULL — PDP renders nothing in the archive-note block
--      for those products unless PRODUCT_LOCAL_OVERRIDES still wins for the id.
--      Migration of legacy override text into the column is a one-time bulk
--      script in scripts/backfillArchiveNote.cjs (deferred; not required to
--      land this schema column).
--   3. AppContext.addProduct/updateProduct now write archive_note normally so
--      new / edited copy lands in the DB. The local-override fallback stays
--      in place for any constant still pinned to a specific id.
-- =============================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS archive_note TEXT;

-- The archive-note block is rendered on archived / sold PDPs only. No
-- NOT-NULL or default needed; NULL means "no founder note copy yet" which is
-- the same behavior the storefront had before this column existed (the old
-- PRODUCT_LOCAL_OVERRIDES simply didn't set anything for most ids).
COMMENT ON COLUMN public.products.archive_note IS
    'Operator-authored copy shown beneath the buy button on sold/archived PDPs. Mirrors Product.archiveNote on the client. Backfilled from constants.ts PRODUCT_LOCAL_OVERRIDES where applicable.';
