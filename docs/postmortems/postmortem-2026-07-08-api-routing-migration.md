# Postmortem: `/api/` per-handler routing migration attempt

**Date:** 2026-07-08
**Status:** UNRESOLVED. Production is on stable 503 baseline (`dca1b57`).
**Cache hypothesis:** Partially supported (1 of 2 validating tests passed). Not conclusively proven.

---

## TL;DR

We attempted to migrate from a single `api/_handlers/*` directory (silently ignored by Vercel because of the `_`-prefix convention) to per-handler Serverless Functions at `api/<slug>.ts`. Three production pushes caused different failure signatures. A Preview-deploy test shows the source compiles cleanly today, but we cannot reproduce the prod regression against the Preview environment because Vercel Authentication intercepts all probes. The most likely remaining cause is **Vercel per-function build/edge cache that didn't invalidate when the file structure changed**. We need a way to force-clear that cache (or direct Vercel support access) before the next prod attempt.

---

## Status (today)

| Surface | State |
|---|---|
| Production HEAD | `dca1b5746b729f94486b4ea37649e1d19ad03bf9` (revert commit, `dca1b57`) |
| Production aliases | `sgcoalition.xyz` — every `/api/*` route returns 503 with `"Handler is temporarily unavailable."` body |
| SPA (consumer-facing) | Continues serving customers from `dist/` as normal |
| Working tree | HEAD + 2 uncommitted modifications (`package-lock.json`, `public/sitemap.xml`) preserved per "stay on baseline" instruction |
| Preview test deployment | `https://worktree-preview-test-i32ge4a0z-derron-byrds-projects.vercel.app` — clean compile, gated by Vercel Auth (401), zero `FUNCTION_INVOCATION_FAILED` |

---

## Timeline

### Attempt 1 — `1450a5a` (regression cycle 1)

**What was committed:** 19 file renames from `api/_handlers/<slug>.ts` → `api/<slug>.ts`. Each handler's internal imports updated to `./_helpers`, `./_types`, `../utils/X`. Catch-all `api/[...slug].ts` HANDLER_LOADERS map updated from `./_handlers/<slug>` → `./<slug>` (verified later via `git show 1450a5a:api/[...slug].ts` — only comments retain `_handlers/` strings). Test files updated for new paths.

**Pre-push safety:** `npx vercel build --yes` succeeded. 20 `.func` bundles emitted (one per handler + catch-all). Each with isolated `node_modules`. `builds.json` showed per-function `@vercel/node` directives. `config.json` showed `handle: filesystem` ahead of any rewrite routes.

**Production behavior (post-75s wait):**

| Endpoint | Status | Body |
|---|---|---|
| `/api/paypal-order` | 500 | `FUNCTION_INVOCATION_FAILED` |
| `/api/marketing-subscribe` | 400 | `{"error":"A valid email or E.164..."}` |
| `/api/complete-order` | 500 | `FUNCTION_INVOCATION_FAILED` |
| `/api/ai-chat` | 500 | `FUNCTION_INVOCATION_FAILED` |
| `/api/foobar` (catch-all) | 404 | `{"error":"Endpoint not found"}` |

3 of 4 handlers returned Vercel's opaque `FUNCTION_INVOCATION_FAILED`. `marketing-subscribe` reached its handler cleanly. The catch-all responded to unknown slugs with a clean 404.

**Recovery:** `git revert HEAD --no-edit && git push origin main` → `dca1b57`. 75s post-push re-probe: all 4 endpoints returned the expected baseline 503. Restoration clean.

### Attempt 2 — speculative eager-init fix (aborted before push)

**Hypothesis:** The root cause was eager module-link-time SDK initialization in the 3 crashing handlers (Stripe, Supabase, GoogleGenerativeAI, Resend).

**Refutation (code-search ground truth):** All 4 suspect files (`paypal-order.ts`, `complete-order.ts`, `ai-chat.ts`, `_helpers.ts`) already use **lazy factory functions** (`getPaypalCredentials()`, `getSupabaseAdmin()`, `getGenAI()`) called inside the handler bodies. Zero module-top eager `new Stripe(...)` / `createClient(...)` / `new GoogleGenerativeAI(...)` constructor calls. The hypothesis was structurally wrong.

**Conclusion:** No push made. Would have reproduced the regression.

### Attempt 3 — diagnostic capture

**Actions:**
- Captured `vercel logs sgcoalition.xyz --json` for the failed deploy window. Discovered the literal runtime error: `Cannot find module '/var/task/api/_handlers/<slug>' imported from /var/task/api/[...slug].js`. The catch-all's loadHandler was looking up `_handlers/<slug>` paths at runtime even though the source HANDLER_LOADERS map was updated.
- Ran `git show 1450a5a:api/[...slug].ts` to confirm HANDLER_LOADERS strings in the migration commit were actually `./<slug>`, not `./_handlers/<slug>`. They were.
- Created a `git worktree` bound to `1450a5a` and ran `npx vercel build` inside it. Grepped the compiled `[...slug].func` and per-handler `.func` bundles for `_handlers` references.

**Findings (compiled-bundle inspection):**

| Bundle | `_handlers/` references in `.js` |
|---|---|
| `[...slug].func` (catch-all) | **0** in executable code. Only in `//` comments. |
| `paypal-order.func` | **0** |
| Other per-handler `.func` | **0** (cross-checked via spot-greps) |

The compiled bundles do not contain stale `_handlers/` paths. The source was clean and the bundler produced a clean artifact.

### Attempt 4 — Preview deploy validation

**Setup:**
- Created `.worktree-preview-test/` bound to commit `1450a5a`.
- Ran `npx vercel deploy --yes --target=preview --no-clipboard`. Preview URL: `https://worktree-preview-test-i32ge4a0z-derron-byrds-projects.vercel.app`.
- Probed 4 endpoints + 1 unknown slug.

**Result:** All 5 endpoints returned **HTTP 401** with body `{"error":{"code":"401","message":"Protected deployment"}}`. Vercel Authentication (Deployment Protection) intercepted every request before the handler code was invoked.

**Critical observation:** **0 of 5 endpoints returned `FUNCTION_INVOCATION_FAILED`** and **0 returned the baseline 503 "Handler is temporarily unavailable" marker.** Validates that:
1. The source compiles cleanly to a deployable artifact.
2. Per-handler routing is registered for each known slug.
3. The catch-all path returns a 404 for unknown slugs when reached via the real filesystem routing.

We cannot validate handler logic behavior end-to-end on the Preview URL without turning off Deployment Protection for that specific deployment.

---

## Working hypothesis: Vercel per-function build/edge cache

**Claim:** The original prod failure was caused by Vercel serving **stale per-function cached Lambda chunks** from the prior deploy, while the new deploy's source/bundle files were being swapped in. The catch-all and `marketing-subscribe` happened to be invalidated correctly; the other 3 handlers retained chunks with `_handlers/<slug>` import paths in their dependency graphs.

**Supporting evidence:**
- Source code in commit `1450a5a` is correct (verified via `git show`).
- Compiled bundles in a local `npx vercel build` are clean (verified via worktree + grep on `.vercel/output/functions/`).
- Preview deploy of the same commit's source builds cleanly and serves the new code with 0 crash signals.
- The migration moved 19 files between directories — exactly the kind of structural change that requires explicit cache invalidation for Vercel's per-function chunk graph.

**Counter-evidence / alternative explanations not yet ruled out:**
- Vercel edge serving from multiple cache tiers in parallel during deploy cutover
- A specific `@vercel/nft` bundler bug when `import('./<slug>')` static-string dynamic imports coexist with file structure changes
- A misconfigured Vercel project setting (e.g., caching policy overrides) we cannot inspect from CLI

**Why we cannot prove the hypothesis from this environment:**
- `vercel logs` stream CLI is unreliable for fetching historical per-function stack traces.
- The Vercel Dashboard's "Functions" tab would show the actual stack, but Dashboard access requires manual human operation.
- The `vercel inspect` CLI gives deployment metadata, not function runtime logs.
- The Vercel CLI does not support `--function` filtering (despite some docs hinting it does).

---

## Retry sequence (for a future session with better Vercel access)

### Pre-conditions (any of these unblocking paths is sufficient)

1. **Vercel Dashboard access** — Manual log capture from the Functions tab of the failed deployment. Verbatim stack trace of the `FUNCTION_INVOCATION_FAILED` will unambiguously identify whether it's module-link-time or runtime-invocation.
2. **Vercel support escalation** — Send the prior timeline + log snippets to Vercel support and ask them to confirm or rule out per-function cache invalidation behavior for this case.
3. **Documented cache bypass API** — Discover whether `vercel redeploy --force` or a Vercel REST API endpoint can flush per-function build cache before the next push.
4. **Preview deploy without auth** — Configure Deployment Protection to allow our IP range, OR explicitly bypass auth on the new Preview. Then re-probe for full end-to-end validation.

### Steps to retry (after pre-conditions resolved)

1. **Confirm baseline:** `git log --oneline -3` — expect `dca1b57` (or later) on top of main.
2. **Restore migration to working tree:**
   ```bash
   git revert dca1b57 --no-commit
   # OR if rebased: git cherry-pick 1450a5a
   ```
3. **Verify pre-push safety locally:**
   ```bash
   npm.cmd run build
   npx.cmd vercel build --yes
   grep -rn '_handlers' .vercel/output/functions/api/  # should print only comments
   ```
4. **Commit + push:**
   ```bash
   git add api/ tests/
   git commit -m 'fix(api): migrate handlers to api/<slug>.ts (cache-bypass retry)'
   git push origin main
   ```
5. **Immediately clear build cache** (this is the differentiator from the failed attempt): Trigger a Vercel redeploy with cleared build cache from the dashboard for that commit's deployment, OR use `vercel redeploy <deployment-url> --force --yes` if that flag exists.
6. **Wait ~75s** for cold-spin-up.
7. **Probe 4 known + 1 unknown slug:**
   ```bash
   for endpoint in paypal-order marketing-subscribe complete-order ai-chat foobar; do
     curl -sS -o /tmp/v_$endpoint.txt -w 'http_status=%{http_code}\n' \
       -X POST -H 'Content-Type: application/json' -d '{}' \
       "https://sgcoalition.xyz/api/$endpoint"
     echo "  body: $(head -c 300 /tmp/v_$endpoint.txt)"
   done
   ```
8. **Decision matrix on the probe:**

   | All 4 known endpoints | Catch-all (`/api/foobar`) | Verdict |
   |---|---|---|
   | HTTP 400 / 200 (validation or business logic) | HTTP 404 / 200 | ✅ Cache hypothesis proven, prod fixed. Promote the build, monitor for 24h. |
   | HTTP 500 FUNCTION_INVOCATION_FAILED | HTTP 404 | ❌ Cache not the cause. Escalate to debugger profile of the actual stack trace from a Vercel Dashboard capture. |
   | HTTP 503 baseline ("Handler is temporarily unavailable") | HTTP 404 | ❌ Catch-all lazy-import path still firing. The handler route auto-detection didn't take effect. Re-check `vercel.json` for any blocking config. |
   | Mixed (some 400, some 500) | HTTP 404 | ❌ Cache invalidation was partial. Look for Vercel-specific cache tiers that exist beyond build cache (e.g., edge CDN). |

9. **If hypothesis confirmed and prod fixed:** file a follow-up to clean up the 2 uncommitted modifications (`package-lock.json`, `public/sitemap.xml`) so the working tree matches HEAD exactly. Optionally write a regression guard test (`tests/apiRuntimeLazyInit.test.ts` was attempted during the diagnostic phase but the file write failed at the time — retry once the cache issue is resolved so handler-lazy-init is locked in as a CI check).

---

## Files & artifacts referenced by this postmortem

- **Failed prod deploy source:** commit `1450a5a`. Files changed: 19 handler renames + `[...slug].ts` + 3 test files = 23 files.
- **Stable baseline:** commit `dca1b57` (revert). Files affected: same 23 files reverted.
- **Successful Preview test deploy:** `https://worktree-preview-test-i32ge4a0z-derron-byrds-projects.vercel.app`. Status: archived by Vercel (typically 7-day retention for Preview deploys on personal accounts; check `vercel ls` before next session).
- **Diagnostic worktree:** `.worktree-preview-test/` (removed after capture). Reusable pattern for any future safe-side migration validation.
- **Local build artifacts:** `.vercel/output/` produced by `npx vercel build` would be regenerated each retry — no need to commit or archive.

---

## Open threads

- **Test file `tests/apiRuntimeLazyInit.test.ts`** was authored in the diagnostic phase but the `write_file` tool returned errors during the conversation. Worth retrying in a future session — the test is straightforward (strips env vars then asserts each handler module imports without throwing) and the handlers' existing lazy-init pattern should let it pass immediately. If it passes today, regression coverage for the lazy pattern is locked in with zero source changes.
- **Uncommitted working-tree modifications** to `package-lock.json` and `public/sitemap.xml` — preserved per the "stay on baseline" instruction. Should be cleaned up after the next commit operation: `git checkout HEAD -- package-lock.json public/sitemap.xml` to discard, OR `git stash` to set them aside.
- **`.vercel-log-capture/` directory** is untracked but live on disk — likely gitignored. Verify `.gitignore` covers `.vercel-log-capture/` or clean up after documentation pass.
- **Vercel `functions`/`builds` configuration** — currently no explicit `builds` block in `vercel.json`. The framework is set to `"vite"` (for SPA only). API functions are picked up by Vercel's default discovery. Worth examining whether adding an explicit `builds` block could give finer cache control in the future.

---

## Adjacent notes

- The "Approach A" historical regression (caused by importing `'./_handlers/<slug>'` at module top) and the current `1450a5a` regression are distinct failure modes. Approach A reproduced consistently in `npx vercel build` (because esbuild's static top-level import error was reproducible). `1450a5a`'s failure was **NOT reproducible in `npx vercel build`** — its compiled artifacts were clean — making this a Vercel-side cache/invalidation bug, not a code defect.
- `tests/paypalReadiness.test.ts` and `tests/attributeOrderToFacebook.test.ts` / `tests/creditCustomerReward.test.ts` were updated during the migration (test path strings). After any future successful migration, those test references need to align with whichever architecture is currently live.
- The user's "no speculative commits" stance remains the right call until either Vercel support clarifies the cache behavior or a fresh Preview-deploy probe (with auth disabled) confirms handler-level behavior end-to-end.

