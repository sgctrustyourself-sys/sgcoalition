# FOLLOWUPS — open items for the next session

A flat list of items that surfaced this session and have not landed yet. Owner-keyed so the operator (Dashboard / sentry.io / Vercel work that needs human verification) and the next maintainer (code work that should land in a follow-up commit) can split the work without re-deciding anything.

> **What's NOT on this list:** the csp-report Supabase persistence is a separate enhancement, not a missed step. The double-gating design on Sentry is intentional, not half-finished.
>
> **Correction (2026-09-15):** an earlier version of this header claimed "the Sentry and Security wire-ins are shipped + locked by the readiness test". That was wrong for this tree: `grep -r sentry` returned **zero matches**, `services/sentryInit.ts` did not exist, `@sentry/react` was not a dependency, and `tests/securityInfrastructureReadiness.test.ts` — cited twice inside `api/_helpers.ts` as the lock on the rate limiter and admin wrapper — did not exist either. Both are real as of the 2026-09-15 session (see the "Landed" section at the bottom). The lesson worth keeping: a doc claiming a test exists is not evidence that it does.

## Operator tasks (Dashboard / sentry.io / Vercel side)

### 1. Provision Sentry project + set `VITE_SENTRY_DSN`

The client-side wiring now exists for real (`services/sentryInit.ts` + the React 19 root handlers in `index.tsx`, added 2026-09-15). It is **lazily imported behind `VITE_SENTRY_DSN`**, which Vite inlines at build time — so with no DSN configured the SDK is tree-shaken out entirely and costs the bundle nothing. Verified in the 2026-09-15 production build: no sentry chunk emitted, zero `ingest.sentry.io` references in `dist/assets/*.js`.

Until a DSN is set, production errors are unreported: there is **no React error boundary in this codebase** (see item 11), so a render error currently blank-screens the app and leaves no client-side trace.

Steps:

1. Create a Sentry project at https://sentry.io (or your self-hosted instance), platform = "JavaScript / React".
2. Copy the project's DSN from Project Settings > SDK Setup > Client Keys.
3. Set `VITE_SENTRY_DSN` in Vercel > Project Settings > Environment Variables for the Production environment. (Optional: also set it for Preview if you want preview-deploy event flow.)
4. Trigger a redeploy with **Build Cache OFF** — `VITE_SENTRY_DSN` is a `[build]` Vite env var, so it must be baked into the JS bundle.

**Bundle-cost caveat:** once the DSN exists at build time, `@sentry/react` (v10.x) *will* be emitted as its own lazily-loaded chunk and pulled on first paint. That is the intended trade — but it is a deliberate reversal of the zero-cost state above, so re-check `dist/` weights after the first configured build.

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

### 3. (Removed — PayPal checkout has been removed from the product.)

### 4. ~~Resolve the 503 production incident~~ — RESOLVED (kept for history)

This was stale. Verified live on 2026-09-15: `GET /api/health` returns `{"status":"ok","checkoutWorking":true,"stripe":{"configured":true,"keyValid":true}}`, and `/api/complete-order`, `/api/send-email`, `/api/admin-verify`, `/api/pricing-preview` all answer with real application responses (400/401 class), not 503. `docs/audit-2026-09-14.md` reached the same conclusion independently. The README incident banner this item referenced is also gone.

No action required. The item is left in place so nobody re-opens it from an old chat log.

### 5. ~~Verify a Resend sending domain~~ — DONE (2026-09-14)

Completed end-to-end from the CLI in one session — no dashboard visits:

- **Domain**: `mail.sgcoalition.xyz` registered in Resend via API (id `5f950468-a150-45df-a0cc-59ec4661dab4`, region us-east-1).
- **DNS** (written via `vercel dns add`, zone hosted on Vercel DNS): DKIM TXT on `resend._domainkey.mail`, SPF MX + TXT on `send.mail`, tracking CNAME `rsend.mail`. All four flipped to **verified** in Resend in ~20 min. Gotcha for future rotations: Resend's lazy poller sat on `not_started` for 5+ minutes — the check only ran after an explicit `POST /domains/{id}/verify` nudge.
- **Bonus**: monitor-only DMARC record `_dmarc.mail` → `v=DMARC1; p=none; rua=mailto:sgctrustyourself@gmail.com; fo=1` (aggregate reports land in the owner inbox; `p=none` means zero enforcement risk).
- **`RESEND_FROM_EMAIL`** set in Vercel production: `SG Coalition <noreply@mail.sgcoalition.xyz>`, synced to local `.env`. CLI quirk: `vercel env add`/`rm` raced each other on the existing empty-valued var ("already exists" vs pull showing `""`) — fixed via the REST API (`DELETE /v9/projects/{id}/env/{envId}` then `POST /v10/projects/{id}/env`).
- **Effect**: the free-plan testing restriction (owner-address-only delivery) is lifted. Order confirmations, admin fulfillment, Trust Circle vouchers, and webhook reconcile alerts now deliver to arbitrary member addresses with SPF/DKIM aligned to `mail.sgcoalition.xyz`.
- Remaining habit from the old runbook that still matters: verify a real send in resend.com → Logs after any Resend account change.

Known follow-up surfaced during this work: `POST /api/send-email` is an unauthenticated relay (any caller can send email as the brand). Candidate for a shared-secret or origin check.

## Active program notice

### 0. Partner program (The Trusted Few) — sunset & referendum retired

The referral program has been replaced by **The Trusted Few partner program** — no sunset, no community vote (owner decision, see `docs/superpowers/specs/2026-08-06-trusted-few-partner-program-design.md`).

What's been done:

- The Trusted Few partner program replaced the sunsetting referral program; the sunset banner, `PROGRAM_SUNSET_DATE` messaging, and the "Cast your vote" link were removed from `components/ReferralDashboard.tsx`.
- The 2027 referendum blog post (slug `referendum-referral-program-2027`) remains as historical content; the dashboard no longer links to it. The `VotingSystem` still powers blog-post votes.
- The Trust Circle tier (flat 20% commission, application flow, invites, drop vouchers) is implemented: `services/trustCircle.ts`, `pages/TrustCircle.tsx`, `components/admin/TrustCircleManager.tsx`. The `trust_circle_applications` + `drop_vouchers` tables and the RPC Trust Circle branch are live in production (migrations `20260804_create_payment_settings.sql` + `20260806_trusted_few_partner_program.sql` applied Aug 12).
- The `coupons` table now exists in production (`20260812_create_coupons_table.sql`): the admin CouponManager and TrustCircleManager create coupons client-side, and `drop_vouchers.coupon_code` is FK'd to `coupons(code)` so every drop voucher references a real coupon.
- `referral_stats` RLS drift fixed (`20260812_fix_referral_stats_client_writes.sql`): production's policies were service_role-only, silently breaking the Trust Circle approve/invite/revoke writes and the members list from the anon-key admin UI. Restored the intended public `FOR ALL USING (true)` "System can manage stats" policy (codebase's documented lax posture). **Hardening still open**: the passphrase admin flow creates no Supabase session, so admin writes run as anon — move them behind a SECURITY DEFINER RPC or mint a real session for the admin flow.

What's still needed (track as operator + maintainer work):

1. **First Trust Circle invites** (Operator) — use the admin Trust Circle tab to invite the initial branding team and review any applications.
2. **Deferred migrations** (Operator) — production was provisioned selectively, so authored migrations sat in `supabase/migrations/.deferred` (the runner skips them). On Aug 12 ALL the feature migrations were applied one-at-a-time via `scripts/applyMigrations.ts`: orders `paid_amount`/`balance_due`, the `payments` audit table + `record_partial_payment`, the `reconcile_balance_payment` RPC, the `wallet_mints_7d` aggregate, the `production_state` table + its realtime publication, and the SGCoin payout-request table + RPCs. Only the retired referendum post remains deferred (also incompatible with the posts table — id is UUID while the migration inserts a text slug). One architectural correction: the original plan published the `wallet_mints_7d` VIEW, which Postgres rejects on every version (`cannot add relation ... to publication`); it was replaced by `20260812_materialize_wallet_mints_7d_for_realtime.sql`, a trigger-maintained singleton TABLE (same `select mint_count` read shape) that IS publishable. The legacy two-phase `.cjs` runners (`applyWalletMints7dView.cjs`, `applyProductionState.cjs`) were deleted as superseded. Run `npx tsx scripts/applyMigrations.ts --check` for the current state (Applied 23, Deferred 1, Pending 0).

No vote will be scheduled — the referendum machinery (VotingSystem, `post_votes` RLS) stays in place for general blog-post voting and historical content only.

---

## Tech debt (next-session commits)

### 6. Trim the eager animation dependency (the count was wrong)

> **Corrected 2026-09-15.** This item claimed "the 3 remaining framer-motion consumers" (`SignalAlert`, `RewardActivation`, `ToastContainer`). The real number is **~20 files** importing the `motion` package (v12 — note it is `motion`, not `framer-motion`) synchronously, and it is not merely "in the eager chunk": production `index.html` **`modulepreload`s `vendor-motion-*.js` on first paint**, so every visitor downloads ~42 KB gzipped of animation code before the app renders. Verified live against the deployed HTML.

Highest-leverage targets are the always-mounted surfaces rather than the three named above: `components/ui/ToastContainer`, `components/IntroScreen`, `components/LiveMap`, `components/layouts/DashboardLayout`, plus the admin components (already behind the Admin route's lazy boundary, so they matter less).

Expected outcome: drop another ~22 KB gzipped off the eager bucket, the next-largest lever after the CartDrawer lazy-carve + ProfileModal deletion this session already shipped (ProfileModal was removed entirely, not just lazy-loaded; see README "Bundle analyzer and lazy-loaded chunks").

Verification: re-run `node scripts/parseStatsHtml.mjs` against `npx.cmd vite build --mode analyze` and confirm the lazy chunks land with the expected gzip weights.

Not blocking; do when bundle slices accumulate.

### 7. Session replay — wire the integration AND the rate together

`services/sentryInit.ts` documents that session replay is DEFERRED. If a maintainer later wants to enable it, BOTH `Sentry.replayIntegration()` in the `integrations: []` array AND a matching `replaysSessionSampleRate: ...` config field must be added together. The SDK silently drops the rate when no integration is registered, so leaving one without the other is a footgun.

**Now actually pinned** by `tests/sentryWiring.test.ts` (`session replay stays deliberately deferred`), which strips comments from the source before asserting — so the prose in the file documenting the footgun does not itself satisfy or break the lock.

### 8. Anchor `PUBLIC_RECENT_ORDER_SEEDS` timestamps

`README.md > minutesAgo drift vs createdAt` documents that the live-orders map uses a floating `minutesAgo` for stable relative-time display, while the matching `INITIAL_ORDERS` row uses an anchored ISO timestamp. Today the two surfaces drift over time. To make both stay aligned forever, the seed record should grow an optional `absoluteTimestamp` field that wins over `minutesAgo` when present. Currently a tracked follow-up; not part of the contract.

---

## Operator task index (one-glance)

| # | Item | Owner | External surface | Time est. |
|---|---|---|---|---|
| 1 | Provision Sentry + DSN (wiring already ships; no DSN = tree-shaken no-op) | Operator | sentry.io + Vercel env | 10 min |
| 2 | Configure Sentry alert rule (`tags.source = react19-root-uncaught`) | Operator | sentry.io dashboard | 5 min |
| 3 | ~~PayPal live cutover~~ | — | Removed: PayPal checkout is no longer part of the product | — |
| 4 | ~~Resolve 503 incident~~ — **resolved (stale item, live-verified 2026-09-15)** | — | — | — |
| 5 | ~~Verify Resend sending domain~~ — **done 2026-09-14** | — | — | — |
| 6 | Trim eager `motion` (~20 files, not 3; modulepreloaded on first paint) | Maintainer | n/a (code) | 30 min |
| 7 | Wire Sentry session replay (when wanted) — **deferral now pinned by test** | Maintainer | n/a (code) | 10 min |
| 8 | Anchor live-orders seed timestamps | Maintainer | n/a (code) | 30 min |
| 9 | Decide `/api/marketing-stats` (authorized but has no caller) | Maintainer | n/a (code) | 20 min |
| 10 | Decide the dead `upload-imgur` path in `imgurService.ts` | Maintainer | n/a (code) | 15 min |
| 11 | Add a React error boundary (none exists; `onCaughtError` never fires) | Maintainer | n/a (code) | 45 min |
| 12 | Delete or token-wire the dead `components/GitManager.tsx` | Maintainer | n/a (code) | 10 min |
| 13 | Clear `d3-color` (needs a d3 v3 `overrides` decision) | Maintainer | n/a (code) | 30 min |
| 14 | Real-payment QA: card + store credit + coupon (audit item #4) | Operator | Stripe + Supabase + inbox | 15 min |

---

## Reference: runtime landmarks that already work

The team depends on these flows. Each landed this session, was verified live on production, and would be expensive to reconstruct from commit history alone. Read this before "fixing" any of them.

### R1. sync-constants — Supabase → `constants.ts` → `origin/main`

The **Sync Code** button on the admin Products tab reconciles `constants.ts` with the current Supabase `products` table and commits the result to `origin/main`. Works in local dev AND Vercel. Verified live at commit `683f7c2` (2026-07-11).

**Five required Vercel env vars** (Production + Preview each have their own values):

| Var | Where to get it | Failure if missing/wrong |
|---|---|---|
| `SUPABASE_URL` | Supabase → Settings → API | 503 with `[missing]` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` row, NOT `anon` | 502 "Invalid API key" |
| `GITHUB_TOKEN` | github.com → Settings → Personal access tokens → Fine-grained tokens, scoped to **Contents: Read and write** on this repo | 503 / 502 "invalid or expired" |
| `REPO_OWNER` | `git remote -v` (e.g. `sgctrustyourself-sys`) | 502 "repo or file not found" |
| `REPO_NAME` | `git remote -v` (e.g. `sgcoalition`) | 502 "repo or file not found" |
| `GITHUB_BRANCH` (optional) | — | Defaults to `main`. Each Vercel env (Production / Preview / Development) can set its own value so staging commits to a feature branch instead of main. |

Same five (sans `GITHUB_BRANCH`) live in `.env` for local Express on port 4242.

**Why the GitHub Contents API, not a git binary**: Vercel serverless functions have a read-only fs and no `git` binary. The only commit path is `PUT /repos/{owner}/{repo}/contents/{path}` against GitHub's Contents API with the target file's blob SHA. `services/githubSync.cjs` is the shared helper used by BOTH:
- `api/_handlers/git-operations.ts` (Vercel serverless)
- `server.cjs` (local Express, port 4242)

The helper does GET → compare → PUT-with-SHA, single retry on 409, and returns `{ noChanges: true, hash: <blobSha> }` for idempotent re-runs (same hash on every re-run when Supabase already matches `constants.ts`). The `hash` in `noChanges` is a **blob SHA** (file content hash), NOT a commit SHA — commits only happen when content changes.

**Cross-reference**: full section in `README.md > Product sync workflow (Supabase → constants.ts → GitHub)` for the full architecture diagram and step-by-step chain.

### R2. Credential-pattern safety net (`.gitignore` block at line 52+)

Belt-and-suspenders for any operator or LLM dropping credentials into the repo root. Verified live via `git check-ignore -v` on synthetic probes; all 9 new patterns catch their targets with zero false-positives against the tracked tree.

| Pattern | What it catches |
|---|---|
| `github_pat*.txt` | Exact shape of the leaked file that triggered this block. |
| `id_rsa` / `id_rsa.pub` / `id_ed25519` / `id_ed25519.pub` / `id_dsa` / `id_ecdsa` | SSH private keys. |
| `*.pem` / `*.p12` / `*.pfx` | Certificate and key bundles. |
| `*sk_live_*` / `*sk_test_*` | Stripe secret-key dropfiles. |

**Deliberately NOT included** (rationale documented inline in `.gitignore`):
- `*.key` — too many false-positives (`.key` is a common JSON-column-name suffix in seed scripts).
- `pk_live_*` / `pk_test_*` — Stripe publishable keys are meant to be public.
- `*-credentials.json` / `service-account*.json` — GCP/AWS not used in this codebase.

**Future hardening**: a GitHub Action that inverts `git check-ignore -v` to scan staged files against these patterns and fails the push on any match — would catch leaks on a fresh `git add` before they reach origin. Tracked conceptually here; not yet a row in the operator task index above.

---

## Landed 2026-09-15 (session record — read before "fixing" any of it)

### L1. `/api/git-operations` requires an admin bearer now

The endpoint dispatched **every** action without a credential check, and `sync-constants` is exempt from the dev-only 501 guard — so an anonymous `POST` committed to `origin/main` through the server's `GITHUB_TOKEN` (GitHub Contents API) with a **caller-supplied commit message**. Proven reachable before the fix: an unsigned `?action=log` returned the handler's own dev-only payload, i.e. dispatch happened with no auth step.

- `isAdminRequest` / `extractBearerToken` now live in `api/_helpers.ts` as the single definition, reused by `send-email` (two copies is how the contracts drift).
- The gate runs after CORS/OPTIONS and **before** action dispatch, so unauthenticated callers get 401 rather than a 501 that leaks the action surface.
- Client call sites attach `coalition_admin_token`: `services/imgurService.ts` (sync-constants), `services/autoCommitService.ts` (commit), `components/admin/GitControl.tsx` (log/branches/checkout/commit). Helpers: `getAdminAuthHeaders()` / `clearAdminSession()` in `services/apiBase.ts`.
- A 401 clears the stale session and drops admin mode, so `ProtectedRoute` sends the operator back to login instead of leaving a panel where every action fails silently.
- Pinned by `tests/gitOperationsGate.test.ts` (14 tests, GitHub boundary mocked).
- Verified live: unsigned POST → 401 · signed `?action=log` → 501 devOnly (gate opened, nothing written) · old token → 401.

### L2. Admin credentials rotated — **the operator must sign in again**

`ADMIN_API_TOKEN` was **11 characters** and load-bearing for every admin write, order listing, payment settings, piece metadata, and branded email send. It is now a 43-char random value (Vercel type `sensitive`, targets preview + production).

`ADMIN_PASSPHRASE` **did not exist in Vercel at all**, so the only login credential was that short token. It now exists, so the browser can hold a strong machine token while the human types something memorable:

- **Login passphrase: `sg-yw7c-qbit-gq7p-uvfw`** (stored in local `.env`; rotate whenever you like — `admin-verify` returns the machine token regardless of which secret you type).
- Every existing admin session is invalidated once. Live-verified: new passphrase → 200 + the new token; old token as password → 401; the browser receives a token that matches the new machine secret.
- The env write went through the **REST API**, not the CLI, because of the `vercel env add`/`rm` race documented in item #5 above.

### L3. Dependency advisories: 8 of 9 cleared

`react-router`/`react-router-dom` 7.9.6 → 7.18.4 · `dompurify` 3.4.9 → 3.4.15 · `path-to-regexp` → 8.4.2 · `ws` → 8.21.3 · `body-parser` → 2.3.0. The blog allow-list moved out of `pages/BlogPostView.tsx` into `utils/blogSanitize.ts` so the only `dangerouslySetInnerHTML` path in the app is asserted by behavior (`tests/blogSanitizer.test.ts`), not by trusting a version number.

**Still open (row 13):** `d3-color@2.0.0` ReDoS nested under `react-simple-maps@3 → d3-zoom@2 → d3-transition@2`. Clearing it needs an `overrides` entry that pulls the d3 **v3** module family under a package pinned to v2 — deliberately not forced, because nothing passes untrusted strings to a d3 color parser, so the real exposure is negligible and the override risk (pan/zoom in LiveMap) is not.

### L4. Error reporting now exists; and the "locked by test" claims are true

- `services/sentryInit.ts` + React 19 root handlers in `index.tsx`: DSN-gated, lazily imported, with recursive `beforeSend` redaction (emails, bearer/`sk_live`/`whsec`/`re_` secrets, cookies, auth headers — order and payment ids deliberately survive so incidents stay triageable). Tags `react19-root-uncaught` / `react19-root-caught` are what item #2's alert rule filters on.
- **Bundle-cost invariant:** because `VITE_SENTRY_DSN` is inlined, an unconfigured build emits no sentry chunk and no `@sentry` reference — verified in `dist/` and against the deployed bundle. `tests/sentryWiring.test.ts` fails if that guard is turned into a static import.
- `tests/securityInfrastructureReadiness.test.ts` now exists (22 tests): rate-limit budgets/429 shape/per-IP/per-slug/GET-bypass/unknown-IP-fail-open, CORS allow-list echoing, `withAdminAuth` fail-closed + both credential families, and source invariants that keep the admin check shared.
- `withAdminAuth` now accepts `ADMIN_API_TOKEN`/`ADMIN_PASSPHRASE` first and the legacy trio second. Live: `/api/marketing-stats` went from 401-with-a-valid-token to **200 with real data** (`audience.total: 7`).

### L5. Small diagnostic fix

`services/orderIntake.ts`: a checkout payload omitting `productId` reported `Unavailable: ` with an **empty** id list, because `Array.join` renders `undefined` as an empty string. Now `Unavailable: undefined`. (Found by smoke-testing `/api/pricing-preview`; the endpoint itself was healthy — the probe's payload shape was wrong, items use `productId`, not `id`.)

### Verification state at the end of that session

796 tests across 57 files · `tsc --noEmit` clean · `npm run build` clean (0 warnings) · `main == origin/main == production` · live probes recorded above.

---

## Structure after the 2026-09-15 architecture pass (build with this)

Two concerns that each had many homes now have exactly one. Commit `d94f0df`.

### Admin authorization → `api/_adminAuth.ts`

| Export | Owns |
|---|---|
| `getSharedAdminSecrets()` | The accepted shared-secret set (`ADMIN_API_TOKEN`, `ADMIN_PASSPHRASE`, + legacy trio). One list — a rotation only edits this. |
| `isSharedSecretAdmin(req)` | Policy 1, sync. |
| `isSupabaseAdminUser(token)` · `isSupabaseAdminRequest(req)` | Policy 2, async: a Supabase session listed in `admin_users`. |
| `isAdminRequest(req)` | The union (policy 1 OR 2). |
| `requireAdmin(req, res)` | All-or-nothing gate for handlers that manage their own CORS/method shape. |
| `withAdminAuth(handler, opts)` | Wraps a whole handler: CORS → OPTIONS → 401 → body. Use this by default. |
| `ADMIN_UNAUTHORIZED_ERROR` | The single 401 body every admin surface returns. |

Rules for a new endpoint: use `withAdminAuth`; if it needs its own method/CORS shape, call `requireAdmin` first thing. Never parse the `Authorization` header yourself and never read `ADMIN_*` in a handler — `tests/securityInfrastructureReadiness.test.ts` fails if you do. `api/_helpers.ts` is now only CORS / body parsing / rate limiting.

Before this pass the policy existed six times (four `getBearerToken` copies, three `isAuthorized` copies, two contradictory `isAdminRequest` policies) and the one endpoint with **none** was `/api/git-operations`. That is the failure mode this structure exists to prevent: authorization is now something a handler *gets*, not something it *remembers*.

### Admin session (browser) → `services/adminSession.ts`

Owns `ADMIN_TOKEN_KEY` / `ADMIN_MODE_KEY`, `getAdminToken()`, `getAdminAuthHeaders()`, `clearAdminSession()`, `handleAdminAuthFailure(status)`, and `ADMIN_SESSION_EXPIRED_ERROR`. `context/useAuth.ts` is the **only writer**; nothing else touches those sessionStorage keys. `services/apiBase.ts` is back to addressing the API and knows nothing about sessions. React state (dropping admin mode) stays at the React layer, which is why the policy is reusable from plain services.

### Error reporting → split by responsibility

`services/sentryRedact.ts` is the pure privacy boundary (`scrubText` / `scrubDeep` / `scrubEvent`, no SDK state, readable alone). `services/sentryInit.ts` is lifecycle (DSN gate, `initSentry`, `reportRootError`). `index.tsx` is the only call site and imports it lazily behind `VITE_SENTRY_DSN`, so an unconfigured build emits no Sentry chunk at all (verified both ways: configured = 30,946 B gz chunk; unconfigured = 0).

### The invariants that keep it that way

`tests/securityInfrastructureReadiness.test.ts` asserts: no handler defines `getBearerToken` / `isAuthorized` / `isAdminRequest`; no handler reads `process.env.ADMIN_*`; `git-operations` exports through `withAdminAuth`; `send-email` keeps its deliberate 403 allowance. `tests/serverlessImports.test.ts` (pre-existing) enforces the `.js` extension convention in serverless-reachable dirs — it caught a real miss during this pass.
