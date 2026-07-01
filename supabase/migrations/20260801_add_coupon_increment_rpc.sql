-- Migration: Atomic coupon usage counter
-- Run this in your Supabase SQL Editor.
--
-- We add an atomic RPC that lets the api handlers bump coupons.used_count
-- without doing a read-modify-write in app code (which would race under
-- PayPal + card flow concurrency). Nullable `updated_at` defensively added
-- because CouponManager UI didn't read it but the RPC sets it; idempotent
-- so the migration is safe to re-run.

ALTER TABLE IF EXISTS public.coupons
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_code TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    UPDATE public.coupons
    SET used_count = used_count + 1,
        updated_at = NOW()
    WHERE code = p_code
      AND is_active = true
      AND (max_uses IS NULL OR used_count < max_uses)
    RETURNING used_count INTO v_new_count;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.increment_coupon_usage(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(TEXT) TO service_role;

DO $$
BEGIN
    RAISE NOTICE 'Coupon increment RPC ready';
END $$;
