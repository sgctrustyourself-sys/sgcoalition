-- =========================================================================
--  production_state (phase 2 — realtime publication)
--
--  Adds the production_state singleton to the Supabase Realtime publication
--  so any UPDATE on it pushes to the React client within ~200-700ms.
--
--  ALTER PUBLICATION is session-level: pooler connections reject it, so
--  this migration is split out from phase 1 (the table create) so the
--  runner can apply the table via pooler first and the publication via
--  direct-only connection.
--
--  DO/EXCEPTION swallows duplicate_object so re-runs no-op (the table is
--  added once; subsequent runs see it's already in the publication).
-- =========================================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.production_state;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'production_state already in supabase_realtime publication (no-op)';
END $$;
