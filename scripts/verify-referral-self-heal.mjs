// End-to-end test for the referral dashboard self-heal path.
//
// What it proves: when a logged-in Supabase user has no `referral_stats`
// row, opening the Referrals tab on /profile causes the client-side
// self-heal in `utils/referralSystem.ts#getReferralStats` to INSERT a
// fresh row, and the dashboard renders normally (no "Unable to load
// referral data" error).
//
// How it works:
//   1. Create a one-off Supabase auth user via the service-role admin
//      client. (Unique email per run, so re-runs don't collide.)
//   2. Delete any existing `referral_stats` row for that user, so we
//      start in the "no row" state the self-heal is meant to fix.
//   3. Sign in as the test user via the anon client, get the session.
//   4. Launch Playwright, inject the session into localStorage
//      (key: `sb-<project-ref>-auth-token` — matches supabase-js v2).
//   5. Navigate to /profile, click the Referrals tab.
//   6. Assert the dashboard renders a referral code (NOT the error).
//   7. Query the DB to confirm the self-heal actually created the row.
//   8. Clean up: delete the test user (cascades to stats row).
//
// Usage:
//   TEST_URL=http://localhost:3000 \
//   VITE_SUPABASE_URL=https://xxx.supabase.co \
//   VITE_SUPABASE_ANON_KEY=xxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxx \
//   node scripts/verify-referral-self-heal.mjs
//
// CI: mirror the secrets + dev-server-start pattern used by
// `verify-loader-fade.mjs`.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', '.referral-test-screenshots');
const URL = process.env.TEST_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

mkdirSync(OUT_DIR, { recursive: true });

// Validate env up front so we fail fast with a clear message.
const missingEnv = [];
if (!SUPABASE_URL) missingEnv.push('VITE_SUPABASE_URL');
if (!SUPABASE_ANON_KEY) missingEnv.push('VITE_SUPABASE_ANON_KEY');
if (!SUPABASE_SERVICE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY');
if (missingEnv.length > 0) {
    console.error(`Missing required env vars: ${missingEnv.join(', ')}`);
    console.error('Set them in your shell or .env (this script reads them via process.env).');
    process.exit(1);
}

// supabase-js v2 stores the session in localStorage under
// `sb-<projectRef>-auth-token`. Extract the ref from the URL.
const projectRef = SUPABASE_URL.match(/^https?:\/\/([^.]+)\./)?.[1] || '';
const STORAGE_KEY = `sb-${projectRef}-auth-token`;
if (!projectRef) {
    console.error(`Could not extract project ref from VITE_SUPABASE_URL: ${SUPABASE_URL}`);
    process.exit(1);
}

async function main() {
    const start = Date.now();

    // --- 1. Set up: admin client + test user ---------------------------------
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const testEmail = `test-selfheal-${Date.now()}-${randomBytes(4).toString('hex')}@sgcoalition-test.anon`;
    const testPassword = randomBytes(16).toString('hex');

    // testUserId is assigned after createUser succeeds. The cleanup helper
    // reads from this closure variable so it can no-op if creation failed
    // (or threw mid-flight and left no user behind).
    let testUserId = null;
    const cleanup = async (label) => {
        if (!testUserId) return; // nothing to clean up
        try {
            await adminClient.auth.admin.deleteUser(testUserId);
            console.log(`[cleanup:${label}] deleted test user: ${testUserId}`);
        } catch (e) {
            console.warn(`[cleanup:${label}] failed to delete test user: ${e.message}`);
        }
    };

    try {
        // --- 1. Create the test user (inside the try so the finally runs) ---
        // If createUser *throws* (network blip after the server processed
        // the request), the user may be orphaned on the server. The unique
        // email prevents collisions with future runs; that's the realistic
        // best we can do without a server-side idempotency key.
        console.log(`[setup] creating test user: ${testEmail}`);
        const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true, // skip the email-confirmation step
        });
        if (createError || !createData?.user) {
            throw new Error(`createUser failed: ${createError?.message || 'no user returned'}`);
        }
        testUserId = createData.user.id;
        console.log(`[setup] created user: ${testUserId}`);

        // --- 2. Pre-state: ensure NO referral_stats row exists ----------------
        // The signup trigger may have already created one — delete it so we
        // start in the exact "no row" state the self-heal is meant to fix.
        const { error: delError } = await adminClient
            .from('referral_stats')
            .delete()
            .eq('user_id', testUserId);
        if (delError) {
            console.error('Failed to pre-delete referral_stats row:', delError);
            await cleanup('pre-delete-failed');
            process.exit(1);
        }
        const { data: preCheck } = await adminClient
            .from('referral_stats')
            .select('user_id')
            .eq('user_id', testUserId)
            .maybeSingle();
        if (preCheck) {
            console.error('Pre-check failed: referral_stats row still exists after delete');
            await cleanup('pre-check-failed');
            process.exit(1);
        }
        console.log('[setup] confirmed: no referral_stats row exists for test user');

        // --- 3. Sign in as the test user via the anon client ----------------
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
            email: testEmail,
            password: testPassword,
        });
        if (signInError || !signInData?.session) {
            console.error('Failed to sign in as test user:', signInError);
            await cleanup('signin-failed');
            process.exit(1);
        }
        console.log('[setup] signed in as test user, got session');

        // --- 4. Launch Playwright + inject the session ------------------------
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

        // addInitScript runs before any page script, so the Supabase client
        // initializes with the session already in localStorage.
        await context.addInitScript((args) => {
            localStorage.setItem(args.key, JSON.stringify(args.session));
        }, { key: STORAGE_KEY, session: signInData.session });

        const page = await context.newPage();
        const consoleErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => {
            consoleErrors.push(`pageerror: ${err.message}`);
        });

        // --- 5. Navigate to /profile -----------------------------------------
        page.setDefaultNavigationTimeout(30000);
        await page.goto(`${URL}/profile`, { waitUntil: 'domcontentloaded' });
        // Wait for the profile tab bar (the Referrals button).
        await page.waitForSelector('button[aria-label="Referrals"]', { timeout: 15000 });
        console.log('[ui] /profile loaded, Referrals tab visible');

        // --- 6. Click the Referrals tab + assert dashboard renders ------------
        await page.click('button[aria-label="Referrals"]');
        console.log('[ui] clicked Referrals tab');

        // Race: the success state (a referral code in the format
        // `SG-XXXXXX`) vs the failure state ("Unable to load referral data").
        // The first one to appear wins. The lazy-loaded dashboard may take
        // a moment to mount (Suspense fallback is a Skeleton), so we give it
        // up to 15s.
        const codeLocator = page.locator('text=/SG-[A-F0-9]{6}/').first();
        const errorLocator = page.getByText('Unable to load referral data', { exact: true });

        let dashboardLoaded = false;
        let referralCode = null;
        let errorMessage = null;
        let outcome = 'timeout';
        // Promise.race doesn't cancel the loser — if codeLocator wins at
        // t=1s, errorLocator's waitFor keeps running and throws on its
        // own 15s timeout, producing an unhandled rejection. The fix:
        // convert each waitFor to always-resolve (via .catch) so the race
        // works on values, not on rejection-vs-resolution.
        const codeP = codeLocator.waitFor({ timeout: 15000 }).then(() => 'code').catch(() => null);
        const errorP = errorLocator.waitFor({ timeout: 15000 }).then(() => 'error').catch(() => null);
        outcome = await Promise.race([codeP, errorP]) ?? 'timeout';

        if (outcome === 'code') {
            referralCode = (await codeLocator.textContent())?.trim() || null;
            dashboardLoaded = true;
        } else if (outcome === 'error') {
            errorMessage = (await errorLocator.textContent())?.trim() || 'Unable to load referral data';
        } else {
            errorMessage = 'Neither referral code nor error message appeared within 15s';
        }

        // Screenshot for debugging — always, success or failure.
        const screenshotPath = join(OUT_DIR, 'self-heal-result.png');
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // --- 7. Verify the self-heal actually wrote a row --------------------
        // This is the proof: the rendered UI alone could be a cached state.
        // We confirm the DB has the new row.
        const { data: postCheck } = await adminClient
            .from('referral_stats')
            .select('*')
            .eq('user_id', testUserId)
            .maybeSingle();

        await browser.close();

        // --- 8. Result + summary ---------------------------------------------
        const result = {
            url: URL,
            testUserId,
            testEmail,
            storageKey: STORAGE_KEY,
            dashboardLoaded,
            referralCode,
            errorMessage,
            outcome,
            dbRowCreated: !!postCheck,
            dbRow: postCheck || null,
            screenshot: screenshotPath,
            consoleErrors,
            totalTimeMs: Date.now() - start,
        };

        writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify(result, null, 2));

        // The self-heal is considered working iff BOTH:
        //   (a) the UI renders the dashboard (not the error), AND
        //   (b) the DB now has a stats row (the self-heal actually wrote it).
        const passed = dashboardLoaded && result.dbRowCreated;

        if (passed) {
            console.log('\nReferral self-heal test PASSED');
            console.log(`   test user:   ${testEmail}`);
            console.log(`   rendered:    ${referralCode}`);
            console.log(`   db row:      ${postCheck.referral_code} (created by self-heal)`);
            console.log(`   screenshot:  ${screenshotPath}`);
        } else {
            console.log('\nReferral self-heal test FAILED');
            console.log(`   dashboardLoaded: ${dashboardLoaded}`);
            console.log(`   referralCode:    ${referralCode || '(none)'}`);
            console.log(`   errorMessage:    ${errorMessage || '(none)'}`);
            console.log(`   dbRowCreated:    ${result.dbRowCreated}`);
            console.log(`   consoleErrors:   ${JSON.stringify(consoleErrors)}`);
            console.log(`   screenshot:      ${screenshotPath}`);
        }

        return { passed, result };
    } finally {
        await cleanup('finally');
    }
}

main()
    .then(({ passed }) => {
        if (!passed) process.exit(1);
    })
    .catch(async (err) => {
        console.error('Test failed unexpectedly:', err);
        process.exit(1);
    });
