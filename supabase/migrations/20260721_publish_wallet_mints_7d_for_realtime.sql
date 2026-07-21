-- =========================================================================
--  wallet_mints_7d (phase 2 — realtime publication)
--
--  Adds the view to the Supabase Realtime publication so the React client
--  gets pushed updates within ~200-700ms of a PAID order webhook landing.
--
--  DO/EXCEPTION makes ADD-ing an already-published relation a no-op so
--  this migration is fully idempotent. Required errcode is 42710
--  (duplicate_object).
--
--  IMPORTANT — connection requirement:
--    `ALTER PUBLICATION ... ADD TABLE` requires a DIRECT Postgres session,
--    not a pooled connection (port 5432 / 6543 from the Supabase pooler
--    reject session-level ops). The runner splits this off so the view
--    itself can still be applied via pooler for fast iteration.
-- =========================================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_mints_7d;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'wallet_mints_7d already in supabase_realtime publication (no-op)';
END $$;
