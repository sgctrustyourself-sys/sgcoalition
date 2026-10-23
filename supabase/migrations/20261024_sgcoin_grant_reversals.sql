-- ============================================
-- SGCOIN GRANT REVERSALS
--
-- A grant can be sent to the wrong member. The fix must not be an UPDATE or a
-- DELETE on public.sgcoin_admin_grants: the ledger's whole value is that a row,
-- once written, still says what it said. So a reversal is a NEW row —
-- kind = 'reversal', a negative amount, and reverses_grant_id pointing at the
-- grant it undoes — written in the same transaction as the balance decrement.
--
-- WHAT THIS KEEPS
--   * The ledger stays append-only: no UPDATE/DELETE policy is added, the
--     service_role-written RPC is still the only writer, and the original grant
--     row is never touched.
--   * A grant can be reversed at most ONCE. Enforced twice: the RPC checks for
--     an existing reversal while holding the grant row lock, and a partial
--     unique index makes a second row impossible even if a future caller
--     forgets the check.
--   * A balance can never go negative. The decrement is a single UPDATE whose
--     WHERE clause requires the balance to cover the grant, so a member who has
--     already spent the SGCoin cannot be pushed below zero by a reversal.
--   * Full reversal only. Partial clawbacks would turn the ledger into a
--     running reconciliation problem; if that is ever needed it should be its
--     own feature with its own rules, not an amount field on this one.
--
-- WHY THE RPC AND NOT THE API
--   Same reason as grant_sgcoin: the balance decrement and the ledger insert
--   have to commit or roll back together. A read-then-write from the handler
--   would let two reversals both pass a "not reversed yet" check, or leave a
--   ledger row with no matching balance change.
--
-- LOCK ORDER (deadlock note)
--   reverse_sgcoin_grant takes the grant row first, then the member's profile
--   row. grant_sgcoin takes the profile row first and only INSERTs into the
--   ledger — it never locks an existing ledger row — so the two orders cannot
--   form a cycle. Two reversals of the same grant serialize on the grant row.
-- ============================================

-- ============================================
-- LEDGER SHAPE: kind + the grant a reversal undoes
-- ============================================

ALTER TABLE public.sgcoin_admin_grants
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'grant';

ALTER TABLE public.sgcoin_admin_grants
    ADD COLUMN IF NOT EXISTS reverses_grant_id UUID
        REFERENCES public.sgcoin_admin_grants(id) ON DELETE RESTRICT;

-- The original column check was inline (`amount NUMERIC ... CHECK (amount > 0)`),
-- so Postgres named it <table>_<column>_check. It has to go: a reversal row is
-- legitimately negative.
--
-- Dropped by DEFINITION, not by name: a generated name is an implementation
-- detail, and if the constraint is not gone the first negative insert fails at
-- runtime with a message that has nothing to do with what the operator did.
--
-- The pattern is anchored to a constraint whose WHOLE definition starts with
-- `CHECK ((amount > ...`. It has to be this loose about the right-hand side:
-- Postgres renders the literal for a NUMERIC column as `(0)::numeric`, so an
-- exact `amount > 0` match silently drops nothing. The composite shape check
-- added below starts with `CHECK (((kind = ...` and is never matched.
DO $$
DECLARE
    old_check TEXT;
BEGIN
    FOR old_check IN
        SELECT conname
          FROM pg_constraint
         WHERE conrelid = 'public.sgcoin_admin_grants'::regclass
           AND contype = 'c'
           AND pg_get_constraintdef(oid) ~ '^CHECK \(\(amount > '
    LOOP
        EXECUTE format(
            'ALTER TABLE public.sgcoin_admin_grants DROP CONSTRAINT %I',
            old_check
        );
    END LOOP;
END $$;

-- One statement for the shape, so a row cannot be half a reversal: a grant is
-- positive and points at nothing, a reversal is negative and must point at the
-- grant it undoes. This is what makes `kind` and `amount` unable to disagree.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.sgcoin_admin_grants'::regclass
           AND conname = 'sgcoin_admin_grants_kind_check'
    ) THEN
        ALTER TABLE public.sgcoin_admin_grants
            ADD CONSTRAINT sgcoin_admin_grants_kind_check
            CHECK (kind IN ('grant', 'reversal'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.sgcoin_admin_grants'::regclass
           AND conname = 'sgcoin_admin_grants_shape_check'
    ) THEN
        ALTER TABLE public.sgcoin_admin_grants
            ADD CONSTRAINT sgcoin_admin_grants_shape_check
            CHECK (
                (kind = 'grant'    AND amount > 0 AND reverses_grant_id IS NULL)
             OR (kind = 'reversal' AND amount < 0 AND reverses_grant_id IS NOT NULL)
            );
    END IF;
END $$;

-- One reversal per grant. Partial: ordinary grants have no target and must not
-- collide on NULL. This also serves the "what was reversed?" lookup, so no
-- separate index is needed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgcoin_admin_grants_reverses
    ON public.sgcoin_admin_grants (reverses_grant_id)
    WHERE reverses_grant_id IS NOT NULL;

COMMENT ON COLUMN public.sgcoin_admin_grants.kind IS
    'grant = SGCoin minted by grant_sgcoin; reversal = that grant taken back by reverse_sgcoin_grant.';
COMMENT ON COLUMN public.sgcoin_admin_grants.reverses_grant_id IS
    'For a reversal row, the grant it undoes. NULL for grants. Unique when set.';

-- ============================================
-- RPC: reverse_sgcoin_grant
--
-- Returns the reversal row's id and the balance the decrement produced. The
-- grant id is the only input that identifies the money; the note is operator
-- text for the audit trail.
-- ============================================

CREATE OR REPLACE FUNCTION public.reverse_sgcoin_grant(
    p_grant_id UUID,
    p_note     TEXT DEFAULT NULL
)
RETURNS TABLE (reversal_id UUID, new_balance NUMERIC, reversed_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
-- A SECURITY DEFINER function must not resolve unqualified names against a
-- caller-controlled schema.
SET search_path = public, pg_temp
AS $$
DECLARE
    v_grant       public.sgcoin_admin_grants%ROWTYPE;
    v_balance     NUMERIC;
    v_current     NUMERIC;
    v_reversal_id UUID;
BEGIN
    IF p_grant_id IS NULL THEN
        RAISE EXCEPTION 'A grant id is required';
    END IF;

    -- Lock the grant row before deciding anything. Two operators clicking
    -- Reverse at the same moment queue here; the second one then sees the
    -- committed reversal row below and is refused, rather than both passing a
    -- check and racing to insert. The unique index is the belt to this braces.
    SELECT *
      INTO v_grant
      FROM public.sgcoin_admin_grants
     WHERE id = p_grant_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Grant not found';
    END IF;

    IF v_grant.kind <> 'grant' THEN
        RAISE EXCEPTION 'Only a grant can be reversed';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.sgcoin_admin_grants
         WHERE reverses_grant_id = p_grant_id
    ) THEN
        RAISE EXCEPTION 'This grant was already reversed';
    END IF;

    -- One statement, two jobs: it takes the profile row lock and it refuses to
    -- write a negative balance. COALESCE because older rows predate the column
    -- default, and sg_coin_balance is nullable.
    UPDATE public.profiles
       SET sg_coin_balance = COALESCE(sg_coin_balance, 0) - v_grant.amount,
           updated_at = now()
     WHERE id = v_grant.user_id
       AND COALESCE(sg_coin_balance, 0) >= v_grant.amount
    RETURNING sg_coin_balance INTO v_balance;

    IF v_balance IS NULL THEN
        -- The UPDATE matched nothing: either the profile is gone or the member
        -- spent the SGCoin. Say which — "balance too low" and "member not
        -- found" are different problems for the operator.
        SELECT sg_coin_balance INTO v_current
          FROM public.profiles
         WHERE id = v_grant.user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Member profile not found';
        END IF;

        RAISE EXCEPTION
            'Member balance is too low to reverse this grant: % SGCoin held, % required',
            COALESCE(v_current, 0), v_grant.amount;
    END IF;

    INSERT INTO public.sgcoin_admin_grants
        (user_id, amount, note, balance_after, kind, reverses_grant_id)
    VALUES
        (v_grant.user_id, -v_grant.amount, NULLIF(TRIM(p_note), ''), v_balance,
         'reversal', p_grant_id)
    RETURNING id INTO v_reversal_id;

    RETURN QUERY SELECT v_reversal_id, v_balance, v_grant.amount;
END;
$$;

-- Lock the function down before anything else can call it.
REVOKE ALL ON FUNCTION public.reverse_sgcoin_grant(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_sgcoin_grant(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_sgcoin_grant(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.reverse_sgcoin_grant(UUID, TEXT) IS
    'Takes a grant back out of a member balance and records an append-only reversal row. Executable by service_role only; the API admin gate is the authorization boundary.';
