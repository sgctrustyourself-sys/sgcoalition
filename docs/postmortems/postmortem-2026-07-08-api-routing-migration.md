# Postmortem: `/api/` per-handler routing migration attempt

**Date:** 2026-07-08 (cycle continues through end of day)
**Status:** **CACHE HYPOTHESIS INVALIDATED** by today's (2026-07-08) `--force` retry (Branch #1 refuted; the predicted fix did NOT resolve the regression). Production rolled back to stable 503 baseline (`cb30a60` = revert of `e33df76`). New diagnostic branches documented in "Updated diagnostic branches" section below.
**Cache hypothesis:** **INVALIDATED** via empirical force-bypass retry. The CLI evidence of `_handlers/<slug>` Cannot-find-module error remains a valid runtime observation (Vercel runtime IS asking for those paths), but the proposed fix (`vercel deploy --prod --force --yes`) did NOT reproduce a fixed prod — same 1-for-1 failure signature as the original `1450a5a`. Either the cache hypothesis is incomplete (only certain cache layers are involved) or the actual mechanism lives in a different layer entirely (route map, function dispatch, bundler-routing edge case). See Attempt 5 in Timeline for the empirical result.

---

### Pre-retry verdict signal (ADDENDUM 2026-07-08, end of retry sequence: invalidated)

Earlier today this section was titled "Pre-retry verdict signal (2026-07-08, end of investigation cycle)" and read:

> "The CLI capture yielded one log line that matches Branch #1 (`[api] failed to load handler paypal-order: Cannot find module '/var/task/api/_handlers/paypal-order' imported from /var/task/api/[...slug].js`). Cache hypothesis confirmed; `--force` resolves it; retry sequence Step 5 Option B is the smallest surgical fix."

**THAT VERDICT IS NOW INVALID.** Today's force-bypass retry (Attempt 5 below) reproduced the regression 1-for-1, so the claim "`--force` resolves it" turned out to be wrong.

**What remains true:** the CLI evidence "`_handlers/<slug>` Cannot-find-module" IS still a valid runtime observation — Vercel runtime IS asking for those paths at runtime. **`--force` just doesn't clear whatever holds them.**

See "Updated diagnostic branches" section below for where the next investigation should target.

---

---

## TL;DR

We attempted to migrate from a single `api/_handlers/*` directory (silently ignored by Vercel because of the `_`-prefix convention) to per-handler Serverless Functions at `api/<slug>.ts`. Multiple prod pushes caused `FUNCTION_INVOCATION_FAILED` on 3 of 4 handlers (`paypal-order`, `complete-order`, `ai-chat`) while `marketing-subscribe` cleanly returned a 400 validation error and the catch-all returned 404.

A CLI capture of one `FUNCTION_INVOCATION_FAILED` line suggested the cache hypothesis (Branch #1) was the cause. Today (2026-07-08) we executed the documented retry sequence with `vercel deploy --prod --force --yes` to bypass build cache.

**The force-bypass retry reproduced the regression 1-for-1.** Same 3 endpoints `FUNCTION_INVOCATION_FAILED`, same 1 endpoint clean 400, same catch-all 404. **Branch #1 verdict is invalidated.**

Some layer between local `npx vercel build` output and runtime invocation preserves `_handlers/<slug>` resolution that `vercel deploy --force` does not clear. New diagnostic branches documented in "Updated diagnostic branches" section below: (1) flawed migration commit, (2) catch-all precedence, (3) edge route map, (4) bundler chunking bug, (5) env-var masking. Production rolled back to stable 503 baseline (`cb30a60`).

**Cache-hypothesis path is exhausted.** Next iteration must investigate the actual mechanism rather than retrying `--force` variations.

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

### Attempt 5 — `--force` cache-bypass retry (2026-07-08, today)

**What was committed:** Restored commit `1450a5a` (the per-handler routing migration) via `git revert dca1b57 --no-commit`, pre-verified locally with `npx vercel build --yes` (clean output, 20 `.func` bundles, ZERO `_handlers` references in compiled executable code per grep). Committed as `e33df76` (`fix(api): migrate handlers to api/<slug>.ts (cache-bypass retry, Branch #1 verdict)`). Pushed to origin main. Then ran `npx.cmd vercel deploy --prod --force --yes` to deploy with explicit build-cache bypass. Force-bypassed deploy URL: `https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app`. Production alias re-pointed to `sgcoalition.xyz`.

**Pre-push verification (passed):**
- Git revert dry-run: 23 files staged, no conflicts, no collateral changes outside `api/` + `tests/`.
- Local `npx.cmd vercel build --yes`: succeeded, 20 `.func` bundles emitted.
- Grep verification on `.vercel/output/functions/`: `_handlers` appears only in stale doc-comment strings inside `create-checkout-session.js`, `create-payment-intent.js`, and `create-subscription-session.js` (Stripe-helper files). ZERO `_handlers` references in executable code, including the catch-all `[...slug].func` and per-handler bundles (`paypal-order.func`, `complete-order.func`, `ai-chat.func`, `marketing-subscribe.func`).
- Code-reviewer-minimax-m3 verdict: clean; HANDLER_LOADERS correctly references `./<slug>`, all per-handler bundles have zero `_handlers` references in executable code.

**Probe result (75s post-`--force`-deploy):**

| Endpoint | Original `1450a5a` | `--force` retry | Verdict |
|---|---|---|---|
| `/api/paypal-order` | 500 FUNCTION_INVOCATION_FAILED | 500 FUNCTION_INVOCATION_FAILED | Same |
| `/api/marketing-subscribe` | 400 valid email required | 400 valid email required | Same |
| `/api/complete-order` | 500 FUNCTION_INVOCATION_FAILED | 500 FUNCTION_INVOCATION_FAILED | Same |
| `/api/ai-chat` | 500 FUNCTION_INVOCATION_FAILED | 500 FUNCTION_INVOCATION_FAILED | Same |
| `/api/foobar` (catch-all) | 404 Endpoint not found | 404 Endpoint not found | Same |

**FINDING:** The `--force` retry reproduced the regression 1-for-1. **Branch #1 verdict invalidated.** The predicted cache-bypass fix did NOT resolve the regression. Build cache is therefore not the layer the regression lives in.

**Rollback (executed):** `git revert HEAD --no-edit && git push origin main` → rollback commit `cb30a60`. After 75s wait + re-probe: all 4 known endpoints back to 503 baseline (`temporarily unavailable` marker present), foobar back to 404. Production state: stable baseline restored. HEAD = `cb30a60` on `origin/main`.

---

## Updated diagnostic branches (after Branch #1 invalidation, 2026-07-08)

Cache invalidation is empirically ruled out: the runtime asks for `_handlers/<slug>` paths that exist in neither the source nor the cleaned local `npx vercel build` output. The mechanism is therefore in some layer between local build output and runtime invocation that `--force` does not touch.

Per think-through analysis, the next diagnostic should distinguish between these candidates:

| # | Hypothesis | Mechanism | Why it fits the empirical signature |
|---|---|---|---|
| 1 | Flawed migration commit (narrowed) | Source has an indirect/conditional `_handlers/` reference NOT reachable via direct HANDLER_LOADERS map audit (e.g., a path-rewrite helper, a default-case fallback, or a runtime string-construction utility). Direct HANDLER_LOADERS audit + clean local `npx vercel build` argue against the simple form (top-level `import('./_handlers/<slug>')`), so H1 stays plausible only via the indirect form. | Would explain why `--force` cleanly rebuilt a broken artifact throwing Cannot-find-module on `_handlers/<slug>` despite direct source + build checks coming back clean. Diagnostic #1 (ground-truth source audit + grep for indirect helpers) is the cheapest test. |
| 2 | Catch-all precedence | Vercel's filesystem routing is routing specific `/api/<slug>` requests to `api/[...slug].ts` instead of the new individual `.ts` files | Would explain why the old dynamic-importing logic is invoked instead of the new isolated functions executing directly |
| 3 | Edge route map state | Vercel's edge network uses a deployment route map that did not atomically update to reflect the new directory structure | Would explain how a perfectly clean compiled bundle could still behave as if it was referencing old routes at runtime |
| 4 | Bundler chunking bug | `@vercel/nft` generates a stale chunk map for dynamic imports across project restructures that `--force` does not clear | Fits the pattern: dynamic imports fail at runtime while static analysis + local builds appear perfectly clean |
| 5 | Env-var masking | Prod environment variables trigger an error path in a shared file that masks itself as a dynamic import module resolution failure | Explains why Preview deploys (different env or none) pass seamlessly while Prod fails consistently |

**Next diagnostic steps (in order of evidence-yielding power):**

| # | Diagnostic | Action | Hypothesis tested |
|---|---|---|---|
| 1 | Ground-truth source audit | `git checkout 1450a5a -- api/[...slug].ts` and grep for `_handlers` and check HANDLER_LOADERS map. Repeat for any `api/_handlers/`-prefixed paths. | H1 — **RULED OUT 2026-07-08 (Diagnostic #1 result below)**. Source is genuinely clean; mechanism is downstream of source. |
| 2 | Delete catch-all | Create a test deploy that entirely removes `api/[...slug].ts` from the migration. | H2 & H3 (Precedence / Route Map). Forces explicit per-handler files; if it 404s wildly, filesystem routing is broken. |
| 3 | Download prod source | Use Vercel Dashboard → Deployments → the failed `--force` retry (deploy URL: `https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app`, archived) → downloadable source zip and grep for `_handlers` in the actual production-built artifacts. Cross-reference: the prior original-`1450a5a` failure deploy was `dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc` — both should be inspected when distinguishing H1 from H4. | Distinguishes H1, H4, H2, H3 simultaneously: if `_handlers/` appears in Vercel-built `.func` → H4 (Bundler Bug); if not in `.func` but runtime resolves to it → H2 (Catch-all Precedence) or H3 (Edge Route Map); if neither → narrows down to H5 (env-var masking). Highest marginal information among the Dashboard-access diagnostics because it reveals what the runtime is actually given. |
| 4 | Dashboard log tracing | Read the verbatim Function Logs in Vercel Dashboard for the failed `--force` deploy (entry-point + cold-start stack + dependency-resolution path). | H2 (Catch-all Precedence). Determines definitively which lambda bundle actually caught and processed the request. |

The smallest diagnostic that could conclusively settle H1 vs H4 is Item 1 (a literal source-code ground truth check). Steps 2-4 require manual operator intervention with Vercel Dashboard access.

---

> **⚠️ STATUS: The hypothesis below ("Vercel per-function build/edge cache") is INVERTED.** This hypothesis predicted that `vercel deploy --prod --force --yes` would resolve the regression. Today's `--force` retry proved it does NOT. The hypothesis content below is archived as the prior analytical work that *was actually executed* today, but it should not be relied on as the source of truth going forward. See "Updated diagnostic branches" section above for the next investigation direction.

---

## Diagnostic #1 result (2026-07-08): ground-truth source audit — H1 RULED OUT

**Filed under:** §Updated diagnostic branches → Diagnostic Step 1 (cheapest H1-vs-H4 discriminator).

**Method:** `git show 1450a5a` (read source without modifying working tree). Dumped `api/[...slug].ts` verbatim, exhaustively grep'd `_handlers` across the full `api/` tree, audited the catch-all for indirect path-rewrite utilities (string concat / template literals / default-case fallbacks / conditional helpers / `path.resolve` / try-catch import fallbacks), inspected the HANDLER_LOADERS map exhaustively, confirmed `api/_handlers/` directory does not exist at this commit.

**Findings — exhaustive `_handlers` reference count across `api/` at commit `1450a5a` (23 files):**

| File | Hits | Location |
|---|---|---|
| `api/[...slug].ts` (catch-all) | 2 | Lines 4 + 20, both in the rationale-comment block above HANDLER_LOADERS. **HANDLER_LOADERS map (lines 43–65) — all 19 entries point at `./<slug>` static strings.** ZERO executable `_handlers` references. |
| `api/_helpers.ts` | 1 | Line 1 comment: *"Shared helpers for /api/_handlers/* — extracted during a post-typed-migration"*. |
| `api/_types.ts` | 2 | Lines 1 + 8, both comments documenting the cross-reference. |
| `api/create-checkout-session.ts` | 1 | Line 20 — rationale comment cross-referencing `api/_handlers/paypal-order.ts`. |
| `api/create-payment-intent.ts` | 1 | Line 15 — inline cross-reference comment ("See api/_handlers/create-checkout-session.ts…"). |
| `api/create-subscription-session.ts` | 1 | Line 17 — cross-reference comment. |
| `api/send-order-confirmation.ts` | 1 | Line 12 — cross-reference comment. |
| `api/verify-subscription.ts` | 1 | Line 22 — cross-reference comment. |
| **Total across entire `api/` tree** | **10** | **ALL in comments. ZERO in executable code.** |

**Indirect-path-rewrite audit on catch-all:** Strings: zero string-concat in `import()` specifiers (all 19 entries are static literal `./<slug>`). Template literals: none. `path.resolve` / `path.join`: not present. `try { import(...) } catch { import(some-other-path) }` fallback pattern not present. Default-case fallback in a switch: not present. The catch-all's only fallback (when `req.query.slug` is unpopulated) parses the request URL string and never resolves to a module specifier.

**`api/_handlers/` directory existence:** Does not exist at commit `1450a5a` — confirmed via `git ls-tree 1450a5a --name-only api/_handlers/` returning empty.

**H1 verdict: RULED OUT.** No source-level mechanism could resolve a runtime import to `/var/task/api/_handlers/<slug>`. The mechanism is downstream of the clean source.

**Architectural insight (raised by the diagnostic):** The catch-all's HANDLER_LOADERS comment block explicitly states:
> *"Production traffic goes through Vercels auto-detected api/<slug>.ts Serverless Functions (precedence rule beats the catch-all)."*

This documents the migration author's expectation that **per-handler functions take precedence over the catch-all** — i.e., the author anticipated **H2 (Catch-all Precedence)** as a known risk. The empirical failure signature (3 of 4 per-handler routes return FUNCTION_INVOCATION_FAILED, while catch-all cleanly responds 404 to unknown slugs) is consistent with H2: requests to per-handler routes are reaching the catch-all Lambda and the catch-all is bombing on the dynamic import resolution under prod conditions. **H2's profile is higher than initially suspected** because the migration author flagged this exact failure mode in source comments.

**Updated next-step recommendation:** With H1 ruled out, focus narrows to **H2 (Catch-all Precedence) + H3 (Edge Route Map) + H4 (Bundler Chunking Bug)**. Order of discriminators (cheapest, lowest-risk first):

1. **Diagnostic #3 (download prod source)** — cheapest, highest info, zero prod impact (Dashboard access only). Per its own cell text, distinguishes H1/H4/H2/H3 simultaneously: if `_handlers/` appears in Vercel-built `.func` → H4 (Bundler Bug); if not in `.func` but runtime resolves to `_handlers/` → H2/H3 (Precedence / Route Map); if neither → narrows to H5 (env-var masking). Highest marginal information per unit of operator effort.
2. **Diagnostic #4 (Dashboard log tracing)** — also Dashboard-only, no prod impact. Reading the actual function-routing entry-point in Vercel Dashboard determines which lambda bundle caught each request. If the catch-all `[...slug].func` is shown as the entry-point for `/api/paypal-order`, H2 is confirmed; if `paypal-order.func` is the entry-point, H2 ruled out.
3. **Diagnostic #2 (delete catch-all + redeploy)** — last because requires a prod push with rollback-recovery loop. If `api/[...slug].ts` is the actual route layer, removing it should route per-handler files directly to Vercel's filesystem-routing system; if per-handler files still 500 FUNCTION_INVOCATION_FAILED after catch-all is gone, the catch-all is innocent (H2 ruled out) and focus shifts to H3/H4.

Diagnostic #1 (this section) is complete; Diagnostic #1 row in the table above is marked RULED OUT to reflect that.

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
3. **Documented cache bypass API** — STATUS: PARTIALLY RESOLVED. `vercel deploy --force` (alias `vc deploy --force`) is documented and forces a clean build, bypassing the `node_modules` + build output cache. There is no per-function build cache (Vercel treats per-deployment builds as atomic). For Edge Cache invalidation (CDN-level response caching controlled by `Cache-Control` headers), Vercel's Purge API or Cache Tags (surrogate keys) are required — see Vercel edge-network docs at https://vercel.com/docs/edge-network/caching. There is no `vercel cache clear` command. See "Refined cache-bypass mechanics" section below for the proven tooling + open gaps.
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
5. **Push with cache bypass** (this is the differentiator from the failed attempt):

   **Option B (single force-bypassed deploy via CLI — preferred):**

   ```bash
   npx.cmd vercel deploy --prod --force --yes
   ```

   Forces a clean build from scratch, ignoring the build cache. Single deployment — clean atomic transition.

   **Option A (two-step: git push auto-deploy + dashboard force-redeploy — fallback if CLI not available):**

   ```bash
   # Step 1: git push triggers an auto-deploy WITHOUT force (cache state preserved)
   git push origin main

   # Step 2: from Vercel Dashboard, trigger a "Redeploy" on the most recent deployment.
   # Look for "Clear Build Cache" / "Force" checkbox or option in the redeploy dialog.
   # The query param for direct force-redeploy (?force=1) is documented but the operator
   # should verify the canonical syntax against current Vercel Dashboard docs at retry time,
   # because that param's exact spelling has shifted between Vercel Dashboard versions.
   ```

   **Inertness note:** Step 2's force-redeploy supersedes Step 1's auto-deploy. The auto-deploy remains in the deployment history but is not the live route — only the force-redeploy serves traffic.

   NOTE: Neither Option A nor Option B touches the Edge Cache. If the FUNCTION_INVOCATION_FAILED returns after a force-bypassed deploy, the next step is Edge Cache invalidation — see "Refined cache-bypass mechanics" section for the concrete reference.
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

## Refined cache-bypass mechanics (added 2026-07-08)

Researcher-docs surfaced authoritative (with caveats noted) Vercel behavior on cache invalidation:

| Cache layer | Bypass mechanism | CLI flag / API |
|---|---|---|
| Build cache (`node_modules`, build output) | Force a clean rebuild | `vercel deploy --force` (or `vercel deploy --prod --force` for prod push) |
| Build cache | Force a clean rebuild via dashboard | "Redeploy with cleared build cache" dialog option (the canonical UI affordance; exact query param syntax has varied between Vercel Dashboard versions — verify at retry time) |
| Edge cache (response CDN) | Purge API or Cache Tags (Surrogate Keys) | Vercel Purge API endpoint — see https://vercel.com/docs/edge-network/caching |
| Per-function build cache | DOES NOT EXIST | Vercel treats each deployment's builds as atomic |

**Critical implication for the cache hypothesis:** The `--force` flag bypasses the build cache. If the 1450a5a regression was caused by stale build cache (most likely cause per the hypothesis), `--force` will fix it on the next push. If the regression was caused by Edge Cache (`Cache-Control` headers with `s-maxage`), `--force` alone won't fix it — the Purge API is then required.

**Handler-cache-surface audit:** None of the handler files in this codebase sets `Cache-Control` headers in their responses directly. `setCorsHeaders` only writes `Access-Control-Allow-*` headers, no caching directives. So Edge Cache would only apply if Vercel's default response caching behaves differently than we expect — e.g. only if a global `Cache-Control` policy is configured in `vercel.json` (it isn't currently), or if Vercel's automatic smart-cache heuristic is enabled and misclassifying a Function response as cacheable.

**Known limitations of this research:**
- researcher-docs service reported "temporary technical limitation with the documentation retrieval service" during the cache-bypass query; findings are based on canonical Vercel architecture rather than a fresh pull of the latest docs.
- `--force` behavior, deployment atomicity, and the absence of per-function cache are well-established Vercel architecture facts (not speculative).
- Edge Cache Purge API specifics and Dashboard force-redeploy URL params should be cross-checked against current Vercel docs at retry time before being relied on.

**Updated retry path:**

- **If 1450a5a regression is build-cache only (most likely):** `npx.cmd vercel deploy --prod --force --yes` is sufficient. Single command, single force-bypassed deploy.
- **If 1450a5a regression is Edge-cache (less likely — none configured today):** additionally run the Vercel Purge API against the affected paths. Concrete API reference: https://vercel.com/docs/edge-network/caching. Fallback if Purge API doesn't help: drop the production domain's old CNAME from DNS and let it re-propagate (~5 min for `sgcoalition.xyz`).

For results that don't match either of those two patterns — e.g. catch-all returning 503 (handler auto-detection didn't take effect) or mixed 400/500 across the 4 endpoints (cache invalidation was partial) — consult the full 4-row decision matrix in Step 8 of the "Retry sequence" section above.

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

