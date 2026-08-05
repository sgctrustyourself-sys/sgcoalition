#!/usr/bin/env bash
# scripts/stagingDeployOrchestrator.sh
#
# (a) PURPOSE: Orchestrator executing the 3-step SGCOIN payout staging deploy end-to-end.
# (b) CREDENTIAL INVARIANT: Do not hardcode creds here. Envs MUST be sourced externally
#     via `.env.staging` or a credential manager BEFORE invoking this script.
# (c) POLICY: 24h soak policy on staging is required before production promotion.
# (d) DOCS: See README.md "SGCOIN Payout Request System > Staging deploy runbook" section.
#
# Usage (operator runs locally):
#   set -a; source .env.staging; set +a
#   bash scripts/stagingDeployOrchestrator.sh
#
# The 3 required env vars (the operator sources these themselves, OUT-OF-BAND from chat):
#   STAGING_DB_URL           postgresql://postgres:<pw>@<host>:5432/postgres
#   SUPABASE_URL             https://<project-ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY  sb_secret_...long-base64-token

set -euo pipefail

echo "========================================================"
echo "  STAGING DEPLOY ORCHESTRATOR (SGCOIN PAYOUT)"
echo "========================================================"
echo ""

# ---------------------------------------------------------
# Step 1: Pre-flight env check
# ---------------------------------------------------------
echo "[O-1] Pre-flight env check..."
: "${STAGING_DB_URL:?STAGING_DB_URL must be set in your environment. Source via: set -a; source .env.staging; set +a}"
: "${SUPABASE_URL:?SUPABASE_URL must be set in your environment. Source via: set -a; source .env.staging; set +a}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY must be set in your environment. Source via: set -a; source .env.staging; set +a}"
echo "      ok (all 3 staging creds present)"
echo ""

# ---------------------------------------------------------
# Step 2: Dry-run validation (no real DB connections needed)
# ---------------------------------------------------------
echo "[O-2] Dry-run validation (scripts/dryRunStagingDeploy.sh)..."
if ! DRY_RUN_OUT=$(bash scripts/dryRunStagingDeploy.sh 2>&1); then
    echo "$DRY_RUN_OUT"
    echo ""
    echo "FAIL [Step 1]: Dry-run validation exited non-zero."
    echo "REMEDIATION: Fix structural issues in the deploy runbook (Node version < 18, missing pg/@supabase/supabase-js deps, or broken bash heredoc in any of the 3 scripts)."
    exit 1
fi
echo "$DRY_RUN_OUT"
if ! echo "$DRY_RUN_OUT" | grep -q "DRY-RUN PASS."; then
    echo ""
    echo "FAIL [Step 1]: Missing 'DRY-RUN PASS.' marker in dry-run output."
    echo "REMEDIATION: Re-run bash scripts/dryRunStagingDeploy.sh manually to see the failure detail."
    exit 1
fi
echo ""

# ---------------------------------------------------------
# Step 3: Deploy shell (psql apply + smoke test + search_path verification)
# ---------------------------------------------------------
echo "[O-3] Apply migration + smoke test (scripts/deployPayoutMigration.sh)..."
# Wrap in `timeout 180` so a hung psql connection / Supabase outage doesn't
# block the operator's terminal indefinitely. Exit code 124 = timeout tripped.
if ! DEPLOY_OUT=$(timeout 180 bash scripts/deployPayoutMigration.sh 2>&1); then
    DEPLOY_RC=$?
    echo "$DEPLOY_OUT"
    echo ""
    if [[ "$DEPLOY_RC" -eq 124 ]]; then
        echo "FAIL [Step 2]: Deploy shell timed out after 180 seconds."
        echo "REMEDIATION (timeout branch):"
        echo "  Suspected: Supabase staging outage, network blip, or DB lock-wait deadlock."
        echo "  Diagnose: psql 'SELECT pid, usename, state, query_start, query FROM pg_stat_activity'"
        echo "  Kill blocking queries, then re-run this orchestrator."
        exit 1
    fi
    echo "FAIL [Step 2]: Deploy script failed."
    echo "$DEPLOY_OUT"
    echo ""
    echo "FAIL [Step 2]: Deploy script failed."
    if echo "$DEPLOY_OUT" | grep -q 'ABORT:'; then
        echo ""
        echo "REMEDIATION (table-already-exists branch):"
        echo "  Connect via psql and run to cleanly wipe + retry:"
        echo "    DROP TABLE IF EXISTS sgcoin_payout_requests CASCADE;"
        echo "    DROP FUNCTION IF EXISTS submit_payout_request CASCADE;"
        echo "    DROP FUNCTION IF EXISTS approve_payout_request CASCADE;"
        echo "    DROP FUNCTION IF EXISTS complete_payout_request CASCADE;"
        echo "    DROP FUNCTION IF EXISTS reject_payout_request CASCADE;"
        echo "  Then re-run this orchestrator."
    elif echo "$DEPLOY_OUT" | grep -q 'SMOKE TEST FAIL'; then
        echo ""
        echo "REMEDIATION (rpc-regression branch):"
        echo "  Either (a) an RPC silently accepts unauthenticated calls (auth check accidentally dropped) -- inspect"
        echo "  supabase/migrations/20260716_create_sgcoin_payout_requests.sql for missing 'IF auth.uid() IS NULL' checks, OR"
        echo "  (b) the expected error substring changed -- update grep patterns in scripts/deployPayoutMigration.sh."
    elif echo "$DEPLOY_OUT" | grep -q 'ERROR:.*syntax error\|ERROR:.*does not exist'; then
        echo ""
        echo "REMEDIATION (psql-syntax branch):"
        echo "  Migration failed mid-apply. Run the teardown sequence from the ABORT branch above, then re-run."
    else
        echo ""
        echo "REMEDIATION (unknown branch):"
        echo "  Inspect the captured output above against the deploy script's expected output markers."
        echo "  Common causes: network blip (re-run the orchestrator), Supabase staging down (check status), schema drift."
    fi
    exit 1
fi
echo "$DEPLOY_OUT"
if ! echo "$DEPLOY_OUT" | grep -q "SUCCESS: staging deploy complete"; then
    echo ""
    echo "FAIL [Step 2]: Missing 'SUCCESS: staging deploy complete' marker."
    exit 1
fi
echo ""

# ---------------------------------------------------------
# Step 4: Race-condition verification (FOR UPDATE row lock proof)
# ---------------------------------------------------------
echo "[O-4] FOR UPDATE row-lock stress test (scripts/testPayoutRaceCondition.mjs)..."
# Wrap in `timeout 120` so a hung parallel RPC (deadlock, slow network) doesn't
# block the operator's terminal indefinitely. Exit code 124 = timeout tripped.
if ! RACE_OUT=$(timeout 120 node scripts/testPayoutRaceCondition.mjs 2>&1); then
    RACE_RC=$?
    echo "$RACE_OUT"
    echo ""
    if [[ "$RACE_RC" -eq 124 ]]; then
        echo "FAIL [Step 3]: Race-condition test timed out after 120 seconds."
        echo "REMEDIATION (timeout branch):"
        echo "  Suspected: Supabase RPC endpoint hanging, or row lock contention not resolving."
        echo "  Diagnose: check staging Supabase status + run a manual 'SELECT * FROM sgcoin_payout_requests WHERE status=\\'pending\\' LIMIT 5' to confirm seed cleanup."
        exit 1
    fi
    echo "FAIL [Step 3]: Race-condition test failed."
    echo "$RACE_OUT"
    echo ""
    echo "FAIL [Step 3]: Race-condition test failed."
    if echo "$RACE_OUT" | grep -q 'Missing required env vars'; then
        echo ""
        echo "REMEDIATION: Envs didn't propagate to the Node script. Confirm SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are exported before invoking this orchestrator."
    elif echo "$RACE_OUT" | grep -q 'CRITICAL: negative balance'; then
        echo ""
        echo "REMEDIATION (CRITICAL SAFETY FAILURE):"
        echo "  Race-condition test reports a negative sg_coin_balance, meaning the FOR UPDATE lock failed to serialize parallel approvals."
        echo "  DO NOT PROCEED TO PRODUCTION. Inspect the migration's approve_payout_request RPC body -- the FOR UPDATE must be present on the profiles row BEFORE the balance check."
    elif echo "$RACE_OUT" | grep -q 'End-state incorrect'; then
        echo ""
        echo "REMEDIATION (end-state mismatch):"
        echo "  Race produced the correct 1-success/1-failure split, but the end balance is wrong. Investigate profiles.sg_coin_balance + the seed/cleanup order in the race script."
    elif echo "$RACE_OUT" | grep -q 'CRITICAL: both approvals succeeded'; then
        echo ""
        echo "REMEDIATION (CATASTROPHIC -- DO NOT PROMOTE TO PROD):"
        echo "  Race-condition test reports BOTH approvals succeeded. This means the FOR UPDATE row lock"
        echo "  is NOT serializing parallel approvals on profiles.sg_coin_balance, and a customer could withdraw"
        echo "  more SGCOIN than they own."
        echo "  Inspect the migration's approve_payout_request RPC body -- the FOR UPDATE clause must be present"
        echo "  on the profiles row BEFORE the balance check. Also confirm SET search_path is locked on the function."
        echo "  This is the most severe regression; do not promote to production until the lock is verified."
    elif echo "$RACE_OUT" | grep -q 'Insufficient balance at approval'; then
        echo ""
        echo "REMEDIATION (lock-serialization string-mismatch):"
        echo "  Race completed but the failed RPC didn't raise 'Insufficient balance at approval'. The error string in the migration drifted; update BOTH the migration AND this orchestrator regex together."
    else
        echo ""
        echo "REMEDIATION (unknown branch):"
        echo "  Capture the full output above and inspect scripts/testPayoutRaceCondition.mjs for contract drift."
    fi
    exit 1
fi
echo "$RACE_OUT"
if ! echo "$RACE_OUT" | grep -q "PASS: FOR UPDATE lock correctly serialized the balance decrement"; then
    echo ""
    echo "FAIL [Step 3]: Missing 'PASS: FOR UPDATE lock correctly serialized' marker despite Node reporting success -- this is unexpected."
    exit 1
fi
echo ""

# ---------------------------------------------------------
# Step 5: Cleanup + Success reminder
# ---------------------------------------------------------
unset STAGING_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
echo "[O-5] Unset staging creds from this shell (operator: source .env.staging cleanup is YOUR responsibility)."
echo ""

echo "========================================================"
echo "  SUCCESS: ORCHESTRATION COMPLETE"
echo "========================================================"
echo ""
echo "ALL 3 STEPS PASSED:"
echo "  [O-2] Dry-run validation"
echo "  [O-3] Migration + smoke test"
echo "  [O-4] FOR UPDATE lock stress test"
echo ""
echo "Operating manual verification (operator-side):"
echo "  1. Open staging Admin UI /admin"
echo "  2. Sign in 
