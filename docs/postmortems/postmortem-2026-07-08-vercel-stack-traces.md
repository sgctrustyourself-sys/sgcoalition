# Vercel runtime stack traces — `1450a5a` failed deploy

**Date:** 2026-07-08
**Linked postmortem:** [`postmortem-2026-07-08-api-routing-migration.md`](postmortem-2026-07-08-api-routing-migration.md)
**Status:** PARTIALLY COMPLETE — CLI-side metadata captured; per-function runtime stack traces require Dashboard access and have not yet been pasted by a human operator.

---

## Why this doc exists

The main postmortem concludes that the production regression on commit `1450a5a` was most likely caused by Vercel build/edge cache not invalidating when the directory layout of `api/_handlers` changed to `api/<slug>.ts`. To conclusively prove or disprove that hypothesis, the literal Node stack trace from each crashing endpoint's `FUNCTION_INVOCATION_FAILED` is the ground truth. CLI paths were attempted but only metadata + summary lines surfaced — runtime stacks require Dashboard UI access.

---

## What CLI captured automatically

**Vercel CLI auth identity:** `sgctrustyourself-1502` (CLI is authed; can list/inspect deployments).

**Failed deploy identification:**

| Field | Value |
|---|---|
| Commit SHA | `1450a5ae60fb51fc297fa267013aa620fca8df4a` |
| Deployment URL | `https://coalition-brand-1mfgn515q-derron-byrds-projects.vercel.app` |
| Deployment ID | `dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc` |
| Project | `coalition-brand` |
| Created (relative) | 2026-07-08, 19:06:06 GMT-0400 |
| Status | Ready (build completed normally — runtime crash was post-deploy during handler invocation, not at build time) |

**Promoted production alias at the time:** `sgcoalition.xyz` — which this deployment was not independently promoted to; it was the failed `1450a5a` deployment that was live ~3 minutes before the `dca1b57` revert was pushed and superseded it.

**CLI attempts that returned summary-level data (NOT stack traces):**

| Command | Result |
|---|---|
| `npx vercel logs sgcoalition.xyz --json` | Returned aggregated log lines (e.g. `"[api] failed to load handler paypal-order: Cannot find module '/var/task/api/_handlers/paypal-order'..."`), NOT per-function stack traces with file:line references. |
| `npx vercel logs --function=<slug>` | CLI rejects `--function` flag — not actually supported despite docs hinting at it. |
| `npx vercel logs --output=raw` / `--format=raw` | CLI rejects — no raw-output mode exists. |
| `npx vercel logs --since` / `--until` (timestamps) | Returns "No logs found" — historical runtime logs past the CLI's stdout retention window. Function-runtime stacks are NOT retained at the CLI level at all. |
| `npx vercel inspect <deployment-url>` | Returns deployment metadata (status, build config, file structure). Does NOT include per-function runtime log content. |
| `curl https://api.vercel.com/v1/deployments/{id}/events` (direct REST API) | 401 Unauthorized — `VERCEL_TOKEN` env var not present in this session. |

**The literal log line that DID come through CLI JSON capture (the highest-fidelity automated capture available).** NOTE on attribution: the JSON example below shows the captured log line for `paypal-order` specifically — that's the slug the basher's `--json` log retrieval surfaced. All 4 endpoints that hit the catch-all during the regression window produced structurally identical lines; only the slug name in the message changed. A `marketing-subscribe`-captured line, for example, would be `"[api] failed to load handler marketing-subscribe: Cannot find module '/var/task/api/_handlers/marketing-subscribe' imported from /var/task/api/[...slug].js"` with the same shape. The §1-§4 sections below request that each captured slug's line be documented separately so the failure class is provably the same across all 4 (or that an exception is identified).

```json
{
  "message": "[api] failed to load handler paypal-order: Cannot find module '/var/task/api/_handlers/paypal-order' imported from /var/task/api/[...slug].js",
  "level": "error"
}
```

This tells us the catch-all's `loadHandler()` rejected the dynamic import for `paypal-order` (this specific captured slug). The same shape is expected for the other 3 crashing endpoints; whether the same shape holds for each is part of what the §1–§4 captures below will determine. It does NOT tell us why the cache served stale `_handlers/<slug>` paths when the source had `./<slug>` paths. That question — *why* did Vercel's runtime resolve to `_handlers/` instead of the post-migration `<slug>` — is the one that requires the Vercel Dashboard runtime stack capture below.

---

## What the human operator needs to paste from the Dashboard

For each of the 3 crashing endpoints, paste the **literal stack trace** shown in Vercel's Dashboard → Functions tab. Each section below is a placeholder — replace its contents with the verbatim trace.

### Step-by-step Dashboard capture

1. Open https://vercel.com/dashboard
2. Navigate to project: `coalition-brand`
3. Click **Deployments** in the left nav
4. Find the deployment with ID `dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc` (created 2026-07-08 19:06:06). Use the search box if necessary.
5. Click into that deployment.
6. Click the **Functions** tab (the FUNCTION_INVOCATION_FAILED stack lives here, NOT in the "Build Logs" / "Logs" tab which is deploy-time build output). Vercel has reorganized tab names several times in 2025–2026; if a tab named "Functions" isn't visible, look for **Observability**, **Runtime**, **Logs**, or any tab adjacent to "Source" / "Build Logs" — the same `FUNCTION_INVOCATION_FAILED` runtime-stack content is surfaced under at least one of these labels in any recent Vercel Dashboard version.
7. In the function list, click each of: `paypal-order`, `complete-order`, `ai-chat`. For each, expand the relevant invocation that returned `FUNCTION_INVOCATION_FAILED` (the very first invocation after deploy is most informative because cold-starts preserve the most diagnostic state).
8. Copy the full stack trace text + any "Cold Start" / "Warning" annotations visible above it.

For each function, paste below. Preserve everything — line numbers, file paths, error message verbatim. Do NOT redact.

---

### §1 — `paypal-order` stack trace

<!-- PASTE STACK TRACE BELOW THIS LINE -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → deployment dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc → Functions tab → paypal-order → first invocation stack ]
```

<!-- PASTE STACK TRACE ABOVE THIS LINE -->

**Cold-start metadata to capture alongside:**
- Cold start duration (e.g. "Cold Start: ~1.4s")
- Function region (e.g. "iad1")
- Lambda version / memory size (e.g. "Lambda 17, 1024 MB")

---

### §2 — `complete-order` stack trace

<!-- PASTE STACK TRACE BELOW THIS LINE -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → deployment dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc → Functions tab → complete-order → first invocation stack ]
```

<!-- PASTE STACK TRACE ABOVE THIS LINE -->

**Cold-start metadata to capture alongside:** (same fields as §1)

---

### §3 — `ai-chat` stack trace

<!-- PASTE STACK TRACE BELOW THIS LINE -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → deployment dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc → Functions tab → ai-chat → first invocation stack ]
```

<!-- PASTE STACK TRACE ABOVE THIS LINE -->

**Cold-start metadata to capture alongside:** (same fields as §1)

---

### §4 — `marketing-subscribe` (the one that returned 400 instead of 500) — for comparison

The 1 endpoint that returned 400 instead of 500 is just as diagnostically important as the 3 that crashed — but its evidence is shaped differently. `marketing-subscribe`'s survival is NOT proof the migration worked for it; it's proof the handler's input validation short-circuited before reaching the lazy-import path that crashed the others. If `marketing-subscribe` had been probed with a payload that passes its validation (instead of the empty `{}` body the probe used), it might still have crashed at the same lazy-import error. So §4 evidence should be read carefully: it tells us "validation gate ran first and 400'd before the broken-import path", not "marketing-subscribe is healthier than the others."

For comparison purposes, capture both: (a) the runtime invocation log for marketing-subscribe's first probe-with-empty-body invocation (which returned 400), AND (b) if a subsequent probe-with-valid-body invocation is feasible and safe, that runtime log too.

<!-- PASTE RUNTIME LOG BELOW THIS LINE (probe-with-empty-body invocation, returned 400) -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → deployment dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc → Functions tab → marketing-subscribe → first invocation with empty JSON body, expected 400 response ]
```

<!-- PASTE RUNTIME LOG ABOVE THIS LINE -->

<!-- PASTE RUNTIME LOG BELOW THIS LINE (if available — probe-with-valid-body invocation, if safe to attempt) -->

```
[ OPTIONAL — if the operator runs a marketing-subscribe probe with a valid email payload and captures the result, paste here for comparison against the empty-body case ]
```

<!-- PASTE RUNTIME LOG ABOVE THIS LINE -->

---

## Verdict derivation (filled in once §1–§4 are populated)

The literal stack traces decide which branch of the cache-vs-bundler decision matrix applies. Once stacks are pasted, compare patterns:

| Stack-pattern observation | Cache-bypass would fix? | Implication |
|---|---|---|
| Stack references `/var/task/api/_handlers/<slug>` in a `Cannot find module` error | **YES** — `--force` flag bypasses build cache | Cache hypothesis confirmed. Retry path is `npx vercel deploy --prod --force --yes` per postmortem §Retry sequence Step 5 Option B. |
| Stack references `/var/task/api/<slug>` but throws on import-side-effect (e.g. SDK constructor missing env, ESM/CJS mismatch, missing transitive dep) | **NO** — `--force` would not help; the source/bundler has a real defect | Bundler-bug hypothesis confirmed. Pre-fix: revert or fix the source defect first — see postmortem §Working hypothesis Counter-evidence. |
| Stack is identical across all 3 crashing endpoints (same file:line, same error class) | Possibly **YES** (single cause) — `--force` if module-link-time; **NO** if a shared dep they all import | Look at the shared imports: `../utils/X`, `../services/X`, `./_helpers`, `./_types`. Cross-reference against the stash's `package.json` scripts section. |
| Stack-empty / FUNCTION_INVOCATION_FAILED with no thrown error | **NO** — Vercel's wrapper caught something it can't expose | Escalate to Vercel support with this deploy ID. |
| Stack shows missing/invalid env var (e.g. `Error: SUPABASE_URL is not configured`, `Stripe: No API key provided`, `@google/generative-ai: API key not set`) | **NO** — missing-env is independent of cache | Add the missing env var to Vercel project (Production scope), THEN redeploy. `vercel deploy --force` is not needed; the env var changes trigger automatic redeploy. |

---

## Cross-references

- **Main postmortem** (decision context): [`postmortem-2026-07-08-api-routing-migration.md`](postmortem-2026-07-08-api-routing-migration.md)
- **Cache-bypass mechanics + retry sequence**: same main postmortem, §Refined cache-bypass mechanics + §Retry sequence
- **Failed deploy Git commit**: `1450a5ae60fb51fc297fa267013aa620fca8df4a`
- **Baseline commit (current prod)**: `dca1b57`
- **Diagnostic Preview deploy URL** (clean-compile proof — Vercel Preview URLs typically have ~7-day retention; verify with `npx.cmd vercel ls` before referencing): `worktree-preview-test-i32ge4a0z-derron-byrds-projects.vercel.app`

---

## Notes on operator's task

- **Don't redact**: copy the full stack including all paths, even if they show `/var/task/api/_handlers/...`. The postmortem depends on those exact strings to validate the cache hypothesis.
- **Anonymize PII**: the stacks should NOT contain personal data per Vercel's runtime model, but if any user email / phone / address appears, redact before pasting into this repo. (None expected based on the catch-all's lazy-import failure path — the stack fires before request body parsing.)
- **One commit per paste**: as each of §1–§4 is populated, commit individually (don't batch) so the diff history tells the trail of when each datum arrived.
