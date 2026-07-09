# Operator recovery runbook — `/api/*` FUNCTION_INVOCATION_FAILED

**Date:** 2026-07-08
**Owner:** Anyone with project-admin access to Vercel `coalition-brand`
**Estimated effort:** ~20 minutes, single Dashboard session
**Linked postmortem:** [`../postmortems/postmortem-2026-07-08-api-routing-migration.md`](../postmortems/postmortem-2026-07-08-api-routing-migration.md)
**Linked stack-traces doc:** [`../postmortems/postmortem-2026-07-08-vercel-stack-traces.md`](../postmortems/postmortem-2026-07-08-vercel-stack-traces.md)

---

## Why this runbook exists

The postmortem has ruled out the two CLI-runnable hypotheses — **`H1` (flawed migration source)** via Diagnostic #1 source audit, and **`H2` (catch-all precedence)** via Diagnostic #2 catch-all removal — and has empirically refuted **Branch #1 (cache hypothesis)** via the `--force` cache-bypass retry. All three CLI/CI capture paths to the failing function runtime are definitively closed (verified 2026-07-08: `vercel download`/`artifacts` do not exist, `vercel inspect` + `vercel logs` only return metadata/summary lines, the REST API returns `403 invalidToken` against `VERCEL_OIDC_TOKEN`, and `vercel.com/dashboard` is auth-walled from the CLI session).

**The next investigation requires a human operator with Vercel Dashboard read-access.** This doc is that operator's end-to-end job description. Run it in one session; do not split across days.

If you do not have Dashboard access, **stop here** — file a Vercel support escalation with both postmortems attached instead. Do not invent logs.

---

## Pre-flight

- [ ] You have **project-admin access** on Vercel team `derron-byron's projects`, project `coalition-brand`.
- [ ] You can `git push` to `git@github.com:…/sgcoalition.git` (to commit the captures one-by-one).
- [ ] You have read both linked documents above (postmortem + stack-traces doc) before touching the Dashboard.
- [ ] About **20 uninterrupted minutes** is available.

### Which deploy to paste from

Both work — pick whichever you can reach first. The Diagnostic #2 deploy is richer because it proved `H2` (catch-all) is innocent (the runbook-level summary is captured in `postmortem-2026-07-08-api-routing-migration.md` §Diagnostic #2 attempt result).

| Priority | Deploy | Deploy ID | URL |
|---|---|---|---|
| **Primary** | `--force` cache-bypass retry | `dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq` | `https://coalition-brand-axuj4ekxb-derron-byrds-projects.vercel.app` |
| Secondary | Diagnostic #2 per-handler-only | retrievable via `npx vercel inspect <url>` | `https://coalition-brand-hkepnhkne-derron-byrds-projects.vercel.app` |
| **Skip** | Original `1450a5a` failure | `dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc` | Past Vercel retention; no longer in `vercel ls`. Skip if not found in Dashboard history. |

---

## End-to-end steps

### Step 0 — Capture the global route-table view FIRST (30-second screenshot, highest signal)

**Cost:** ~30 seconds. **Signal:** surfaces H3 (Edge Route Map stale state) + per-handler cold-start crash signature + marketing-subscribe contrast all in one capture, before any per-function work begins. **Run this BEFORE any of Steps 1–7** — it locks in the layer discriminator (H3 vs H4 vs H7) faster than the 5–7-minute per-function deep-dive.

1. On the Vercel Dashboard landing page (`vercel.com/dashboard`), click project `coalition-brand`.
2. Set the time-filter dropdown (top-right of the dashboard) to **"Last 2 hours"**.
3. Screenshot the entire page. Focus is the aggregate `Invocations` + `Error Rate` panel + the per-route table below it (every Lambda registered on the live domain, with columns: **Invocations · Active CPU · P95 Duration · Error Rate**).
4. Paste the screenshot + verbatim number transcription into `docs/postmortems/postmortem-2026-07-08-api-routing-migration.md` §Diagnostic #4 partial result section, replacing the operator-supplied 2026-07-08 capture that's there now with the new fresh capture (prepend each one with `[source: <date>]` so a future reader can disambiguate sequential captures).

**What the route-table surfaces (per the 2026-07-08 evidence shape):**

| Signal | What it tells you | Implicates |
|---|---|---|
| Catch-all `[...]slug` is the highest-invocation route | Catch-all is the dominant runtime entry point, not a tail | Sets caller expectations — 90%+ of `/api/*` traffic error rate lives at THIS layer even if per-handler Lambda routes look identical from the outside |
| Per-handler routes tracked independently of catch-all AND the per-handler source files only exist at `api/_handlers/<slug>.ts` (which Vercel's `_`-prefix convention should hide) | Stale edge route-map entries from prior failed deploys (`e33df76`, `--force` retry, `diag-2-no-catchall`) are real | **H3 (Edge Route Map) — HIGH CONFIDENCE AMONG SURVIVING HYPOTHESES** in one screenshot |
| Per-handler routes show `Active CPU = 0ms` AND `P95 Duration > 200ms` | Lambda bootstrap crashes BEFORE user code runs | H4 (Bundler Chunking Bug) OR H7 (Builder / Runtime Mismatch) both fit this signature — disambiguated by Step 5 entry-point Lambda name + Step 9 bundle-grep |
| `marketing-subscribe` shows `Error Rate = 0%` with non-zero `Active CPU` | Marketing-subscribe genuinely succeeded — catch-all resolved its `loadHandler()` + handler ran + validation gate reached | Refutes the postmortem's earlier inference that "marketing-subscribe survived only by validation short-circuit"; clarifies that marketing-subscribe is the contrast case, not a narrow survivor |
| Per-handler routes show exactly N invocations at regular intervals (e.g. ~6 over 2h) | Vercel uptime probes or third-party monitors hitting those paths on a fixed cadence | Explains why per-handler Lambdas rack up error counts even when no real user traffic hits those paths — important for "is this a customer-impacting incident" framing |

**Why Step 0 first (cost / signal ranking, ascending by signal per minute):**

| Action | Cost | Signal |
|---|---|---|
| **Step 0 (route-table screenshot)** | **~30s** | **HIGH** — locks in H3 / H4 / H7 layer discriminator in one capture |
| Step 1 (open Dashboard, locate failed deploy) | ~30s | LOW (navigation only) |
| Step 2–3 (paste URL into search, open Functions tab) | ~1 min | LOW (UI plumbing only) |
| Step 4–7 (per-function cold-start stacks for the 4 handlers × ~5 min each) | ~20 min | MEDIUM — narrows to exact fix path |
| Step 9 (download zip + bundle-grep) | ~3 min | MEDIUM-HIGH — confirms or rules out H4 specifically |

If Step 0 already locks in H3 + H7 (e.g., the route-table catches a fully-broken bundler output or a missing `@vercel/node` attachment on per-handler handlers), Steps 4–7 become **confirmatory** instead of **discovery** — total session time drops from ~25 min (Step 1–7 sequentially) to ~5 min (Step 0 + Step 9 minimum).

### Step 1 — Open the Dashboard
Go to **`https://vercel.com/dashboard`**
 → team `derron-byron's projects` → project `coalition-brand`. You should land on the **Deployments** tab.

### Step 2 — Locate the failed deploy
**Paste** one of the deploy URLs from the table above into the Deployments search box. The deploy row should appear at the top. Click into it.

### Step 3 — Open the Functions tab (Diagnostic #4 core)
On the deployment's detail page, click the **Functions** tab. If you see **Observability / Runtime / Logs** instead of "Functions" (Vercel has reorganized tab names several times in 2025–2026), click that — function-runtime stacks surface under one of those labels in any recent Dashboard version. **Do not** use Build Logs; that tab is deploy-time build output, not runtime crash output.

### Step 4 — Expand the first `FUNCTION_INVOCATION_FAILED` for `paypal-order`
In the function list, click `paypal-order`. Open the topmost invocation in the timeline (oldest, cold-start preserves the most diagnostic state).

### Step 5 — Capture the **Lambda entry-point** (the H3-vs-H4 discriminator)
At the top of the expanded stack, find the **Lambda entry-point line** — the exact function-name / file-path the runtime resolves to before throwing. **This is the single most important datum** because it discriminates between the two surviving hypotheses:

| Entry-point shown by the runtime | Implicates |
|---|---|
| `[...slug].func` — the **catch-all** Lambda bundle | **H3 (Edge Route Map):** Vercel's edge layer is misrouting per-handler requests to the catch-all bundle. |
| `paypal-order.func` — the **per-handler** Lambda bundle | **H4 (Bundler Chunking Bug):** The per-handler bundle itself compiled or chunked incorrectly; runtime lazy-imports a `_handlers/<slug>` path that no longer exists in it. |

Write the entry-point string verbatim into the postmortem (`§Diagnostic #4 attempt result` subsection) along with a one-line note: `[entry-point → H3]` or `[entry-point → H4]` (or `[entry-point → H3+H4 inconclusive]` if neither bucket applies cleanly).

### Step 6 — Capture the **full cold-start + dependency-resolution stack**
Copy everything below the entry-point line: cold-start duration, region, Lambda version + memory size, and the full stack trace. **Do not redact** — line numbers, file paths, error messages all go into the paste.

### Step 7 — Repeat Steps 4–6 for `complete-order` and `ai-chat`
Same flow. Same paste target. Same commit pattern.

### Step 8 — (Optional) Capture `marketing-subscribe`'s runtime log for §4
`marketing-subscribe` returned **400** (not 500) for the empty-body probe. Its evidence is shaped differently: validation short-circuited before the lazy-import path that crashed the others. Read the §4 header of the stack-traces doc first to understand why it matters; capture the same way.

### Step 9 — Diagnostic #3 (Recommended, same-session companion) — download source zip
Per the main postmortem's strategy note, Diagnostic #3 + Diagnostic #4 share the same prerequisite (Vercel Dashboard access) and are designed to run **together in this single session** — do not split across days. From the deployment's detail page, click the **Source** panel's download button to retrieve the deployed source zip. Then extract + grep for `_handlers` (do NOT use streaming `-p`):

```bash
mkdir -p /tmp/vfy_unzip && unzip -o <downloaded>.zip -d /tmp/vfy_unzip
grep -rE '_handlers' /tmp/vfy_unzip/ | head -20
```

Streaming `unzip -p | grep` looks cleaner but silently loses matches against binary-blob sections of the zip (Vercel sometimes ships hashed JS + `.vercel/cache` blobs concatenated in the same archive). Extracting first guarantees a real "no matches" result is evidence, not a false negative.

| Grep result | Confirms |
|---|---|
| `_handlers` strings present in deployed bundle | **H4 (Bundler Bug)** — Vercel shipped stale `_handlers` references in the bundle. |
| `_handlers` strings absent in deployed bundle but runtime still asks for them | **H3 (Edge Route Map)** — bundle is clean, edge is misrouting. |
| Binary artifacts only, no source-readable files in the zip | Escalate to Vercel support (you cannot inspect the bundle from your side). |

---

## Where to paste

| Captured | Paste target | File |
|---|---|---|
| `paypal-order` stack + entry-point | **§1 — paypal-order stack trace** | [`../postmortems/postmortem-2026-07-08-vercel-stack-traces.md`](../postmortems/postmortem-2026-07-08-vercel-stack-traces.md) |
| `complete-order` stack + entry-point | **§2 — complete-order stack trace** | same file |
| `ai-chat` stack + entry-point | **§3 — ai-chat stack trace** | same file |
| `marketing-subscribe` runtime log | **§4 — marketing-subscribe** (probe-with-empty-body + optional valid-body variant) | same file |
| Diagnostic #3 grep result + zip verdict | **§Diagnostic #3 attempt result** subsection | [`../postmortems/postmortem-2026-07-08-api-routing-migration.md`](../postmortems/postmortem-2026-07-08-api-routing-migration.md) |
| Step-5 discriminator call (entry-point → H3 / H4) | Top of `§Diagnostic #4 attempt result` subsection | same main postmortem file |

**Prepend every paste with `[source: <deploy-id>]`** so the postmortem can disambiguate dates — multiple deploys reproduce the same regression, and the diff history needs to track which one captured each datum.

---

## Commit hygiene (one commit per paste — non-negotiable)

```
docs(postmortem): paste <endpoint> FUNCTION_INVOCATION_FAILED stack from <deploy-id>

Source: dpl_<id>
Entry-point: <entry-point-string> → H3 | H4 | inconclusive
Cold-start: <duration> Region: <region> Lambda: <ver>, <memory>MB
```

Why per-paste commits matter: the diff history tells the trail of when each datum arrived. Reviewers (present and future) can jump to the commit that flipped the discriminator verdict. A single batch commit loses that audit trail.

**Anonymize PII:** the stacks should NOT contain user data per Vercel's runtime model (the lazy-import error fires before request body parsing), but if any email / phone / address slips in, redact before pasting.

---

## After the runbook

Once §1–§4 are populated, the main postmortem's `H3 (Edge Route Map) + H4 (Bundler Chunking Bug) + H5 (Env-var Masking)` header moves from `[unverified]` to `[confirmed by Dashboard capture]`. The decision matrix in the stack-traces doc (`§Verdict derivation`) then becomes a concrete fix path, not a guess:

- **Entry-point was `[...slug].func`** → H3 confirmed → fix path is to restore catch-all as canonical handler-routing OR investigate why edge is misrouting per-handler files.
- **Entry-point was `paypal-order.func` (or per-handler-named)** → H4 confirmed → fix path is either (a) revert the migration to `api/_handlers/<slug>.ts` (rerun the rollback chain to baseline `b632e74`), OR (b) diagnose why the bundler refused to fold per-handler `<slug>.ts` files into a single working chunk + fix it inline (preserves the new architecture). (a) is faster; (b) keeps the per-handler logic-forward target.
- **Stacks show missing/invalid env var** → H5 confirmed → fix path is to add the missing env var to Vercel (Production scope), then redeploy. `--force` not needed (env-var changes trigger automatic redeploy).

---

## Cross-references

- Main postmortem (decision context): [`../postmortems/postmortem-2026-07-08-api-routing-migration.md`](../postmortems/postmortem-2026-07-08-api-routing-migration.md)
- Stack-traces doc (paste targets + decision matrix): [`../postmortems/postmortem-2026-07-08-vercel-stack-traces.md`](../postmortems/postmortem-2026-07-08-vercel-stack-traces.md)
- Failed deploy Git commit: `1450a5ae60fb51fc297fa267013aa620fca8df4a`
- Baseline commit (current prod): `b632e74` (docs on top of `cb30a60` which reverted `e33df76`)
- Diagnostic #2 branch (kept on remote as audit trail): `diag-2-no-catchall`
