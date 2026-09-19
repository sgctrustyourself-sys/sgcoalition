#!/usr/bin/env node
/**
 * ── The bare-checkout rule ────────────────────────────────────────────────
 * A test that silently depends on an undeclared env var cannot be seen while
 * the suite runs with those vars supplied: it is green there and red on a clean
 * checkout. That is not hypothetical — noRefundsPolicy and
 * stripePaymentElementGate each read a var they never declared, and only a bare
 * checkout exposed it.
 *
 * This script is the single owner of the rule that catches that class of
 * dependence: prove the environment really is bare, then run the suite with
 * nothing to fall back on. Two callers, one rule —
 *
 *   npm run gate:bare      CI (.github/workflows/ci.yml, job `bare-checkout`),
 *                          on every pull request and every push to main.
 *   --release              the release path: the build itself, reached through
 *                          utils/bareCheckoutGate.mjs, which vite.config.ts
 *                          installs as a build plugin. Deliberately NOT the
 *                          `prebuild` npm hook: a Vercel build command other
 *                          than `npm run build` (a dashboard override, which
 *                          vercel.json cannot see) skips every npm hook, and the
 *                          release path must not be routable around.
 *
 * `--release` is the only difference between them, for one reason: a Vercel
 * build has the project's own environment injected into it (VITE_SUPABASE_URL
 * and friends), so the bare condition cannot be observed from the outside —
 * the suite would simply fall back to Vercel's variables. In release mode this
 * removes every VITE_ var from the child process instead, and prints what it
 * removed, so the suite still runs with nothing to fall back on somewhere it
 * matters. Off Vercel, `--release` skips: a developer's checkout legitimately
 * has a .env, and their local build is not a release.
 *
 * The rule is not duplicated in YAML or anywhere else. Both callers run this.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Exactly the names Vitest loads (mode `test`), so a .env.example, a .envrc or
 * a renamed backup does not trip this by accident.
 */
const ENV_FILES = ['.env', '.env.local', '.env.test', '.env.test.local'];

const VITE_PREFIX = 'VITE_';

const release = process.argv.includes('--release');
const onVercel = Boolean(process.env.VERCEL);

if (release && !onVercel) {
  console.log(
    'bare-checkout guard (release): not a Vercel build — skipped. ' +
      'The release path is the Vercel build; run `npm run gate:bare` to enforce this rule here.',
  );
  process.exit(0);
}

const die = (message) => {
  console.error(`::error::bare-checkout guard: ${message}`);
  process.exit(1);
};

// ANTI-VACUITY. This guard only proves something if the checkout really is
// bare. An env file, or a VITE_ var reaching this run, would supply the very
// values the suite is supposed to do without — the run would pass while
// checking nothing. Fail loudly instead of passing quietly.
const envFiles = ENV_FILES.filter((name) => existsSync(join(process.cwd(), name)));
if (envFiles.length > 0) {
  die(
    `${envFiles.join(', ')} exists and would supply the vars this guard exists to prove unnecessary. ` +
      'Move it aside (a bare checkout is the condition under test).',
  );
}

const childEnv = { ...process.env };

if (release) {
  const injected = Object.keys(childEnv).filter((name) => name.startsWith(VITE_PREFIX)).sort();
  for (const name of injected) delete childEnv[name];
  if (injected.length > 0) {
    console.log(
      `bare-checkout guard (release): removed Vercel-injected ${injected.join(', ')} so the suite runs bare`,
    );
  }
}

const leaked = Object.keys(childEnv)
  .filter((name) => name.startsWith(VITE_PREFIX))
  .sort();
if (leaked.length > 0) {
  die(
    `VITE_ vars reached this run (${leaked.join(' ')}) — drop them so the suite runs bare. ` +
      'A var a test needs belongs in the test (vi.stubEnv in a vi.hoisted block), not in the environment.',
  );
}

console.log(
  `premise holds: none of ${ENV_FILES.join('/')} exists, and no VITE_ var is set — running the suite bare`,
);

// The suite itself, exactly as `npm test` runs it — no env supplied, and the
// child inherits stdio so its failure output lands in the build/CI log.
//
// NODE_ENV is the one thing normalized rather than inherited. From a shell, or
// from CI, `npm test` runs with no NODE_ENV and Vitest uses its test mode.
// Reached from the build it does not: Vite sets NODE_ENV=production for
// `vite build`, the suite would inherit it, React's dev-only APIs would be
// bundled away, and the run would fail wholesale for a reason that has nothing
// to do with the rule — measured: 44 files and 102 tests red, `act is not a
// function`, with nothing actually wrong with the tests.
childEnv.NODE_ENV = 'test';

const suite = spawnSync('npm', ['test'], {
  env: childEnv,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (suite.error) {
  die(`could not run the suite: ${suite.error.message}`);
}

process.exit(suite.status ?? 1);
