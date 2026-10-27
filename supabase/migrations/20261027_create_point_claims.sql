-- ============================================
-- POINT CLAIMS
--
-- The gap this closes: SGCoin is minted per order (orders.sg_coin_reward, 1 SGC
-- per $1) but it lands in public.profiles.sg_coin_balance, which is keyed on a
-- member account. A shopper who checked out as a guest — or who ordered before
-- they signed up — has an order row with a reward and no account to receive it.
-- Nothing in the app could give them those points: the admin grant path needs a
-- member UUID, and there was no buyer-facing way to say "I ordered, here is my
-- receipt, where are my points".
--
-- A claim is a REQUEST, not a credit. Points move only when an operator
-- approves, through public.grant_sgcoin (20261023_sgcoin_admin_grants.sql), so
-- every claim that pays out leaves the same audit row as a manual grant. That
-- also means this table can never be the thing that mints SGCoin.
--
-- WHO CAN DO WHAT
--   claimant  (role authenticated)  SELECT own claims, and the two narrow
--                                   functions below (lookup / submit).
--   operator  (service_role, via api/_handlers/admin-point-claims.ts behind
--             withAdminAuth)         SELECT every claim, approve, reject.
--   nobody else. There is no client INSERT or UPDATE policy on the table: the
--   money-relevant fields are computed by the functions, not sent by a browser.
--
-- WHY THE MATCHER IS PRIVILEGED
--   match_point_order answers "does this order number + email pair exist, and
--   what is it worth". Both inputs are guessable, so it is the one piece that
--   must not be callable by a browser holding the anon key (an enumeration
--   oracle). It is executable by service_role alone, and the two functions that
--   ARE callable reach it internally — a SECURITY DEFINER function runs as its
--   owner, so the caller's own privileges never apply to the inner call.
-- ============================================

-- ============================================
-- TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.point_claims (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The claimant. NOT NULL: every claim is made from a signed-in account, so
    -- the points have somewhere to land and there is no email-only limbo state.
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Snapshot of the account email at submit time. An operator compares three
    -- addresses when reviewing: this one, the one the claimant typed, and the
    -- one on the order. Kept as a snapshot because auth.users can change.
    claimant_email TEXT NOT NULL,
    -- NULL when the order could not be matched — that is the whole point of the
    -- proof-screenshot path, and a matched claim is a different review.
    --
    -- TEXT, not UUID: orders.id is a text column. It looks like a uuid on the
    -- online path (the client's attempt id) but the intake fallback writes
    -- 'order_<timestamp>_<rand>' (services/orderIntake.ts), and the FK below
    -- settles it — 20260730_create_payments_table.sql already references
    -- orders(id) as TEXT, and a uuid column could not hold either shape.
    order_id       TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    order_number   TEXT NOT NULL,
    -- The email the claimant typed, not the account email: a buyer who ordered
    -- with a different address is the normal case here.
    order_email    TEXT NOT NULL,
    matched        BOOLEAN NOT NULL DEFAULT FALSE,
    -- What the order says the reward is. 0 for an unmatched claim; the operator
    -- supplies the amount at approval either way.
    points         NUMERIC(20, 0) NOT NULL DEFAULT 0 CHECK (points >= 0),
    proof_url      TEXT,
    note           TEXT,
    status         TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    -- What was actually granted, which may differ from `points` (an operator can
    -- round up a goodwill gesture or down a partial refund).
    granted_amount NUMERIC(20, 0) CHECK (granted_amount IS NULL OR granted_amount >= 0),
    review_note    TEXT,
    -- No reviewer column: the admin session is a shared secret verified in
    -- api/_adminAuth.ts, so there is no admin user id to record. Same reason
    -- 20261023_sgcoin_admin_grants.sql has no admin_id.
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every claimant-facing read is "my claims", newest first.
CREATE INDEX IF NOT EXISTS idx_point_claims_user_id
    ON public.point_claims (user_id, created_at DESC);
-- The operator queue: pending, oldest first (first in, first reviewed).
CREATE INDEX IF NOT EXISTS idx_point_claims_status_created_at
    ON public.point_claims (status, created_at);
-- "Which claims name this order?" — used by the matcher's already-claimed check.
CREATE INDEX IF NOT EXISTS idx_point_claims_order_id
    ON public.point_claims (order_id);

-- One live claim per order. Defense in depth: submit_point_claim checks first,
-- but two submissions a millisecond apart both see "no live claim" before either
-- INSERT lands. The index makes the second one fail with 23505 instead of
-- paying the same order's points twice. Partial because rejected claims must not
-- block a corrected resubmission.
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_claims_one_live_per_order
    ON public.point_claims (order_id)
    WHERE order_id IS NOT NULL AND status IN ('pending', 'approved');

COMMENT ON TABLE public.point_claims IS
    'Buyer-initiated requests for SGCoin owed on a past order. A claim is reviewed by an operator and paid out through grant_sgcoin(); this table never mints SGCoin itself.';
COMMENT ON COLUMN public.point_claims.matched IS
    'True when the order number + email matched a paid order at submit time. False means the operator is reviewing a screenshot instead of a record.';
COMMENT ON COLUMN public.point_claims.granted_amount IS
    'What grant_sgcoin actually credited at approval. NULL until approved; may differ from points when the operator adjusts the amount.';

-- ============================================
-- RLS: claimants read their own; the operator reads through service_role
-- ============================================
-- ONE select policy, deliberately. An "admins can read all" policy looks like
-- the obvious second one, and an earlier revision of this file had it as
-- `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())`. It does not
-- work: admin_users carries its own self-referential RLS policy, so reading it
-- from another table's policy re-enters RLS and Postgres raises
-- "infinite recursion detected in policy for relation admin_users". Permissive
-- SELECT policies are ORed, so that error fired for EVERY claimant reading
-- their own rows — the buyer's claim list failed while the tables were fine.
--
-- The review queue therefore has no policy to lean on: it reads through the
-- service-role client in api/_handlers/admin-point-claims.ts, which bypasses
-- RLS. That is required anyway because the admin session is a shared secret
-- (api/_adminAuth.ts), not a Supabase user, so auth.uid() is null on that path.
-- The DROP below removes the policy from databases that applied the earlier
-- revision; it is idempotent and can stay forever.
--
-- No INSERT/UPDATE/DELETE policy is declared at all: with RLS enabled and no
-- permissive write policy, the only writers are the functions below. Claim
-- points and matched/order_id are server-computed — a browser that could insert
-- here would be writing its own reward.

ALTER TABLE public.point_claims ENABLE ROW LEVEL SECURITY;

-- Broken policy from the first revision. Kept as a DROP so re-running this file
-- cleans up any database that already executed it.
DROP POLICY IF EXISTS "Admins can read all point claims" ON public.point_claims;

DROP POLICY IF EXISTS "Claimants can read their own point claims" ON public.point_claims;
CREATE POLICY "Claimants can read their own point claims"
    ON public.point_claims FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- MATCHER (internal — service_role only)
--
-- The single owner of "which order is this, and what is it worth". Both the
-- lookup and the submit path call it, so the rule cannot drift between what the
-- buyer is shown and what gets recorded.
--
-- Returns no customer data — not the name, not the address, not the order's own
-- email. Points, date, total and the claim state are all the buyer-facing flow
-- needs, and an operator reads the rest from the order itself.
-- ============================================

CREATE OR REPLACE FUNCTION public.match_point_order(
    p_order_number TEXT,
    p_email        TEXT
)
RETURNS TABLE (
    order_id        TEXT,
    matched         BOOLEAN,
    points          NUMERIC,
    order_total     NUMERIC,
    order_date      TIMESTAMPTZ,
    already_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_number TEXT := TRIM(COALESCE(p_order_number, ''));
    v_email  TEXT := LOWER(TRIM(COALESCE(p_email, '')));
    v_order  public.orders%ROWTYPE;
BEGIN
    IF v_number = '' OR v_email = '' THEN
        RAISE EXCEPTION 'An order number and the email used on the order are both required';
    END IF;

    -- Case-insensitive on both sides: buyers type their email however they like,
    -- and order numbers are stored inconsistently across the manual and online
    -- intake paths ("ORD-001" vs "ord-001").
    SELECT * INTO v_order
      FROM public.orders o
     WHERE LOWER(TRIM(o.order_number)) = LOWER(v_number)
       AND LOWER(TRIM(o.customer_email)) = v_email
       -- Paid-ish only. types.ts OrderStatus makes processing/shipped/delivered
       -- post-payment states alongside paid; pending/cancelled/failed are not
       -- owed points, and a refunded order must never be claimable. There is no
       -- orders.status column — payment_status is the payment state (see
       -- services/orderIntake.ts), and it is the same column every other read
       -- in the app uses.
       AND LOWER(COALESCE(o.payment_status, 'pending'))
           IN ('paid', 'processing', 'shipped', 'delivered')
     ORDER BY o.created_at ASC
     LIMIT 1;

    IF NOT FOUND THEN
        -- Not an error: "we could not find it" is a normal answer that routes the
        -- buyer to the screenshot path.
        RETURN QUERY SELECT NULL::TEXT, FALSE, 0::NUMERIC, NULL::NUMERIC, NULL::TIMESTAMPTZ, FALSE;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        v_order.id,
        TRUE,
        COALESCE(v_order.sg_coin_reward, 0)::NUMERIC,
        COALESCE(v_order.total, v_order.total_amount, 0)::NUMERIC,
        v_order.created_at,
        EXISTS (
            SELECT 1 FROM public.point_claims c
             WHERE c.order_id = v_order.id
               AND c.status IN ('pending', 'approved')
        );
END;
$$;

-- Locked down before anything else can call it: the browser must not be able to
-- probe order number + email pairs.
REVOKE ALL ON FUNCTION public.match_point_order(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_point_order(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_point_order(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.match_point_order(TEXT, TEXT) IS
    'Resolves an order number + email pair to the points owed. Executable by service_role only — it is the enumeration surface, and lookup_order_points/submit_point_claim call it internally.';

-- ============================================
-- RPC: lookup_order_points (claimant-facing, read-only)
--
-- What the /claim page calls after the buyer signs in, so they see the points
-- before committing to a claim. Deliberately not anon-callable: the claim flow
-- requires an account anyway (the points have to land somewhere), and granting
-- this to anon would hand the uncounted internet a points oracle.
-- ============================================

CREATE OR REPLACE FUNCTION public.lookup_order_points(
    p_order_number TEXT,
    p_email        TEXT
)
RETURNS TABLE (
    matched         BOOLEAN,
    points          NUMERIC,
    order_total     NUMERIC,
    order_date      TIMESTAMPTZ,
    already_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to look up your order';
    END IF;

    RETURN QUERY
    SELECT m.matched, m.points, m.order_total, m.order_date, m.already_claimed
      FROM public.match_point_order(p_order_number, p_email) m;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_order_points(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_order_points(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_order_points(TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.lookup_order_points(TEXT, TEXT) IS
    'Read-only order + points lookup for a signed-in claimant. Returns no customer PII.';

-- ============================================
-- RPC: submit_point_claim (claimant-facing)
--
-- Records the claim. Every money-relevant field is computed here, never taken
-- from the client: the browser sends what it typed, the function decides what
-- the order is worth and whether it is a matched claim or a screenshot review.
--
-- Proof is required only when the order could NOT be matched. A matched claim
-- is already evidenced by the order record plus the email match, so demanding a
-- screenshot there would be friction with nothing behind it.
-- ============================================

CREATE OR REPLACE FUNCTION public.submit_point_claim(
    p_order_number TEXT,
    p_email        TEXT,
    p_proof_url    TEXT DEFAULT NULL,
    p_note         TEXT DEFAULT NULL
)
RETURNS TABLE (
    claim_id UUID,
    status   TEXT,
    points   NUMERIC,
    matched  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id    UUID := auth.uid();
    v_claimant   TEXT;
    v_number     TEXT := TRIM(COALESCE(p_order_number, ''));
    v_email      TEXT := LOWER(TRIM(COALESCE(p_email, '')));
    v_proof      TEXT := NULLIF(TRIM(COALESCE(p_proof_url, '')), '');
    v_note       TEXT := NULLIF(TRIM(COALESCE(p_note, '')), '');
    v_match      RECORD;
    v_claim_id   UUID;
    v_status     TEXT := 'pending';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in to claim your points';
    END IF;

    IF v_number = '' OR v_email = '' THEN
        RAISE EXCEPTION 'An order number and the email used on the order are both required';
    END IF;

    -- Longest values the columns and the upload path produce. Bounds rather than
    -- silent truncation, so a bad client is told instead of quietly stored.
    IF LENGTH(v_number) > 64 THEN
        RAISE EXCEPTION 'That order number is too long';
    END IF;
    IF LENGTH(v_email) > 320 THEN
        RAISE EXCEPTION 'That email is too long';
    END IF;
    IF LENGTH(COALESCE(v_proof, '')) > 2048 THEN
        RAISE EXCEPTION 'That proof link is too long';
    END IF;
    IF LENGTH(COALESCE(v_note, '')) > 1000 THEN
        RAISE EXCEPTION 'Keep the note under 1000 characters';
    END IF;

    SELECT email INTO v_claimant FROM auth.users WHERE id = v_user_id;
    IF v_claimant IS NULL THEN
        RAISE EXCEPTION 'Your account has no email address to review against';
    END IF;

    SELECT * INTO v_match FROM public.match_point_order(v_number, v_email);

    -- A live claim for the same order is refused with a sentence the page can
    -- show. The unique index behind it is the race-proof version of this check.
    IF v_match.matched AND v_match.already_claimed THEN
        RAISE EXCEPTION 'That order already has a claim on it — nothing more to do';
    END IF;

    IF NOT v_match.matched THEN
        IF v_proof IS NULL THEN
            RAISE EXCEPTION 'Attach a receipt or order screenshot so we can verify it';
        END IF;
    END IF;

    INSERT INTO public.point_claims (
        user_id, claimant_email, order_id, order_number, order_email,
        matched, points, proof_url, note, status
    )
    VALUES (
        v_user_id, LOWER(TRIM(v_claimant)), v_match.order_id, v_number, v_email,
        COALESCE(v_match.matched, FALSE), COALESCE(v_match.points, 0), v_proof, v_note, v_status
    )
    RETURNING id INTO v_claim_id;

    RETURN QUERY SELECT v_claim_id, v_status, COALESCE(v_match.points, 0), COALESCE(v_match.matched, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_point_claim(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_point_claim(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_point_claim(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.submit_point_claim(TEXT, TEXT, TEXT, TEXT) IS
    'Records a point claim for the calling account (auth.uid()). Points and matched are computed server-side from the order record.';

-- ============================================
-- RPC: approve_point_claim (operator-facing)
--
-- Pays a claim and closes it in ONE transaction: grant_sgcoin increments the
-- balance and writes the ledger row, then this function records what was paid.
-- Splitting those across two calls is what the sgcoin migrations already argue
-- against — a grant that commits without its claim closing (or the reverse)
-- leaves either free SGCoin or a claimant told "approved" with no balance.
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_point_claim(
    p_claim_id UUID,
    p_amount   NUMERIC,
    p_note     TEXT DEFAULT NULL
)
RETURNS TABLE (
    claim_id     UUID,
    granted      NUMERIC,
    balance      NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_claim   public.point_claims%ROWTYPE;
    v_granted NUMERIC;
    v_balance NUMERIC;
BEGIN
    IF p_claim_id IS NULL THEN
        RAISE EXCEPTION 'A claim id is required';
    END IF;

    -- Lock the claim before deciding anything. Two operators clicking Approve
    -- queue here; the second then sees status <> 'pending' and is refused,
    -- instead of both crediting the same claim.
    SELECT * INTO v_claim
      FROM public.point_claims
     WHERE id = p_claim_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found';
    END IF;

    IF v_claim.status <> 'pending' THEN
        RAISE EXCEPTION 'That claim is already %', v_claim.status;
    END IF;

    -- Whole coins only, matching grant_sgcoin's contract. An operator overriding
    -- the amount upward or downward must still land on a whole number.
    v_granted := COALESCE(p_amount, v_claim.points);
    IF v_granted IS NULL OR v_granted <= 0 OR v_granted <> TRUNC(v_granted) THEN
        RAISE EXCEPTION 'The grant amount must be a positive whole number of SGCoin';
    END IF;

    -- A claimant who signed up minutes ago may have no profiles row yet —
    -- nothing creates one on signup (the auth.users trigger in
    -- create_referral_system.sql only seeds referral_stats), and useAuth only
    -- ever UPDATEs profiles. Without a row, grant_sgcoin below raises 'Member
    -- profile not found' and the operator has no remedy from the UI, because the
    -- Distribution picker lists members FROM profiles
    -- (api/_handlers/admin-sgcoin-members.ts). The claim would dead-end at the
    -- moment it should pay out, for exactly the audience this feature is for.
    --
    -- Columns are deliberately the same pair 20260730's record_partial_payment and
    -- reconcile_balance_payment already insert with — the live profiles table is
    -- keyed by id alone and has no user_id column (that mismatch is what
    -- tests/partialPaymentRpc.test.ts exists to catch; it reads this line).
    -- ON CONFLICT DO NOTHING, so an existing member is never touched and a
    -- lifetime_spend_usd of 0 is a fact for a member with no order history
    -- recorded yet — updateLifetimeStats fills the real figure on their next
    -- order.
    INSERT INTO profiles (id, lifetime_spend_usd)
    VALUES (v_claim.user_id, 0)
    ON CONFLICT (id) DO NOTHING;

    -- The only SGCoin mint in this file, and it is the same call the manual
    -- Distribution tab makes, so the ledger cannot tell the two apart.
    SELECT g.balance INTO v_balance
      FROM public.grant_sgcoin(
               v_claim.user_id,
               v_granted,
               'Point claim ' || v_claim.order_number
           ) g;
    -- `grant_sgcoin` returns TABLE(grant_id, balance); the SELECT above takes the
    -- one row it produces. It also raises when the member has no profiles row,
    -- and that aborts this whole function — no claim is marked approved without
    -- a balance having moved.

    UPDATE public.point_claims
       SET status = 'approved',
           granted_amount = v_granted,
           review_note = NULLIF(TRIM(COALESCE(p_note, '')), ''),
           reviewed_at = now()
     WHERE id = p_claim_id;

    RETURN QUERY SELECT p_claim_id, v_granted, COALESCE(v_balance, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_point_claim(UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_point_claim(UUID, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_point_claim(UUID, NUMERIC, TEXT) TO service_role;

COMMENT ON FUNCTION public.approve_point_claim(UUID, NUMERIC, TEXT) IS
    'Pays a pending claim through grant_sgcoin and closes it, in one transaction. Executable by service_role only; the API admin gate is the authorization boundary.';

-- ============================================
-- RPC: reject_point_claim (operator-facing)
-- ============================================

CREATE OR REPLACE FUNCTION public.reject_point_claim(
    p_claim_id UUID,
    p_reason   TEXT DEFAULT NULL
)
RETURNS TABLE (claim_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_claim public.point_claims%ROWTYPE;
BEGIN
    IF p_claim_id IS NULL THEN
        RAISE EXCEPTION 'A claim id is required';
    END IF;

    SELECT * INTO v_claim
      FROM public.point_claims
     WHERE id = p_claim_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found';
    END IF;

    -- Nothing is refunded here: a rejected claim never moved SGCoin.
    IF v_claim.status <> 'pending' THEN
        RAISE EXCEPTION 'That claim is already %', v_claim.status;
    END IF;

    UPDATE public.point_claims
       SET status = 'rejected',
           review_note = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
           reviewed_at = now()
     WHERE id = p_claim_id;

    RETURN QUERY SELECT p_claim_id, 'rejected'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_point_claim(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_point_claim(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_point_claim(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.reject_point_claim(UUID, TEXT) IS
    'Closes a pending claim without paying it. Executable by service_role only.';
