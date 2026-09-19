// @vitest-environment node
//
// Node rather than the suite's jsdom default: this file is pure filesystem and
// string work over the policy module and the guard's source — no DOM in it, and
// the policy is what the release gate relies on, so it is exercised directly.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    deploymentEnvNames,
    isDeploymentEnvName,
    projectEnvNames,
    stripDeploymentEnv,
} from '../utils/deploymentEnv.mjs';

/**
 * The bare-checkout rule's blind spot, pinned.
 *
 * The rule used to strip VITE_ vars only, so a test leaning on anything else a
 * Vercel build injects — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * STRIPE_SECRET_KEY, RESEND_API_KEY, ADMIN_API_TOKEN — passed in a release and
 * would have failed on a clean checkout. That is the same defect the rule was
 * written for, one prefix past where it was looking.
 *
 * What these pins defend is the *class*, because the class is what widened:
 *
 *   1. every var the deployment actually declares is covered — read from
 *      .env.production.template, so adding an integration without teaching the
 *      policy about it goes red instead of shipping a new blind spot;
 *   2. the names the app and the suite are measurably reading are covered;
 *   3. the platform and toolchain remain untouched, since the suite reads them
 *      to know where it is running and stripping them would break the build's
 *      machinery rather than the rule;
 *   4. the rule strips exactly this class and nothing else;
 *   5. the rule has no second copy of the class — no prefix of its own to drift
 *      away from this one.
 *
 * The class is wider than what a *bare run* asserts, and that gap is pinned too:
 * the first release run with the widened class stripped this machine's
 * FREEBUFF_CDP_BRIDGE_TOKEN and SYSTEMCLEANER_SIGNING_KEY, which is correct for a
 * strip and would be a false alarm for an assertion — a checkout is not impure
 * because some unrelated tool exported a credential.
 */
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readText = (relative: string) => readFileSync(path.join(projectRoot, relative), 'utf8');

describe('deployment env policy', () => {
    it('covers every var the deployment declares', () => {
        const declared = [...readText('.env.production.template').matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(
            (match) => match[1],
        );

        // Anti-vacuity floor, in this repo's convention: an empty or unparsed
        // template would otherwise let the loop below pass while checking nothing.
        expect(declared.length, 'no vars parsed out of .env.production.template').toBeGreaterThan(10);

        expect(
            declared.filter((name) => !isDeploymentEnvName(name)),
            'declared in .env.production.template but not treated as the deployment\'s own — a test reading it ' +
                'would pass in a release and fail on a clean checkout',
        ).toEqual([]);
    });

    it('covers what the app and the suite actually read', () => {
        // Measured from the tree: the names handlers and tests read today. Several
        // are covered only by their shape (ADMIN_API_TOKEN, WEBHOOK_SECRET), which
        // is the point of a class over a list of prefixes.
        const readInTree = [
            'VITE_SUPABASE_URL',
            'VITE_SUPABASE_ANON_KEY',
            'VITE_STRIPE_PUBLISHABLE_KEY',
            'VITE_DISCORD_CLIENT_SECRET',
            'VITE_APP_URL',
            'VITE_SENTRY_DSN',
            'SUPABASE',
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',
            'STRIPE_SECRET_KEY',
            'STRIPE_WEBHOOK_SECRET',
            'RESEND_API_KEY',
            'RESEND_FROM_EMAIL',
            'GEMINI_API_KEY',
            'ADMIN_API_TOKEN',
            'ADMIN_PASSPHRASE',
            'ADMIN_TOKEN',
            'ORDER_NOTIFICATION_EMAIL',
            'AI_SESSION_SECRET',
            'FULL_AI_PASSWORD',
            'WEBHOOK_SECRET',
            'VERCEL_OIDC_TOKEN',
            'VERCEL_AUTOMATION_BYPASS_SECRET',
        ];

        expect(
            readInTree.filter((name) => !isDeploymentEnvName(name)),
            'read in the tree, but outside the class the rule strips',
        ).toEqual([]);
    });

    it('leaves the platform and the toolchain alone', () => {
        // Identity, not configuration: the suite is allowed to know where it is
        // running, and the toolchain needs its own namespaces. The split is
        // deliberate — VERCEL_ENV says where this build ran and is kept;
        // VERCEL_OIDC_TOKEN is a credential and is stripped (proven below).
        const kept = [
            'CI',
            'NODE_ENV',
            'PATH',
            'HOME',
            'TMPDIR',
            'TEMP',
            'SHELL',
            'LANG',
            'VERCEL',
            'VERCEL_ENV',
            'VERCEL_URL',
            'VERCEL_DEPLOYMENT_ID',
            'VERCEL_GIT_COMMIT_SHA',
            'GITHUB_TOKEN',
            'GITHUB_SHA',
            'RUNNER_TEMP',
            'ACTIONS_RUNTIME_TOKEN',
            'ACTIONS_ID_TOKEN_REQUEST_URL',
            'npm_config_cache',
            'npm_lifecycle_event',
            'NODE_OPTIONS',
            'VITEST_POOL_ID',
        ];

        expect(
            kept.filter((name) => isDeploymentEnvName(name)),
            'platform or toolchain vars must not be stripped — the build needs them, and they are not the ' +
                'deployment\'s configuration',
        ).toEqual([]);
    });

    it('strips exactly that class, leaving the rest of the environment working', () => {
        const before = {
            PATH: '/usr/local/bin',
            HOME: '/home/runner',
            NODE_ENV: 'production',
            VERCEL: '1',
            VERCEL_ENV: 'production',
            VERCEL_GIT_COMMIT_SHA: 'abc123',
            GITHUB_TOKEN: 'ghs_x',
            npm_config_cache: '/home/runner/.npm',
            VITE_SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'service-role',
            STRIPE_SECRET_KEY: 'sk_live_x',
            ORDER_NOTIFICATION_EMAIL: 'orders@example.com',
        };

        const { env, stripped } = stripDeploymentEnv(before);

        expect(stripped).toEqual([
            'ORDER_NOTIFICATION_EMAIL',
            'STRIPE_SECRET_KEY',
            'SUPABASE_SERVICE_ROLE_KEY',
            'VITE_SUPABASE_URL',
        ]);
        expect(env).toEqual({
            PATH: '/usr/local/bin',
            HOME: '/home/runner',
            NODE_ENV: 'production',
            VERCEL: '1',
            VERCEL_ENV: 'production',
            VERCEL_GIT_COMMIT_SHA: 'abc123',
            GITHUB_TOKEN: 'ghs_x',
            npm_config_cache: '/home/runner/.npm',
        });
        // The rule keeps reading its own environment to know where it is running,
        // so the caller passes a copy and this must not be mutated in place.
        expect(before, 'the input environment must not be mutated').toHaveProperty('STRIPE_SECRET_KEY');
        expect(deploymentEnvNames({ STRIPE_SECRET_KEY: '', PATH: '/bin' })).toEqual(['STRIPE_SECRET_KEY']);
    });

    it("keeps an unrelated tool's ambient credential out of the bare check", () => {
        // Measured on a real release run, not hypothetical: the widened class
        // stripped FREEBUFF_CDP_BRIDGE_TOKEN and SYSTEMCLEANER_SIGNING_KEY from
        // this machine's environment. Stripping those is harmless; refusing a
        // bare run over them would be a false alarm about a bare checkout.
        const ambient = {
            FREEBUFF_CDP_BRIDGE_TOKEN: 'x',
            SYSTEMCLEANER_SIGNING_KEY: 'x',
            SYSTEMCLEANER_ED25519_PRIVATE_KEY: 'x',
            VERCEL_OIDC_TOKEN: 'x',
        };
        expect(projectEnvNames(ambient), "another tool's credential is not this project's config").toEqual([]);
        expect(
            deploymentEnvNames(ambient),
            'the strip still covers them: a release must run without any credential the build injected',
        ).toEqual([
            'FREEBUFF_CDP_BRIDGE_TOKEN',
            'SYSTEMCLEANER_ED25519_PRIVATE_KEY',
            'SYSTEMCLEANER_SIGNING_KEY',
            'VERCEL_OIDC_TOKEN',
        ]);

        // And the other direction: this project's own vars are a finding in both
        // readings, so a bare run cannot pass while leaning on the deployment's.
        const project = { ...ambient, ORDER_NOTIFICATION_EMAIL: 'x', STRIPE_SECRET_KEY: 'x', SUPABASE_URL: 'x', VITE_SUPABASE_URL: 'x' };
        expect(projectEnvNames(project)).toEqual([
            'ORDER_NOTIFICATION_EMAIL',
            'STRIPE_SECRET_KEY',
            'SUPABASE_URL',
            'VITE_SUPABASE_URL',
        ]);
    });

    it('has one owner: the guard takes the class from this policy, not a prefix of its own', () => {
        const guard = readText('scripts/bareCheckoutGuard.mjs');

        expect(guard, 'the guard must take the class from utils/deploymentEnv.mjs').toContain(
            "from '../utils/deploymentEnv.mjs'",
        );
        // The old, too-narrow rule, which left the same defect one prefix over.
        expect(guard, 'the guard must not carry a second copy of the class').not.toMatch(
            /VITE_PREFIX|startsWith\(['"]VITE_['"]\)/,
        );
    });
});
