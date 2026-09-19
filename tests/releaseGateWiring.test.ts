import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The bare guard's two callers, pinned by the calls they make.
 *
 * `prebuild` reaching scripts/bareCheckoutGuard.mjs is the entire enforcement of
 * "the release path refuses while the bare guard is red": delete that clause, or
 * point Vercel's build at something that does not fire the npm hook, and the
 * release path stops refusing while every other check stays green. Nothing else
 * in the suite looks at the wiring, so it is pinned here — and cheaply: no suite
 * runs inside these tests, only the two files that describe the calls.
 *
 * Each pin asserts an invocation, not a name in prose, and resolves
 * `npm run <alias>` through package.json before matching. So renaming an alias
 * or reformatting the workflow stays green, while deleting the call, moving it
 * somewhere that never runs, or redirecting it goes red.
 */
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readText = (relative: string) => readFileSync(path.join(projectRoot, relative), 'utf8');
const readJson = (relative: string) => JSON.parse(readText(relative));

const GUARD = 'scripts/bareCheckoutGuard.mjs';

/** The guard, invoked as its own command — not something that mentions it. */
const GUARD_INVOCATION = /^(?:node\s+)?\.?\/?scripts\/bareCheckoutGuard\.mjs(?:\s+--release)?$/;

/** One command of a `&&` chain, with `npm run <alias>` resolved to the script it names. */
function resolveAliases(command: string, scripts: Record<string, string>, depth = 0): string {
    const alias = command.trim().match(/^npm run ([^\s&|]+)$/);
    if (!alias) return command.trim();
    const target = scripts[alias[1]];
    if (target === undefined || depth >= 5) return '';
    return target.split('&&').map((part) => resolveAliases(part, scripts, depth + 1)).join(' && ');
}

const commandsOf = (script: string, scripts: Record<string, string>): string[] =>
    script.split('&&').map((part) => resolveAliases(part, scripts));

/** Every `run:` value in a workflow. Anchored at `run:`, so a commented-out call cannot match. */
const runCommandsOf = (workflow: string): string[] =>
    [...workflow.matchAll(/^[ \t]*run:[ \t]*(.+?)[ \t]*$/gm)].map((match) =>
        match[1].replace(/^['"]|['"]$/g, ''),
    );

describe('release gate wiring', () => {
    it('reaches the guard from the build Vercel is configured to run', () => {
        const scripts = readJson('package.json').scripts as Record<string, string>;

        // `prebuild` is an npm lifecycle hook: it fires for `npm run build` and for
        // no other command, so a build command that is not this never reaches the
        // guard at all — the quietest way this guarantee can stop existing.
        expect(readJson('vercel.json').buildCommand.trim()).toBe('npm run build');

        const prebuild = scripts.prebuild ?? '';
        const invocation = commandsOf(prebuild, scripts).find((command) => GUARD_INVOCATION.test(command));
        expect(invocation, `prebuild must invoke ${GUARD}; it currently is: ${prebuild}`).toBeTruthy();
        expect(existsSync(path.join(projectRoot, GUARD)), `${GUARD} must exist (a clean build is what catches this)`).toBe(true);
    });

    it("keeps CI's caller enforcing, where it cannot silently skip", () => {
        const scripts = readJson('package.json').scripts as Record<string, string>;
        const resolved = runCommandsOf(readText('.github/workflows/ci.yml')).flatMap((command) =>
            commandsOf(command, scripts),
        );

        const guardCalls = resolved.filter((command) => GUARD_INVOCATION.test(command));
        expect(guardCalls, 'ci.yml must invoke the guard, as its bare-checkout job does').not.toHaveLength(0);
        // The guard's release mode stops when it is not on a Vercel build, so wiring CI
        // that way would leave the job green while checking nothing at all.
        expect(
            guardCalls.filter((command) => command.includes('--release')),
            'ci.yml must call the guard in its enforcing mode, not its release mode',
        ).toHaveLength(0);
    });
});
