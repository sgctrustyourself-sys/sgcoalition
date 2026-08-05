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
    crypto_enabled  boolean     NOT NULL DEFAULT true,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payment_settings_singleton CHECK (id = 1)
);

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
