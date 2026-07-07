-- ============================================================================
-- 20260702_add_customer_profile_rewards.sql
-- ----------------------------------------------------------------------------
-- Customer-profile feature in three layers:
--   1. profiles     : wallet-link timestamp + lifetime rollups + admin notes
--   2. social_accounts.platform : widened CHECK to allow 'facebook'
--   3. orders       : facebook_username attribution column
--   4. customer_reward_credits : audit log for admin-issued SGCoin credits
--
-- This migration is idempotent — every ALTER uses IF NOT EXISTS, every CREATE
-- uses IF NOT EXISTS, every CHECK DROP/ADD is guarded so re-running is safe.
--
-- Privacy contract (matches Recently Ordered Live Map):
--   * customer_email lives only on the orders row, never surfaced on the live
--     map or admin view. The admin attribution tool writes back the FB username
--     the maintainer supplies at record-link time.
--   * profiles.customer_notes is admin-only via RLS below.
-- ============================================================================

-- 1. profiles columns ------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS wallet_linked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lifetime_spend_usd NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lifetime_orders INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reward_credit_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_reward_credit_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS customer_notes TEXT;

COMMENT ON COLUMN public.profiles.wallet_linked_at IS
    'First-time wallet link timestamp. Stamped by the connectMetaMaskWallet path once per profile (NULL -> first non-null write). Lets the admin CustomerProfileAdmin view surface "wallet linked X days ago".';
COMMENT ON COLUMN public.profiles.lifetime_spend_usd IS
    'Sum of orders.total across PAID orders for this profile, refreshed by service-role handlers on paid-order insertion. UI reads it for the lifetime-value card.';
COMMENT ON COLUMN public.profiles.lifetime_orders IS
    'Count of PAID orders for this profile. Paired with lifetime_spend_usd for the admin "purchases over time" rollup.';
COMMENT ON COLUMN public.profiles.last_reward_credit_at IS
    'Timestamp of the most recent admin SGCoin credit (customer_reward_credits row). Lets the admin UI show "last bonus" without scanning the audit table client-side.';
COMMENT ON COLUMN public.profiles.last_reward_credit_amount IS
    'SGC amount of the most recent reward credit. Paired with last_reward_credit_at.';
COMMENT ON COLUMN public.profiles.customer_notes IS
    'Private admin-only notes about this customer (e.g. "Starrboii067 — Facebook attribution 2026-07-02"). RLS gates read/write to admin_users only.';

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
    FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update customer_notes" ON public.profiles;
CREATE POLICY "Admins can update customer_notes" ON public.profiles
    FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
              WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- 2. social_accounts.platform CHECK widened --------------------------------
ALTER TABLE IF EXISTS public.social_accounts
    DROP CONSTRAINT IF EXISTS social_accounts_platform_check;

ALTER TABLE IF EXISTS public.social_accounts
    ADD CONSTRAINT social_accounts_platform_check
    CHECK (platform IN ('instagram', 'twitter', 'tiktok', 'facebook'));

-- 3. orders.facebook_username ---------------------------------------------
ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS facebook_username TEXT;

COMMENT ON COLUMN public.orders.facebook_username IS
    'Facebook handle (without @) the maintainer attributed this order to. Written via the admin "attribute order to Facebook" tool, never by the customer. Pairs with orders.customer_email so the admin can locate the live Supabase row to write back into.';

-- 4. customer_reward_credits ------------------------------------------------
-- Append-only audit log of admin-issued SGCoin credits.
CREATE TABLE IF NOT EXISTS public.customer_reward_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id TEXT,
    amount_sgc NUMERIC NOT NULL CHECK (amount_sgc > 0),
    amount_usd NUMERIC,
    awarded_by_user_id UUID NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_reward_credits_profile
    ON public.customer_reward_credits (profile_id);
CREATE INDEX IF NOT EXISTS idx_customer_reward_credits_created_at
    ON public.customer_reward_credits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_reward_credits_order
    ON public.customer_reward_credits (order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.customer_reward_credits IS
    'Append-only audit log of admin SGCoin credits. Clients fetch this table to render the credit history; profiles.last_reward_credit_{at,amount} mirror the latest row for at-a-glance reads.';
COMMENT ON COLUMN public.customer_reward_credits.amount_sgc IS
    'SGC amount credited; positive by CHECK. Mirrored to profiles.sg_coin_balance via credit-customer-reward handler.';
COMMENT ON COLUMN public.customer_reward_credits.amount_usd IS
    'Optional USD value the operator typed in (informational; rewards are issued in SGC).';
COMMENT ON COLUMN public.customer_reward_credits.awarded_by_user_id IS
    'auth.uid of the admin who issued the credit. Captured server-side from the session token so client cannot forge.';
COMMENT ON COLUMN public.customer_reward_credits.reason IS
    'Free-text reason ("Welcome bonus for first wallet link", "Starrboii067 sale apology", etc).';

ALTER TABLE IF EXISTS public.customer_reward_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers can read their own credits" ON public.customer_reward_credits;
CREATE POLICY "Customers can read their own credits" ON public.customer_reward_credits
    FOR SELECT USING (
        profile_id = auth.uid()
        OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can write credits" ON public.customer_reward_credits;
CREATE POLICY "Admins can write credits" ON public.customer_reward_credits
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

DO $$ BEGIN RAISE NOTICE 'customer_profile + reward credits + facebook platform + orders.fb_username ready'; END $$;
