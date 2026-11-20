-- ============================================
-- SGCOIN ADMIN GRANTS
--
-- The admin "SGCoin Distribution" tab used to "send" SGCoin by rewriting a
-- localStorage key ('users') that nothing else in the app ever read. The
-- operator got a success toast and no balance moved.
--
-- This makes the grant real: the balance lives where every other SGCoin read
-- already looks (public.profiles.sg_coin_balance — see context/useAuth.ts,
-- verify-subscription, and the payout RPCs), and each grant leaves a ledger
-- row so a distribution is auditable after the fact.
--
-- WHY AN RPC AND NOT AN UPDATE FROM THE API
--   The API handler runs with SUPABASE_SERVICE_ROLE_KEY, so it *could* update
--   profiles directly. It must not: the increment and the ledger insert have to
--   succeed or fail together, and a read-then-write from two requests would
--   lose one of them. Both statements below run inside one function body, which
--   PostgREST executes as one transaction.
--
-- WHY service_role ONLY
--   There is no auth.uid() on this path — the admin session is a shared secret
--   verified in api/_adminAuth.ts, not a Supabase user — so a policy keyed on
--   admin_users would reject every legitimate call. The grant therefore lives
--   behind the API's admin gate, and the function itself is executable by
--   service_role alone. anon/authenticated are revoked explicitly: a browser
--   holding the public anon key must never be able to mint SGCoin.
-- ============================================

-- ============================================
-- LEDGER
-- ============================================

CREATE TABLE IF NOT EXISTS public.sgcoin_admin_grants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount        NUMERIC(20, 0) NOT NULL CHECK (amount > 0),
    note          TEXT,
    -- Snapshot of the balance the grant produced, so a row explains itself
    -- without replaying every earlier grant.
    balance_after NUMERIC(20, 0) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign-key index: every read of this table is "grants for a member", and
-- ON DELETE CASCADE without an index makes an account deletion scan the table.
CREATE INDEX IF NOT EXISTS idx_sgcoin_admin_grants_user_id
    ON public.sgcoin_admin_grants (user_id);
CREATE INDEX IF NOT EXISTS idx_sgcoin_admin_grants_created_at
    ON public.sgcoin_admin_grants (created_at DESC);

COMMENT ON TABLE public.sgcoin_admin_grants IS
    'Audit ledger for SGCoin minted by the admin Distribution tab. Written only by grant_sgcoin().';

-- ============================================
-- RLS: admins may read the ledger, nobody may write it directly
-- ============================================
-- No INSERT/UPDATE/DELETE policy is declared on purpose: with RLS enabled and
-- no permissive write policy, the only writer is service_role (which bypasses
-- RLS) via grant_sgcoin(). A stray client-side insert fails closed.

ALTER TABLE public.sgcoin_admin_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read sgcoin grants" ON public.sgcoin_admin_grants;
CREATE POLICY "Admins can read sgcoin grants"
    ON public.sgcoin_admin_grants FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- ============================================
-- RPC: grant_sgcoin
--
-- Atomically increments profiles.sg_coin_balance and records the grant.
-- The UPDATE ... RETURNING is a single statement, so two concurrent grants to
-- the same member serialize on the row lock and neither can read a stale
-- balance (the lost-update shape a read-then-write would have).
-- ============================================

CREATE OR REPLACE FUNCTION public.grant_sgcoin(
    p_user_id UUID,
    p_amount  NUMERIC,
    p_note    TEXT DEFAULT NULL
)
RETURNS TABLE (grant_id UUID, balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
-- Pin the search_path: a SECURITY DEFINER function must not resolve unqualified
-- names against a caller-controlled schema.
SET search_path = public, pg_temp
AS $$
DECLARE
    v_balance NUMERIC;
    v_grant_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A member id is required';
    END IF;

    -- Whole coins only: profiles.sg_coin_balance is NUMERIC and every other
    -- SGCoin surface formats it as an integer. 1.5 SGCoin would be a balance
    -- no screen can round-trip.
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> trunc(p_amount) THEN
        RAISE EXCEPTION 'Grant amount must be a positive whole number of SGCoin';
    END IF;

    UPDATE public.profiles
       SET sg_coin_balance = COALESCE(sg_coin_balance, 0) + p_amount,
           updated_at = now()
     WHERE id = p_user_id
    RETURNING sg_coin_balance INTO v_balance;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Member profile not found';
    END IF;

    INSERT INTO public.sgcoin_admin_grants (user_id, amount, note, balance_after)
    VALUES (p_user_id, p_amount, NULLIF(TRIM(p_note), ''), v_balance)
    RETURNING id INTO v_grant_id;

    RETURN QUERY SELECT v_grant_id, v_balance;
END;
$$;

-- Lock the function down before anything else can call it. Empty-string note
-- handling lives in the function, so the API passes the raw operator text.
REVOKE ALL ON FUNCTION public.grant_sgcoin(UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_sgcoin(UUID, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_sgcoin(UUID, NUMERIC, TEXT) TO service_role;

COMMENT ON FUNCTION public.grant_sgcoin(UUID, NUMERIC, TEXT) IS
    'Mints SGCoin into a member balance and records the grant. Executable by service_role only; the API admin gate is the authorization boundary.';
