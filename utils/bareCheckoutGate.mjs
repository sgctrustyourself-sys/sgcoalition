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
 * Off Vercel the guard skips itself: a developer's checkout legitimately has a
 * .env and is not a release. So a local build pays one process spawn, and every
 * Vercel build pays the suite — the same run `prebuild` used to make, moved to
 * where a build command cannot route around it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

/**
 * Run the rule, and refuse this build unless it passes. stdio is inherited, so
 * the guard's own output and the suite's failures land in the build log rather
 * than behind a wall of "build failed".
 */
export function runBareCheckoutGate() {
  const guard = resolve(process.cwd(), GUARD_SCRIPT);

  if (!existsSync(guard)) {
    throw new Error(
      `bare-checkout gate: ${GUARD_SCRIPT} is missing, so the rule cannot run — refusing to finish this build.`,
    );
  }

  const result = spawnSync(process.execPath, [guard, GUARD_MODE], { stdio: 'inherit' });

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
 * The rule, as a Vite plugin. `apply: 'build'` keeps the dev server and
 * `vite preview` untouched; only a build — the thing that becomes a deploy —
 * is gated.
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
  };
}
