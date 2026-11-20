// Verifies that production's VITE_APP_URL is the canonical storefront origin.
//
// The failure this exists for already happened twice: VITE_APP_URL pointed
// at a retired host while the code was correct — every default said the
// right host, but the env var overrides every default, so the CORS echo,
// the transactional email links and the webhook URLs all quietly aimed at a
// dead host. Nothing in the build can see that: the value is injected at
// deploy time. (This file names no retired host on purpose:
// tests/downDomain.test.ts forbids them in source, even in comments.)
//
// So this check reads it back from the live deployment. GET /api/health
// reports `origin.configured` — VITE_APP_URL exactly as the deployment
// received it — and this check fails unless that equals the canonical origin.
// It runs *after* the deploy, so it cannot prevent a bad one: it reports one,
// loudly, on every production deploy (and on demand via workflow_dispatch).
//
// Deliberately node builtins only: the post-deploy gate runs without
// `npm ci`, so this file must not import anything (see
// scripts/verify-gate-verdict.mjs, the same constraint).
//
// The canonical origin has exactly one owner: SITE_ORIGIN in utils/seo.ts.
// The default below mirrors it — plain Node cannot import that TS module —
// and tests/verifyAppUrl.test.ts fails if the two ever disagree, so the
// mirror cannot drift behind a move either.
//
// Wired in .github/workflows/post-deploy-gate.yml; runnable by hand:
//
//   TEST_URL=https://sgcoalition-five.vercel.app npm run verify:app-url

// Mirror of SITE_ORIGIN in utils/seo.ts (the owner). Pinned by
// tests/verifyAppUrl.test.ts — change the owner, not this line.
const DEFAULT_EXPECTED_ORIGIN = 'https://sgcoalition-five.vercel.app';

const ORIGIN = (process.env.TEST_URL || DEFAULT_EXPECTED_ORIGIN).replace(/\/+$/, '');
const EXPECTED_ORIGIN = (process.env.EXPECTED_ORIGIN || '').trim().replace(/\/+$/, '') || DEFAULT_EXPECTED_ORIGIN;

/** Ends the check with a reason; the reporter below owns the message and the exit code. */
class CheckFailed extends Error {}

const fail = (message) => {
  throw new CheckFailed(message);
};

const report = (error) => {
  const reason =
    error instanceof CheckFailed ? error.message : `verification could not run: ${error?.stack || error}`;
  console.error(`\n❌ App-URL check FAILED\n   ${reason}`);
  // `exitCode`, not `process.exit()`: this check exits while the HTTP client is
  // still holding sockets, and tearing the process down at that moment asserts in
  // libuv on Windows — reporting 127 and a crash instead of the failure it found.
  // Setting the code lets the process end on its own, which it does as soon as the
  // fetch settles.
  process.exitCode = 1;
};

const main = async () => {
  // The query string is a cache-buster: without it a CDN copy of the previous
  // deployment's health payload can be served, and the check would report a
  // drift that is not there (or miss one that is).
  const url = `${ORIGIN}/api/health?check=app-url`;
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    fail(`could not reach ${url} (${error?.message || error}). The deployment may still be coming up — rerun once it answers.`);
  }

  const body = await response.text();

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    fail(
      `${url} did not return JSON (HTTP ${response.status}, it starts "${body.slice(0, 60)}"). ` +
        'A 404 means this origin serves no deployment; a login page means it is a protected preview, not the live origin.',
    );
  }

  // The 503 payloads carry the origin report too — a dead Stripe key must not
  // hide a drifted app URL, and a drifted app URL must not hide behind a key
  // outage. What matters is only whether the deployment says what it is.
  const configured = payload?.origin?.configured;
  if (typeof configured !== 'string' || configured.trim() === '') {
    fail(
      `${url} returned no origin.configured, so VITE_APP_URL is unset on this deployment (${url}). ` +
        `Every API default falls back to ${EXPECTED_ORIGIN}, but an unset production variable is one dashboard edit away from pointing anywhere — set VITE_APP_URL to ${EXPECTED_ORIGIN} in the Vercel project settings.`,
    );
  }

  const normalized = configured.trim().replace(/\/+$/, '');
  if (normalized !== EXPECTED_ORIGIN) {
    fail(
      `VITE_APP_URL on the live deployment is "${normalized}", not the canonical origin "${EXPECTED_ORIGIN}" (${url}). ` +
        'The CORS echo, the transactional email links and the webhook URLs all follow that variable, so they are aiming at the wrong host right now. ' +
        `Fix it in the Vercel project settings (Environment Variables → VITE_APP_URL = ${EXPECTED_ORIGIN}) and redeploy; no code change is needed.`,
    );
  }

  console.log('\n✅ App-URL check PASSED');
  console.log(`   ${url}`);
  console.log(`   VITE_APP_URL is the canonical origin: ${normalized}`);
};

main().catch(report);
