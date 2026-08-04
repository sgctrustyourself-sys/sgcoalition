-- supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql
--
-- Adds partial-payment columns to public.orders so admins can track
-- paid_amount and balance_due for pending deposit orders (e.g. Travis's
-- custom shirt with $30 deposit / $10 balance). Default 0 means existing
-- rows are unaffected — fully-paid orders stay at paid_amount=0 by default
-- and get flipped via computePaymentState() on subsequent writes.
--
-- IDEMPOTENT
--   ADD COLUMN IF NOT EXISTS so re-running this migration is safe.
--   The backfill UPDATE is also idempotent: re-parsing the same notes with
--   the same regex yields the same values.
--
-- ONE REGEX, TWO FORMS
--   The TS helper utils/orderDepositNotes.ts exposes DEPOSIT_NOTES_RE and
--   mirrors this SQL exactly. If you change one, change the other — the
--   tests in tests/orderDepositNotes.test.ts are the canary.
--
-- FORMAT (single line, anchored on each digit run):
--   "DEP $X paid / BAL $Y owes"
-- where X and Y are non-negative decimals (one or two-digit cents).
-- Examples that DO match (post-migration pay_amount=X, balance_due=Y):
--   "DEP $30 paid / BAL $10 owes. Custom Coalition Shirt ..."
--   "DEP $30.50 paid / BAL $9.50 owes."
-- Examples that do NOT match (paid_amount=0, balance_due=0 default):
--   "" / null
--   "DEP $30 paid"  (no BAL half)
--   "DEP £30 paid / BAL £10 owes"  (alt currency)
--   "DEP $30 paid / BAL $10 owns"  (typo)

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.paid_amount IS
    'Amount the customer has paid so far, in dollars (numeric). For fully-paid orders this equals total. For pending deposit orders whose notes contain "DEP $X paid / BAL $Y owes" this is X. Default 0 for legacy rows; resolvePaymentState (utils/orderDepositNotes) and the toOrderRecord path fill this on subsequent writes.';

COMMENT ON COLUMN public.orders.balance_due IS
    'Amount still owed, in dollars (numeric). For fully-paid orders this is 0. For pending deposit orders whose notes contain "DEP $X paid / BAL $Y owes" this is Y. Default 0 for legacy rows; resolvePaymentState and the toOrderRecord path fill this on subsequent writes.';

-- ---------------------------------------------------------------------------
-- Backfill: parse "DEP $X paid / BAL $Y owes" out of every pending order's
-- notes column. Idempotent — re-applying the migration on an already
-- backfilled row yields the same numbers (or zeros, since the UPDATE only
-- fires when payment_status=pending).
-- ---------------------------------------------------------------------------
-- Uses two separate `regexp_match` calls because PostgreSQL's
-- substring(string FROM pattern) only returns the FIRST capture group.
-- The TS helper DEPOSIT_NOTES_RE captures BOTH groups in one pass because
-- JavaScript's RegExp.exec() returns the full capture array.
-- ---------------------------------------------------------------------------
UPDATE public.orders
SET
    paid_amount = COALESCE(
        NULLIF(
            (regexp_match(
                notes,
                'DEP \$([0-9]+(\.[0-9]+)?) paid / BAL \$[0-9]+(\.[0-9]+)? owes'
            ))[1],
            ''
        )::numeric,
        0
    ),
    balance_due = COALESCE(
        NULLIF(
            (regexp_match(
                notes,
                'DEP \$[0-9]+(\.[0-9]+)? paid / BAL \$([0-9]+(\.[0-9]+)?) owes'
            ))[1],
            ''
        )::numeric,
        0
    )
WHERE payment_status = 'pending'
  AND notes ~ 'DEP \$[0-9]+(\.[0-9]+)? paid / BAL \$[0-9]+(\.[0-9]+)? owes';
