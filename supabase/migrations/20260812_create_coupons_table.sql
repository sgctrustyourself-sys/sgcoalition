-- coupons + drop_vouchers FK (2026-08-12)
--
-- The admin `CouponManager` and `TrustCircleManager` write coupons
-- client-side via Supabase, but production never had a `coupons` table —
-- CouponManager showed "Failed to load coupons" and drop vouchers were
-- issued with no referential target. This migration:
--
--   1. Creates `coupons` matching the exact CouponManager contract:
--        code, discount_type (percent|fixed), discount_value,
--        min_order_value, max_uses, used_count, start_date, end_date,
--        is_active, created_at
--   2. Wires `drop_vouchers.coupon_code` to `coupons(code)` so every
--      Trust Circle drop voucher references a real coupon row.
--
-- SAFE to run twice (IF NOT EXISTS guarded where Postgres allows it).
--
-- NOTE: checkout's `validateCouponCode` validates against `referral_stats`
-- (referral codes), NOT this table — `coupons` is the admin-side coupon
-- ledger + drop-voucher registry. Redemption wiring is future work.

CREATE TABLE IF NOT EXISTS public.coupons (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT         NOT NULL UNIQUE,
    discount_type   TEXT         NOT NULL DEFAULT 'percent'
        CHECK (discount_type IN ('percent', 'fixed')),
    discount_value  NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_uses        INTEGER,
    used_count      INTEGER      NOT NULL DEFAULT 0,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Lax posture consistent with the codebase (admin UI writes client-side
-- with the anon key — cf. custom_inquiries, trust_circle_applications
-- "System can read all applications"). Harden later by moving admin
-- writes behind a SECURITY DEFINER RPC if this ships to untrusted admins.
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons public read" ON public.coupons;
CREATE POLICY "coupons public read"
    ON public.coupons FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "coupons client insert" ON public.coupons;
CREATE POLICY "coupons client insert"
    ON public.coupons FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "coupons client update" ON public.coupons;
CREATE POLICY "coupons client update"
    ON public.coupons FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "coupons client delete" ON public.coupons;
CREATE POLICY "coupons client delete"
    ON public.coupons FOR DELETE
    USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO anon, authenticated;

-- Wire drop_vouchers to real coupons (0 rows exist today, so the FK add
-- cannot orphan anything). Postgres has no ADD CONSTRAINT IF NOT EXISTS,
-- so guard with a DO block to keep the migration re-runnable.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.drop_vouchers'::regclass
          AND conname  = 'drop_vouchers_coupon_code_fkey'
    ) THEN
        ALTER TABLE public.drop_vouchers
            ADD CONSTRAINT drop_vouchers_coupon_code_fkey
            FOREIGN KEY (coupon_code) REFERENCES public.coupons(code);
    END IF;
END $$;
