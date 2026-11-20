-- =========================================================================
--  crypto-verify (direct USDC-on-Polygon checkout)
--
--  payment_settings: the merchant's public receiving address + payment
--  window live alongside the crypto toggle, so the owner can rotate them
--  without a redeploy. Until set, the server falls back to the founder
--  wallet (the same address the checkout hardcodes today).
--
--  orders: per-order crypto verification markers. crypto_tx_hash is UNIQUE
--  so one on-chain payment can never confirm two orders (the handler also
--  checks payment_reference pre-migration, which covers environments where
--  this migration has not landed yet — the handler writes both).
--
--  All statements are additive + idempotent; RLS/policies are untouched.
--  Access: anon + authenticated keep SELECT on payment_settings (the
--  checkout reads the merchant address); order writes stay behind the
--  service-role /api/crypto-verify handler.
-- =========================================================================

-- Merchant crypto config on the singleton row.
ALTER TABLE public.payment_settings
    ADD COLUMN IF NOT EXISTS crypto_merchant_address text NOT NULL DEFAULT '';

ALTER TABLE public.payment_settings
    ADD COLUMN IF NOT EXISTS crypto_window_hours integer NOT NULL DEFAULT 24;

-- Optional override for the accepted USDC contract (defaults to native
-- USDC on Polygon in code when blank).
ALTER TABLE public.payment_settings
    ADD COLUMN IF NOT EXISTS crypto_usdc_contract text NOT NULL DEFAULT '';

-- Per-order verification markers.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS crypto_status text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS crypto_tx_hash text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS crypto_expected_usdc numeric;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS crypto_merchant_address text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS crypto_confirmed_amount text;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS crypto_confirmed_at timestamptz;

-- One payment confirms one order. IF NOT EXISTS keeps reruns safe.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_crypto_tx_hash_unique'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_crypto_tx_hash_unique UNIQUE (crypto_tx_hash);
    END IF;
END
$$;
