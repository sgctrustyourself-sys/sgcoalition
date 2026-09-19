/**
 * ── The build-side caller of the bare-checkout rule ───────────────────────
 *
 * The rule has exactly one owner: scripts/bareCheckoutGuard.mjs. This module is
 * how the *build* reaches it, and it exists because of one measured bypass.
 *
 * `prebuild` is an npm lifecycle hook, so it only fires when the build is
 * invoked through `npm run build`. Point Vercel's build command at `npx vite
 * build` — a dashboard setting, which overrides vercel.json and which nothing
 * in the repo can see — and every npm hook is skipped: the guard never runs,
 * the build finishes green, and a test that silently depends on an env var
 * production does not have reaches production with the release path never
 * refusing. A previously verified deployment pair showed exactly that: the same
 * hidden dependency shipped from main and was refused only when the hook was
 * reached.
 *
 * Vite loads its config for any `vite build`, however it was invoked, so the
 * check rides in the build itself: the rule runs as the first thing the build
 * does, and the build aborts if it does not exit 0. Nothing has to be inferred
 * or attested — there is no token file to go stale, be committed, or be replayed,
 * because the guard is *run*.
 *
 * The rule's verdict then ships with the app, at /gate-verdict.json. A build log
 * is the one place a deploy's evidence normally lives, and reading it needs
 * dashboard access and a Vercel token; a served record needs neither, so
 * "did this deployment run the rule, and what did it check?" is answerable with
 * a curl. The file is the rule's own record, not this module's summary of it,
 * and a build may not finish without it: a deployment that cannot show the rule
 * ran is the thing this whole thread exists to prevent.
 *
 * Off Vercel the guard skips itself: a developer's checkout legitimately has a
 * .env and is not a release. So a local build pays one process spawn and
 * publishes a verdict of `skipped`, and every Vercel build pays the suite — the
 * same run `prebuild` used to make, moved to where a build command cannot route
 * around it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/** The plugin's name, and the handle the wiring test looks for in the built config. */
export const PLUGIN_NAME = 'bare-checkout-gate';

/** The rule. The wiring test asserts this is the same script `npm run gate:bare` runs. */
export const GUARD_SCRIPT = 'scripts/bareCheckoutGuard.mjs';

/**
 * Release mode, and it must stay release mode: a Vercel build has the project's
 * own VITE_ vars injected into it, so without stripping them the suite would
 * fall back to them and pass while checking nothing.
 */
export const GUARD_MODE = '--release';

/** Where the rule's record is served from, and where the rule writes it for us. */
export const VERDICT_FILE = 'gate-verdict.json';

const HANDOFF = ['node_modules', '.cache', 'bare-checkout-gate', 'verdict.json'];

/**
 * Under node_modules on purpose: this file is a handoff between two processes of
 * the same build, not a source artifact, and node_modules is ignored by git — so
 * a record can neither be committed to satisfy a build nor survive a fresh clone.
 */
export const verdictHandoffPath = () => resolve(process.cwd(), ...HANDOFF);

/** Run the rule, and refuse this build unless it passes. */
export function runBareCheckoutGate() {
  const guard = resolve(process.cwd(), GUARD_SCRIPT);

  if (!existsSync(guard)) {
    throw new Error(
      `bare-checkout gate: ${GUARD_SCRIPT} is missing, so the rule cannot run — refusing to finish this build.`,
    );
  }

  // A previous build's record must never be republished as this build's proof.
  rmSync(verdictHandoffPath(), { force: true });

  const result = spawnSync(
    process.execPath,
    [guard, GUARD_MODE, '--verdict', verdictHandoffPath()],
    { stdio: 'inherit' },
  );

  if (result.error) {
    throw new Error(`bare-checkout gate: could not run ${GUARD_SCRIPT}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `bare-checkout gate: ${GUARD_SCRIPT} ${GUARD_MODE} exited ${result.status}, so this build is refused. ` +
        'A red suite here means a test depends on something this build supplies — the fix belongs in the test, ' +
        'because shipping it would carry a dependence the deployed app cannot satisfy.',
    );
  }
}

/**
 * Ship the rule's record with the build. Called as a Rollup hook, so `this` is
 * the plugin context that can emit a file into the output.
 */
export function publishGateVerdict() {
  const handoff = verdictHandoffPath();

  if (!existsSync(handoff)) {
    throw new Error(
      `bare-checkout gate: the rule did not record a verdict, so this build cannot show that it ran — ` +
        `refusing to finish. Expected ${VERDICT_FILE} to come from ${GUARD_SCRIPT}.`,
    );
  }

  this.emitFile({ type: 'asset', fileName: VERDICT_FILE, source: readFileSync(handoff, 'utf8') });
  rmSync(handoff, { force: true });
}

/**
 * The rule, as a Vite plugin. `apply: 'build'` keeps the dev server and
 * `vite preview` untouched; only a build — the thing that becomes a deploy — is
 * gated, and only a build publishes the proof.
 *
 * @returns {import('vite').Plugin}
 */
export function bareCheckoutGate() {
  return {
    name: PLUGIN_NAME,
    apply: 'build',
    buildStart() {
      runBareCheckoutGate();
    },
    generateBundle() {
      publishGateVerdict.call(this);
    },
  };
}
