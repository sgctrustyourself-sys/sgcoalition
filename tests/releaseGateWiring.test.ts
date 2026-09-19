// @vitest-environment node
//
// Deliberately node, not the suite's default jsdom: this file imports the real
// vite.config.ts, and loading a Vite config pulls esbuild in, which asserts on
// realm identity (`new TextEncoder().encode('') instanceof Uint8Array`) and
// fails inside jsdom's realm. The pin is worth more against the config Vite
// actually loads than against a re-description of it.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';
import {
    GUARD_MODE,
    GUARD_SCRIPT,
    PLUGIN_NAME,
    VERDICT_FILE,
    publishGateVerdict,
    verdictHandoffPath,
} from '../utils/bareCheckoutGate.mjs';

/**
 * The bare-checkout rule's callers, pinned by what they actually invoke.
 *
 * The rule itself — assert the checkout is bare, then run the suite with nothing
 * to fall back on — has one owner: scripts/bareCheckoutGuard.mjs. What is pinned
 * here is that the release path *reaches* it, because that is what a future edit
 * can quietly delete while every other check stays green.
 *
 * The release path is the build, not an npm hook. It used to be `prebuild`, and
 * that was routable around: `prebuild` only fires when the build runs through
 * `npm run build`, so a Vercel build command of `npx vite build` — a dashboard
 * setting, which overrides vercel.json and which no test can see — skipped the
 * guard entirely and finished green. Vite loads its config for any `vite build`,
 * so the caller now rides in the config, and that is what these pins defend.
 *
 * Each pin asserts an invocation rather than a name in prose: the plugin is
 * found by its identity in the built config, and the script it runs is compared
 * against the one CI runs, resolved through package.json. Renaming an alias or
 * reformatting the workflow stays green; deleting the caller, making it a dev
 * server plugin, or pointing it somewhere else goes red.
 *
 * The last pin covers what a *deployment* can be asked: a build log needs
 * dashboard access and a Vercel token, so the rule's verdict ships with the app
 * at /gate-verdict.json instead, and a build that has no such record must not
 * finish. What is exercised here is that handoff — read the rule's record, or
 * refuse; publish the rule's own bytes, and consume them so nothing can be
 * replayed. The writing half belongs to the guard, which runs the suite, so it
 * is proven by a real build rather than from inside the suite it runs.
 */
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readText = (relative: string) => readFileSync(path.join(projectRoot, relative), 'utf8');
const readJson = (relative: string) => JSON.parse(readText(relative));

const GUARD = 'scripts/bareCheckoutGuard.mjs';

/** The guard, invoked as its own command — not something that mentions it. */
const GUARD_INVOCATION = /^(?:node\s+)?\.?\/?scripts\/bareCheckoutGuard\.mjs(?:\s+--release)?$/;

/** The post-deploy check of the live deployment's verdict. */
const VERDICT_CHECK_INVOCATION = /^(?:node\s+)?\.?\/?scripts\/verify-gate-verdict\.mjs$/;

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

/** The config is a function (defineConfig(() => …)); call it the way Vite would. */
const builtPlugins = (): Array<Record<string, unknown>> => {
    const config = (viteConfig as unknown as (env: { command: string; mode: string }) => {
        plugins?: unknown[];
    })({ command: 'build', mode: 'production' });
    return ((config.plugins ?? []) as unknown[]).flat(Infinity) as Array<Record<string, unknown>>;
};

describe('release gate wiring', () => {
    it('carries the guard in the build itself, not in a hook a build command can skip', () => {
        const gate = builtPlugins().filter((plugin) => plugin?.name === PLUGIN_NAME);
        expect(
            gate,
            `vite.config.ts must install the ${PLUGIN_NAME} plugin — that is what makes the release path refuse`,
        ).toHaveLength(1);

        // A dev-only or inert plugin would leave every build ungated while this
        // plugin was still "installed", so the shape of the caller is pinned too.
        const plugin = gate[0];
        expect(plugin.apply, `${PLUGIN_NAME} must apply to builds`).not.toBe('serve');
        expect(typeof plugin.buildStart, `${PLUGIN_NAME} must run the guard when the build starts`).toBe(
            'function',
        );
    });

    it('runs the same rule CI runs, in the mode that cannot pass vacuously', () => {
        const scripts = readJson('package.json').scripts as Record<string, string>;

        // One rule, two callers: the script this plugin runs must be the very
        // script `npm run gate:bare` runs.
        const ciTarget = commandsOf(scripts['gate:bare'] ?? '', scripts).find((command) =>
            GUARD_INVOCATION.test(command),
        );
        expect(ciTarget, `gate:bare must invoke ${GUARD}`).toBeTruthy();
        expect(GUARD_SCRIPT, 'the build and CI must run the same guard script').toBe(
            (ciTarget as string).replace(/^node\s+/, ''),
        );
        expect(existsSync(path.join(projectRoot, GUARD)), `${GUARD} must exist`).toBe(true);

        // Release mode, not the bare default: a Vercel build injects the
        // project's VITE_ vars, so a run that keeps them can pass while
        // checking nothing.
        expect(GUARD_MODE, 'the build must call the guard in release mode').toBe('--release');
    });

    it("keeps CI's caller enforcing, where it cannot silently skip", () => {
        const scripts = readJson('package.json').scripts as Record<string, string>;
        const resolved = runCommandsOf(readText('.github/workflows/ci.yml')).flatMap((command) =>
            commandsOf(command, scripts),
        );

        const guardCalls = resolved.filter((command) => GUARD_INVOCATION.test(command));
        expect(guardCalls, 'ci.yml must invoke the guard, as its bare-checkout job does').not.toHaveLength(
            0,
        );
        // The guard's release mode stops when it is not on a Vercel build, so wiring CI
        // that way would leave the job green while checking nothing at all.
        expect(
            guardCalls.filter((command) => command.includes('--release')),
            'ci.yml must call the guard in its enforcing mode, not its release mode',
        ).toHaveLength(0);
    });

    it("ships the rule's own verdict with the build, and refuses to finish without one", () => {
        const handoff = verdictHandoffPath();
        const emitted: Array<{ fileName: string; source: string }> = [];
        const context = {
            emitFile: (file: { fileName: string; source: string }) => emitted.push(file),
        };

        // No record: this build has nothing to show, so it must not finish.
        rmSync(handoff, { force: true });
        expect(() => publishGateVerdict.call(context)).toThrow(/did not record a verdict/);
        expect(emitted, 'a build without a record must publish nothing').toHaveLength(0);

        // The rule's own bytes are what ship — not a summary this module invented.
        const record = {
            rule: 'bare-checkout',
            verdict: 'passed',
            suite: { files: { passed: 68, failed: 0 }, tests: { passed: 940, failed: 0 } },
        };
        mkdirSync(path.dirname(handoff), { recursive: true });
        writeFileSync(handoff, `${JSON.stringify(record, null, 2)}\n`);
        try {
            publishGateVerdict.call(context);
        } finally {
            rmSync(handoff, { force: true });
        }

        expect(emitted).toHaveLength(1);
        expect(emitted[0].fileName).toBe(VERDICT_FILE);
        expect(JSON.parse(emitted[0].source)).toEqual(record);
        expect(existsSync(handoff), 'the record is consumed, so it cannot be replayed').toBe(false);
    });

    it('asks the live deployment for that verdict once it ships', () => {
        const scripts = readJson('package.json').scripts as Record<string, string>;
        const workflow = readText('.github/workflows/post-deploy-gate.yml');

        // The trigger is as load-bearing as the call: no deployment_status, no
        // check, and a deployment nobody asks about is a deployment nobody checked.
        expect(workflow, 'the check must run when a deployment succeeds').toMatch(
            /^\s*deployment_status:/m,
        );

        const calls = runCommandsOf(workflow).flatMap((command) => commandsOf(command, scripts));
        expect(
            calls.filter((command) => VERDICT_CHECK_INVOCATION.test(command)),
            'post-deploy-gate.yml must run scripts/verify-gate-verdict.mjs (as `npm run test:gate-verdict`)',
        ).not.toHaveLength(0);
    });
});
