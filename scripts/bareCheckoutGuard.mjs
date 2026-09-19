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
 * `--verdict <path>` writes the rule's own record of what it decided, whenever
 * it is asked to. Its only caller is the release path, which publishes that
 * record with the app, so a deployment can be checked without reading a build
 * log. The record carries the suite's counts because "the suite ran and passed"
 * is worth nothing if it collected nothing — and the build may not finish
 * without it.
 *
 * The rule is not duplicated in YAML or anywhere else. Both callers run this.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Exactly the names Vitest loads (mode `test`), so a .env.example, a .envrc or
 * a renamed backup does not trip this by accident.
 */
const ENV_FILES = ['.env', '.env.local', '.env.test', '.env.test.local'];

const VITE_PREFIX = 'VITE_';

const release = process.argv.includes('--release');
const onVercel = Boolean(process.env.VERCEL);

const verdictFlag = process.argv.indexOf('--verdict');
const verdictPath = verdictFlag > -1 ? process.argv[verdictFlag + 1] : undefined;

const commitSha = () => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return rev.status === 0 ? rev.stdout.trim() : null;
};

/**
 * What the rule decided, in the rule's own words. Written only when a caller
 * asked for it (`--verdict <path>`), so the CI caller stays a plain exit code.
 */
const writeVerdict = (verdict, extra = {}) => {
  if (!verdictPath) return;
  mkdirSync(dirname(verdictPath), { recursive: true });
  writeFileSync(
    verdictPath,
    `${JSON.stringify(
      {
        rule: 'bare-checkout',
        ruleScript: 'scripts/bareCheckoutGuard.mjs',
        mode: release ? 'release' : 'bare',
        verdict,
        ranAt: new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? (onVercel ? 'vercel' : 'local'),
        commit: commitSha(),
        ...extra,
      },
      null,
      2,
    )}\n`,
  );
};

/** Vitest's own summary, so the record shows how much was actually checked. */
const suiteCounts = (output) => {
  // Vitest colors that summary even when its output is a pipe, so the escapes
  // come off first — otherwise every count silently records as null, and a
  // record that cannot say what the suite contained is barely a record.
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
  // A null line means the suite never got far enough to summarise at all; a
  // line that is present but does not mention failures means none.
  const summaryLine = (label) =>
    plain.match(new RegExp(`^\\s*${label}\\s+(.+)$`, 'm'))?.[1] ?? null;
  const count = (source, word) => {
    if (source === null) return null;
    const match = source.match(new RegExp(`(\\d+)\\s+${word}`));
    return match ? Number(match[1]) : 0;
  };
  const files = summaryLine('Test Files');
  const tests = summaryLine('Tests');
  return {
    files: { passed: count(files, 'passed'), failed: count(files, 'failed') },
    tests: { passed: count(tests, 'passed'), failed: count(tests, 'failed') },
  };
};

if (release && !onVercel) {
  console.log(
    'bare-checkout guard (release): not a Vercel build — skipped. ' +
      'The release path is the Vercel build; run `npm run gate:bare` to enforce this rule here.',
  );
  writeVerdict('skipped');
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

// The suite itself, exactly as `npm test` runs it — no env supplied, and its
// output streamed straight through so failures land in the build/CI log.
//
// NODE_ENV is the one thing normalized rather than inherited. From a shell, or
// from CI, `npm test` runs with no NODE_ENV and Vitest uses its test mode.
// Reached from the build it does not: Vite sets NODE_ENV=production for
// `vite build`, the suite would inherit it, React's dev-only APIs would be
// bundled away, and the run would fail wholesale for a reason that has nothing
// to do with the rule — measured: 44 files and 102 tests red, `act is not a
// function`, with nothing actually wrong with the tests.
childEnv.NODE_ENV = 'test';

const suite = spawn('npm', ['test'], { env: childEnv, shell: process.platform === 'win32' });

const captured = [];
suite.stdout.on('data', (chunk) => {
  captured.push(chunk);
  process.stdout.write(chunk);
});
suite.stderr.pipe(process.stderr);

const outcome = await new Promise((resolve) => {
  suite.on('error', (error) => resolve({ status: 1, error }));
  suite.on('close', (code, signal) => resolve({ status: signal ? 1 : code ?? 1 }));
});

if (outcome.error) {
  die(`could not run the suite: ${outcome.error.message}`);
}

writeVerdict(outcome.status === 0 ? 'passed' : 'failed', {
  suite: suiteCounts(Buffer.concat(captured).toString('utf8')),
});

process.exit(outcome.status);
