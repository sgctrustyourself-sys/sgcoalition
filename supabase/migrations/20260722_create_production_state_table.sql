-- =========================================================================
--  production_state (phase 1 — table + RLS + seed)
--
--  Single-row singleton table exposing the current shop-floor status:
--    * which workshop is producing (currently_being_built_label)
--    * when the previous SKU dropped (last_drop_at timestamptz in UTC)
--    * what's on the floor right now (on_deck_label + cylinder progress)
--
--  Replaces the 'X wallets minted this week' count on Home + Wallets with
--  the producing-floor pacing — same honesty register, more proof texture
--  (visitors see how fast the floor is moving, not just how fast the
--  consumption is).
--
--  Why a table not a view?
--    * The cylinder-current field is hand-maintained by the shop owner
--      (advanced when a cylinder is finished). Views can't expose mutable
--      state without a backing table.
--    * Singleton enforcement via CONSTRAINT production_state_singleton
--      CHECK (id = 1) prevents accidental duplicate rows.
--    * last_drop_at is timestamptz so the visitor sees a literal ISO 8601
--      timestamp (the user's exact ask).
--
--  Realtime:
--    Added to supabase_realtime in the companion publication migration:
--    supabase/migrations/20260722_publish_production_state_for_realtime.sql.
--
--  Access:
--    anon + authenticated both get SELECT. The state is public — the
--    workshop name, last-drop timestamp, and cylinder progress are exactly
--    the kind of social proof that builds buyer trust.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.production_state (
    id                              int PRIMARY KEY DEFAULT 1,
    currently_being_built_label     text           NOT NULL,
    last_drop_at                    timestamptz    NOT NULL,
    last_drop_sku_label             text           NOT NULL,
    on_deck_label                   text           NOT NULL,
    on_deck_cylinder_current        int            NOT NULL CHECK (on_deck_cylinder_current >= 0),
    on_deck_cylinder_total          int            NOT NULL CHECK (on_deck_cylinder_total   >  0),
    updated_at                      timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT production_state_singleton CHECK (id = 1)
);

-- Idempotent singleton-seed via ON CONFLICT (key) — first run inserts the
-- illustrative starter values, every subsequent run is a no-op.
INSERT INTO public.production_state (
    id,
    currently_being_built_label,
    last_drop_at,
    last_drop_sku_label,
    on_deck_label,
    on_deck_cylinder_current,
    on_deck_cylinder_total
) VALUES (
    1,
    'North Yard Stitching',
    '2026-07-19T14:32:00Z',
    'Coalition Parts Wallet 1/4',
    'Coalition Parts Wallet 2/4',
    14,
    30
) ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read; only service_role (or the shop owner's manual UPDATE
-- via Supabase Studio) can mutate. We don't expose a public mutation RPC.
ALTER TABLE public.production_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "production_state public read" ON public.production_state;
CREATE POLICY "production_state public read"
    ON public.production_state
    FOR SELECT
    USING (true);

GRANT SELECT ON public.production_state TO anon, authenticated;
