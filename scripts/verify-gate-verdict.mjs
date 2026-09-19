// Verifies that a deployment carries proof it ran the bare-checkout rule.
//
// The rule's verdict ships with the app at /gate-verdict.json — written by
// scripts/bareCheckoutGuard.mjs (--verdict), published by utils/bareCheckoutGate.mjs,
// which refuses to finish a build without it. That answers "did this deployment
// run the rule?" without dashboard access and a Vercel token ... for the build.
// Nothing checked the *deployment*, and a deployment can be wrong in ways its
// build could not see:
//
//   - production can serve a deployment built from a different commit than the
//     one that was pushed (the push never became live, a rollback is in place,
//     the check is pointed at the wrong origin);
//   - a build that did not go through the gated path carries no artifact at all;
//   - or the artifact is there but describes a run that checked nothing.
//
// So this check reads the served record and fails unless it is a *passed*
// verdict for the *expected* commit, with a suite that actually contained
// something. Three deliberate strictnesses:
//
//   - "skipped" is not a pass. Off Vercel, release mode skips, so a served
//     "skipped" means the thing behind this URL is a local build, not a release.
//   - the commit must match the deployment's own commit, not merely be present.
//     A verdict for an older commit is exactly the stale-deploy case.
//   - the counts must be non-zero, because a "passed" verdict over an empty
//     suite is worse than no verdict: it looks like evidence. That is the same
//     anti-vacuity floor the rule itself applies to its own premise.
//
// It runs *after* the deploy, so it cannot prevent a bad one — it reports one.
// Prevention is the in-build gate; this is the line that says the deployment
// that is actually live carries the proof.
//
// Wired in .github/workflows/post-deploy-gate.yml, on successful production
// deployments; runnable by hand against any origin:
//
//   TEST_URL=https://sgcoalition.xyz EXPECTED_COMMIT=$(git rev-parse HEAD) \
//     npm run test:gate-verdict

import { spawnSync } from 'node:child_process';
import { VERDICT_FILE } from '../utils/bareCheckoutGate.mjs';

const ORIGIN = (process.env.TEST_URL || 'https://sgcoalition.xyz').replace(/\/+$/, '');
const EXPECTED_ENVIRONMENT = (process.env.EXPECTED_ENVIRONMENT || '').trim();

const gitHead = () => {
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return rev.status === 0 ? rev.stdout.trim() : '';
};

const EXPECTED_COMMIT = (process.env.EXPECTED_COMMIT || '').trim() || gitHead();

/** Ends the check with a reason; the reporter below owns the message and the exit code. */
class CheckFailed extends Error {}

const fail = (message) => {
  throw new CheckFailed(message);
};

const report = (error) => {
  const reason =
    error instanceof CheckFailed ? error.message : `verification could not run: ${error?.stack || error}`;
  console.error(`\n❌ Gate-verdict check FAILED\n   ${reason}`);
  // `exitCode`, not `process.exit()`: this check exits while the HTTP client is
  // still holding sockets, and tearing the process down at that moment asserts in
  // libuv on Windows — reporting 127 and a crash instead of the failure it found.
  // Setting the code lets the process end on its own, which it does as soon as the
  // fetch settles.
  process.exitCode = 1;
};

const main = async () => {
  if (!EXPECTED_COMMIT) {
    fail(
      'there is no commit to compare the served verdict against. Set EXPECTED_COMMIT to the commit this ' +
        'deployment was built from (GitHub passes the deployment\'s own commit); without it this check cannot ' +
        'tell this release\'s verdict from one an older deployment left behind, which is the case it exists for.',
    );
  }

  // The query string is a cache-buster: without it a CDN copy of the previous
  // deployment's record can be served, and the check would report a stale deploy
  // that is not there (or miss one that is).
  const url = `${ORIGIN}/${VERDICT_FILE}?expected=${EXPECTED_COMMIT}`;
  const response = await fetch(url);

  if (!response.ok) {
    fail(
      `no gate verdict at ${url} (HTTP ${response.status}). A deployment whose build ran the rule publishes one; ` +
        'a 404 means this deployment did not come from the gated build (and a 302 means the URL is a protected ' +
        'preview, not the live origin). A deployment that cannot show the rule ran is not a release.',
    );
  }

  const body = await response.text();

  let record;
  try {
    record = JSON.parse(body);
  } catch {
    fail(`${url} did not return JSON, so it is not a gate verdict (it starts "${body.slice(0, 60)}").`);
  }

  if (record.rule !== 'bare-checkout') {
    fail(`${url} is a verdict for rule "${record.rule}", not "bare-checkout" — this check would be reading the wrong record.`);
  }

  if (record.verdict !== 'passed') {
    fail(
      `the served verdict is "${record.verdict}", not "passed" (${url}). ` +
        (record.verdict === 'skipped'
          ? 'A skipped run means release mode decided it was not a Vercel build, so what is live came from a local build rather than a gated release.'
          : 'The rule refused the build this record came from, and the record is what it left behind.'),
    );
  }

  if (record.commit !== EXPECTED_COMMIT) {
    fail(
      `the live verdict is for commit ${record.commit || '(none recorded)'}, but this release is ${EXPECTED_COMMIT} (${url}). ` +
        'Production is serving a deployment built from another commit: the push never became the live deployment, ' +
        'a rollback is in place, or this check is pointed at the wrong origin.',
    );
  }

  if (EXPECTED_ENVIRONMENT && record.environment !== EXPECTED_ENVIRONMENT) {
    fail(
      `the live verdict records environment "${record.environment}", not "${EXPECTED_ENVIRONMENT}" (${url}). ` +
        'The record names the Vercel environment its build ran in, so a mismatch means a build from somewhere else is ' +
        'answering at this origin.',
    );
  }

  const files = record.suite?.files?.passed;
  const tests = record.suite?.tests?.passed;
  const testsFailed = record.suite?.tests?.failed ?? 0;

  if (!Number.isFinite(files) || files <= 0 || !Number.isFinite(tests) || tests <= 0) {
    fail(
      `the live verdict says "passed" but records ${files ?? 'no'} test files and ${tests ?? 'no'} tests (${url}), ` +
        'so the run it describes checked nothing. A verdict over an empty suite is worse than no verdict: it looks like evidence.',
    );
  }

  if (testsFailed !== 0) {
    fail(`the live verdict says "passed" but records ${testsFailed} failing tests (${url}).`);
  }

  console.log('\n✅ Gate-verdict check PASSED');
  console.log(`   ${url}`);
  console.log(`   verdict ${record.verdict} · environment ${record.environment} · commit ${record.commit}`);
  console.log(`   ran ${record.ranAt} over ${files} files / ${tests} tests, none failing`);
};

main().catch(report);
