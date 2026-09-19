/**
 * ── Which env vars are the deployment's own ───────────────────────────────
 *
 * The bare-checkout rule (scripts/bareCheckoutGuard.mjs) exists because a test
 * that quietly leans on an env var its environment supplies is green there and
 * red on a clean checkout. It used to know one prefix, VITE_, which left the
 * same class open one name over: a Vercel build injects the project's *service*
 * credentials too — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
 * RESEND_API_KEY, ADMIN_API_TOKEN — so a test reading any of those passed in a
 * release and would have failed for a fresh clone. Same defect, one prefix past
 * the rule's blind spot.
 *
 * This module is the single owner of the distinction, so the rule, its caller
 * and its tests all mean the same thing by "bare". A var belongs to the
 * deployment if it is client-exposed (VITE_*), if it belongs to an integration
 * this app is wired to, or if it is shaped like the configuration a deployment
 * hands an app (…_KEY, …_SECRET, …_TOKEN, …_URL, …_EMAIL, …). The shape rule
 * matters as much as the list: a new integration's KEY/SECRET is covered the day
 * it is added, not the day someone remembers this file.
 *
 * Two readings of that set, because two things are asked of it. A *release*
 * (`--release`) has the deployment's environment injected into it, so it strips the
 * whole class before running the suite: the class is the strip target. A *bare
 * run* has nothing to strip — it asserts instead, and asserts the narrower
 * `projectEnvNames`: this project's own namespaces (VITE_*, SUPABASE_*, STRIPE_*,
 * …). A shell or runner image carrying some unrelated tool's credential is not a
 * finding about this checkout, but a project var reaching a run that claims to be
 * bare is exactly the false-pass the assertion exists to prevent.
 *
 * What is deliberately NOT the deployment's: the platform describing the build
 * (VERCEL, VERCEL_ENV, VERCEL_URL, VERCEL_GIT_*, CI, GITHUB_*, RUNNER_*,
 * ACTIONS_*) and the toolchain's own settings (npm_*, NODE_*, VITEST*). Those
 * are exempt because stripping them would break the build's machinery, not the
 * rule — and because the suite legitimately reads them to know where it is
 * running. The line is identity versus configuration: `VERCEL_ENV` says where
 * this build ran, and is kept; `VERCEL_OIDC_TOKEN` and
 * `VERCEL_AUTOMATION_BYPASS_SECRET` are credentials the platform issued, and are
 * stripped like any other credential a test has no business reading.
 */

/** The integrations this app is wired to. A new one's vars are covered by shape; the prefix makes intent explicit. */
const OWNER_PREFIXES = [
  'VITE_',
  'SUPABASE',
  'STRIPE',
  'RESEND',
  'GEMINI',
  'SENTRY',
  'PINATA',
  'ETHERSCAN',
  'COOKIEBOT',
  'ADMIN_',
  'SGCOIN',
  'ORDER_',
];

/** The shapes deployment configuration takes, whatever it is called. */
const CONFIG_SUFFIXES = [
  '_KEY',
  '_SECRET',
  '_TOKEN',
  '_PASSPHRASE',
  '_PASSWORD',
  '_DSN',
  '_EMAIL',
  '_URL',
];

/** The build describing itself — where it ran, not what it was given. */
const PLATFORM_IDENTITY = new Set([
  'CI',
  'NODE_ENV',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_REGION',
  'VERCEL_TARGET_ENV',
  'VERCEL_DEPLOYMENT_ID',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_BRANCH_URL',
]);

/** Platform and toolchain namespaces. Not this app's configuration. */
const PLATFORM_PREFIXES = ['VERCEL_GIT_', 'GITHUB_', 'RUNNER_', 'ACTIONS_', 'npm_', 'NODE_', 'VITEST'];

const isPlatformVar = (name) =>
  PLATFORM_IDENTITY.has(name) || PLATFORM_PREFIXES.some((prefix) => name.startsWith(prefix));

/** Does this env var name belong to the deployment rather than to the machine? */
export const isDeploymentEnvName = (name) =>
  typeof name === 'string' &&
  name.length > 0 &&
  !isPlatformVar(name) &&
  (OWNER_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    CONFIG_SUFFIXES.some((suffix) => name.endsWith(suffix)));

/** Every deployment-supplied var in an environment, sorted so messages are stable. */
export const deploymentEnvNames = (env) => Object.keys(env).filter(isDeploymentEnvName).sort();

/**
 * This project's own vars, by namespace — the names a run that claims to be
 * bare must not have been handed.
 *
 * Narrower than the class above on purpose, and the difference is what each
 * caller needs. The class is what a *release* must run without, so a release
 * strips all of it. This is what a *bare run* is checked for, because a
 * developer's shell and a runner image legitimately hold credentials of
 * unrelated tools (an editor's bridge token, a signer's key) and refusing a run
 * over those would be a false alarm about something the bare condition has
 * nothing to do with. A var in this project's namespaces is a finding.
 */
export const projectEnvNames = (env) =>
  Object.keys(env)
    .filter((name) => OWNER_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .sort();

/**
 * The same environment with the deployment's vars removed, and the names that
 * were removed. The input is not mutated: a caller decides what to do with the
 * result, and the rule keeps reading its own environment (VERCEL, VERCEL_ENV)
 * to know where it is running.
 */
export function stripDeploymentEnv(env) {
  const stripped = deploymentEnvNames(env);
  const bare = { ...env };
  for (const name of stripped) delete bare[name];
  return { env: bare, stripped };
}
