-- 20261022_align_payment_settings_defaults.sql
--
-- Payment option accuracy: the code's documented default and the database's
-- column default disagreed about Klarna.
--
--   services/paymentSettings.ts  DEFAULT_PAYMENT_SETTINGS.klarna = false
--   components/admin/PaymentOptionsCard.tsx  DEFAULT_FLAGS.klarna = false
--   components/admin/PaymentOptionsCard.tsx  ROWS -> "Klarna … (currently OFF)"
--   supabase/migrations/20260804 …  klarna_enabled boolean NOT NULL DEFAULT true
--
-- The seeded singleton row therefore shipped with Klarna ENABLED, while every
-- reader in the app documented it as hidden. The owner can flip it live from
-- Admin -> Command Center -> Payment Options, and the toggle is wired to the
-- same row, so re-enabling it is one click.
--
-- The `whop` flag is the promoter/affiliate channel (a promoter sells on
-- Whop and earns their 30%; the buyer pays the normal price on that path).
-- It stays OFF by default and gates /api/create-whop-checkout-link — it is NOT
-- a site payment method and never replaces the Stripe checkout.

-- ---------------------------------------------------------------------------
-- Align the COLUMN default with the documented default.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.payment_settings
    ALTER COLUMN klarna_enabled SET DEFAULT false;

-- ---------------------------------------------------------------------------
-- Bring the live singleton row in line with the documented default.
-- Idempotent: re-running is a no-op once the value is already false.
-- ---------------------------------------------------------------------------
UPDATE public.payment_settings
SET klarna_enabled = false
WHERE id = 1 AND klarna_enabled IS DISTINCT FROM false;
