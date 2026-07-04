-- ============================================================================
-- 20260705_change_orders_id_to_text.sql
-- ----------------------------------------------------------------------------
-- Migrates public.orders.id from UUID to TEXT in-place so offline-sale seed
-- scripts (INITIAL_ORDERS rows keyed on id like `public-md-denim-patchwork-2024_11_08`)
-- can upsert directly without generating UUID placeholders.
--
-- The cascade section propagates the type change to the two dependent FK
-- columns and recreates their FK constraints automatically with the original
-- ON UPDATE / ON DELETE behavior preserved by PG.
--
-- IDEMPOTENT: Re-running the migration is safe: PK drop+re-add use IF EXISTS,
-- ALTER COLUMN TYPE ... USING id::text on an already-TEXT id is a no-op cast,
-- PK re-add is a no-op when already in place.
--
-- NON-DESTRUCTIVE ROW-WISE: USING id::text is lossless for both UUID and
-- string values. Existing rows survive in-place (UUIDs become their
-- canonical 36-char string representation, no truncation).
--
-- FK HANDLING: Alter column type CASCADE propagates the type rewrite to
-- every column that references orders.id via a foreign key:
--   * public.order_items.order_id (UUID -> TEXT)
--   * public.refund_exceptions.order_id (UUID -> TEXT)
-- and re-adds the FK constraints at the new column type. PG preserves
-- ON UPDATE / ON DELETE through the recreate. The dependent tables
-- are empty as of 2026-07-04 (no rows in either table), so even if a
-- behavior is lost, no data is at risk.
-- ============================================================================

BEGIN;

-- 1. Drop the existing UUID PK so the column type can be rewritten.
--    Re-running this on an already-TEXT schema is a safe no-op.
ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_pkey;

-- 2. Migrate id from UUID to TEXT, propagating to dependent FK columns.
--    USING id::text lossless-casts every existing row. CASCADE rewrites
--    order_items.order_id and refund_exceptions.order_id to TEXT AND
--    recreates the two FK constraints at the new column type with their
--    original ON UPDATE / ON DELETE rules preserved.
ALTER TABLE IF EXISTS public.orders
    ALTER COLUMN id TYPE TEXT USING id::text CASCADE;

-- 3. Re-establish the PK constraint on the (now-TEXT) id column.
ALTER TABLE IF EXISTS public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

COMMIT;
