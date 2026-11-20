/**
 * ── Where a live Stripe credential may live ───────────────────────────────
 *
 * The rule: a *live* Stripe credential belongs to the Production environment and
 * to no other. Preview and Development get Stripe test-mode keys, or none.
 *
 * Why it exists, measured before it did: this project's Preview scope held a live
 * restricted key for a *different* live business (acct_1TDVw…, "nexusdesign.agency")
 * while carrying no publishable key at all. A preview could therefore create live
 * PaymentIntents on an account with zero webhook endpoints — so nothing could ever
 * reconcile them — and could not mount a Stripe Element, so no checkout could
 * complete there either. That state is not a sandbox and not production: it is the
 * worst of both, and its only measurable output was real live objects created by
 * test tooling (a $45 intent stamped `smoke@example.com`, 2026-09-20). Development
 * carried the same business's key, which is what `vercel dev` injects — a silent
 * substitution of one live account for another, invisible in every log.
 *
 * Why a build plugin rather than a checklist: the same reasoning as the
 * bare-checkout gate next door (utils/bareCheckoutGate.mjs). Vite loads its config
 * for any `vite build`, however the build is invoked; an npm lifecycle hook is
 * skipped the moment the platform's build command points straight at the bundler.
 * A preview handed a live key therefore fails to build, which is the one failure
 * nobody can route around.
 *
 * Off Vercel the rule says nothing at all. A developer's `.env` legitimately holds
 * the live key — that is the one place live reads are wanted, and
 * scripts/stripeWhoami.ts reports exactly which account they reach. `VERCEL_ENV`
 * is the difference: it is the platform stating where this build ran.
 *
 * Not covered, deliberately: STRIPE_WEBHOOK_SECRET. A webhook signing secret is
 * `whsec_` whether it signs test or live events, so its value cannot say which
 * mode it belongs to. Preview deployments are not webhook targets anyway — the
 * endpoint registered on the live account points at production.
 */

/** The plugin's name, and the handle the wiring test looks for in the built config. */
export const PLUGIN_NAME = 'stripe-env-policy';

/** The variables that carry a Stripe credential. */
const CREDENTIAL_NAMES = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'VITE_STRIPE_PUBLISHABLE_KEY'];

/** A value shape only Stripe's live mode issues. */
const LIVE_PREFIXES = ['sk_live_', 'rk_live_', 'pk_live_'];

/** Which of the credential variables actually hold a live value. */
export const liveStripeCredentials = (env = process.env) =>
  CREDENTIAL_NAMES.filter((name) => {
    const value = String(env[name] ?? '').trim();
    return LIVE_PREFIXES.some((prefix) => value.startsWith(prefix));
  });

/**
 * Refuse a non-production Vercel build that was handed a live credential.
 * Off Vercel (VERCEL_ENV unset) and in Production, this is a no-op.
 */
export function assertProductionOnlyLiveKeys(env = process.env) {
  const environment = env.VERCEL_ENV;
  if (!environment || environment === 'production') return;

  const offenders = liveStripeCredentials(env);
  if (offenders.length === 0) return;

  throw new Error(
    `stripe-env-policy: ${offenders.join(', ')} ${offenders.length === 1 ? 'holds a live Stripe credential' : 'hold live Stripe credentials'} ` +
      `in the ${environment} environment. Live credentials belong to Production only — a preview or development build must use Stripe ` +
      `test-mode keys, or none. Remove the live value from the Vercel ${environment} scope ` +
      '(Project → Settings → Environment Variables).',
  );
}

/**
 * The rule, as a Vite plugin. `apply: 'build'` leaves the dev server and
 * `vite preview` untouched: only a build — the thing that becomes a deployment —
 * is gated. `vercel dev` runs the dev server, so a developer's live `.env` is
 * unaffected by design.
 *
 * @returns {import('vite').Plugin}
 */
export function stripeEnvPolicy() {
  return {
    name: PLUGIN_NAME,
    apply: 'build',
    buildStart() {
      assertProductionOnlyLiveKeys();
    },
  };
}
