-- =============================================================================
-- supabase/migrations/20260630_add_image_roles_to_products.sql
-- -----------------------------------------------------------------------------
-- Adds the `image_roles` JSONB column to public.products so admin can explicitly
-- assign Primary / Hover / Gallery roles per image instead of relying on the
-- implicit position-based default (images[0] = primary, images[1] = hover,
-- images[2..n] = gallery). Stored as URL strings (NOT indices) so admin
-- reorders / deletes don't silently corrupt the role assignment.
--
-- Companion UI: components/admin/ProductManager.tsx + the per-image star/eye/G
-- toolbar on each tile. Read path: utils/productImage.getProductRoles.
--
-- ROLLOUT
--   1. Apply this SQL in Supabase SQL Editor (idempotent on second run).
--   2. Existing rows are untouched — getProductRoles() falls back to the
--      position-based default in TypeScript so legacy products still render.
--   3. New / edited products will read+write image_roles normally.
-- =============================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS image_roles JSONB;

-- A simple JSONB-shape sanity check. image_roles is nullable so missing
-- values are fine. When present, both primaryUrl and hoverUrl should be
-- strings (or hoverUrl===null for "no hover"); URL values outside `images`
-- are silently repaired by the client-side reconcileImageRoles helper.
COMMENT ON COLUMN public.products.image_roles IS
    'Per-product image-role mapping. Shape: { primaryUrl?: string, hoverUrl?: string|null, galleryUrls?: string[] }. See utils/productImage.getProductRoles.';
