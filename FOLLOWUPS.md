# FOLLOWUPS — open items for the next session

A flat list of items that surfaced this session and have not landed yet. Owner-keyed so the operator (Dashboard / sentry.io / Vercel work that needs human verification) and the next maintainer (code work that should land in a follow-up commit) can split the work without re-deciding anything.

> **What's NOT on this list:** the Sentry and Security wire-ins are shipped + locked by the readiness test. The double-gating design on Sentry is intentional, not half-finished. The csp-report Supabase persistence is a separate enhancement, not a missed step. The 503 production incident is on this list as an Operator task because the 4-click recipe requires Dashboard access; resolution does not require code changes.

## Operator tasks (Dashboard / sentry.io / Vercel side)

### 1. Provision Sentry project + set `VITE_SENTRY_DSN`

The Sentry wire-in (commits `387f405` + `dc0ddfe`) is on `main` but the init gates to silent no-op until a project exists and the DSN is in Vercel. Until then, production errors are still caught by `ErrorBoundary` and logged to the Vercel runtime via `console.error` — Sentry just doesn't see them.

Steps:

1. Create a Sentry project at https://sentry.io (or your self-hosted instance), platform = "JavaScript / React".
2. Copy the project's DSN from Project Settings > SDK Setup > Client Keys.
3. Set `VITE_SENTRY_DSN` in Vercel > Project Settings > Environment Variables for the Production environment. (Optional: also set it for Preview if you want preview-deploy event flow.)
4. Trigger a redeploy with **Build Cache OFF** — `VITE_SENTRY_DSN` is a `[build]` Vite env var, so it must be baked into the JS bundle.

Verify on the next production deploy:

1. Open `https://sgcoalition.xyz` in an incognito window; the `index-*.js` chunk should make a Sentry init call on first paint.
2. Confirm events arrive in the Sentry Issues page (e.g. trigger a temporary unhandled error with `throw new Error("test")` in DevTools, then delete the test event).

### 2. Configure Sentry alert rules

Both React 19 root handlers in `index.tsx` report at level `error`. Sentry's default alert rule fires on any error-level event, so without a manual filter, caught errors (those that surfaced the recovery UI) will page on-call just as loudly as uncaught ones.

Add one alert rule:

- **Condition:** `error-level event`
- **Filter:** `tags.source = react19-root-uncaught`
- **Action:** Notify the operator channel (email, Slack, PagerDuty).

Without this filter, you'll get paged for errors the user already saw a recovery UI for. The trade-off is also documented in `.env.example > Sentry` so whoever sets the DSN is reminded.

### 3. PayPal live cutover

The full runbook is in [`DEPLOYMENT_CHECKLIST.md` §6 Live PayPal Cutover Runbook](./DEPLOYMENT_CHECKLIST.md#6-live-paypal-cutover-runbook).

Blockers to flip from sandbox to live on production:

- A live PayPal REST app's `CLIENT_ID` + `CLIENT_SECRET` (different from sandbox).
- A confirmed sandbox pass through §6.3 step 6-7 (Supabase `orders` row has `payment_status = paid` + matching PayPal dashboard `COMPLETED` + matching capture amount in both tables).
- A redeploy with **Build Cache OFF** so the new `VITE_PAYPAL_CLIENT_ID` is baked into `index.html`.

Until this is done, the storefront can still complete PayPal sandbox orders but real buyers cannot pay.

### 4. Resolve the 503 production incident

The README's top banner shows `/api/*` returning 503 in production (per-operator confirmation after the directory-flattening refactor rollback). The 4-click recipe (Dashboard → Deployments → Functions tab → first invocation) lives in [README.md > Production incident](./README.md#production-incident-customer-checkout-at-503) with paste targets in [`docs/postmortems/postmortem-2026-07-08-vercel-stack-traces.md`](./docs/postmortems/postmortem-2026-07-08-vercel-stack-traces.md).

Until resolved: checkout is gated, but browsing + carting still work.

## Tech debt (next-session commits)

### 5. Lazy-load the 3 remaining framer-motion consumers

`README.md > Bundle analyzer and lazy-loaded chunks` documents the refactor. Today `SignalAlert`, `RewardActivation`, and `components/ui/ToastContainer` still import `framer-motion` synchronously, keeping ~22 KB gzipped in the eager `index-*.js` chunk. None of them touch auth or realtime state, so wrapping each in `React.lazy + <Suspense fallback={null}>` is straightforward.

Expected outcome: drop another ~22 KB gzipped off the eager bucket, the next-largest lever after the ProfileModal/CartDrawer carve-outs this session already shipped.

Verification: re-run `node scripts/parseStatsHtml.mjs` against `npx.cmd vite build --mode analyze` and confirm the lazy chunks land with the expected gzip weights.

Not blocking; do when bundle slices accumulate.

### 6. Session replay — wire the integration AND the rate together

`services/sentryInit.ts` documents that session replay is DEFERRED. If a maintainer later wants to enable it, BOTH `Sentry.replayIntegration()` in the `integrations: []` array AND a matching `replaysSessionSampleRate: ...` config field must be added together. The SDK silently drops the rate when no integration is registered, so leaving one without the other is a footgun. The readiness test makes the absence a regression-catch — the comment in the file (and the lock in the test) both pin the deferral as intentional.

### 7. Anchor `PUBLIC_RECENT_ORDER_SEEDS` timestamps

`README.md > minutesAgo drift vs createdAt` documents that the live-orders map uses a floating `minutesAgo` for stable relative-time display, while the matching `INITIAL_ORDERS` row uses an anchored ISO timestamp. Today the two surfaces drift over time. To make both stay aligned forever, the seed record should grow an optional `absoluteTimestamp` field that wins over `minutesAgo` when present. Currently a tracked follow-up; not part of the contract.

---

## Operator task index (one-glance)

| # | Item | Owner | External surface | Time est. |
|---|---|---|---|---|
| 1 | Provision Sentry + DSN | Operator | sentry.io + Vercel env | 10 min |
| 2 | Configure Sentry alert rule | Operator | sentry.io dashboard | 5 min |
| 3 | PayPal live cutover | Operator | PayPal developer + Vercel + sandbox smoke pass | 30 min |
| 4 | Resolve 503 incident | Operator | Vercel Dashboard | 20 min (per the 4-click recipe) |
| 5 | Lazy-load 3 framer-motion consumers | Maintainer | n/a (code) | 30 min |
| 6 | Wire Sentry session replay (when wanted) | Maintainer | n/a (code) | 10 min |
| 7 | Anchor live-orders seed timestamps | Maintainer | n/a (code) | 30 min |
