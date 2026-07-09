# Vercel runtime stack traces — `1450a5a` failed deploy

**Date:** 2026-07-08
**Linked postmortem:** [`postmortem-2026-07-08-api-routing-migration.md`](postmortem-2026-07-08-api-routing-migration.md)
**Status:** PARTIALLY COMPLETE — CLI-side metadata captured; per-function runtime stack traces require Dashboard access and have not yet been pasted by a human operator. §1–§4 placeholder blocks below are now keyed to the **`[source: 2026-07-09]` capture schema** — three verbatim fields per the runbook Steps 5/6/9 (entry-point Lambda name + cold-start stack + Diagnostic #3 bundle-grep result). Operator paste target per the user's next-action cycle: `expand `/api/paypal-order` row in Vercel Dashboard` first (per §Diagnostic #4 still-pending list), then complete-order / ai-chat / marketing-subscribe. The CLI/CI capture-path audit below is unchanged — only a human operator with preserved Dashboard session can populate §1–§4 this turn.

**Tagging convention (operator action — applies to all 4 §1–§4 schemas):**
- **Date tag `[source: 2026-07-09]` is REQUIRED** on every paste (per the `[source: YYYY-MM-DD]` convention introduced in the §Diagnostic #4 partial result refresh in `postmortem-2026-07-08-api-routing-migration.md`).
- **Per-deploy tag `[source: <deploy-id>]` is OPTIONAL** but recommended when the operator knows the deploy ID (per the older `[source: <deploy-id>]` convention in the existing PENDING-block REMINDERs).
- **Both tags are orthogonal and can layer:** a paste with both reads `[source: 2026-07-09 | dpl_<deploy-id>]`. Worked example: `[source: 2026-07-09 | dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq]` = captured 2026-07-09 from the `--force` retry deploy URL `https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app` (the primary paste target per Step 2 in the runbook).
- **Per-section variations** are documented inline in each schema's Field A pick-rule (or §4-specific tag variant for the marketing-subscribe contrast case).
**Linked runbook (for the operator):** [`../runbooks/api-routing-fallback.md`](../runbooks/api-routing-fallback.md)

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

> **Operator note: three paste-source deploys, status as of 2026-07-08 final CLI/CI capture audit:**
>
> - **Original `1450a5a` failure deploy**: deploy ID `dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc`, deploy URL `https://coalition-brand-1mfgn515q-derron-byrds-projects.vercel.app`. **Status:** no longer in `npx vercel ls` (likely past the production retention window). May still be reachable via Vercel Dashboard history or by pasting the URL directly; if not found, treat as archived and skip.
> - **`--force` cache-bypass retry**: deploy ID `dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq`, deploy URL `https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app`. **Status:** confirmed READABLE via `vercel ls` (current session 2026-07-08). **Primary paste source.**
> - **Diagnostic #2 per-handler-only-no-catch-all deploy**: deploy URL `https://coalition-brand-hkepnhkne-derron-byrds-projects.vercel.app` (deploy ID retrievable via `npx vercel inspect <url>`). **Status:** confirmed READABLE via `vercel ls` (current session 2026-07-08). **Particularly important because it proves H2 catch-all-precedence is innocent** (per-handler + no catch-all still failed in the diagnostic).
>
> All three reproduce the same diagnostic question: why does Vercel's runtime ask for `/var/task/api/_handlers/<slug>` paths even when the per-handler file is supplied? The operator can paste stack traces from any of the three (preferably the `--force` retry or Diagnostic #2 deploy, since both are confirmed-readable). **Mark which deploy ID was used at paste time** (prepend `[source: <deploy-id>]` to each captured stack) so the postmortem can disambiguate dates and prevent downstream confusion.
>
> **CLI/CI capture path audit (all paths definitively closed 2026-07-08):**
>
> - `vercel download` / `vercel artifacts` — does not exist (`npx vercel --help` does not document either).
> - `vercel inspect` — returns deployment metadata only, not function runtime stacks.
> - `vercel logs` — returns only summary-level data (the original "Cannot find module" line); per-function stack traces not exposed.
> - REST API with `VERCEL_TOKEN` — token not in env.
> - REST API with `VERCEL_OIDC_TOKEN` — **definitive test 2026-07-08: HTTP 403 `{"error":{"code":"forbidden","message":"Not authorized","invalidToken":true}}`** (Vercel-OIDC tokens in CI environments are scoped to deploy triggers only, do NOT authenticate against `/v13/deployments/{id}` routes. The `invalidToken: true` flag confirms token rejection at the auth layer.)
> - Browser automation against `vercel.com/dashboard` — auth-wall at `https://vercel.com/login?next=%2Fdashboard`. Chrome in this session has no preserved Vercel auth cookies.
>
> **Only remaining capture path:** a manual operator with Vercel Dashboard project-admin access for `coalition-brand`. The full end-to-end runbook lives at [`../runbooks/api-routing-fallback.md`](../runbooks/api-routing-fallback.md) (new file as of 2026-07-08) — read it before pasting, since it has the H3-vs-H4 entry-point discriminator + paste-target crosswalk + per-deploy commit-message format. **Operating summary:** open Dashboard → coalition-brand → search any of the readable deploy IDs above → Functions tab → expand the first FUNCTION_INVOCATION_FAILED invocation for `paypal-order` → capture the entry-point Lambda function name (this is the **critical discriminator** for H3 vs H4: if the entry-point shows `[...slug].func` (catch-all) is the entry-point, H3 (Edge Route Map) is implicated; if `paypal-order.func` is the entry-point, H4 (Bundler Chunking Bug) is implicated) → paste the captured stack + entry-point into §1-§4 placeholder blocks below, one commit per paste.

### Step-by-step Dashboard capture

1. Open https://vercel.com/dashboard
2. Navigate to project: `coalition-brand`
3. Click **Deployments** in the left nav
4. Find the deployment with ID `dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc` (created 2026-07-08 19:06:06). Use the search box if necessary. **Substitute one of the 3 valid deploy IDs above if this one is no longer in the list.**
5. Click into that deployment.
6. Click the **Functions** tab (the FUNCTION_INVOCATION_FAILED stack lives here, NOT in the "Build Logs" / "Logs" tab which is deploy-time build output). Vercel has reorganized tab names several times in 2025–2026; if a tab named "Functions" isn't visible, look for **Observability**, **Runtime**, **Logs**, or any tab adjacent to "Source" / "Build Logs" — the same `FUNCTION_INVOCATION_FAILED` runtime-stack content is surfaced under at least one of these labels in any recent Vercel Dashboard version.
7. In the function list, click each of: `paypal-order`, `complete-order`, `ai-chat`. For each, expand the relevant invocation that returned `FUNCTION_INVOCATION_FAILED` (the very first invocation after deploy is most informative because cold-starts preserve the most diagnostic state).
8. Copy the full stack trace text + any "Cold Start" / "Warning" annotations visible above it.

For each function, paste below. Preserve everything — line numbers, file paths, error message verbatim. Do NOT redact.

---

### §1 — `paypal-order` stack trace

#### Operator capture schema (per runbook Steps 5/6/9) — `[source: 2026-07-09 — pending operator paste]`

The next operator paste (runbook Step 4: "expand `/api/paypal-order` row in Vercel Dashboard → Functions tab → first FUNCTION_INVOCATION_FAILED invocation") yields THREE verbatim fields. Paste each in its own fenced block per the schema below — tagged with `[source: 2026-07-09]` so the postmortem disambiguates from the 2026-07-08 capture cycle audited in the linked main postmortem §Diagnostic #4 partial result.

**→ Paste target:** replace the existing `[ PENDING — paste verbatim... ]` block below (the older CLI-side placeholder) with three fenced blocks in Field A → Field B → Field C order. The boundary-marker comments around the existing PENDING block (`<!-- PASTE STACK TRACE BELOW THIS LINE -->` etc.) MUST stay so future diffs can see where your paste landed.

(See the Status block at the top of this doc for the general date + per-deploy tag-layering rules.)

**Field A pick-rule (operator action):** after pasting Field A's template `[source: 2026-07-09 | entry-point → H3 | H4 | inconclusive]`, REPLACE `H3 | H4 | inconclusive` with the single chosen hypothesis — the paste reads exactly one of `[source: 2026-07-09 | entry-point → H3]`, `[source: 2026-07-09 | entry-point → H4]`, or `[source: 2026-07-09 | entry-point → inconclusive]`. Do NOT leave the three-way `H3 | H4 | inconclusive` literal.

**Field A — Entry-point Lambda function name (Step 5 — the H3-vs-H4 discriminator):** the FIRST line of the expanded stack shows the Lambda entry-point string the runtime resolved to before throwing. Tag the resulting paste with the implicated hypothesis:

```
[source: 2026-07-09 | entry-point → H3 | H4 | inconclusive]
```

Decision matrix (verbatim from `../runbooks/api-routing-fallback.md` Step 5):

| Entry-point shown by the runtime | Implicates |
|---|---|
| `[...slug].func` — the **catch-all** Lambda bundle | **H3 (Edge Route Map)** |
| `paypal-order.func` — the **per-handler** Lambda bundle | **H4 (Bundler Chunking Bug)** |

**Field B — Full cold-start + dependency-resolution stack (Step 6):** paste the full literal stack below. Do NOT redact line numbers, file paths, or error messages. Include the cold-start metadata block at top (Cold Start ~<duration>, Region, Lambda version, Memory size).

**Field C — Bundle-grep result (Step 9 / Diagnostic #3, same-session companion):** per runbook Step 9, download the deployed source zip from the same deployment's Source panel, extract to `/tmp/vfy_unzip/`, then run `grep -rE '_handlers' /tmp/vfy_unzip/ | head -20`. Paste the grep output verbatim:

- If matches present → **H4 confirmed**. Paste the grep output verbatim.
- If matches absent → **H3 confirmed**. Paste the empty grep output verbatim.
- If zip contains binary artifacts only → escalate to Vercel support. Paste the `file -i` listing of the zip.

(The existing PENDING block below this schema remains as the older CLI-side reference — do NOT delete it. The new schema block above is the operational target for the `[source: 2026-07-09]` capture cycle.)

<!-- PASTE STACK TRACE BELOW THIS LINE -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → one of three deploys:

  1. `--force` retry (PRIMARY): deploy dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq at https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app (today's cache-bypass retry — still failed 1-for-1)
  2. Diagnostic #2 per-handler-only-no-catch-all deploy (cleanest H3-vs-H4 discriminator; if any per-handler entry-point shows here, the catch-all routing layer was innocent): https://coalition-brand-hkepnhkne-derron-byrds-projects.vercel.app — retrieve deploy ID via `npx vercel inspect <url>` if needed
  3. Original 1450a5a failure deploy (likely past Vercel retention; skip if not visible in Dashboard history): dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc

→ Functions tab → paypal-order → first FUNCTION_INVOCATION_FAILED invocation → full stack + cold-start annotations + entry-point Lambda function name. The entry-point reading is the first half of the H3-vs-H4 two-stage discriminator: `entry-point = `[...slug].func` → strongly implicates H3 (Edge Route Map). entry-point = `paypal-order.func` (or any other per-handler name) → narrows to H4 territory. Full H4 confirmation requires the runbook's Diagnostic #3 (bundle-grep) step to also show `_handlers` strings still present in the deployed `.func` bundle — see the runbook's `### Step 9` for that second-stage check.)

REMINDER: prepend your paste with [source: <deploy-id>] so the postmortem disambiguates dates. ]
```

<!-- PASTE STACK TRACE ABOVE THIS LINE -->

**Cold-start metadata to capture alongside:**
- Cold start duration (e.g. "Cold Start: ~1.4s")
- Function region (e.g. "iad1")
- Lambda version / memory size (e.g. "Lambda 17, 1024 MB")

---

### §2 — `complete-order` stack trace

#### Operator capture schema (per runbook Steps 5/6/9) — `[source: 2026-07-09 — pending operator paste]`

The next operator paste (runbook Step 7: "expand `/api/complete-order` row in Vercel Dashboard → Functions tab → first FUNCTION_INVOCATION_FAILED invocation") yields THREE verbatim fields. Paste each in its own fenced block per the schema below — tagged with `[source: 2026-07-09]` so the postmortem disambiguates from the 2026-07-08 capture cycle audited in the linked main postmortem §Diagnostic #4 partial result.

**→ Paste target:** replace the existing `[ PENDING — paste verbatim... ]` block below (the older CLI-side placeholder) with three fenced blocks in Field A → Field B → Field C order. The boundary-marker comments around the existing PENDING block (`<!-- PASTE STACK TRACE BELOW THIS LINE -->` etc.) MUST stay so future diffs can see where your paste landed.

(See the Status block at the top of this doc for the general date + per-deploy tag-layering rules.)

**Field A pick-rule (operator action):** after pasting Field A's template `[source: 2026-07-09 | entry-point → H3 | H4 | inconclusive]`, REPLACE `H3 | H4 | inconclusive` with the single chosen hypothesis — the paste reads exactly one of `[source: 2026-07-09 | entry-point → H3]`, `[source: 2026-07-09 | entry-point → H4]`, or `[source: 2026-07-09 | entry-point → inconclusive]`. Do NOT leave the three-way `H3 | H4 | inconclusive` literal.

**Field A — Entry-point Lambda function name (Step 5 — the H3-vs-H4 discriminator):** the FIRST line of the expanded stack shows the Lambda entry-point string the runtime resolved to before throwing. Tag the resulting paste with the implicated hypothesis:

```
[source: 2026-07-09 | entry-point → H3 | H4 | inconclusive]
```

Decision matrix (verbatim from `../runbooks/api-routing-fallback.md` Step 5):

| Entry-point shown by the runtime | Implicates |
|---|---|
| `[...slug].func` — the **catch-all** Lambda bundle | **H3 (Edge Route Map)** |
| `complete-order.func` — the **per-handler** Lambda bundle | **H4 (Bundler Chunking Bug)** |

**Field B — Full cold-start + dependency-resolution stack (Step 6):** paste the full literal stack below. Do NOT redact line numbers, file paths, or error messages. Include the cold-start metadata block at top (Cold Start ~<duration>, Region, Lambda version, Memory size).

**Field C — Bundle-grep result (Step 9 / Diagnostic #3, same-session companion):** per runbook Step 9, download the deployed source zip from the same deployment's Source panel, extract to `/tmp/vfy_unzip/`, then run `grep -rE '_handlers' /tmp/vfy_unzip/ | head -20`. Paste the grep output verbatim:

- If matches present → **H4 confirmed**. Paste the grep output verbatim.
- If matches absent → **H3 confirmed**. Paste the empty grep output verbatim.
- If zip contains binary artifacts only → escalate to Vercel support. Paste the `file -i` listing of the zip.

(The existing PENDING block below this schema remains as the older CLI-side reference — do NOT delete it. The new schema block above is the operational target for the `[source: 2026-07-09]` capture cycle.)

<!-- PASTE STACK TRACE BELOW THIS LINE -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → one of three deploys:

  1. `--force` retry (PRIMARY): deploy dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq at https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app
  2. Diagnostic #2 per-handler-only-no-catch-all deploy: https://coalition-brand-hkepnhkne-derron-byrds-projects.vercel.app — retrieve deploy ID via `npx vercel inspect <url>` if needed
  3. Original 1450a5a failure deploy (likely past Vercel retention; skip if not visible in Dashboard history): dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc

→ Functions tab → complete-order → first FUNCTION_INVOCATION_FAILED invocation → full stack + cold-start annotations.

REMINDER: prepend your paste with [source: <deploy-id>] so the postmortem disambiguates dates. ]
```

<!-- PASTE STACK TRACE ABOVE THIS LINE -->

**Cold-start metadata to capture alongside:** (same fields as §1)

---

### §3 — `ai-chat` stack trace

#### Operator capture schema (per runbook Steps 5/6/9) — `[source: 2026-07-09 — pending operator paste]`

The next operator paste (runbook Step 7: "expand `/api/ai-chat` row in Vercel Dashboard → Functions tab → first FUNCTION_INVOCATION_FAILED invocation") yields THREE verbatim fields. Paste each in its own fenced block per the schema below — tagged with `[source: 2026-07-09]` so the postmortem disambiguates from the 2026-07-08 capture cycle audited in the linked main postmortem §Diagnostic #4 partial result.

**→ Paste target:** replace the existing `[ PENDING — paste verbatim... ]` block below (the older CLI-side placeholder) with three fenced blocks in Field A → Field B → Field C order. The boundary-marker comments around the existing PENDING block (`<!-- PASTE STACK TRACE BELOW THIS LINE -->` etc.) MUST stay so future diffs can see where your paste landed.

(See the Status block at the top of this doc for the general date + per-deploy tag-layering rules.)

**Field A pick-rule (operator action):** after pasting Field A's template `[source: 2026-07-09 | entry-point → H3 | H4 | inconclusive]`, REPLACE `H3 | H4 | inconclusive` with the single chosen hypothesis — the paste reads exactly one of `[source: 2026-07-09 | entry-point → H3]`, `[source: 2026-07-09 | entry-point → H4]`, or `[source: 2026-07-09 | entry-point → inconclusive]`. Do NOT leave the three-way `H3 | H4 | inconclusive` literal.

**Field A — Entry-point Lambda function name (Step 5 — the H3-vs-H4 discriminator):** the FIRST line of the expanded stack shows the Lambda entry-point string the runtime resolved to before throwing. Tag the resulting paste with the implicated hypothesis:

```
[source: 2026-07-09 | entry-point → H3 | H4 | inconclusive]
```

Decision matrix (verbatim from `../runbooks/api-routing-fallback.md` Step 5):

| Entry-point shown by the runtime | Implicates |
|---|---|
| `[...slug].func` — the **catch-all** Lambda bundle | **H3 (Edge Route Map)** |
| `ai-chat.func` — the **per-handler** Lambda bundle | **H4 (Bundler Chunking Bug)** |

**Field B — Full cold-start + dependency-resolution stack (Step 6):** paste the full literal stack below. Do NOT redact line numbers, file paths, or error messages. Include the cold-start metadata block at top (Cold Start ~<duration>, Region, Lambda version, Memory size).

**Field C — Bundle-grep result (Step 9 / Diagnostic #3, same-session companion):** per runbook Step 9, download the deployed source zip from the same deployment's Source panel, extract to `/tmp/vfy_unzip/`, then run `grep -rE '_handlers' /tmp/vfy_unzip/ | head -20`. Paste the grep output verbatim:

- If matches present → **H4 confirmed**. Paste the grep output verbatim.
- If matches absent → **H3 confirmed**. Paste the empty grep output verbatim.
- If zip contains binary artifacts only → escalate to Vercel support. Paste the `file -i` listing of the zip.

(The existing PENDING block below this schema remains as the older CLI-side reference — do NOT delete it. The new schema block above is the operational target for the `[source: 2026-07-09]` capture cycle.)

<!-- PASTE STACK TRACE BELOW THIS LINE -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → one of three deploys:

  1. `--force` retry (PRIMARY): deploy dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq at https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app
  2. Diagnostic #2 per-handler-only-no-catch-all deploy: https://coalition-brand-hkepnhkne-derron-byrds-projects.vercel.app — retrieve deploy ID via `npx vercel inspect <url>` if needed
  3. Original 1450a5a failure deploy (likely past Vercel retention; skip if not visible in Dashboard history): dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc

→ Functions tab → ai-chat → first FUNCTION_INVOCATION_FAILED invocation → full stack + cold-start annotations.

REMINDER: prepend your paste with [source: <deploy-id>] so the postmortem disambiguates dates. ]
```

<!-- PASTE STACK TRACE ABOVE THIS LINE -->

**Cold-start metadata to capture alongside:** (same fields as §1)

---

### §4 — `marketing-subscribe` (the one that returned 400 instead of 500) — for comparison

The 1 endpoint that returned 400 instead of 500 is just as diagnostically important as the 3 that crashed — but its evidence is shaped differently. `marketing-subscribe`'s survival is NOT proof the migration worked for it; it's proof the handler's input validation short-circuited before reaching the lazy-import path that crashed the others. If `marketing-subscribe` had been probed with a payload that passes its validation (instead of the empty `{}` body the probe used), it might still have crashed at the same lazy-import error. So §4 evidence should be read carefully: it tells us "validation gate ran first and 400'd before the broken-import path", not "marketing-subscribe is healthier than the others."

For comparison purposes, capture both: (a) the runtime invocation log for marketing-subscribe's first probe-with-empty-body invocation (which returned 400), AND (b) if a subsequent probe-with-valid-body invocation is feasible and safe, that runtime log too.

#### Operator capture schema (per runbook Step 8) — `[source: 2026-07-09 — pending operator paste]`

The probe-with-empty-body invocation that returned 400 is the **contrast evidence** — marketing-subscribe's validation gate ran before the broken-import path that crashed §1–§3. The valid-body probe (if safely attemptable) extends the contrast to a full handler round-trip. Paste each field in its own fenced block per the schema below — tagged with `[source: 2026-07-09]` so the postmortem disambiguates from the 2026-07-08 capture cycle audited in the linked main postmortem §Diagnostic #4 partial result.

**→ Paste target:** replace the existing `[ PENDING — paste verbatim... ]` blocks below (older CLI-side placeholders) with the relevant Field blocks in Field A → Field B → Field C order. Note: §4 has TWO `[ PENDING — paste verbatim... ]` blocks (probe-with-empty-body + optional probe-with-valid-body); replace BOTH. The boundary-marker comments around the existing PENDING blocks (`<!-- PASTE RUNTIME LOG BELOW THIS LINE -->` etc.) MUST stay.

(See the Status block at the top of this doc for the general date + per-deploy tag-layering rules.)

**§4-specific tag variant (operator action):** the Field A empty-body probe tag should read `[source: 2026-07-09 | marketing-subscribe empty-body probe → 400]` to make the contrast-case role explicit (this tag answers "did the validation gate short-circuit before the broken-import path?" — marketers will read this tag years later and recognize the question it answers). The Field B valid-body probe (optional) tag reads `[source: 2026-07-09 | marketing-subscribe valid-body probe → <response-code>]` with the actual response code the operator observed appended at the end.

**Field A — Probe-with-empty-body runtime log (Step 8):** paste the literal runtime log for the first invocation with `{}` body, expected 400 response:

```
[source: 2026-07-09 | marketing-subscribe empty-body probe → 400 → confirms validation gate ran first, did NOT reach lazy-import path]
```

**Field B — (Optional) Probe-with-valid-body runtime log (Step 8 extension):** if the operator runs a marketing-subscribe probe with a valid email payload and captures the result, paste here:

```
[source: 2026-07-09 | marketing-subscribe valid-body probe → reached handler IF present, else 400 validation re-fires]
```

**Field C — Bundle-grep result (Step 9 / Diagnostic #3, same-session companion):** see `### §1 — paypal-order stack trace` Field C for full bundle-grep mechanics. Note: a SINGLE bundle-grep result PER BUNDLE covers all 4 §1–§4 entries (H4/H3 confirmation is per-bundle, not per-endpoint) — paste the grep output ONCE in §1 Field C, then from §2/§3/§4 reference it as `[source: 2026-07-09 | see §1 Field C — bundle-grep result]`. One operator paste action, four section references.

(The existing PENDING blocks below this schema remain as the older CLI-side reference — do NOT delete them. The new schema block above is the operational target for the `[source: 2026-07-09]` capture cycle.)

<!-- PASTE RUNTIME LOG BELOW THIS LINE (probe-with-empty-body invocation, returned 400) -->

```
[ PENDING — paste verbatim from Vercel Dashboard → coalition-brand → one of three deploys:

  1. `--force` retry (PRIMARY): deploy dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq at https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app
  2. Diagnostic #2 per-handler-only-no-catch-all deploy: https://coalition-brand-hkepnhkne-derron-byrds-projects.vercel.app — retrieve deploy ID via `npx vercel inspect <url>` if needed
  3. Original 1450a5a failure deploy (likely past Vercel retention; skip if not visible in Dashboard history): dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc

→ Functions tab → marketing-subscribe → first invocation with empty JSON body, expected 400 response.

REMINDER: prepend your paste with [source: <deploy-id>] so the postmortem disambiguates dates. ]
```

<!-- PASTE RUNTIME LOG ABOVE THIS LINE -->

<!-- PASTE RUNTIME LOG BELOW THIS LINE (if available — probe-with-valid-body invocation, if safe to attempt) -->

```
[ OPTIONAL — if the operator runs a marketing-subscribe probe with a valid email payload and captures the result, paste here for comparison against the empty-body case ]
```

<!-- PASTE RUNTIME LOG ABOVE THIS LINE -->

---

## Commit hygiene for next capture cycle (per-paste mode — 5 commits expected per the runbook's `## Commit hygiene`)

The agent is now configured for **per-paste commits** per the runbook's `## Commit hygiene` section (one commit per paste — non-negotiable for the granular audit trail). Five commits are anticipated for the next operator capture cycle, each subject templated as `docs(postmortem): paste <endpoint> FUNCTION_INVOCATION_FAILED stack from <deploy-id>` (or `…bundle-grep result…` for commit #1):

| # | Subject (verbatim template) | Target section |
|---|---|---|
| 1 | `docs(postmortem): paste bundle-grep result from <deploy-id>` | §1 Field C only (per-bundle; §2/§3/§4 Field C cross-references commit #1 — no duplication) |
| 2 | `docs(postmortem): paste paypal-order FUNCTION_INVOCATION_FAILED stack from <deploy-id>` | §1 Field A + Field B |
| 3 | `docs(postmortem): paste complete-order FUNCTION_INVOCATION_FAILED stack from <deploy-id>` | §2 Field A + Field B |
| 4 | `docs(postmortem): paste ai-chat FUNCTION_INVOCATION_FAILED stack from <deploy-id>` | §3 Field A + Field B |
| 5 | `docs(postmortem): paste marketing-subscribe empty-body probe from <deploy-id>` | §4 Field A (always) |
| 5b (conditional) | `docs(postmortem): paste marketing-subscribe valid-body probe from <deploy-id>` | §4 Field B (only if operator runs the probe-with-valid-body variant) |

Each commit body follows the runbook's standard metadata template:

```
Source: dpl_<id>
Entry-point: <entry-point-string> → [pick ONE of H3 | H4 | inconclusive] (post-§1-§3 Field A pick-rule applies here — REPLACE three-way with the single chosen hypothesis)
Cold-start: <duration> Region: <region> Lambda: <ver>, <memory>MB
```

**Notes on metadata applicability (per-commit-type):**

- **Commits #2, #3, #4** (crashing endpoints with entry-points) — use the canonical metadata template above verbatim.
- **Commit #1** (bundle-grep, per-bundle) — use just `Source: dpl_<id>` followed by the grep output verbatim. There is NO entry-point and NO cold-start metadata because the bundle is the artifact, not a runtime invocation. Sample body for commit #1:

  ```
  Source: dpl_<deploy-id>
  Command: grep -rE '_handlers' /tmp/vfy_unzip/ | head -20
  Output: [paste command's full stdout verbatim — either matched lines (one per line) if the bundler shipped stale _handlers references, or empty result (no output between the surrounding lines) if the bundle is clean]
  ```

- **Commit #5** (marketing-subscribe, contrast case that returns 400 not 500) — use `Source: dpl_<id>` + `Probe: empty-body → <response-code>` instead of `Entry-point: ... → H3 | H4 | inconclusive`. Marketing-subscribe's diagnostic signature is validation-gate short-circuit evidence, NOT entry-point evidence — the H3/H4/inconclusive pick-rule does NOT apply here. Sample body for commit #5:

  ```
  Source: dpl_<deploy-id>
  Probe: empty-body → <response-code> (400 expected per runbook Step 8)
  ```

- **Commit #5b (conditional, optional)** — if the operator runs the probe-with-valid-body variant AND captures its result, the metadata is `Source: dpl_<id>` + `Probe: valid-body → <response-code>` (without `Entry-point:` line). Sample body for commit #5b:

  ```
  Source: dpl_<deploy-id>
  Probe: valid-body → <response-code> (200 / 400-re-fires / 502 etc.)
  ```

**Edge cases:**

- **Multi-deploy paste scenario** — if the operator pastes from multiple deploys (e.g., `--force` retry `dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq` for §1 / §2 / §3 + Diagnostic #2 deploy `hkepnhkne-…` for §4), each per-deploy paste is its own commit per the per-paste rule. Grand total may exceed 5 commits. Still per-paste compliant.
- **Optional §4 Field B (valid-body probe)** — if the operator runs the probe-with-valid-body variant AND captures its result, that's a separate commit appended (e.g. as commit #5b): `docs(postmortem): paste marketing-subscribe valid-body probe from <deploy-id>`. The empty-body probe is commit #5.
- **Commit ordering** — commits do NOT need to be in the table order above. The §4 Field C cross-reference fix means any order works — the diff history just needs to record each datum's arrival time individually. Operator Dashboard-capture order (paste §1 Field A/B first, then §2, §3, §4; bundle-grep last) produces commits in **document-section order** (#2 first, then #3, #4, #5, #5b, finally #1) — NOT numeric table order. Either is valid per-paste.
- **Single combined commit ("all in one") mode is explicitly NOT used.** The runbook's `## Commit hygiene` declares per-paste commits **non-negotiable** — there is no opt-out path documented. Operators must always commit per-paste per the table above; the per-paste mode is the audit-trail-preserving default. If a future investigator believes a single-combined commit is justified for an exceptional reason, surface it as a *separate* commit-and-amendment proposal (postmortem addendum); do NOT silently switch modes mid-cycle.

**Why per-paste commits matter (verbatim from runbook rationale):** the diff history tells the trail of when each datum arrived. Reviewers (present and future) can jump to the commit that flipped the discriminator verdict. A single batch commit loses that audit trail — and this regression has cost enough debugging time that future investigators will thank us for granular commit metadata.

---

## Verdict derivation (refutation added 2026-07-08: Branch #1 inverted)

**UPDATE 2026-07-08 (Attempt 5 result):** Branch #1 (cache hypothesis) has been empirically refuted. The documented retry sequence (`vercel deploy --prod --force --yes`) was executed with full pre-push safety (clean local `npx vercel build --yes`, ZERO `_handlers` references in executable code, code-reviewer approval). The force-bypass retry reproduced FUNCTION_INVOCATION_FAILED on 3 of 4 handlers identically to the original `1450a5a` failure. **Branch #1 verdicts are NOT a viable fix path**, even when stack-pattern matches the literal CLI line that originally supported it.

The Dashboard paste (when/if it happens) is now valuable for distinguishing among the *new* branches (1-5 below in "Updated diagnostic branches" section of the main postmortem), not for confirming Branch #1.

The literal stack traces (when pasted) decide which branch of the cache-vs-bundler decision matrix applies. With stacks in hand, compare patterns:

| Stack-pattern observation | Cache-bypass would fix? | Implication |
|---|---|---|
| Stack references `/var/task/api/_handlers/<slug>` in a `Cannot find module` error | Was: **YES** — `--force` flag bypasses build cache. **REFUTED 2026-07-08 (Attempt 5)**: `--force` cache-bypass reproduced the regression 1-for-1 (3 of 4 handlers `FUNCTION_INVOCATION_FAILED`, same signature as the original `1450a5a`). Branch #1 is NO LONGER a viable fix path. | See `postmortem-2026-07-08-api-routing-migration.md` §Updated diagnostic branches for next investigation direction. The "YES" verdict below was correct as far as the static analysis went (build cache bypass IS the right mechanic in theory) but the empirical reproduction falsified the underlying hypothesis. |
| Stack references `/var/task/api/<slug>` but throws on import-side-effect (e.g. SDK constructor missing env, ESM/CJS mismatch, missing transitive dep) | **NO** — `--force` would not help; the source/bundler has a real defect | Bundler-bug hypothesis confirmed. Pre-fix: revert or fix the source defect first — see postmortem §Working hypothesis Counter-evidence. |
| Stack is identical across all 3 crashing endpoints (same file:line, same error class) | Possibly **YES** (single cause) — `--force` if module-link-time; **NO** if a shared dep they all import | Look at the shared imports: `../utils/X`, `../services/X`, `./_helpers`, `./_types`. Cross-reference against the stash's `package.json` scripts section. |
| Stack-empty / FUNCTION_INVOCATION_FAILED with no thrown error | **NO** — Vercel's wrapper caught something it can't expose | Escalate to Vercel support with this deploy ID. |
| Stack shows missing/invalid env var (e.g. `Error: SUPABASE_URL is not configured`, `Stripe: No API key provided`, `@google/generative-ai: API key not set`) | **NO** — missing-env is independent of cache | Add the missing env var to Vercel project (Production scope), THEN redeploy. `vercel deploy --force` is not needed; the env var changes trigger automatic redeploy. |

---

## Cross-references

- **Main postmortem** (decision context): [`postmortem-2026-07-08-api-routing-migration.md`](postmortem-2026-07-08-api-routing-migration.md)
- **Operator runbook** (step-by-step Dashboard capture): [`../runbooks/api-routing-fallback.md`](../runbooks/api-routing-fallback.md)
- **Cache-bypass mechanics + retry sequence**: same main postmortem, §Refined cache-bypass mechanics + §Retry sequence
- **Failed deploy Git commit**: `1450a5ae60fb51fc297fa267013aa620fca8df4a`
- **Baseline commit (current prod)**: `b632e74` (docs on top of `cb30a60` which reverted `e33df76`)
- **Diagnostic Preview deploy URL** (clean-compile proof — Vercel Preview URLs typically have ~7-day retention; verify with `npx.cmd vercel ls` before referencing): `worktree-preview-test-i32ge4a0z-derron-byrds-projects.vercel.app`

---

## Notes on operator's task

- **Don't redact**: copy the full stack including all paths, even if they show `/var/task/api/_handlers/...`. The postmortem depends on those exact strings to validate the cache hypothesis.
- **Anonymize PII**: the stacks should NOT contain personal data per Vercel's runtime model, but if any user email / phone / address appears, redact before pasting into this repo. (None expected based on the catch-all's lazy-import failure path — the stack fires before request body parsing.)
- **One commit per paste**: as each of §1–§4 is populated, commit individually (don't batch) so the diff history tells the trail of when each datum arrived. See the runbook for the canonical commit-message format.
- **Status of CLI/CI capture paths**: all 6 paths definitively closed 2026-07-08 (see operator note above + runbook for the formal audit).
