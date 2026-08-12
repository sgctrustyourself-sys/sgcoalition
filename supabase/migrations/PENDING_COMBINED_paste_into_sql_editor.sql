-- ============================================================================
-- COALITION — PENDING MIGRATIONS (combined, paste into Supabase SQL Editor)
-- Generated from the two source migration files — do NOT hand-edit.
--   1. supabase/migrations/20260804_create_payment_settings.sql
--   2. supabase/migrations/20260806_trusted_few_partner_program.sql
-- Idempotent (IF NOT EXISTS / ON CONFLICT guarded). Safe to run twice.
-- ============================================================================

-- uuid-ossp must exist for uuid_generate_v4() (used by the new tables).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MIGRATION 1: payment_settings (20260804)
-- ============================================================================
-- =========================================================================
--  payment_settings (phase 1 — table + RLS + seed)
--
--  Single-row singleton table holding which payment options are shown to
--  customers at checkout. The shop owner flips these live from the admin
--  Command Center (PaymentOptionsCard) — no redeploy, no code change.
--
--  Flags:
--    * card_enabled    — Stripe card payments (primary checkout path)
--    * paypal_enabled  — PayPal wallet / Apple Pay / Pay in 4
--    * klarna_enabled  — Klarna Pay in 4 (secondary, behind 'More payment
--                        options' in the checkout)
--    * cashapp_enabled — Cash App manual payment to $sgcoalition (secondary)
--    * crypto_enabled  — USDC on Polygon (secondary)
--
--  Why a table not an env var? The owner needs to flip options without a
--  Vercel redeploy, and both the serverless handlers (create-payment-intent,
--  paypal-order) and the checkout client must agree on the same source of
--  truth. A singleton row read with the service-role client is that source.
--
--  Failure semantics: services/paymentSettings.loadPaymentSettings() treats
--  ANY read failure (table missing, migration not applied, transient DB
--  error) as ALL-ENABLED, so a settings outage can never silently lock
--  customers out of checkout.
--
--  Access:
--    anon + authenticated get SELECT (the checkout needs it).
--    Writes go through the admin-only /api/payment-settings handler using
--    SUPABASE_SERVICE_ROLE_KEY — no public mutation RPC.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.payment_settings (
    id              int         PRIMARY KEY DEFAULT 1,
    card_enabled    boolean     NOT NULL DEFAULT true,
    paypal_enabled  boolean     NOT NULL DEFAULT true,
    klarna_enabled  boolean     NOT NULL DEFAULT true,
    cashapp_enabled boolean     NOT NULL DEFAULT true,
    crypto_enabled  boolean     NOT NULL DEFAULT true,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payment_settings_singleton CHECK (id = 1)
);

-- Additive for environments where the phase-1 table already exists without
-- the cashapp flag (20260804 phase 1 shipped card/paypal/klarna/crypto only).
ALTER TABLE public.payment_settings
    ADD COLUMN IF NOT EXISTS cashapp_enabled boolean NOT NULL DEFAULT true;

-- Idempotent singleton-seed — first run inserts the all-enabled default,
-- every subsequent run is a no-op.
INSERT INTO public.payment_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_settings public read" ON public.payment_settings;
CREATE POLICY "payment_settings public read"
    ON public.payment_settings
    FOR SELECT
    USING (true);

GRANT SELECT ON public.payment_settings TO anon, authenticated;

-- ============================================================================
-- MIGRATION 2: Trusted Few / Trust Circle (20260806)
-- ============================================================================
-- The Trusted Few / Trust Circle partner program -- additive migration
--
-- Extends the existing referral engine:
--   * referral_stats gains tier columns (partner_tier, flat-rate override,
--     invite/member timestamps)
--   * trust_circle_applications holds the brand-voice application flow
--   * drop_vouchers is the operator ledger for per-drop 100%-off vouchers
--   * track_referral_event is re-created with a Trust Circle branch so the
--     tier ladder never clobbers the flat 20% rate
--
-- SAFE to run twice -- every change is IF NOT EXISTS guarded.

-- ---------------------------------------------------------------------------
-- 1. referral_stats tier columns
-- ---------------------------------------------------------------------------
ALTER TABLE referral_stats
    ADD COLUMN IF NOT EXISTS partner_tier TEXT NOT NULL DEFAULT 'trusted_few'
        CHECK (partner_tier IN ('trusted_few', 'trust_circle')),
    ADD COLUMN IF NOT EXISTS trust_circle_commission_rate NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS circle_member_since TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. trust_circle_applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trust_circle_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'declined')),
    why_join TEXT NOT NULL,
    what_you_create TEXT NOT NULL,
    platforms TEXT[] NOT NULL DEFAULT '{}',
    handles JSONB NOT NULL DEFAULT '{}',
    audience_size TEXT,
    portfolio_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    review_note TEXT
);

-- One pending application per user (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS trust_circle_applications_one_pending
    ON trust_circle_applications (user_id)
    WHERE status = 'pending';

ALTER TABLE trust_circle_applications ENABLE ROW LEVEL SECURITY;

-- User reads/writes only their own application.
DROP POLICY IF EXISTS "Users can view own applications" ON trust_circle_applications;
CREATE POLICY "Users can view own applications"
    ON trust_circle_applications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own applications" ON trust_circle_applications;
CREATE POLICY "Users can create own applications"
    ON trust_circle_applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admin dashboard reads all applications client-side (wallet-gated UI),
-- matching the codebase's established lax posture (cf. custom_inquiries,
-- referral_stats "System can manage stats"). Hardening note: move review
-- writes behind a SECURITY DEFINER RPC if this ever ships to untrusted admins.
DROP POLICY IF EXISTS "System can read all applications" ON trust_circle_applications;
CREATE POLICY "System can read all applications"
    ON trust_circle_applications FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "System can review applications" ON trust_circle_applications;
CREATE POLICY "System can review applications"
    ON trust_circle_applications FOR UPDATE
    USING (true);

-- ---------------------------------------------------------------------------
-- 3. drop_vouchers (operator ledger for free drops)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drop_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coupon_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued'
        CHECK (status IN ('issued', 'redeemed', 'expired')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE drop_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read drop vouchers" ON drop_vouchers;
CREATE POLICY "Anyone can read drop vouchers"
    ON drop_vouchers FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "System can manage drop vouchers" ON drop_vouchers;
CREATE POLICY "System can manage drop vouchers"
    ON drop_vouchers FOR ALL
    USING (true);

-- ---------------------------------------------------------------------------
-- 4. Hardened track_referral_event with Trust Circle flat-rate override
--    (full re-creation of the v2 body + trust_circle branch)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_referral_event(
    p_referral_code VARCHAR(20),
    p_event_type    VARCHAR(20),
    p_user_id       UUID         DEFAULT NULL,
    p_visitor_ip    VARCHAR(45)  DEFAULT NULL,
    p_user_agent    TEXT         DEFAULT NULL,
    p_referrer_url  TEXT         DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_referrer_id            UUID;
    v_total_clicks           INTEGER;
    v_total_views            INTEGER;
    v_successful_referrals   INTEGER;
    v_conversion_rate        DECIMAL(5,2);
    v_new_tier               INTEGER;
    v_new_rate               DECIMAL(5,2);
BEGIN
    SELECT user_id INTO v_referrer_id
    FROM referral_stats
    WHERE referral_code = p_referral_code;

    IF v_referrer_id IS NULL THEN
        RETURN;
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id = v_referrer_id THEN
        RETURN;
    END IF;

    INSERT INTO referral_analytics (
        referral_code, referrer_id, event_type,
        visitor_ip, user_agent, referrer_url
    ) VALUES (
        p_referral_code, v_referrer_id, p_event_type,
        p_visitor_ip, p_user_agent, p_referrer_url
    );

    UPDATE referral_stats
    SET last_referral_ip       = COALESCE(p_visitor_ip, last_referral_ip),
        last_referral_event_at = NOW()
    WHERE user_id = v_referrer_id;

    CASE p_event_type
        WHEN 'click' THEN
            UPDATE referral_stats SET total_clicks = total_clicks + 1 WHERE user_id = v_referrer_id;
        WHEN 'view' THEN
            UPDATE referral_stats SET total_views = total_views + 1 WHERE user_id = v_referrer_id;
        WHEN 'signup' THEN
            UPDATE referral_stats SET total_referrals = total_referrals + 1 WHERE user_id = v_referrer_id;
        WHEN 'purchase' THEN
            UPDATE referral_stats SET successful_referrals = successful_referrals + 1 WHERE user_id = v_referrer_id;

            UPDATE referral_analytics
            SET converted_to_sale = TRUE
            WHERE referral_code = p_referral_code
              AND event_type = 'signup'
              AND created_at = (
                  SELECT MAX(created_at)
                  FROM referral_analytics
                  WHERE referral_code = p_referral_code
                    AND event_type = 'signup'
              );
    END CASE;

    SELECT total_clicks, total_views, successful_referrals
      INTO v_total_clicks, v_total_views, v_successful_referrals
    FROM referral_stats
    WHERE user_id = v_referrer_id;

    IF v_total_clicks > 0 THEN
        v_conversion_rate := (v_successful_referrals::DECIMAL / v_total_clicks::DECIMAL) * 100;
    ELSE
        v_conversion_rate := 0.00;
    END IF;

    -- Trust Circle: keep the flat rate; the tier ladder must not clobber it.
    IF (SELECT partner_tier FROM referral_stats WHERE user_id = v_referrer_id) = 'trust_circle' THEN
        UPDATE referral_stats
        SET conversion_rate = v_conversion_rate
        WHERE user_id = v_referrer_id;
    ELSE
        CASE
            WHEN v_successful_referrals >= 100 THEN v_new_tier := 8; v_new_rate := 40.00;
            WHEN v_successful_referrals >=  50 THEN v_new_tier := 7; v_new_rate := 35.00;
            WHEN v_successful_referrals >=  30 THEN v_new_tier := 6; v_new_rate := 30.00;
            WHEN v_successful_referrals >=  15 THEN v_new_tier := 5; v_new_rate := 25.00;
            WHEN v_successful_referrals >=   7 THEN v_new_tier := 4; v_new_rate := 20.00;
            WHEN v_successful_referrals >=   3 THEN v_new_tier := 3; v_new_rate := 15.00;
            WHEN v_successful_referrals >=   1 THEN v_new_tier := 2; v_new_rate := 10.00;
            ELSE v_new_tier := 1; v_new_rate := 5.00;
        END CASE;

        UPDATE referral_stats
        SET conversion_rate         = v_conversion_rate,
            current_tier            = v_new_tier,
            current_commission_rate = v_new_rate
        WHERE user_id = v_referrer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION track_referral_event(VARCHAR, VARCHAR, UUID, VARCHAR, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION track_referral_event(VARCHAR, VARCHAR, UUID, VARCHAR, TEXT, TEXT) TO anon;

DO $sgcoalition_notice$
BEGIN
    RAISE NOTICE 'Trusted Few migration complete';
END $sgcoalition_notice$;

SELECT
    'referral_stats tier cols' AS what,
    count(*) FILTER (WHERE column_name IN ('partner_tier','trust_circle_commission_rate','invited_at','circle_member_since'))::int AS n
FROM information_schema.columns
WHERE table_name = 'referral_stats'
UNION ALL SELECT
    'trust_circle_applications',
    count(*)::int
FROM trust_circle_applications
UNION ALL SELECT
    'drop_vouchers',
    count(*)::int
FROM drop_vouchers
UNION ALL SELECT
    'trust_circle RPC branch',
    count(*) FILTER (WHERE proname = 'track_referral_event')::int
FROM pg_proc
WHERE proname = 'track_referral_event';
