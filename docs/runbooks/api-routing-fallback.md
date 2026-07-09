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
| **Primary** | `--force` cache-bypass retry | `dpl_H6m4Eyh2DTKNNyZSrFzTyL8kYWSq` | `https://coalition-brand-axuj4ekxb-derron-byron's-projects.vercel.app` |
| Secondary | Diagnostic #2 per-handler-only | retrievable via `npx vercel inspect <url>` | `https://coalition-brand-hkepnhkne-derron-byron's-projects.vercel.app` |
| **Skip** | Original `1450a5a` failure | `dpl_AUqeWAftrtcXNcALCpMKp5RxuaHc` | Past Vercel retention; no longer in `vercel ls`. Skip if not found in Dashboard history. |

---

## End-to-end steps

### Step 1 — Open the Dashboard
Go to **`https://vercel.com/dashboard`** → team `derron-byron's projects` → project `coalition-brand`. You should land on the **Deployments** tab.

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

### Step 9 — (If requested) Diagnostic #3 — download source zip for the same deploy
If asked to also do **Diagnostic #3 in the same session**, from the deployment's detail page click the **Source** panel's download button to retrieve the deployed source zip. Then:

```bash
unzip -p <downloaded>.zip 2>/dev/null | grep -E '_handlers' | head -20
```

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
- **Entry-point was `paypal-order.func` (or per-handler-named)** → H4 confirmed → fix path is to revert the migration to `api/_handlers/<slug>.ts` (rerun the rollback chain to baseline `b632e74`).
- **Stacks show missing/invalid env var** → H5 confirmed → fix path is to add the missing env var to Vercel (Production scope), then redeploy. `--force` not needed (env-var changes trigger automatic redeploy).

---

## Cross-references

- Main postmortem (decision context): [`../postmortems/postmortem-2026-07-08-api-routing-migration.md`](../postmortems/postmortem-2026-07-08-api-routing-migration.md)
- Stack-traces doc (paste targets + decision matrix): [`../postmortems/postmortem-2026-07-08-vercel-stack-traces.md`](../postmortems/postmortem-2026-07-08-vercel-stack-traces.md)
- Failed deploy Git commit: `1450a5ae60fb51fc297fa267013aa620fca8df4a`
- Baseline commit (current prod): `b632e74` (docs on top of `cb30a60` which reverted `e33df76`)
- Diagnostic #2 branch (kept on remote as audit trail): `diag-2-no-catchall`
