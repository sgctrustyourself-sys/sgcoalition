-- =========================================================================
--  wallet_mints_7d (phase 1 — view + grant)
--
--  Single-row scalar view exposing the rolling 7-day count of wallet
--  line-items in PAID orders.
--
--  Why a view, not a query in AppContext?
--    * The counter was previously recomputed client-side in every useMemo
--      that read `useApp().orders` (Home hero, Wallets grid, etc.).
--      Switching to a server-side aggregate means:
--        - one tiny payload (1 row, 1 column) instead of streaming every
--          paid order's items[] array over the wire;
--        - truth lives in Postgres, not in two slightly-different JS
--          filters that could drift;
--        - realtime can subscribe to a single row and emit clean deltas.
--
--  Why SUM(quantity) not COUNT(*)?
--    Because OrderItem JSON can have `quantity > 1`. SUM is the honest
--    "how many wallets shipped" number, not "how many order lines".
--
--  Why is this file separate from the publication migration?
--    ALTER PUBLICATION requires a direct database session (not pooler).
--    Splitting into two files lets the runner apply the view+grant via
--    any connection (pooler or direct), and the publication via direct only.
--    See: 20260721_publish_wallet_mints_7d_for_realtime.sql
--
--  Access:
--    anon + authenticated both get SELECT. The view is non-sensitive
--    (only paid order line-items that are already public via /orders).
-- =========================================================================

CREATE OR REPLACE VIEW public.wallet_mints_7d AS
SELECT
    COALESCE(SUM((item->>'quantity')::bigint), 0)::bigint AS mint_count
FROM public.orders o
CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
JOIN public.products p
    ON p.id = (item->>'productId')
WHERE o.payment_status = 'paid'
    AND o.created_at >= (NOW() - INTERVAL '7 days')
    AND p.category = 'wallet';

GRANT SELECT ON public.wallet_mints_7d TO anon, authenticated;
