-- 20260923_create_admin_login_nonces.sql
-- Single-use wallet login nonces — the table that closes the login replay
-- window. A wallet login message (contract in utils/adminWallets.ts) carries
-- a random Nonce; /api/admin-verify SPENDS it with one atomic INSERT before it
-- will issue a bearer, so a captured signature can be redeemed at most once.
-- The primary key is the replay detector: a second INSERT for the same nonce
-- fails with 23505 and the handler answers 401.
--
-- Service-role only. RLS is enabled with NO policies, so anon/authenticated
-- can neither read rows nor DELETE them — deleting a spent nonce would reopen
-- exactly the replay window this table exists to close. The handler writes via
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. No admin UI touches this
-- table; rows are spent nonces and nothing reads them back.
--
-- Rows: one per SUCCESSFUL wallet login (the spend happens only after the
-- allowlist passes), so growth is a few rows per month — deliberately no purge
-- job. If volume ever makes that untrue, a TTL delete older than
-- 2 * ADMIN_WALLET_LOGIN_MAX_AGE_MS is safe: freshness rejects any message
-- older than the acceptance window before the nonce is consulted.

CREATE TABLE IF NOT EXISTS admin_login_nonces (
    nonce   TEXT PRIMARY KEY,
    used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS admin_login_nonces ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN RAISE NOTICE 'admin_login_nonces table + service-role-only RLS ready'; END $$;
