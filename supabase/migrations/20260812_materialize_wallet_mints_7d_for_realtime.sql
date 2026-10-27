-- =========================================================================
--  wallet_mints_7d — realtime publication (materialized table, not view)
--
--  WHY THIS FILE EXISTS: the original plan (20260721_publish_wallet_mints_7d_
--  for_realtime.sql) tried to add the wallet_mints_7d VIEW to the
--  supabase_realtime publication. Postgres rejects that on every version:
--      ERROR 22023: cannot add relation "wallet_mints_7d" to publication
--      DETAIL: This operation is not supported for views.
--  Realtime can only publish base tables. This migration replaces the
--  view-backed approach with a materialized singleton TABLE maintained by a
--  trigger on orders — so realtime pushes a clean count delta to the React
--  client (~200-700ms after a PAID order webhook lands), which is the
--  original intent.
--
--  Shape compatibility: the app reads `select mint_count from wallet_mints_7d`
--  (see context/useWallets.ts). A singleton table with id=1 provides exactly
--  that. The trigger recomputes the same SUM(quantity) aggregate the view
--  computed, restricted to PAID orders in the last 7 days for wallet-category
--  products.
--
--  Idempotent: DROP VIEW IF EXISTS, CREATE TABLE IF NOT EXISTS,
--  CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS, and a DO/EXCEPTION
--  wrapper on the publication add.
-- =========================================================================

-- Replace the view with a table of the same name (drop first; a table and a
-- view cannot share a name in the same schema).
DROP VIEW IF EXISTS public.wallet_mints_7d;

CREATE TABLE IF NOT EXISTS public.wallet_mints_7d (
    id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    mint_count  bigint NOT NULL DEFAULT 0,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed with the current aggregate so the first realtime push (and any read
-- before the first order change) shows the true number.
INSERT INTO public.wallet_mints_7d (id, mint_count)
SELECT 1,
       COALESCE(SUM((item->>'quantity')::bigint), 0)::bigint
FROM public.orders o
CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
JOIN public.products p
    ON p.id = (item->>'productId')
WHERE o.payment_status = 'paid'
  AND o.created_at >= (NOW() - INTERVAL '7 days')
  AND p.category = 'wallet'
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read (the count is non-sensitive — it is already exposed
-- via the public /orders feed). Only the trigger (SECURITY DEFINER-ish via
-- the table owner) writes.
ALTER TABLE public.wallet_mints_7d ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_mints_7d public read" ON public.wallet_mints_7d;
CREATE POLICY "wallet_mints_7d public read"
    ON public.wallet_mints_7d
    FOR SELECT
    USING (true);

GRANT SELECT ON public.wallet_mints_7d TO anon, authenticated;

-- Recompute the count whenever orders change (INSERT paid order, UPDATE
-- payment_status -> paid, DELETE). Statement-level so a bulk change costs
-- one recompute.
CREATE OR REPLACE FUNCTION public.refresh_wallet_mints_7d()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_count bigint;
BEGIN
    SELECT COALESCE(SUM((item->>'quantity')::bigint), 0)::bigint
      INTO v_count
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
    JOIN public.products p
        ON p.id = (item->>'productId')
    WHERE o.payment_status = 'paid'
      AND o.created_at >= (NOW() - INTERVAL '7 days')
      AND p.category = 'wallet';

    INSERT INTO public.wallet_mints_7d (id, mint_count, updated_at)
    VALUES (1, v_count, now())
    ON CONFLICT (id)
    DO UPDATE SET mint_count = EXCLUDED.mint_count, updated_at = now();

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_mints_7d_refresh ON public.orders;
CREATE TRIGGER trg_wallet_mints_7d_refresh
    AFTER INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.refresh_wallet_mints_7d();

-- Publish the TABLE (tables are publishable; views are not). DO/EXCEPTION
-- swallows duplicate_object so re-runs are a no-op.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_mints_7d;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'wallet_mints_7d already in supabase_realtime publication (no-op)';
END $$;
