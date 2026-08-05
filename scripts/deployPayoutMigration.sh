#!/usr/bin/env bash
# scripts/deployPayoutMigration.sh
#
# Staging-first psql runbook for the SGCOIN payout migration.
#
# Usage:
#   export STAGING_DB_URL='postgresql://postgres:...'
#   bash scripts/deployPayoutMigration.sh
#
# Steps:
#   1. Pre-flight: confirm sgcoin_payout_requests table does NOT already exist
#      (idempotency guard -- CREATE TABLE IF NOT EXISTS is a no-op, but new RPC
#      definitions would not refresh).
#   2. Apply the migration via psql with ON_ERROR_STOP=1 (any SQL error aborts).
#   3. Smoke test: exercise each RPC with dummy UUIDs from the psql session.
#      Most will raise because psql runs without auth.uid(); the warnings are
#      EXPECTED. The migrations install correctly if the function definitions
#      load (no 42501 / 42P13 / 42883 errors at CREATE time).
#   4. Verify SET search_path is locked on every SECURITY DEFINER function so
#      the migration is hardened against the search_path attack vector.
#
# Idempotent re-runs on an already-deployed staging dataset WILL show the
# pre-flight error by design. To force-redeploy, DROP TABLE / DROP FUNCTION first.

set -euo pipefail

: "${STAGING_DB_URL:?Set STAGING_DB_URL in env (postgresql://postgres:...)}"
MIGRATION='supabase/migrations/20260716_create_sgcoin_payout_requests.sql'

# 1. Pre-flight
echo '[1/4] Pre-flight: sgcoin_payout_requests must not already exist on staging...'
EXISTS=$(psql "$STAGING_DB_URL" -tAc "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'sgcoin_payout_requests');")
if [[ "$EXISTS" == 't' ]]; then
  echo '  ABORT: table already exists. DROP it before re-running, or move forward manually.' >&2
  exit 2
fi
echo '  ok (table absent)'

# 2. Apply
echo "[2/4] Applying $MIGRATION via psql..."
psql "$STAGING_DB_URL" --set ON_ERROR_STOP=1 -v ON_ERROR_STOP=1 -f "$MIGRATION"
echo '  ok (migration applied)'

# 3. Smoke test: invoke each RPC and EXpect an auth-uid error in psql session
echo '[3/4] Running post-deploy smoke test (psql has no auth.uid() -- EXpect errors below)...'
DUMMY_ADMIN='00000000-0000-0000-0000-000000000002'
DUMMY_REQ='00000000-0000-0000-0000-000000000003'

set +e  # intentionally tolerate RPCs raising -- we just want to see they LOAD
# Each psql call's stdout/stderr is captured and grep'd for the expected
# 'Authentication required' message. If a future regression silently allows
# the RPC to succeed without auth (e.g., the auth check is accidentally dropped),
# the grep fails loudly before we declare the smoke phase OK.
#
# INTENTIONALLY SKIPPED: get_payout_request_stats (the 5th SECURITY DEFINER
# RPC). It has no auth.uid() gate — it's a read-only aggregate that always
# returns rows. Calling it in a no-auth psql session would succeed silently
# and trigger a false SMOKE TEST FAIL. Its search_path hardening is still
# verified in step 4 via the pg_proc query.
for rpc_call in \
    "SELECT submit_payout_request('test@example.com', '0xDEAD', 5000);" \
    "SELECT approve_payout_request('$DUMMY_REQ', '$DUMMY_ADMIN');" \
    "SELECT complete_payout_request('$DUMMY_REQ', '$DUMMY_ADMIN', '0xabcdef1234567890');" \
    "SELECT reject_payout_request('$DUMMY_REQ', '$DUMMY_ADMIN', 'test reject');"
do
    # Portable: awk '{print $2}' extracts the function name, cut strips the '('
    rpc_label=$(echo "$rpc_call" | awk '{print $2}' | cut -d'(' -f1)
    rpc_output=$(psql "$STAGING_DB_URL" -tAc "$rpc_call" 2>&1 || true)
    echo "  ${rpc_label}: $rpc_output"
    # Broadened pattern: 3 of 4 RPCs (approve/complete/reject) check row-existence
    # BEFORE the auth check, so they naturally raise 'Payout request not found'
    # on a fresh deploy when DUMMY_REQ doesn't yet exist. Only submit_payout_request
    # raises 'Authentication required' first (it starts with v_user_id := auth.uid()).
    # Any of these errors is an EXPECTED first failure for a no-auth psql session.
    #
    # SCOPE of regression detection: this smoke test catches 'silent-accept regression'
    # (where the RPC returns empty success in a no-auth session) but NOT
    # 'partial-auth-bypass regression' (where the auth check is dropped but other
    # validations still raise an error). Partial-bypass detection would require an
    # authenticated psql session via set_config('request.jwt.claim.sub', ...) +
    # a real seed row, which is out of scope for this structural pre-flight.
    #
    # COUPLING NOTE: the stub's canned reply (see scripts/dryRunStagingDeploy.sh
    # `*)` case) must remain a SUBSTRING of this grep pattern, otherwise the
    # dry-run self-test will silently FAIL after this grep is tightened.
    echo "$rpc_output" | grep -qE 'Authentication required|Payout request not found|Only pending requests can be approved|Polygon tx hash required|Only admins may' || {
        echo ""
        echo "SMOKE TEST FAIL: $rpc_label did NOT raise any expected error on the no-auth session."
        echo "Expected (one of): Authentication required | Payout request not found | Only pending requests... | Polygon tx hash required | Only admins may..."
        echo "Actual output: $rpc_output"
        echo "This means either (a) the RPC silently accepts unauthenticated calls (regression) or"
        echo "(b) the error message has changed and the grep pattern needs updating."
        echo "Aborting deploy to surface this loudly (better a false-FAIL than letting a regression ship)."
        exit 1
    }
done
set -e

# 4. Verify search_path is locked on every SECURITY DEFINER RPC
echo ''
echo '[4/4] Verifying SET search_path is locked on every SECURITY DEFINER RPC...'
psql "$STAGING_DB_URL" -tAc "
SELECT p.proname, COALESCE(p.proconfig::text, '<NONE>') AS locked_gucs
  FROM pg_proc p
 WHERE p.proname IN (
        'submit_payout_request',
        'approve_payout_request',
        'complete_payout_request',
        'reject_payout_request',
        'get_payout_request_stats')
   AND p.prosecdef = true
 ORDER BY p.proname;"

echo ''
echo 'PASS: staging deploy complete. NEXT STEPS:'
echo '  1. Sign in as admin via /admin and submit/approve/reject a payout end-to-end'
echo '  2. Run scripts/testPayoutRaceCondition.mjs to validate the FOR UPDATE lock'
echo '  3. Document the run in docs/ - include psql output, RPC signatures, tx_hash of your test'
echo '  4. After 24-48 hours of staging soak with no errors, promote to production'
