-- ============================================================================
-- 20260620_add_is_limited_edition_to_products.sql
-- ----------------------------------------------------------------------------
-- Adds an is_limited_edition column to the products table so Supabase-sourced
-- drops render the Limited Edition badge in the storefront, not just the
-- products seeded from INITIAL_PRODUCTS in constants.ts.
--
-- Before this migration:
--   - The frontend Product type already had `isLimitedEdition?: boolean`
--   - The schema column was missing
--   - services/retryQueue.ts -> mapProductToDb did not write it
--   - scripts/syncProducts.ts did not read it back
--   - components/ProductCard.tsx renders the badge from product.isLimitedEdition
--
-- Result: any product added via admin ProductManager or seeded via
-- scripts/add*Wallet.ts silently lost its Limited Edition badge in production.
--
-- This migration closes the round-trip:
--   Admin / scripts writes  -> is_limited_edition
--   store reads (SELECT *)  -> Product.isLimitedEdition
--   syncProducts.ts sync   -> INITIAL_PRODUCTS in constants.ts
-- ============================================================================

ALTER TABLE IF EXISTS public.products
    ADD COLUMN IF NOT EXISTS is_limited_edition BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.products.is_limited_edition IS
    'When true, render the Limited Edition badge on the storefront product card. Mirrors the frontend Product.isLimitedEdition field. Defaults to FALSE so existing rows are unaffected.';
