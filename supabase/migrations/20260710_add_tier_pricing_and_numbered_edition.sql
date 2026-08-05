-- ============================================================================
-- 20260710_add_tier_pricing_and_numbered_edition.sql
-- ----------------------------------------------------------------------------
-- Adds edition_size and pricing_tiers columns to the products table.
-- ============================================================================

ALTER TABLE IF EXISTS public.products
    ADD COLUMN IF NOT EXISTS edition_size INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.products.edition_size IS
    'When set to a positive integer, this product is a numbered edition. NULL means not a numbered edition.';

ALTER TABLE IF EXISTS public.products
    ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT NULL;

COMMENT ON COLUMN public.products.pricing_tiers IS
    'JSONB array of { untilCount: number|null, price: number } for tiered pricing. NULL or empty = flat pricing.';
