#!/usr/bin/env bash
# scripts/dryRunStagingDeploy.sh
#
# SANDBOX-ONLY dry-run helper for the SGCOIN Payout staging-deploy runbook.
#
# Validates that the deploy shell + race script are syntactically correct +
# have all required deps loadable WITHOUT ever touching a real database.
# After this passes, the operator can safely plug in real credentials and run:
#   bash scripts/deployPayoutMigration.sh
#   node scripts/testPayoutRaceCondition.mjs
#
# Safety: this script SHADOWS psql via $PATH so even if STAGING_DB_URL is set,
# no real PostgreSQL connection is possible. Runs entirely against an empty
# stdin / stubbed binary.
#
# Usage: bash scripts/dryRunStagingDeploy.sh

set -euo pipefail

echo "========================================================"
echo "  SGCOIN PAYOUT STAGING-DEPLOY DRY-RUN"
echo "  (no real DB connections will be made)"
echo "========================================================"
echo ""

# ============================================
# 1. Force "fake" staging credentials (NEVER real ones here)
# ============================================
export STAGING_DB_URL='postgresql://dryrun:dryrun@localhost:9999/dryrun_db'
export SUPABASE_URL='https://dryrun.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='dryrun-not-real-key'

# ============================================
# 0. Node version gate (race script uses top-level await + ?? + Promise.allSettled; needs Node 18+)
# ============================================
node -e 'process.exit(parseInt((process.versions.node.match(/^v?(\d+)/) || [, "0"])[1], 10) >= 18 ? 0 : 1)' || {
    echo "========================================================"
    echo "  DRY-RUN FAIL: Node < 18 detected."
    echo "  The race script uses top-level await + nullish coalescing + Promise.allSettled."
    echo "  Install Node 18+. (asdf or nvm recommended for version management.)"
    echo "========================================================"
    exit 1
}

echo "[1/4] Forced sandbox credentials (NEVER use these against a real DB)"
echo "       STAGING_DB_URL=postgresql://dryrun:***@localhost:9999/***"
echo "       SUPABASE_URL=https://dryrun.supabase.co"
echo "       SUPABASE_SERVICE_ROLE_KEY=*** (set but NEVER read)"
echo ""

# ============================================
# 2. Shadow psql via a PATH-override stub so deployPayoutMigration.sh
#    can run end-to-end without ever hitting Postgres.
# ============================================
# SAFETY: trap ensures the stub dir is cleaned up on ANY exit (success, set -e failure,
# or signal). Without this trap a mid-script set -e failure leaks the temp dir.
# IMPORTANT: mktemp runs BEFORE the trap so $TMP_BIN is always bound when the
# trap fires. With set -euo pipefail and an unbound TMP_BIN at trap-fire time,
# evaluating $TMP_BIN inside the trap would itself fail (set -u unbound-var),
# masking the true upstream failure with a confusing trap-only error.
#
# The trap captures $? FIRST into $rc BEFORE running any cleanup commands,
# so the original upstream exit code propagates. Without `rc=$?` the trap's
# last `|| true` would reset $? to 0 internally, and bash would exit with 0
# even when an upstream `set -e` command had tripped. Proof (run in any shell):
#   bash -c 'trap "true" EXIT; false ; echo $?'                    # prints 0 (MASKED)
#   bash -c 'trap "rc=$?; true; exit $rc" EXIT; false ; echo $?'   # prints 1 (PRESERVED)
TMP_BIN=$(mktemp -d)
trap 'rc=$?; rm -rf "$TMP_BIN" 2>/dev/null || true; exit $rc' EXIT
# IMPORTANT: ONLY psql is shadowed here. If the future deploy runbook adds curl,
# wget, supabase-cli, or other network-bypassable binaries to its flow, this dry-run's
# safety guarantee weakens -- extend the sandbox to shadow those binaries too.
cat > "$TMP_BIN/psql" << 'PSQL_STUB_EOF'
#!/usr/bin/env bash
# Stub psql: prints the exact command that would be executed, then mocks
# the existence-check return value ('f' = table does NOT exist) AND the
# RPC smoke-test output ('ERROR: Authentication required') so the deploy
# script's pre-flight + smoke-test BOTH pass the dry-run.
echo "      [STUB psql] $*"
case "$*" in
    *'SELECT EXISTS'*)
        echo "f"   # Simulate "table not pre-existing yet" (NOTE: this stub validates FORWARD-progress against a fresh database, NOT idempotency. To re-test idempotency, set STAGING_DB_URL to a stale URL but DON'T pipe through this stub psql.)
        ;;
    *)
        # Simulate any non-EXISTS query (e.g., SELECT submit_payout_request(...))
        # raising 'Authentication required' to satisfy the deploy shell's broadened
        # smoke-test grep. In a real DB without auth.uid() context, the SECURITY
        # DEFINER RPCs would raise this exact error (or 'Payout request not found'
        # before the auth check for approve/complete/reject).
        #
        # COUPLING NOTE: this canned reply MUST remain a SUBSTRING of the deploy
        # shell's broadened smoke-test grep (see scripts/deployPayoutMigration.sh).
        # If you tighten/rename one without the other, the dry-run self-test will
        # silently fail on the deploy script's smoke check.
        #
        # Forward-progress only: newly added DDL queries (not EXISTENCE, not RPC
        # smoke) will pass through unwrapped because the stub can't perfectly model
        # them. Keep the deploy script's non-EXISTS psql calls to a minimum.
        echo "ERROR: Authentication required (stubbed)"
        ;;
esac
PSQL_STUB_EOF
chmod +x "$TMP_BIN/psql"
export PATH="$TMP_BIN:$PATH"

echo "[2/4] Shadowed psql via $(basename $TMP_BIN)/psql --"
echo "       Now running scripts/deployPayoutMigration.sh end-to-end."
echo "       Every psql command will be PRINTED but never EXECUTED."
echo "--------------------------------------------------------"
bash scripts/deployPayoutMigration.sh || {
    echo ""
    echo "DRY-RUN FAIL: deployPayoutMigration.sh exited non-zero above."
    echo "Inspect the printed psql commands for the failure point."
    rm -rf "$TMP_BIN"
    exit 1
}
echo "--------------------------------------------------------"
echo "       deployPayoutMigration.sh flow is STRUCTURALLY correct (real Postgres parser was NOT exercised by this dry-run)."
echo ""

# ============================================
# 3. Validate the race script's syntax + ESM dependency wiring
# ============================================
echo "[3/4] Syntax-checking scripts/testPayoutRaceCondition.mjs ..."
node --check scripts/testPayoutRaceCondition.mjs && echo "       ok (parses cleanly)"

echo ""
echo "[4/4] Verifying the race script can LOADEss required ESM deps..."
node -e "
  Promise.all([
    import('pg'),
    import('@supabase/supabase-js'),
  ]).then(([pg, supabase]) => {
    const checks = [
      ['pg.Client',                            typeof pg.Client === 'function'],
      ['pg.Client.prototype.connect',          typeof pg.Client.prototype.connect === 'function'],
      ['pg.Client.prototype.query',            typeof pg.Client.prototype.query   === 'function'],
      ['pg.Client.prototype.end',              typeof pg.Client.prototype.end     === 'function'],
      ['supabase.createClient',                typeof supabase.createClient === 'function'],
    ];
    let ok = true;
    for (const [name, pass] of checks) {
      console.log('       ' + (pass ? 'ok ' : 'FAIL ') + name);
      if (!pass) ok = false;
    }
    if (!ok) process.exit(1);
  }).catch(e => {
    console.error('       FAIL (imports threw):', e.message);
    process.exit(1);
  });
"
echo "       Race script ready to invoke against staging."
echo ""

# Cleanup
rm -rf "$TMP_BIN"

echo "========================================================"
echo "  DRY-RUN PASS."
echo ""
echo "  NEXT: plug in your real credentials and run:"
echo "    export STAGING_DB_URL='postgresql://postgres:...'"
echo "    export SUPABASE_URL='https://<project>.supabase.co'"
echo "    export SUPABASE_SERVICE_ROLE_KEY='...'"
echo "    bash scripts/deployPayoutMigration.sh"
echo "    node scripts/testPayoutRaceCondition.mjs"
echo "========================================================"
