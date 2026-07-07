-- ============================================================================
-- 20260704_add_discount_percent_to_products.sql
-- ----------------------------------------------------------------------------
-- Adds a discount_percent column to the products table so Supabase-sourced
-- products can carry an automatic, always-on discount that displays as
-- strikethrough "$40 -> $20" in the storefront, without needing a coupon
-- code or an admin interaction at checkout.
--
-- Before this migration:
--   - The frontend Product type did NOT have a discountPercent field.
--   - The schema column was missing.
--   - services/retryQueue.ts -> mapProductToDb did not write a discount.
--   - scripts/addSharkTee.ts forced price: 60.0 with no discount path.
--   - pages/Checkout.tsx had no notion of per-product discount math.
--
-- After this migration:
--   - constants.ts + admin form + scripts can ship discountPercent: 50
--     on Coalition Shark Tee (prod_1773860269374) and it round-trips.
--   - pages/ProductDetails.tsx renders strike-through + sale price + badge.
--   - pages/Checkout.tsx evaluates max(productDiscountSum, couponDiscount)
--     so a Shark Tee discount on a $40 product ($20 off) does NOT stack
--     with a 10% BADDIES-style coupon on the same cart (only the larger
--     of the two wins). The order of operations is: gross subtotal minus
--     set bonus = base; productDiscount applied to product lines, then
--     the bigger of productDiscountSum vs couponDiscount keeps the base;
--     SGCoin payment-method discount applies on top of the smaller
--     remaining base.
--   - Existing rows default to 0 so they're unaffected without backfill.
-- ============================================================================

ALTER TABLE IF EXISTS public.products
    ADD COLUMN IF NOT EXISTS discount_percent NUMERIC NOT NULL DEFAULT 0;

-- Defensive CHECK so a future write of 99.9999 or -10 cannot silently
-- undermine the math. The 0-100 bound matches the helper signature in
-- utils/productDiscount.ts.
DO $BODY$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND constraint_name = 'products_discount_percent_range'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_discount_percent_range
            CHECK (discount_percent >= 0 AND discount_percent <= 100);
    END IF;
END
$BODY$;

COMMENT ON COLUMN public.products.discount_percent IS
    'Auto-discount percentage (0-100) applied to the product price. No-stack rule: at checkout, max(sum_of_product_discounts, cart_wide_coupon_discount) is honored; the smaller of the two is dropped. Shark Tee (prod_1773860269374) uses 50 with base price 40 -> $20 final. Mirrors the frontend Product.discountPercent field. Defaults to 0 so existing rows are unaffected.';
