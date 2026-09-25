-- One-time backfill migration: create a `referral_stats` row for every
-- `auth.users` row that doesn't already have one.
--
-- Why: the `create_referral_stats_on_signup` trigger in
-- create_referral_system.sql only fires for new Supabase auth signups.
-- Users who existed before that trigger was applied (migration drift,
-- manual `INSERT INTO auth.users`, etc.) have no row, and the
-- dashboard's `getReferralStats` returned `null` for them. The
-- client-side self-heal in `utils/referralSystem.ts` will still catch
-- the rest as a fallback, but this backfill is the proper one-shot
-- repair.
--
-- Idempotent: `ON CONFLICT (user_id) DO NOTHING` makes it safe to
-- re-run if interrupted.
--
-- How to run:
--   1. Go to https://supabase.com/dashboard/project/tvacscfbzcmjlcekjcsn
--   2. Open SQL Editor
--   3. Paste the contents below
--   4. Click Run
--
-- Edge case (documented, not fixed here): a user could theoretically
-- have rows in the `referrals` table (referrer_id FKs to auth.users)
-- without a `referral_stats` row. The new stats row would default
-- earnings/counters to 0. The `track_referral_event` RPC will
-- re-aggregate on the next analytics event for that user, so this
-- self-heals in the normal flow. Documenting the limitation rather
-- than backfilling the aggregations here keeps this migration
-- single-purpose and easy to reason about.
--
-- ============================================================================
-- 1) Pre-flight: how many rows are missing?
-- ============================================================================
SELECT COUNT(*) AS missing_referral_stats_rows
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM referral_stats rs WHERE rs.user_id = u.id
);

-- ============================================================================
-- 2) The backfill itself
-- ============================================================================
INSERT INTO referral_stats (user_id, referral_code)
SELECT
    u.id,
    'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM referral_stats rs WHERE rs.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING
RETURNING user_id, referral_code;

-- ============================================================================
-- 3) Post-flight verification
-- ============================================================================

-- 3a) Every auth.users now has a stats row?
SELECT
    (SELECT COUNT(*) FROM auth.users) AS total_users,
    (SELECT COUNT(*) FROM referral_stats) AS total_stats_rows,
    (SELECT COUNT(*) FROM auth.users u
     WHERE NOT EXISTS (SELECT 1 FROM referral_stats rs WHERE rs.user_id = u.id)
    ) AS still_missing;

-- 3b) Any duplicate referral_codes? Should be empty at 16^6 entropy.
SELECT referral_code, COUNT(*) AS n
FROM referral_stats
GROUP BY referral_code
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 5;
