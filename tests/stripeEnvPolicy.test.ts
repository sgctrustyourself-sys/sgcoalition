// @vitest-environment node
//
// Node, not the suite's default jsdom, for the same reason as
// tests/releaseGateWiring.test.ts: this file imports the real vite.config.ts, and
// loading a Vite config pulls esbuild in, which asserts on realm identity inside
// jsdom. The pin is worth more against the config Vite actually loads.
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';
import {
    PLUGIN_NAME,
    assertProductionOnlyLiveKeys,
    liveStripeCredentials,
    stripeEnvPolicy,
} from '../utils/stripeEnvPolicy.mjs';

/**
 * Where a live Stripe credential may live, pinned.
 *
 * The rule's one owner is utils/stripeEnvPolicy.mjs; it exists because the Preview
 * scope held a live restricted key for a different live business while carrying no
 * publishable key, so a preview could create live objects on an account nothing
 * could reconcile and could not complete a checkout either. This file's value is
 * the pair of directions: a live key outside Production must be refused, and a
 * developer's live `.env` must not be.
 *
 * Every fixture is built from literals rather than spread from `process.env`. The
 * suite loads `.env`, so a spread would silently pick up this machine's live key
 * and the refusals below would pass or fail by ambient circumstance — the very
 * dependence the bare-checkout guard exists to catch.
 */
const LIVE_SECRET = 'sk_live_exampleSecretKey';
const LIVE_PUBLISHABLE = 'pk_live_examplePublishableKey';

describe('stripe environment policy', () => {
    it('refuses a preview build carrying a live secret key, naming it and the environment', () => {
        const env = { VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: LIVE_SECRET };
        expect(() => assertProductionOnlyLiveKeys(env)).toThrow(/STRIPE_SECRET_KEY/);
        expect(() => assertProductionOnlyLiveKeys(env)).toThrow(/preview/);
    });

    it('refuses a development build carrying a live publishable key', () => {
        const env = { VERCEL_ENV: 'development', VITE_STRIPE_PUBLISHABLE_KEY: LIVE_PUBLISHABLE };
        expect(() => assertProductionOnlyLiveKeys(env)).toThrow(/VITE_STRIPE_PUBLISHABLE_KEY/);
        expect(() => assertProductionOnlyLiveKeys(env)).toThrow(/development/);
    });

    it('allows Production to hold live credentials', () => {
        const env = {
            VERCEL_ENV: 'production',
            STRIPE_SECRET_KEY: LIVE_SECRET,
            VITE_STRIPE_PUBLISHABLE_KEY: LIVE_PUBLISHABLE,
        };
        expect(() => assertProductionOnlyLiveKeys(env)).not.toThrow();
        expect(liveStripeCredentials(env)).toHaveLength(2);
    });

    it("allows a developer's own machine, where live reads are the point", () => {
        expect(() => assertProductionOnlyLiveKeys({ STRIPE_SECRET_KEY: LIVE_SECRET })).not.toThrow();
    });

    it('allows test-mode credentials outside Production, and does not count them as live', () => {
        const env = { VERCEL_ENV: 'preview', STRIPE_SECRET_KEY: 'sk_test_x', VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_x' };
        expect(() => assertProductionOnlyLiveKeys(env)).not.toThrow();
        expect(liveStripeCredentials(env)).toEqual([]);
    });

    it('allows a preview to carry no Stripe credential at all', () => {
        expect(() => assertProductionOnlyLiveKeys({ VERCEL_ENV: 'preview' })).not.toThrow();
    });

    it('is reached by the build, not merely installed in the config', () => {
        // Behavioural, so this cannot pass on a plugin that mentions the rule
        // without consulting the environment it runs in.
        const before = { env: process.env.VERCEL_ENV, key: process.env.STRIPE_SECRET_KEY };
        process.env.VERCEL_ENV = 'preview';
        process.env.STRIPE_SECRET_KEY = LIVE_SECRET;
        try {
            expect(() => stripeEnvPolicy().buildStart?.()).toThrow(/live Stripe credential/);
        } finally {
            if (before.env === undefined) delete process.env.VERCEL_ENV;
            else process.env.VERCEL_ENV = before.env;
            if (before.key === undefined) delete process.env.STRIPE_SECRET_KEY;
            else process.env.STRIPE_SECRET_KEY = before.key;
        }
    });

    it('rides in the built config, and only for builds', () => {
        const config = (viteConfig as unknown as (env: { command: string; mode: string }) => {
            plugins?: unknown[];
        })({ command: 'build', mode: 'production' });
        const plugins = ((config.plugins ?? []) as unknown[]).flat(Infinity) as Array<Record<string, unknown>>;
        const policy = plugins.filter((plugin) => plugin?.name === PLUGIN_NAME);

        expect(policy, `vite.config.ts must install ${PLUGIN_NAME}`).toHaveLength(1);
        expect(policy[0].apply, `${PLUGIN_NAME} must apply to builds, not the dev server`).toBe('build');
        expect(typeof policy[0].buildStart, `${PLUGIN_NAME} must check when the build starts`).toBe('function');
    });
});
