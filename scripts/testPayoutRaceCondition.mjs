#!/usr/bin/env node
// scripts/testPayoutRaceCondition.mjs
//
// Concurrent approve_payout_request stress test for the SGCOIN payout
// migration. Validates that the FOR UPDATE row-lock + balance re-check
// inside the RPC prevents lost-update when two admins click "approve"
// simultaneously on separate pending requests for the same user.
//
// Required env:
//   STAGING_DB_URL             postgresql://postgres:...
//   SUPABASE_URL               https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  ... (SUPABASE env var)
//
// Usage:
//   node scripts/testPayoutRaceCondition.mjs
//
// Expectation:
//   ONE approval MUST succeed and ONE MUST fail with a PostgrestException
//   containing "Insufficient balance at approval". If both succeed, the
//   race lock is broken (catastrophic: customer can withdraw 2x the balance).
//   Cleanup runs unconditionally.

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Client } = pg;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAGING_DB_URL = process.env.STAGING_DB_URL;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STAGING_DB_URL) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGING_DB_URL');
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Seed UUIDs (deterministic so reruns work)
const SEED_USER = '00000000-0000-0000-0000-000000000aaa';
const SEED_ADMIN = '00000000-0000-0000-0000-000000000bbb';
const REQ_A = '00000000-0000-0000-0000-000000000aa1';
const REQ_B = '00000000-0000-0000-0000-000000000aa2';

// Seed constants -- extracted so the dynamic end-state assertion matches what the
// seed INSERTs. Change PER_REQUEST_SGC + INITIAL_BAL_SGC together and the test still
// self-corrects (it queries startBal at runtime, not a hardcoded value).
const INITIAL_BAL_SGC = 5000;
const PER_REQUEST_SGC = 5000;

const db = new Client({ connectionString: STAGING_DB_URL });
await db.connect();

let exitCode = 1;
try {
  console.log('[1/3] Seeding profile (sg_coin_balance=5000) + 2 pending payout requests (each 5000)...');
  await db.query(`
    DELETE FROM sgcoin_payout_requests WHERE id IN ($1, $2);
    DELETE FROM profiles WHERE id = $3;
      INSERT INTO profiles (id, sg_coin_balance, email)
      VALUES ($3, ${INITIAL_BAL_SGC}, 'race-test@example.com');
    INSERT INTO sgcoin_payout_requests (id, user_id, email, wallet_address, amount, status)
      VALUES ($1, $3, 'race-test@example.com', '0xAAA', ${PER_REQUEST_SGC}, 'pending');
    INSERT INTO sgcoin_payout_requests (id, user_id, email, wallet_address, amount, status)
      VALUES ($2, $3, 'race-test@example.com', '0xBBB', ${PER_REQUEST_SGC}, 'pending');
  `, [REQ_A, REQ_B, SEED_USER]);

  // Capture the starting balance BEFORE the race so future seed changes
  // (e.g., 10000 instead of 5000) don't hardcode this assertion to 0.
  // Read as STRING (pg driver returns NUMERIC as string) so values past
  // Number.MAX_SAFE_INTEGER (~9×10¹⁵) round-trip exactly through the assertion.
  const startingBalRes = await db.query('SELECT sg_coin_balance FROM profiles WHERE id = $1', [SEED_USER]);
  const startBalStr = startingBalRes.rows[0]?.sg_coin_balance;
  if (startBalStr === undefined || startBalStr === null) {
    throw new Error(`Could not read starting balance for seed user ${SEED_USER}: ${JSON.stringify(startingBalRes.rows[0])}`);
  }
  // Compute expected end-state using string math: subtract PER_REQUEST_SGC
  // (also a small integer) from startBalStr. Both fit in BigInt easily.
  const EXPECTED_END_BAL = String(BigInt(startBalStr) - BigInt(PER_REQUEST_SGC));

  console.log('[2/3] Racing 2 parallel approve_payout_request calls...');
  const t0 = Date.now();
  const settled = await Promise.allSettled([
    sb.rpc('approve_payout_request', { p_request_id: REQ_A, p_admin_id: SEED_ADMIN }),
    sb.rpc('approve_payout_request', { p_request_id: REQ_B, p_admin_id: SEED_ADMIN }),
  ]);
  const elapsed = Date.now() - t0;
  console.log(`  race finished in ${elapsed}ms (FOR UPDATE lock should serialize the balance check)`);

  const successes = settled.filter(r => r.status === 'fulfilled').length;
  const failures = settled.filter(r => r.status === 'rejected').length;
  settled.forEach((r, i) => {
    const label = i === 0 ? 'A' : 'B';
    if (r.status === 'rejected') {
      const msg = r.reason?.message || JSON.stringify(r.reason);
      console.log(`  request ${label} FAILED: ${msg}`);
    } else {
      console.log(`  request ${label} succeeded`);
    }
  });

  if (successes !== 1 || failures !== 1) {
    console.error(`FAIL: expected exactly 1 success + 1 failure, got ${successes} successes and ${failures} failures.`);
    if (successes === 2) {
      console.error('CRITICAL: both approvals succeeded -- customer could withdraw 2x balance. FOR UPDATE LOCK IS BROKEN.');
    }
    exitCode = 1;
  } else {
    // Strict assertion: the failed RPC MUST raise 'Insufficient balance at approval'.
    // This is the ONLY message that proves the FOR UPDATE lock on profiles serialized
    // the two calls -- the second one waited for the first to commit the decrement,
    // then read the new lower balance. Any other error ('Only pending requests can
    // be approved' from ordering, generic 'Auth', etc.) means the lock is failing
    // or not present, and we must fail loudly.
    //
    // COUPLING NOTE: this string MUST stay in sync with the raise in
    // supabase/migrations/20260716_create_sgcoin_payout_requests.sql inside
    // approve_payout_request (the "RAISE EXCEPTION 'Insufficient balance at
    // approval (have %, need %)'" line). If the migration's error string drifts
    // (capitalization, plural, punctuation), the script false-fails; update both
    // sides at the same time when refactoring the migration.
    const failed = settled.find(r => r.status === 'rejected');
    const failedMsg = failed.reason?.message || '';
    if (!failedMsg.includes('Insufficient balance at approval')) {
      console.error(`FAIL: Expected lock-serialized 'Insufficient balance at approval' rejection, instead got: ${failedMsg}`);
      console.error('This means the FOR UPDATE row lock on profiles is NOT serializing parallel approvals. Either the migration is missing the lock OR a different admin RPC is racing.');
      exitCode = 1;
    } else {
      // END-STATE PROOF: query the DB to confirm the actual decrement matches expectations.
      // The strict-error-string assertion proves the lock *raced as designed*. This end-state
      // query proves the lock *serialized as designed* -- after exactly one 5000 decrement,
      // the user's sg_coin_balance must be exactly 0 (not 5000, not -5000).
      const balRes = await db.query('SELECT sg_coin_balance FROM profiles WHERE id = $1', [SEED_USER]);
      const balStr = balRes.rows[0]?.sg_coin_balance;
      if (balStr === EXPECTED_END_BAL) {
        console.log(`PASS: FOR UPDATE lock correctly serialized the balance decrement (end-state balance is ${EXPECTED_END_BAL}).`);
        exitCode = 0;
      } else {
        const balIsNeg = balStr != null && BigInt(balStr) < 0n;
        console.error(`FAIL: End-state incorrect. Expected sg_coin_balance=${EXPECTED_END_BAL} (start=${startBalStr} - ${PER_REQUEST_SGC}), got ${balStr}.`);
        if (balIsNeg) {
          console.error('CRITICAL: negative balance means the lock is broken -- customer could withdraw more than they own.');
        }
        exitCode = 1;
      }
    }
  }
} catch (e) {
  console.error('Unexpected test error:', e);
  exitCode = 1;
} finally {
  console.log('[3/3] Cleanup (deleting seed rows)...');
  try {
    await db.query('DELETE FROM sgcoin_payout_requests WHERE id IN ($1, $2);', [REQ_A, REQ_B]);
    await db.query('DELETE FROM profiles WHERE id = $1;', [SEED_USER]);
    console.log('  cleanup ok');
  } catch (cleanupErr) {
    console.error('CLEANUP FAILED (manual cleanup needed):', cleanupErr);
  }
  await db.end();
  process.exit(exitCode);
}
