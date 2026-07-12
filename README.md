<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Working generations — deployment state as of 2026-07-10

### The "perfect UI" — known-good target for restoration

The best-known UI generation is **deployment `dpl_75Vza3u5F1cqwmK83qvGXV9x4ANg`** at commit **`e3b94e2`** (`fix(images): commit shorts front image so PDP gallery resolves all 4 thumbnails`), bundle `assets/index-CzMoBt7O.js`. This deployment had the highest-quality UI with the most polished product card grid, PDP rendering, and checkout layout — the "perfect" version the user approved.

**To restore the perfect UI:**
```bash
vercel rollback dpl_75Vza3u5F1cqwmK83qvGXV9x4ANg --yes
```

⚠️ **Trade-off:** the perfect UI ships with an older `api/[...slug].ts` that uses extensionless dynamic imports (`import('./_handlers/paypal-order')` instead of `import('./_handlers/paypal-order.js')`), causing `ERR_MODULE_NOT_FOUND` on every /api/* endpoint. To restore the perfect UI WITH working API:

1. Check out commit `e3b94e2` as baseline.
2. Cherry-pick the ESM .js extension fix from commit `7ef19f7` (adds .js to all dynamic imports).
3. Rebuild and deploy with build cache off (`vercel --prod --force`).
4. Verify /api/paypal-order returns 200.

### Current working state (`sgcoalition.xyz`)

- **Bundle:** `assets/index-CFMsameB.js` (latest deploy — contains the SearchResults loading-guard fix, 7 missing products added to INITIAL_PRODUCTS, category type fixes, and real image URLs)
- **API handlers:** all fixed — api/_handlers/*.ts uses .js extensions for ESM import resolution. /api/paypal-order, /api/complete-order, /api/ai-chat, /api/marketing-subscribe all return 200.
- **Products:** 26 on the live shop page (up from 19), including all Women's products, Halo Mini Dress, and Above As Below Set — verified working in the browser with no broken images.
- **Search:** "Women" returns 4 results (all Women's products) — loading guard prevents false "No results found" during Supabase fetch.
- **API rate limiter, CSP headers, ErrorBoundary, Sentry:** all wired and locked by `tests/securityInfrastructureReadiness.test.ts`.

### Next steps to reach perfect UI

1. `vercel rollback dpl_75Vza3u5F1cqwmK83qvGXV9x4ANg --yes`
2. Cherry-pick `7ef19f7` (ESM .js extension fix) onto the rolled-back commit.
3. Deploy with build cache off.
4. Verify API handlers return 200 + the UI matches the perfect generation.

# Coalition Brand - E-commerce Platform

## Contents

- [Working generations](#working-generations--deployment-state-as-of-2026-07-10)
- [Features](#features)
- [Brand voice — the Peaceful Space framework](#brand-voice--the-peaceful-space-framework)
- [Tech Stack](#tech-stack)
- [Backend Architecture](#backend-architecture)
- [Backend Bug-Fix Checklist](#backend-bug-fix-checklist)
- [Security & resilience](#security--resilience)
- [Sentry error monitoring](#sentry-error-monitoring)
- [Current Product Catalog Baseline](#current-product-catalog-baseline)
- [Local Development](#local-development)
- [Instant Loading Screen & No-JS Fallback](#instant-loading-screen--no-js-fallback)
- [Cross-cut category filters on /shop](#cross-cut-category-filters-on-shop)
- [Recently Ordered Live Map](#recently-ordered-live-map)
- [Above As Below Set Offers](#above-as-below-set-offers)
- [Referral Program](#referral-program)
- [Production Deployment](#production-deployment)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)
- [Customer Profile](#customer-profile)
- [/admin Verified Buyers tab](#admin-verified-buyers-tab)
- [/admin Instagram-handle filter chips](#admin-instagram-handle-filter-chips)
- [Reel + post recipe (1/1 process videos)](#reel--post-recipe-11-process-videos)
- [Public site map](#public-site-map)
- [/admin operator map](#admin-operator-map)


Premium streetwear e-commerce platform built with React, Vite, and Stripe.

## Features

- 🛍️ **Product Catalog** - Browse and shop premium streetwear
- 💳 **Stripe Checkout** - Secure payment processing with card and crypto options
- 📧 **Order Confirmation** - Automated email receipts via Resend
- 🪙 **SGCoin Rewards** - Loyalty program with every purchase
- 🔗 **NFT Integration** - Products linked to Polygon NFTs
- 📱 **Responsive Design** - Mobile-first, beautiful UI

### Premium Wallets

Coalition wallets are hand-built in-house from a single hide of full-grain leather — no factory, no shortcuts, just the process. Every build, past and present, holds to the same six non-negotiables:

- **Hand-Cut & Hand-Stitched** — cut by hand from a single hide and stitched on a saddle stitch.
- **Coalition-Branded Inks & Stamps** — hand-pressed branding using archival inks and steel dies.
- **Full-Grain Leather** — vegetable-tanned, sourced for patina. The more you carry it, the better it looks.
- **One-of-One Builds** — most wallets are 1/1 drops. Numbered runs (e.g. Grey Wave 1/2) are capped at two or four and never repeat.
- **Six-Card Bifold or Long Wallet** — 6 card slots, hidden bill compartment, cash sleeve, slim front-pocket profile.
- **Signed & Numbered** — each wallet ships with a Coalition authenticity card.

## Brand voice — the Peaceful Space framework

The storefront is aligned to an internal brand-voice framework called **Peaceful Space — Unhurried Conviction**. The framework treats every UI surface (raw urgency badges, gamified cart meters, shouted shipping copy, fake ticking clocks) as a candidate for elimination, and treats every "kept" chrome (notification pills, status indicators, financial-market color conventions) as a deliberate allowlisted exception. The canonical reference is [`docs/peaceful-space.md`](docs/peaceful-space.md) — read that doc before adding a UI element that touches scarcity, urgency, or the buy moment. Peaceful ≠ soft. Peaceful ≠ sanitized. The grief, the grind, Gmoneyworld, chrome accents, and "Trust Yourself" stay sharp — the manipulative ecommerce chrome does not.

### What the wedge retired this iteration

These touches were eliminated as a coordinated pass; the work lives across `pages/`, `components/`, and `utils/`:

- **`components/PromoBar.tsx`** — **deleted.** Was a flashing "FLASH SALE / Ends Soon" bar with pulsing `Zap`/`Clock` icons. `components/AnnouncementBar.tsx` is the only announcement surface now and renders a quiet brand line ("Coalition · Hand-built in Baltimore · No factory, no shortcuts").
- **`components/ui/CountdownTimer.tsx`** — **deleted.** Was a red pulsing per-second clock. `components/DropCountdown.tsx` now renders a static "To be announced" panel with a join-the-list CTA.
- **`components/CartUpsells.tsx`** — **deprecated.** Was the generic "You may also like" + "Reach free shipping!" surface; the contextual Above-as-Below set bonus is the only cart cross-sell that earns its place, and it lives inline in `components/CartDrawer.tsx`, `pages/Cart.tsx`, and `pages/Checkout.tsx`.
- **`components/ui/FreeShippingBar.tsx`** — **deprecated.** Was the "X away from free shipping!" progress meter; the policy is now stated as a plain fact in the PDP footer, the cart total panel, and About.
- **`utils/urgencyUtils.ts` — `generateViewCount`, `getRecentSales`, `hasActiveFlashSale`, `getTimeRemaining`, `formatTimeRemaining`** — **removed.** All five manufactured synthetic FOMO. If a real viewer-count or recent-sales signal is ever needed, it lands server-side (analytics/orders), not client-side.
- **Other retargeting** — cart celebration banners (green `Sparkles` "Save $X" boxes in `CartDrawer` / `Cart` / `Checkout`) softened to neutral "set bonus applied" copy; PDP per-size stock colors moved from a traffic-light range (`text-red-500`, `text-yellow-500`) to a single gray scale; home featured-eyebrow `animate-pulse` removed; Checkout "RECOMMENDED" payment-method badge removed; shouty ALL-CAPS shipping footers sentence-cased; `founderNote` elevated to sit directly under the buy button on the PDP (gated on `!isUnavailable` so sold/archived pieces use the archival voice instead).

### What the pass slowed

The framework also retargets tempo so the site reads as deliberate, not hurried:

- `components/IntroScreen.tsx` exit slowed 0.8s → 1.4s with a custom `cubic-bezier(0.16, 1, 0.3, 1)` ease — the first breath of the site.
- `components/CartDrawer.tsx` slide-in slowed from the Tailwind default ~150ms → 500ms with the same ease — the cart is a quiet handoff, not a snap.

Time-only changes; no copy or shape changes.

### The audit script (the enforcement half)

`scripts/audit-urgency-chrome.ts` is the wedge's enforcement arm. It scans `pages/` and `components/` for a closed set of composite celebration patterns (Sparkles + carnival-color, shout-copy, removed-component imports, removed-utility references) that match `docs/peaceful-space.md > What Contradicts It` row-for-row. The script is:

- **Pattern-banning, not color-banning.** Single-class regexes like "anything in `text-green-400`" generate hundreds of false positives because green also names success-checkmark states, red also names form-error states, and yellow also names star ratings + warnings. The framework cares about the COMPOSITE patterns that manufacture purchase pressure, not the primitive colors. The script's header documents the v1 dropped patterns and why.
- **Loud on drift, quiet on alignment.** `npm run audit:chrome` exits non-zero on any violation; clean runs print one ✅ line. Output is grouped by file so the maintainer can open each offender at the right line.
- **Allowlisted on Kept Patterns.** A small set of legitimate exceptions is enumerated inline (`Sparkles text-orange-500` next to h2 section headings on the on-chain Ecosystem dashboard, the historical-replacement comment in `AnnouncementBar`, etc.). Adding a kept pattern requires both an `allowlist` entry in the script AND a matching `docs/peaceful-space.md > Kept Patterns` row — both are required to keep the audit reversible.

```bash
npm.cmd run audit:chrome                                # scours pages/ + components/ for the closed pattern set
npx.cmd vitest run tests/audit-urgency-chrome.test.ts    # locks the rule logic against synthetic fixtures
```

`tests/audit-urgency-chrome.test.ts` covers rule precision (no false negatives across the canonical violation set), explicit allowlist overrides for each documented Kept Pattern, and the cell-level `scanFile` API the CLI uses so future rule additions can be warranted without writing temp fixtures on disk.

- **The mobile-nav audit pass surfaced zero code changes.** `components/MobileBottomNav.tsx` cart-count badge is a buyer-intent status pill (no `animate-pulse`, no viewership fabrication); red is the universal mobile-notification color (Instagram unread count, Twitter mentions), so a future audit pass must not false-flag it. `/shop` mobile grid stacks on the already-audited `ProductCard` (red `Heart` favorite fill is the universal favorited-status convention). `Shop.tsx` purple/blue VIP Membership Banner is brand-voice pitch, not a "limited time!" deal — keep.

### Files the wedge touched

`App.tsx` (route `/wallets` added — provenance-first landing page), `components/AnnouncementBar.tsx`, `components/CartDrawer.tsx`, `components/CartUpsells.tsx` (deprecated), `components/ConceptCard.tsx`, `components/DropCountdown.tsx`, `components/IntroScreen.tsx`, `components/Navbar.tsx` (wallets dropdown → single featured 1/1 + Explore link), `components/ProductCard.tsx`, `components/PromoBar.tsx` (deleted), `components/ui/CountdownTimer.tsx` (deleted), `components/ui/FreeShippingBar.tsx` (deprecated), `components/ui/UrgencyBadge.tsx`, `constants.ts` (product-level toggles + Above-as-Below wallet seed), `pages/Archive.tsx`, `pages/BuySGCoin.tsx`, `pages/Cart.tsx`, `pages/Checkout.tsx`, `pages/CustomInquiry.tsx`, `pages/Ecosystem.tsx`, `pages/Home.tsx`, `pages/Membership.tsx`, `pages/ProductDetails.tsx`, `pages/SGCoalitionPortal.tsx`, `pages/Shop.tsx`, `pages/Wallets.tsx` (new), `pages/WizardsPortal.tsx`, `pages/tutorial/UsingSGCoin.tsx`, `public/robots.txt`, `public/sitemap.xml`, `scripts/generateSeoArtifacts.mjs`, `tests/rendererSmoke.test.ts`, `types.ts`, `utils/urgencyUtils.ts`.

### Where to read it

- Framework (canonical, must-read before any urgency-adjacent UI work): [`docs/peaceful-space.md`](docs/peaceful-space.md)
- Audit script (enforcement): `scripts/audit-urgency-chrome.ts`
- Audit lock (test): `tests/audit-urgency-chrome.test.ts`
- npm alias: `npm run audit:chrome`
- Companion doc set: [`docs/README.md`](docs/README.md) (drop template trio, repo file map)

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Vanilla CSS with modern design
- **Payments**: Stripe (Card + Crypto)
- **Backend**: Vercel serverless functions under `api/`
- **Database/Auth/Realtime**: Supabase
- **Email**: Resend API
- **Blockchain**: Ethers.js for Web3 integration
- **Deployment**: Vercel

## Backend Architecture

The production backend is not a long-running Express server. It is a Vercel serverless API plus Supabase.

### Request flow

1. Browser routes are served by Vite/React from `dist/`.
2. `vercel.json` rewrites non-API page requests back to `index.html`.
3. Requests that start with `/api/` go to `api/[...slug].ts`.
4. `api/[...slug].ts` is the API router. It lazy-loads one file from `api/_handlers/` based on the route name.
5. Shared request utilities live in `api/_helpers.ts`; shared request/row types live in `api/_types.ts`.

When adding a new API handler, do both steps:

1. Add the handler file in `api/_handlers/<route-name>.ts`.
2. Add `<route-name>` to the `handlers` map in `api/[...slug].ts`.

If step 2 is missed, the frontend can call a real-looking endpoint and still get `404 Endpoint not found`.

### Main backend routes

| Route | Handler | Purpose |
| --- | --- | --- |
| `/api/complete-order` | `api/_handlers/complete-order.ts` | Final order write, admin order reads/updates, PayPal capture verification, server-side price checks, order email sends. |
| `/api/paypal-order` | `api/_handlers/paypal-order.ts` | Creates/captures PayPal orders after re-checking product prices, inventory, coupons, and set discounts. |
| `/api/create-payment-intent` | `api/_handlers/create-payment-intent.ts` | Creates Stripe PaymentIntents and applies store credit when requested. |
| `/api/create-checkout-session` | `api/_handlers/create-checkout-session.ts` | Legacy Stripe Checkout Session path. |
| `/api/marketing-subscribe` | `api/_handlers/marketing-subscribe.ts` | Unified email/SMS opt-in. Writes `marketing_contacts` and attribution metadata. |
| `/api/marketing-optout` | `api/_handlers/marketing-optout.ts` | Email unsubscribe links and Twilio STOP webhook handling. |
| `/api/marketing-send` | `api/_handlers/marketing-send.ts` | Admin marketing send path for email/SMS audiences. |
| `/api/marketing-stats` | `api/_handlers/marketing-stats.ts` | Marketing dashboard counts. |
| `/api/subscribe-drop` | `api/_handlers/subscribe-drop.ts` | Older drop email list signup. |
| `/api/unsubscribe` | `api/_handlers/unsubscribe.ts` | Older drop email unsubscribe route. |
| `/api/create-subscription-session` | `api/_handlers/create-subscription-session.ts` | Stripe VIP/subscription checkout. |
| `/api/verify-subscription` | `api/_handlers/verify-subscription.ts` | Verifies Stripe subscription checkout and updates profile fields. |
| `/api/ai-chat` | `api/_handlers/ai-chat.ts` | AI chat endpoint. |

### Supabase data model in practice

`context/AppContext.tsx` is the frontend data bridge. It reads Supabase directly for normal catalog/admin data, then calls serverless APIs for operations that need service-role access or payment verification.

Products load in this order:

1. `INITIAL_PRODUCTS` from `constants.ts` gives the local fallback catalog.
2. Supabase `products` rows replace matching local rows when the database is available.
3. Local-only products are appended so a successful Supabase fetch does not hide drops that are still only in code.
4. `PRODUCT_LOCAL_OVERRIDES` is applied last for pinned local fixes such as image roles, copy, archive notes, and shipping copy.

Because of that merge order, product bugs usually need two checks:

1. Static fallback: `constants.ts` and `PRODUCT_LOCAL_OVERRIDES`.
2. Live database: the matching script in `scripts/` or the admin product manager.

### Payment and order rules

The client can display prices, but the backend is the source of truth when money moves.

1. PayPal order creation re-loads products from Supabase, verifies item IDs, prices, inventory, keychain clip add-ons, promo discounts, and Above as Below set discounts.
2. PayPal order completion re-checks the PayPal capture ID, capture status, reference ID, and captured amount before writing the order.
3. Stripe PaymentIntent creation applies store credit server-side before creating a payment intent.
4. `/api/complete-order` writes orders with the Supabase service-role key, then sends customer/admin emails through Resend when configured.

### Marketing and lead capture

Lead capture forms call `/api/marketing-subscribe`. The frontend captures UTM/referrer/click IDs in `utils/trafficAttribution.ts`, and `DropLeadCapture` includes that payload in the subscribe request. The handler stores it in `marketing_contacts.metadata` so traffic sources can be reviewed later.

The marketing backend depends on these tables/migrations:

1. `supabase/migrations/20260701_create_marketing_schema.sql`
2. `marketing_contacts`
3. `marketing_consent_log`
4. `marketing_campaigns`
5. Legacy `subscribe_emails` for the older drop list

### Seeding operator-added SMS contacts

Use `npm run seed:sms` to insert phone numbers the operator adds manually (e.g. a buyer who texted to be added to the SMS list). The script is idempotent: it skips numbers already active, re-subscribes previously unsubscribed numbers, and inserts new ones. Each subscribe/re-subscribe writes a `marketing_consent_log` row.

```bash
npm run seed:sms
```

The script reads `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` from `.env`. Phone numbers are defined in `scripts/seedSmsContact.ts > CONTACTS_TO_SEED` and auto-normalized to E.164 (+1 prefix for US). `source` is set to `'manual_seed'` to distinguish operator-added contacts from form submissions.

To add a new number, append an entry to `CONTACTS_TO_SEED` and re-run the script. Verify in Supabase:

```sql
SELECT id, phone_e164, status, source FROM marketing_contacts WHERE phone_e164 IS NOT NULL;
```

### Test-campaign guard

`POST /api/marketing-send` filters verified buyers out of any campaign whose **name contains the substring `test` (case-insensitive)** before the Resend / Twilio send loop. Verified buyers are contacts whose `source` is one of:

- `manual_seed` (operator-added offline sale, written by `npm run seed:sms`)
- `past_customer` (anyone who placed an order through the storefront)

Form leads (`sms_signup`, `sms_signup_email`, `drop_list`, `marketing_contacts`) are NOT verified buyers - they only opted in, never purchased, and ARE still reachable from test campaigns so devs can verify Resend + Twilio wiring.

```
campaign name = "Spring Drop"   -> audience: all (verified + leads)
campaign name = "Test Drop"     -> audience: leads only (verified excluded)
```

#### Why substring, not whole-word

The filter uses substring match on purpose. Words like **latest**, **contest**, **attest**, **detest** therefore _also_ flip the switch - by design. If you are sending to a verified buyer and your campaign title could even glance at `test`, rename it. This is the firmest mid-process enforcement without rejecting legitimate sends out of hand. The unit tests in `tests/marketingAudience.test.ts` lock both halves: the intended matches and the documented edge-case matches (the test file also pins a negative case for visually-similar words like `restock` and `festive` that _do not_ flip the switch, so a future "make this whole-word" refactor cannot silently drift which campaigns get filtered).

#### How to send to a verified customer anyway

There is no override. To deliver a campaign to a verified customer, rename it so the name does NOT contain `test`. The Composer view in `components/admin/MarketingManager.tsx` shows an amber advisory banner the moment the field contains `test` so the operator can catch it before clicking Send.

#### Auditability

Every test campaign that drops verified customers writes `excluded_verified_customers: <n>` into `marketing_campaigns.stats` (only present when the count is greater than zero). The `/api/marketing-send` response also surfaces the same count under `excludedVerifiedCustomers`. The server-side console emits:

```
[marketing-send] test campaign excluded N verified-customer rows (manual_seed/past_customer)
```

#### Where to read it

- Helper (predicate + filter): `utils/marketingAudience.ts` exporting `VERIFIED_CUSTOMER_SOURCES`, `isVerifiedCustomerSource`, `isTestCampaignName`, `filterVerifiedCustomers`.
- Server enforcement: `api/_handlers/marketing-send.ts` (`fetchAudience` derives `excludeVerified` from the campaign name via `isTestCampaignName`, then drops matching rows).
- UI advisory: `components/admin/MarketingManager.tsx` `ComposerView` Campaign Name field.
- Helper tests: `tests/marketingAudience.test.ts` (covers the constants, the predicate, the substring match with documented edge-cases, and the filter in both on/off modes).

## Backend Bug-Fix Checklist

Use this when something disappears, prices are wrong, checkout fails, or a form silently stops working.

1. Reproduce the exact URL and action first. Record route, product ID, size, cart contents, coupon, and payment method.
2. Check whether the bug is frontend-only or backend/data:
   - Frontend-only: broken render, wrong component branch, missing link, wrong local copy.
   - Backend/data: endpoint 404/500, wrong Supabase row, missing migration, payment verification mismatch.
3. If a frontend call hits `/api/<name>`, confirm `<name>` exists in `api/[...slug].ts`.
4. If product data is wrong, update both `constants.ts` and the matching Supabase upsert script when needed.
5. If a Supabase column is missing, add or run the migration under `supabase/migrations/` before relying on that column in code.
6. If checkout totals are wrong, inspect shared pricing helpers first:
   - `utils/aboveAsBelowSet.ts`
   - `utils/promoCodes.ts`
   - `utils/walletAddOns.ts`
   - `api/_handlers/paypal-order.ts`
   - `api/_handlers/complete-order.ts`
7. If a lead form fails, check the router entry, `marketing-subscribe` env vars, and `marketing_contacts` schema.
8. Add or update a focused test for the bug before pushing. Keep tests near the failing behavior, for example `tests/CompleteTheFit.test.tsx` for PDP set cards.
9. Run focused tests first, then the production build:

```bash
npx.cmd vitest run tests/<changed-area>.test.tsx
npm.cmd run build
```

10. If the build runs `scripts/generateSeoArtifacts.mjs`, check `git status` afterward so generated files are not accidentally missed or staged when unchanged.

## Security & resilience

Three defensive layers were added this session without changing feature surface. They are: a global ErrorBoundary that catches unhandled render errors, an in-memory API rate limiter that gates every `/api/*` route, and a strict CSP header on every page response with a stub `/api/csp-report` endpoint that acknowledges browser reports. All three are observability-agnostic; they work even if downstream services (Sentry, Supabase) are unconfigured. Each layer is locked by `tests/securityInfrastructureReadiness.test.ts` so a future refactor cannot silently regress any of them.

### Global ErrorBoundary

A single class-component error boundary in `components/ErrorBoundary.tsx` wraps the entire `<App>` tree in `App.tsx > ErrorBoundaryWithNavReset`. Any unhandled render error renders a recovery UI (a centered card with Reload + Go Home) instead of a white screen; the user always has one-click paths back to a working page.

Reset semantics matter here: the parent forwards `location.pathname` as `resetKey`. When the user navigates to a new route after the boundary fired, `componentDidUpdate` flips `hasError` back to false and re-renders the children WITHOUT remounting. This is the correct hook because remounting the children would clobber local state in `CartDrawer`, `AIChatWidget`, and every in-flight form. Anyone passing `key={pathname}` instead will silently break that contract; the readiness test pins the wrapper shape (`App.tsx > ErrorBoundaryWithNavReset` exposes `resetKey={location.pathname}`, NOT `key={...}`).

When `ENABLE_SENTRY` (i.e. `VITE_SENTRY_DSN` set + on prod) the boundary's `componentDidCatch` also forwards the error to `Sentry.captureException` under `tags.errorBoundary = 'global'`. See [Sentry error monitoring](#sentry-error-monitoring) for the full capture path. `console.error` is always called as a local backup so observability never depends solely on Sentry being healthy.

Locked by `tests/securityInfrastructureReadiness.test.ts > Feature 1`.

### API rate limiter

Every `/api/*` route through `api/[...slug].ts` runs through `withRateLimit(slug, req, res)` from `api/_helpers.ts` after slug validation, before handler load. The default budget is 30 requests per minute per IP per slug; per-endpoint overrides live in `SLUG_LIMITS_PER_MINUTE` in the same file. The gate runs before `loadHandler` so a slug under spam never pays the import cost on the broken path.

When the gate trips, `withRateLimit` writes a 429 + `Retry-After` header and returns `{ allowed: false }`. The router just `return`s — the handler never gets a chance to start. When the gate passes, `RateLimitResult { allowed, remaining, limit, resetAt, retryAfterSeconds }` is returned for logging at the handler edge.

Caveat: in-memory state survives within the warm Lambda container but dies on cold start. For per-IP throttling that outlives a restart, a shared counter (e.g., Upstash Redis) would need a small change — tracked in [FOLLOWUPS.md](./FOLLOWUPS.md).

Kill switch: set `DISABLE_RATE_LIMIT=1` in Vercel env to turn the gate off — only do this during a load test or an operator smoke run.

Locked by `tests/securityInfrastructureReadiness.test.ts > Feature 2` (25 assertions including per-IP isolation, per-slug boundaries, and a sorted-rate-window model).

### CSP header + csp-report endpoint

`vercel.json > headers[0].value` ships a strict Content-Security-Policy on every page response, with violations reported to `/api/csp-report`. The policy explicitly denies `script-src` and `frame-ancestors` outside the small allow-list, and uses `report-uri /api/csp-report` so the operator can watch for unexpected inline scripts or third-party iframes that snuck past review. Notable allowlist entries from this session: `https://browser.sentry-cdn.com` in `script-src`, `https://*.ingest.sentry.io` and `https://*.ingest.us.sentry.io` in `connect-src`.

The handler at `api/_handlers/csp-report.ts` parses the browser POST body in CSP-report-spec shape, logs the structured violation server-side (`[csp-report] { document, directive, blocked, source, line, col }`), and returns 204. The intent: the report is acknowledged; the browser does not retry-flood the 404 case. 400 on garbage bodies — browsers do not retry 4xx so the report is effectively dropped without a log line on misbehaving clients (the per-slug rate-limit caps the abuse surface further). CORS is set globally by the catch-all in `api/[...slug].ts` before this handler runs, so the handler does not call `setCorsHeaders` itself.

The handler is intentionally minimal today — a future pass will write rows to a `csp_reports` Supabase table and surface counts in the Admin dashboard. The minimum viable contract is "endpoint exists and returns 204" so the browser does not retry-flood the 404 case.

Locked by `tests/securityInfrastructureReadiness.test.ts > Feature 3 + Feature 4`.

### Where to read it

- Class component: `components/ErrorBoundary.tsx`
- App wrapper: `App.tsx > ErrorBoundaryWithNavReset`
- Rate-limit helper: `api/_helpers.ts > withRateLimit`
- Rate-limit gate wiring: `api/[...slug].ts`
- CSP header: `vercel.json > headers[0] > value`
- CSP report endpoint: `api/_handlers/csp-report.ts`
- Operator kill switch + env template: `.env.example` (`DISABLE_RATE_LIMIT` flag, callouts on response cadence)
- Lock: `tests/securityInfrastructureReadiness.test.ts` (Features 1–4)

## Sentry error monitoring

Sentry is wired into the browser bundle for unhandled error capture in production. The init is double-gated so a missing DSN or a non-prod build is a silent no-op — never an exception, never console spam, never a dev rethrow loop. The defensive layers in [Security & resilience](#security--resilience) are observability-agnostic and work even if Sentry is unconfigured; Sentry is the upstream dashboard story that ties them together.

### Where it lives

- `services/sentryInit.ts` — sole `initSentry()` call. Imports `@sentry/react`, runs two gates (`import.meta.env.PROD` + `VITE_SENTRY_DSN` non-empty). Configures `Sentry.browserTracingIntegration()`, `tracesSampleRate: 0.1`, `denyUrls` for browser extensions (`chrome-extension://`, `extensions/`, `moz-extension://`), `beforeSend` to drop `ResizeObserver loop` noise.
- `components/ErrorBoundary.tsx` — global class component. `componentDidCatch` calls `Sentry.captureException(error, { extra: { componentStack }, tags: { errorBoundary: 'global' }, level: 'error' })`. `console.error` is kept as a local backup so observability does not depend solely on Sentry being healthy.
- `App.tsx > ErrorBoundaryWithNavReset` — parent that forwards `location.pathname` as `resetKey` so route changes drop the recovery UI without remounting children.
- `index.tsx` — `initSentry()` runs at module-load (before `ReactDOM.createRoot`) so module-link errors that throw before React mounts are still captured. Then `createRoot()` registers both React 19 error options: `onUncaughtError` (escaped every boundary → `tags.source = react19-root-uncaught`) and `onCaughtError` (caught by a boundary but forwarded → `tags.source = react19-root-caught`). Both at `level: 'error'`.
- `vercel.json` — CSP `script-src` allows `https://browser.sentry-cdn.com`; `connect-src` allows `https://*.ingest.sentry.io` and `https://*.ingest.us.sentry.io` so the SDK can POST events.

### The two gates (the safety property itself)

Both gates are deliberate. Don't remove either — the two-gate design IS the safety property:

1. `if (!import.meta.env.PROD) return;` — Vite dead-code eliminates the entire init body in DEV and PREVIEW. So a preview deploy cannot accidentally leak events to Sentry's ingest even if the DSN is set.
2. `if (!dsn || typeof dsn !== 'string' || dsn.trim() === '') return;` — silent no-op when `VITE_SENTRY_DSN` is unset. Deliberately no console warning in the boot path so the operator can deploy without configuring the var.

When both pass, every `Sentry.captureException` call becomes a real network post. When either fails, every call site is a documented no-op (the SDK never initialized) — so `ErrorBoundary` and the React 19 root handlers don't need per-call guards.

### Why `level: 'error'` for both React 19 root handlers

`caught` vs `uncaught` is differentiated via `tags.source`, not via level. Reasoning:

- Downgrading caught to `warning` would mask the signal from any Sentry alert rule that fires on `error`-level events — the default SaaS rule.
- The operator configures one manual alert rule that asserts `tags.source = react19-root-uncaught` so caught errors don't page on-call.

This trade-off is documented in `.env.example` under the Sentry section. If the alert rule is not set up, caught errors will page just as loudly as uncaught ones — by design. See [FOLLOWUPS.md](./FOLLOWUPS.md) for the operator steps.

### Session replay — intentionally deferred

Replay is intentionally NOT wired. To enable later, BOTH `Sentry.replayIntegration()` in the `integrations: []` array AND a matching `replaysSessionSampleRate: ...` config field must be added together. The SDK silently drops the rate when no integration is registered, so leaving one without the other is a footgun. The readiness test makes the absence a regression-catch so a future developer cannot accidentally re-introduce just the rate without also wiring the integration.

### Where to read it

- Init: `services/sentryInit.ts`
- Boundary: `components/ErrorBoundary.tsx`
- App.tsx wrapper: `App.tsx > ErrorBoundaryWithNavReset`
- React 19 root handlers: `index.tsx`
- CSP additions: `vercel.json > headers[0].value > script-src / connect-src`
- Env template: `.env.example > ---------- Sentry ----------`
- Lock: `tests/securityInfrastructureReadiness.test.ts` (Feature 5 + onCaughtError level consistency — 15 assertions)
- Operator follow-ups: [FOLLOWUPS.md](./FOLLOWUPS.md) — provision the Sentry project + configure the alert rule.

## Current Product Catalog Baseline

Last verified on July 2, 2026 against the live Supabase `products` table, then compared with `INITIAL_PRODUCTS` and `PRODUCT_LOCAL_OVERRIDES`.

Use this section as the starting point when a product disappears, has the wrong price, lands in the wrong category, or shows the wrong badge. The app's catalog merge order is:

1. Live Supabase row wins for matching product IDs.
2. Local-only `INITIAL_PRODUCTS` rows are appended so code-only products do not vanish.
3. `PRODUCT_LOCAL_OVERRIDES` is applied last.

If a live Supabase row exists, the Supabase price is the current storefront price. If no live row exists, the local fallback price is the current storefront price. This baseline has 25 merged products: 13 active and 12 archived/sold. The live Supabase query returned 17 rows with 17 unique product IDs.

> `INITIAL_ORDERS` rows feed the [Recently Ordered Live Map](#recently-ordered-live-map); the `id`-dedup contract lives there, so any new seed id has to be mirrored in `PUBLIC_RECENT_ORDER_SEEDS` to avoid double-counting.

### Active Products

| ID | Product | Price | Category | Status | Inventory | Source |
| --- | --- | ---: | --- | --- | --- | --- |
| `Coalition_Above_As_Below_Wallet_1_1` | COALITION ABOVE AS BELOW 1/1 WALLET | $85 | wallet | Live | stock 1; One Size: 1 | Supabase + local overrides |
| `Coalition_NF_Tee` | COALITION NF-TEE | $40 | shirt | Live | stock 350; size map S:1 M:1 L:1 XL:1 | Supabase + local |
| `prod_1773860269374` | Coalition Shark Tee - 1/1 Exclusive | $40 (with 50% auto-discount → $20) | shirt | Live | stock 1; S:1 M:0 L:0 XL:0 | Supabase + local |
| `prod_halo_mini_dress` | COALITION HALO MINI DRESS | $50 | dress | Live, standard release | stock 50; S:12 M:13 L:13 XL:12 | Supabase + local overrides |
| `prod_hoodie_overwhelmingly_patient` | COALITION OVERWHELMINGLY PATIENT HOODIE | $100 | sweatshirt | Live pre-order | stock 5; S:1 M:1 L:1 XL:1 2XL:1 | Supabase + local overrides |
| `prod_set_above_as_below` | COALITION ABOVE AS BELOW SET | $120 | apparel | Live set offer | stock 20; S:4 M:4 L:4 XL:4 2XL:4 | Supabase + local overrides |
| `prod_shorts_above_as_below` | COALITION ABOVE AS BELOW SHORTS | $75 | shorts | Live | stock 44; S:9 M:9 L:9 XL:9 2XL:8 | Supabase + local |
| `prod_tee_above_as_below` | COALITION ABOVE AS BELOW TEE | $75 | shirt | Live | stock 44; S:9 M:9 L:9 XL:9 2XL:8 | Supabase + local overrides |
| `prod_tee_distortion` | COALITION DISTORTION TEE | $60 | shirt | Live local fallback only | no live stock row | Local fallback only |
| `prod_womens_above_as_below_contrast_shorts` | WOMEN'S COALITION ABOVE AS BELOW CONTRAST SHORTS | $40 | shorts | Live | stock 4; S:1 M:1 L:1 XL:1 | Supabase + local overrides |
| `prod_womens_above_as_below_crop_tank` | WOMEN'S COALITION ABOVE AS BELOW CREWNECK CROP TANK | $40 | shirt | Live | stock 4; S:1 M:1 L:1 XL:1 | Supabase + local overrides |
| `prod_womens_above_as_below_set` | WOMEN'S COALITION ABOVE AS BELOW SET | $75 | apparel | Live set offer | stock 4; S:1 M:1 L:1 XL:1 | Supabase + local overrides |
| `prod_womens_coalition_halo_contrast_tee` | WOMEN'S COALITION HALO CONTRAST TEE | $40 | shirt | Live, standard release | stock 4; S:1 M:1 L:1 XL:1 | Supabase + local overrides |

### Archived Or Sold Products

| ID | Product | Price | Category | Status | Inventory | Source |
| --- | --- | ---: | --- | --- | --- | --- |
| `Coalition_Grey_Wave_Wallet_1_2` | Coalition 'Grey Wave' Wallet 1/2 | $75 | wallet | Archived/sold | stock 0; One Size: 0 | Supabase + local overrides |
| `Coalition_Grey_Wave_Wallet_2_2` | Coalition 'Grey Wave' Wallet 2/2 | $75 | wallet | Archived/sold | stock 0; One Size: 0 | Supabase + local overrides |
| `Coalition_Racing_Team_Wallet_1_4` | Coalition 'Racing Team' Wallet 1/4 | $85 | wallet | Archived/sold | One Size: 0 | Local fallback only |
| `Coalition_Racing_Team_Wallet_2_4` | Coalition 'Racing Team' Wallet 2/4 | $85 | wallet | Archived/sold | One Size: 0 | Local fallback only |
| `Coalition_Racing_Team_Wallet_3_4` | Coalition 'Racing Team' Wallet 3/4 | $85 | wallet | Archived/sold | One Size: 0 | Local fallback only |
| `Coalition_Racing_Team_Wallet_4_4` | Coalition 'Racing Team' Wallet 4/4 | $85 | wallet | Archived/sold | One Size: 0 | Local fallback only |
| `Coalition_x_True_Religion_S1` | Coalition x True Religion 1/1 Jeans S1 | $240 | jeans | Archived/sold | stock 0; 33: 0 | Supabase + local |
| `GreenCamoWallet` | Coalition Green Camo Wallet | $75 | accessory | Archived/sold | stock 0; One Size: 0 | Supabase + local |
| `SKYYBLUEWALLET1_2` | COALITION SKYY BLUE WALLET 1/2 | $75 | wallet | Archived/sold | stock 0; One Size: 0 | Supabase + local overrides |
| `prod_trust_yourself_hat_01` | Trust Yourself Custom Trucker (1/1) | $50 | headwear | Archived/sold | stock 0; One Size: 0 | Supabase + local |
| `prod_wallet_004` | COALITION SKYY BLUE WALLET 2/2 | $85 | wallet | Archived/sold | One Size: 0 | Local fallback only |
| `prod_wallet_chrome_hearts` | CUSTOM COALITION X CHROME HEARTS WALLET | $450 | wallet | Archived/sold | no size map | Local fallback only |
| `Coalition_Denim_Patchwork_S1` | Coalition Denim Patchwork 1/1 Jeans S1 | $140 | jeans | Archived/sold | stock 0; 30: 0 | Supabase + local overrides |

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Stripe account (test mode)
- Resend account (optional for emails)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
   STRIPE_SECRET_KEY=sk_test_your_key
   RESEND_API_KEY=re_your_key
   VITE_APP_URL=http://localhost:3000
   ```

4. Start the frontend dev server:
   ```bash
   npm run dev
   ```

5. For API testing, run through Vercel dev so `/api/*` routes execute like production:
   ```bash
   npx vercel dev
   ```

6. Open the local URL printed by the command you are running. Vite defaults to http://localhost:3000 in this project.

### Testing Checkout

Use Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Any future expiry date and CVC

### PayPal Checkout Smoke Test

PayPal checkout is server-verified before an order is saved. The browser SDK uses `VITE_PAYPAL_CLIENT_ID`; `/api/paypal-order` creates/captures the PayPal order; `/api/complete-order` verifies the capture against PayPal and Supabase product pricing before writing `orders`.

Pay Later / BNPL is enabled in the PayPal browser SDK with `components=buttons,messages&enable-funding=paylater`. There is no extra BNPL env var; PayPal decides whether to show Pay Later for the buyer, order amount, device, and merchant account.

Required environment variables:

```env
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENV=sandbox
VITE_APP_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Optional order email variables:

```env
RESEND_API_KEY=re_your_key
RESEND_FROM_EMAIL="SG Coalition <orders@your-domain.com>"
ORDER_NOTIFICATION_EMAIL=orders@your-domain.com
```

Before testing, apply `supabase/migrations/20260617_add_paypal_order_fields.sql` so PayPal order and capture IDs are stored and de-duplicated.

Smoke-test flow:

1. Use a PayPal sandbox REST app and set all PayPal variables from the same sandbox app. Do not mix sandbox browser IDs with live server secrets.
2. Run `npm run build`.
3. Run the app through Vercel dev or a Vercel preview so `/api/paypal-order` and `/api/complete-order` execute as serverless functions.
4. Add a physical product to cart, fill all shipping fields, leave partial store credit off, and choose PayPal.
5. Check the checkout page for the Pay Later message. If the sandbox buyer/order is eligible, Pay Later messaging or a Pay Later funding button appears; if it does not appear, continue with the normal PayPal sandbox buyer flow.
6. Click `Continue to PayPal`, approve with a PayPal sandbox personal buyer account, and let the app return from PayPal.
7. Confirm the app lands on `/order/success?payment_method=paypal`.
8. In Supabase, confirm one `orders` row exists with `payment_method = paypal`, `payment_status = paid`, `paypal_order_id` populated, `payment_reference` populated with the capture ID, and `total` equal to the PayPal capture amount.
9. In the PayPal sandbox dashboard, confirm the order is `COMPLETED` and the captured amount matches the Supabase order total.

For production, switch to live PayPal credentials and set `PAYPAL_ENV=live`, then redeploy so the Vite `VITE_PAYPAL_CLIENT_ID` is rebuilt into `index.html`.

### Coalition Brain Bootstrap

Populate the Brain table and seed entries with one idempotent admin bootstrap command:

```bash
npm run bootstrap:brain
```

Set either `SUPABASE_DB_URL`, or `VITE_SUPABASE_URL` plus `SUPABASE_DB_PASSWORD`, before running it. The script executes `supabase/migrations/20240611_seed_brain_entries.sql` through Postgres admin credentials, so it does not rely on anon-key writes against RLS-protected tables.

### Bundle analyzer and lazy-loaded chunks

The eager `index-*.js` chunk sits at ~696 KB raw / ~196 KB gzipped under the pre-refactor baseline. Two off-screen overlays are now deferred via `React.lazy` + `<Suspense fallback={null}>`, and a developer utility extracts per-module bytes from a rollup-plugin-visualizer report so future regressions are measured, not estimated.

#### Off-screen overlays now lazy

- `components/CartDrawer` (`App.tsx`): always-mounted, but the chunk only downloads after first paint when the user opens the cart. Pulled out of eager so its own code plus the transitive `framer-motion` internals it imports (`create-projection-node.mjs`, `VisualElementDragControls.mjs`, `animation-state.mjs`, `tslib.es6.mjs`) no longer count against the initial bundle as long as no other eager consumer remains.
- ~~`components/ProfileModal` (`components/Navbar.tsx`): loaded only on first `isProfileOpen === true` interaction.~~ **Deleted** — `components/ProfileModal.tsx` was removed entirely. The navbar's MY PROFILE button now navigates to `/profile` (the full Profile page with the tab strip), so the trigger that opened the modal is gone. The bundle drop from this entry is the full `~15.8 KB raw / ~3.3 KB gzipped` of the component, not a lazy carve-out.

Both wrappers use `fallback={null}` because the surfaces are off-screen by default; the chunk only enters memory after auth hydration or first click, so the user sees no perceptible delay.

#### Empirical carve-out (post-refactor, July 2026)

Running `node scripts/parseStatsHtml.mjs` against a fresh `vite build --mode analyze` reports the eager chunk dropping from **696 KB to ~678 KB** on-disk. `ProfileModal.tsx` was later deleted entirely (its trigger in the navbar was removed; MY PROFILE now navigates to `/profile`), so the eager chunk drops an additional `~15.8 KB raw / ~3.3 KB gzipped` of the full component beyond the lazy-carve baseline. The three `framer-motion` internals (totaling ~104 KB raw / ~22 KB gzipped) **stay** in the eager chunk because `SignalAlert`, `RewardActivation`, and `components/ui/ToastContainer` still import `framer-motion` synchronously. Tracked as the next-largest lever; lazy-loading those three would drop the eager chunk by another ~22 KB gzipped with no AppContext/Supabase impact (none of them touch auth or realtime state).

#### Bundle analyzer workflow

```bash
npm.cmd run build                                   # regular production build, NO dist/stats.html
npx.cmd vite build --mode analyze                   # emits dist/stats.html (~1.55 MB treemap HTML)
node scripts/parseStatsHtml.mjs                     # prints top contributors (raw | gzip | brotli)
```

`scripts/parseStatsHtml.mjs` bracket-matches the inline `const data = {...}` literal in `dist/stats.html`, walks the tree (inline objects down to leaves that carry a `uid`), and reads byte weights from `data.nodeParts[uid].{renderedLength,gzipLength,brotliLength}`. It outputs raw / gzipped / brotli bytes per module, ranked by raw size, split into the eager `index-*.js` bucket vs. lazy-loaded chunks. Use it whenever you do a meaningful dependency bump or add a new global UI surface.

Vite's chunk-size warning limit sits at 800 KB (`vite.config.ts > build.chunkSizeWarningLimit`) to suppress the pre-existing 500 KB noise without masking future 800+ KB regressions. The analyzer only emits `dist/stats.html` when invoked with `--mode analyze`; regular `npm.cmd run build` skips it.

#### Hard constraints preserved

- `vite.config.ts` still rejects `build.rollupOptions.output.manualChunks` because reintroducing it previously OOM-killed Vercel's build worker (lucide-react / ethers / framer-motion full-AST path). The lazy-load refactor uses only `React.lazy` + Vite's automatic code-splitting at the `import()` boundary; no manual chunk config.
- `supabase` import in `App.tsx` stays synchronous so `context/AppContext.tsx`'s mount-time `onAuthStateChange` and realtime channel subscriptions queue correctly. Lazy-loading the supabase client would race against session restore on slow connections.
- `context/AppContext.tsx`'s synchronous `INITIAL_PRODUCTS` state init (see "Current Product Catalog Baseline") is preserved; `constants.ts` is NOT lazy.

## Instant Loading Screen & No-JS Fallback

A four-layer system that eliminates the "blank screen" on slow connections and gives crawlers/bots a meaningful response when JavaScript is disabled or unavailable. The whole system is additive — none of the layers change the React app's behavior, they only manage the window between first paint and React mount.

### Layer 1 — Inline loader (HTML)

`index.html` contains a `<div id="initial-loader">` inside `#root` with a spinner and the "COALITION" brand. The loader's CSS lives in the `<head>` `<style>` block (not inside `#root`) so the styles are guaranteed to be applied before the loader is painted, even on extremely slow connections where the browser would otherwise paint an unstyled loader. The loader sits at `z-index: 99999` (above the noise overlay's `9999`) so it covers the page chrome during the JS download.

### Layer 2 — Fade-out hook (TypeScript)

`index.tsx` finds `#initial-loader` before mounting React, sets `opacity: 0` to trigger the CSS `transition: opacity 0.5s ease`, and listens for `transitionend` to call `root.render()`. A `mounted` flag prevents double-render, and a 600ms `setTimeout` safety net catches cases where `transitionend` never fires (`prefers-reduced-motion: reduce`, hot reload, or the element is already at opacity 0 from a previous run). The 600ms must stay greater than the 0.5s CSS transition — the comment in `index.tsx` pins this dependency.

### Layer 3 — No-JS fallback

`index.html` contains a `<noscript>` block inside `#root` that browsers ignore when JS is enabled. When JS is disabled, it renders a "JavaScript is required" message at `z-index: 100000` (above the loader), covering the spinner so the user gets a clear message instead of an infinite loading indicator. The fallback also includes a "View our basic site" link to `/nojs.html`.

### Layer 4 — Static no-JS page

`public/nojs.html` is a fully self-contained static page served at `/nojs.html`. It uses a system font stack (no external font requests), contains brand info, social links (Twitter/X `@sgcoalition`), contact email, full meta tags (description, `robots: index, follow`, og:*, twitter:*, canonical pointing to `/nojs.html`), a `<link rel="alternate" href="/" title="Full site (requires JavaScript)" />` pointer back to the SPA, and JSON-LD `Organization` structured data. This is what crawlers and bots that don't execute JS see, and what JS-disabled users land on if they click the link in the noscript fallback.

### Testing

Local:

```bash
# Start any server on http://localhost:3000 (dev or preview)
npm run dev

# In another terminal, run the Playwright verification
npm run test:fade
```

The `test:fade` script (`scripts/verify-loader-fade.mjs`) throttles to Slow 3G via CDP, samples `#initial-loader`'s opacity at 10 wall-clock intervals over ~10 seconds, takes screenshots, and asserts that opacity decreased AND React mounted. Pass criteria: `opacityDecreased && finalState.reactChildCount > 0`. Exit code 1 on failure, which CI consumes to fail the workflow. Output goes to `.loader-fade-screenshots/result.json` and ten `loader-fade-NNNNNms.png` files.

CI: `.github/workflows/loader-fade.yml` runs the same test automatically on every PR and push to `main`. The workflow:

- Uses `permissions: contents: read` (least-privilege) and `concurrency: cancel-in-progress` (kills superseded runs on rapid pushes).
- Installs deps, then `npx playwright install --with-deps chromium`, then runs `npm run build`.
- **Starts `vite preview` + runs the test in a single step** — the preview server MUST live in the same step as the test that uses it, because GitHub Actions kills background processes when a step ends. The earlier split-step version was a real bug caught in review.
- Uploads the screenshots + `result.json` as an artifact on every run (including failures) so the operator can inspect what Slow 3G actually rendered.

### Print and JS-disabled behavior

Both `#initial-loader` and `#noscript-fallback` are hidden via `@media print { display: none !important; }` so they never appear in printouts. The noscript fallback only renders when JS is disabled, so JS-enabled browsers never see it.

### Where to read it

- `index.html` — loader markup, noscript block, loader + noscript CSS in the head's `<style>` block
- `index.tsx` — fade-out hook (listener-before-style pattern, `mounted` flag, 600ms safety net)
- `public/nojs.html` — static no-JS fallback page (self-contained, no external requests)
- `scripts/verify-loader-fade.mjs` — Playwright verification script (Slow 3G via CDP, opacity sampling, screenshots)
- `.github/workflows/loader-fade.yml` — GitHub Actions CI workflow (single-step preview+test, concurrency, artifact upload)
- `package.json > "scripts" > "test:fade"` — local test command

## Cross-cut category filters on /shop

The `/shop` page exposes two cross-cut gender filters on top of the existing apparel-type filters:

- **`?category=women`** (alias: `?category=womens`): surfaces the women's product family.
- **`?category=men`** (alias: `?category=mens`): surfaces men's and unisex products.

Both filters are wired in `pages/Shop.tsx > categoryGroups / categories` and resolved by the same predicate in `utils/categoryFilter.ts > matchesCategoryFilter`. They are NOT a `Product.category` value because the Supabase `products.category` column is a single varchar — flipping that string would collapse the apparel-type filters (`?category=shirts`, `?category=dresses`) on the same products. Anchoring on the product ID namespace keeps every existing filter surface working unchanged.

### Filter contracts

| Filter | Match rule | Always excluded |
|---|---|---|
| `women` / `womens` | `product.id.startsWith('prod_womens_')` | `prod_halo_mini_dress` (predates the `prod_womens_*` naming) |
| `men` / `mens` | NOT `prod_womens_*` AND NOT `prod_halo_mini_dress` | All `prod_womens_*` products; halo mini dress |
| `all` and falsy filters | All products | — |

### Symmetry between women + men

The women's match is a single-direction prefix check. The men's match is the symmetric inverse — every `prod_womens_*` product is dropped, plus the halo mini dress carve-out. The carve-out is paired: if a maintainer ever renames `prod_halo_mini_dress` → `prod_womens_halo_mini_dress` (or otherwise brings it under the `prod_womens_*` umbrella), the explicit denylist in the men's branch becomes a no-op and can be deleted in the same commit. The carve-out is documented inline at the men's branch in `utils/categoryFilter.ts`.

### Adding a new women's product

1. Use the `prod_womens_` ID prefix.
2. Keep its apparel-type category (`shirt`, `shorts`, etc.) unchanged so existing apparel filters keep surfacing it.
3. Drop it into `constants.ts > INITIAL_PRODUCTS` and the matching Supabase upsert script (`scripts/<slug>.ts`).
4. Extend `tests/categoryFilter.test.ts` if the new product opens a category pattern that the umbrella regression test doesn't yet cover.

### Adding a new men's / unisex product

1. Drop the ID into `constants.ts > INITIAL_PRODUCTS` and the matching Supabase upsert script.
2. The product surfaces under `/shop?category=men` automatically since it isn't in the `prod_womens_*` namespace.
3. If the product is genuinely unisex (e.g. a wallet or hat), `?category=wallets` / `?category=hats` keep working as before.

### Tests

The filter contract is locked in `tests/categoryFilter.test.ts` (currently 14 assertions):

- 5 women's describe assertions: prefix match + halo-dress exclusion + mens/unisex exclusion + `womens` alias + case-insensitivity.
- 5 men's describe assertions: paired-probe inclusion + `prod_womens_*` exclusion + halo-dress carve-out + `mens` alias + case-insensitivity.
- 4 backward-compat assertions: womens_* products still under their apparel type, halo dress still under `?category=dresses`, `all` / falsy passthrough, and an umbrella regression test that locks both sides of the cross-cut pair against the apparel umbrella with real paired probes (`shirts`, `shorts`, `apparel`), the women's side (`dresses`), and the men's side (`jeans`, `sweatshirt`).

A regression in either cross-cut filter or in any apparel sub-bucket flips the test red.

## Recently Ordered Live Map

The `/live-orders` page (`pages/LiveOrdersMap.tsx`) renders a state-level map, four summary cards, and a Recent Activity ticker driven by `buildLiveOrdersFeed()` in `utils/liveOrdersFeed.ts`. The map is intentionally built from three overlapping data surfaces so it always has something honest to show - no loaders, no "we'll get back to you", no fake billboard copy.

### Data flow at a glance

```
                              /live-orders
                                   |
                                   v
                  buildLiveOrdersFeed(orders, timeRange)
                                   |
            +----------+----------+----------+----------+
            |          |          |          |          |
            v          v          v          v          v
       Supabase    PUBLIC_    DEMO_        Display      Drop if
       orders in   RECENT     TRACKED      sort +       any of
       useApp()    ORDER_     ORDER_       dedup        those
                   SEEDS      SEEDS        + window     return
                              (DEV only)   filter       empty
```

The result is one of three shapes:

- **Live state** when at least one real Supabase order or `PUBLIC_RECENT_ORDER_SEEDS` row survives the window filter.
- **DEV-only fallback** when the production environment serves no orders AND the current `import.meta.env.DEV` flag is true; `DEMO_TRACKED_ORDER_SEEDS` then lights up the map visually for local testing.
- **Empty state** when production has no orders and DEV is false - the ticker prints the "No live orders in this window yet" panel.

Each layer is filtered, deduplicated, and re-sorted on its way through, so the timestamp inside `INITIAL_ORDERS` and the `minutesAgo` inside `PUBLIC_RECENT_ORDER_SEEDS` always need to be in lock-step.

### The three data surfaces in detail

**Layer 1 - Real Supabase orders.** The `Order[]` array handed to `buildLiveOrdersFeed` comes from `useApp().orders`. `AppContext.tsx` fetches it from the Supabase `orders` table. Orders are dropped if:

- Status is `cancelled`, `failed`, or `refunded` (`EXCLUDED_STATUSES`).
- `createdAt` is missing or unparseable.
- `shippingAddress.state` (or any of the legacy shipping-field aliases `getShippingState` reads) cannot be resolved to a US state code.

State and city come out of `shippingAddress.{state, city}` directly - these are buyer data and live on the Supabase row.

**Layer 2 - `PUBLIC_RECENT_ORDER_SEEDS` in `utils/liveOrdersFeed.ts`.** A small `as const` literal array of real offline sales. Every seed runs the same render pipeline as a Supabase order (`createSeedTrackedOrders`) so it produces an identical `TrackedLiveOrder`. Deduplication against Layer 1 happens by `order.id`; a Supabase row with the same `id` as a public seed will REPLACE the seed in the feed, not append.

**Layer 3 - `DEMO_TRACKED_ORDER_SEEDS`.** The same shape, populated with plausible US-state sales. This layer is gated by `DEMO_FEED_ENABLED = import.meta.env.DEV`, so a production build (`npm run build`) bakes the flag to `false` and these seeds are never reachable. They exist so a developer with an empty Supabase local environment still sees the visual layout working.

### The five currently shipping real-sale seeds

| `id` | Product | Location | `minutesAgo` | Surfaces in |
| --- | --- | --- | ---: | --- |
| `public-pa-grey-wave-wallet-2-2` | Coalition 'Grey Wave' Wallet 2/2 | York, PA | 12 | 24h, 7d, 30d, 90d, all |
| `public-pa-grey-wave-wallet-1-2` | Coalition 'Grey Wave' Wallet 1/2 | York, PA | 10_080 (7d) | 7d, 30d, 90d |
| `public-md-wholesale-wallets-2026_05_22` | 7-wallet wholesale bundle (friiqy) — ticker shows GreenCamo + 6 more | Abingdon, MD | 58_284 (40d) | 90d, all |
| `public-md-trust-yourself-hat-01` | TRUST YOURSELF CUSTOM TRUCKER (1/1) | Owings Mills, MD | 120_960 (84d) | 90d, all |
| `public-md-denim-patchwork-2024_11_08` | Coalition Denim Patchwork 1/1 Jeans S1 | Abingdon, MD | 865_440 (601d) | all only |
| `public-ny-true-religion-s1` | Coalition x True Religion 1/1 Jeans S1 | New York, NY | 1_219_680 (121w) | all only |

The wholesale bundle (`public-md-wholesale-wallets-2026_05_22`) is split into 7 separate `OrderItem` rows in `INITIAL_ORDERS` (one per wallet: `GreenCamoWallet`, `SKYYBLUEWALLET1_2`, `prod_wallet_004`, Coalition Racing Team 1/4 through 4/4) at $25 each = $175 total. The buyer is `@friiqy` on Instagram — the same Instagram account that bought the `Coalition_x_True_Religion_S1` row, joined via `instagramUsername: 'friiqy'` on both `INITIAL_ORDERS` rows. The full shipping address lives in the gitignored `shipping_internal.json` (see the "Admin-only shipping data" subsection below) for internal fulfillment; the public seed only carries `city: 'Abingdon'` + `state: 'MD'` per the live map privacy contract. The ticker link points to `/product/GreenCamoWallet` (the first wallet in catalog order); the other 6 wallets surface through the `+ 6 more items` copy.

The "Surfaces in" column comes from the `entry.timestamp >= windowStart` filter that runs after `createSeedTrackedOrders`:

```
windowStart = Date.now() - RANGE_MS[timeRange]
```

A seed drops out of a window when `now - seed.minutesAgo_minutes < windowStart`. The wallet seeds are inside 24h/7d/30d; the hat drops out of 30d (it's at 84d, past `30 * 24 * 60`); the True Religion S1 drops out of 90d (it's at 121w, past `90 * 24 * 60`). Only the 'All time' window holds every seed.

### Time-range tuple

`LiveOrdersTimeRange = '24h' | '7d' | '30d' | '90d' | 'all'`. Three places enumerate that exact tuple and must stay in lock-step:

1. `LiveOrdersTimeRange` and `RANGE_MS` in `utils/liveOrdersFeed.ts` - the source of truth. `RANGE_MS['all']` is a `Number.POSITIVE_INFINITY` sentinel that disables the window filter entirely so every real sale (including the 121-week True Religion S1) becomes visible.
2. `RANGE_LABELS` in `pages/LiveOrdersMap.tsx` - human-readable chip text.
3. The inline button list `(['24h', '7d', '30d', '90d', 'all'] as const)` in `pages/LiveOrdersMap.tsx` - drives the selector UI.

The default selected range on first render is `7d`. When `all` is active, the Orders summary card swaps its helper text to "Showing all real sales since the first drop" so the broader view doesn't read as a live pulse - it's a deliberate archive.

`formatRelativeTime` is also tiered above 24h so the "All time" view doesn't print "847d ago" for the 121-week sale: `<7d` -> `Xd ago`, `<30d` -> `Xw ago`, `<365d` -> `Xmo ago`, `>=365d` -> `Xy ago`. Tests in `tests/liveOrdersFeed.test.ts` pin all four tiers.

### Privacy contract - non-negotiable

- The ticker renders `"<product> ordered in <locationLabel>"` only. No address line, no ZIP, no customer name, no order number is exposed.
- All `shippingAddress.address1` and `shippingAddress.zip` values in seed orders are empty strings.
- Customer email in seed rows is `customer@example.com` - never a real address.
- `formatLocationLabel` only shows a city when it was set on the originating row; never fill in a city you cannot verify. The matcher reads `shippingAddress.city` plus several legacy shipping-field aliases, so older row shapes still surface correctly.

### The `id` contract

`buildLiveOrdersFeed` dedupes Layer 2 against Layer 1 with a `Set<string>` keyed on `order.id` per render. The seed format is:

```
public-<state>-<short-product-slug>
```

Three rules keep the contract sound:

1. Every entry in `PUBLIC_RECENT_ORDER_SEEDS` MUST have a sibling row in `INITIAL_ORDERS` whose `id` is byte-for-byte the same string. Comments in both files call this out so a future edit doesn't drift.
2. `INITIAL_ORDERS` rows use the seed id; new Supabase orders should not be assigned to a `public-...` id by the seed scripts (`scripts/add*Wallet.ts`, `scripts/listBuckets.ts`, etc.) unless the intent is exactly "this offline sale is now an online sale". Otherwise Layer 1 will collide with Layer 2.
3. The dedup test in `tests/liveOrdersFeed.test.ts` (`deduplicates when an INITIAL_ORDERS row carries the same id as a public seed`) is the regression guard. If a future refactor accidentally breaks dedup, this test fails first.

A drift between the two id columns will surface as a duplicated row in the ticker AND a double-count in `feed.states`, which is what the Grey Wave wallet seeds were originally written to catch.

### minutesAgo drift vs `createdAt`

`PUBLIC_RECENT_ORDER_SEEDS.minutesAgo` is a *floating* offset from "now" - it produces a stable relative time at build time, but it does not stay anchored to the real sale date as days pass. The corresponding `INITIAL_ORDERS.createdAt` is an *anchored* ISO timestamp that drifts in the opposite direction (it stays correct forever but its distance from "now" grows). This is acceptable today because:

- The public seed is the surface any visitor sees, and "12m ago" / "3mo ago" reads honestly.
- The `INITIAL_ORDERS` row is only used as the AppContext fallback when Supabase orders have not yet loaded, and the page tolerates a mismatch until then.

If a maintainer wants both surfaces to stay aligned forever, the seed record should grow an optional `absoluteTimestamp` field that wins over `minutesAgo` when present. Tracked as a follow-up; not part of the current contract.

### Worked example - adding the Trust Yourself hat sale

The Maintainer received a new offline sale ("hat sold in Baltimore MD, Owings Mills, April 9, 2026") and wired it in this section. The full edit went through three files:

**1. `utils/liveOrdersFeed.ts`** (`PUBLIC_RECENT_ORDER_SEEDS`, appended after the Grey Wave 2/2 seed):

```ts
{
    id: 'public-md-trust-yourself-hat-01',
    stateCode: 'MD',
    stateName: 'Maryland',
    city: 'Owings Mills',
    productId: 'prod_trust_yourself_hat_01',
    productName: 'TRUST YOURSELF CUSTOM TRUCKER (1/1)',
    productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_iYBlwm8.png',
    minutesAgo: 84 * 24 * 60,
    itemCount: 1,
},
```

Key choices documented inline: image resolves through `PRODUCT_IMAGE_URLS.trustYourselfHat.cover` so the storefront PDP and the ticker share one canonical URL; city is the specific CDP, not "Baltimore" generically, because the buyer data contained it; `minutesAgo` lines up with the recorded April 9 sell date from a July 2 viewer.

**2. `constants.ts` `INITIAL_ORDERS`** (new row, id matched byte-for-byte):

```ts
{
    id: 'public-md-trust-yourself-hat-01',
    orderNumber: 'ORD-SG-TRUST-YOURSELF-HAT-9500',
    isGuest: true,
    customerName: 'Owings Mills Customer',
    customerEmail: 'customer@example.com',
    items: [{
        productId: 'prod_trust_yourself_hat_01',
        productName: 'TRUST YOURSELF CUSTOM TRUCKER (1/1)',
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_iYBlwm8.png',
        selectedSize: 'One Size',
        quantity: 1,
        price: 50,
        total: 50,
    }],
    subtotal: 50, tax: 0, discount: 0, total: 50,
    paymentMethod: 'cash', paymentStatus: 'paid', orderType: 'manual',
    shippingAddress: {
        address1: '', city: 'Owings Mills', state: 'MD', zip: '',
        country: 'US', shippingMethod: 'standard', shippingCost: 0,
    },
    createdAt: '2026-04-09T15:00:00-04:00',
    paidAt:   '2026-04-09T15:00:00-04:00',
},
```

The empty `address1` and `zip`, the `customer@example.com` placeholder, and the missing order number display on the public site all uphold the privacy contract.

**3. `tests/liveOrdersFeed.test.ts`** extended the assertions so:

- The 90d window now expects 4 ticker entries in this exact order: 2/2, 1/2, S1, hat (jsdom sorts by timestamp descending).
- The 30d window still expects just 2 entries (the hat and S1 are both outside 30d).
- The 24h and 7d exclusion test now also asserts the hat does not appear in either window.

### Step-by-step recipe for adding a new real sale

1. Decide on the `minutesAgo`. If the sale is older than 90d from today, plan to add a new range literal (`'180d'`, `'1y'`) before doing anything else - see the time-range tuple section.
2. Edit `utils/liveOrdersFeed.ts > PUBLIC_RECENT_ORDER_SEEDS`. Pick the seed `id` as `public-<state>-<product-slug>` so it can never collide with an `Order.id` minted by `AppContext`.
3. Pin the city/state/product fields from the buyer data. If a field is missing or unverified, leave `city` undefined and let the ticker fall back to the state name.
4. Mirror the entry in `constants.ts > INITIAL_ORDERS` with the same `id`. Set all PII fields to safe placeholders (`''` for address, `customer@example.com` for email).
5. Extend `tests/liveOrdersFeed.test.ts` with one assertion for each time window the seed appears in, plus an exclusion assertion for each window the seed does NOT appear in.
6. Run tests + check the live page:

```bash
npx.cmd vitest run tests/liveOrdersFeed.test.ts
```

Open `/live-orders` in dev, click through every range button, and confirm the new sale shows up exactly once with the right product image.

### Editing or removing an existing sale

**Edit** - update the same entry in both `PUBLIC_RECENT_ORDER_SEEDS` and `INITIAL_ORDERS`. If only the timestamp changed, the tests will still pass because they freeze "now" via `vi.useFakeTimers`; update the assertions to match if the seed crossed a boundary into a different window.

**Remove** - drop the matching row from `INITIAL_ORDERS` first (it's the safe delete), then the matching entry from `PUBLIC_RECENT_ORDER_SEEDS`. Tests should drop naturally if the seed vanishes from the relevant window assertions - if a test is left checking for a now-absent entry, that is a sign the test was wrong.

### Common errors and what they mean

- **The same sale appears twice in the ticker.** The `id` in `INITIAL_ORDERS` does not match the `id` in `PUBLIC_RECENT_ORDER_SEEDS`. Diff the two arrays and copy one `id` into the other.
- **The sale appears but the state leaderboard count is off by one.** Same root cause as above. The leaderboard dedups using the same id set.
- **The sale is missing from a window it should fit in.** `minutesAgo` is larger than the window's `RANGE_MS`. Either bump the window or lower `minutesAgo`.
- **Clicking a ticker row does nothing.** Either `productId` is missing/wrong or the PDP doesn't exist at `/product/<productId>`. Verify with `utils/localImageAssets.ts` and the matching `scripts/add<slug>.ts`.
- **The "city" line says only the state name.** `city` was never set on the seed; verify the buyer data really did record a city, otherwise the state-only rendering is correct.

## Above As Below Set Offers

Use this checklist before changing the Above as Below tees, shorts, crop tank, or set pricing.

### Current set math

1. Men's tee: `prod_tee_above_as_below` is `$75`.
2. Men's shorts: `prod_shorts_above_as_below` is `$75`.
3. Men's set behavior: adding tee + shorts individually applies a `$30` cart bonus, so `$150` becomes `$120`.
4. Women's crop tank: `prod_womens_above_as_below_crop_tank` is `$40`.
5. Women's contrast shorts: `prod_womens_above_as_below_contrast_shorts` is `$40`.
6. Women's set SKU: `prod_womens_above_as_below_set` is `$75`, so `$80` separately becomes `$75` together.

### Where the feature lives

1. Product IDs and set math constants live in `utils/aboveAsBelowSet.ts`.
2. Static fallback product data lives in `constants.ts`.
3. Live Supabase upserts live in:
   - `scripts/addAboveAsBelowSet.ts` for the men's `$120` set SKU.
   - `scripts/addWomensAboveAsBelowProducts.ts` for the women's crop tank, shorts, and `$75` set SKU.
4. Product-page set suggestions render from `components/CompleteTheFit.tsx`.
   - Men's tee/shorts pages suggest the missing individual piece and rely on the cart bonus.
   - Women's crop tank/shorts pages suggest the direct women's set SKU at `$75`.
5. Cart-side men's tee/shorts suggestions render from `components/CompleteTheFitCart.tsx`.
6. Cart totals display the men's `$30` bonus from `components/CartDrawer.tsx` and checkout/order handlers through `calculateAboveAsBelowSetBonusCents`.

### Change checklist

1. Update `constants.ts` first so local fallback and static previews have the right product names, prices, descriptions, images, sizes, and inventory.
2. Update the matching Supabase script in `scripts/` so live data can be re-upserted.
3. Update `utils/aboveAsBelowSet.ts` if any product ID, individual total, or bonus amount changes.
4. Update `components/CompleteTheFit.tsx` only if the PDP suggestion rules change.
5. Update `components/CompleteTheFitCart.tsx` only if the cart-side tee/shorts bonus behavior changes.
6. Add or update tests in `tests/CompleteTheFit.test.tsx` and `tests/CompleteTheFitCart.test.tsx`.
7. Run the live upsert only when the product row or price needs to change in Supabase:

```bash
npx.cmd tsx scripts/addWomensAboveAsBelowProducts.ts
npx.cmd tsx scripts/addAboveAsBelowSet.ts
```

8. Verify locally before pushing:

```bash
npx.cmd vitest run tests/CompleteTheFit.test.tsx tests/CompleteTheFitCart.test.tsx
npm.cmd run build
```

9. Check these URLs after deploy:
   - `/product/prod_womens_above_as_below_crop_tank` shows the women's `$75` set suggestion.
   - `/product/prod_womens_above_as_below_contrast_shorts` shows the women's `$75` set suggestion.
   - `/product/prod_tee_above_as_below` and `/product/prod_shorts_above_as_below` still show the men's missing-piece set bonus.

## Referral Program

The Coalition referral program lives across `utils/referralSystem.ts`, `utils/referralAnalytics.ts`, `utils/couponSystem.ts`, `utils/customizeReferralCode.ts`, `data/blogPosts.ts`, and the `referral_*` Supabase tables. The user-facing dashboard is `components/ReferralDashboard.tsx` (mounted as the Referrals tab in `pages/Profile.tsx`). The admin overview is `admin/ReferralAnalytics.tsx`. Coupon input + self-referral check live in `pages/Checkout.tsx`.

### Commission tier table (v2)

The first successful sale immediately bumps a referrer from 5% to 10% — no more waiting for a second sale to unlock Tier 2. Bounds must stay in lock-step with the SQL CASE in `track_referral_event` (see `supabase/migrations/20260711_referral_v2_columns_and_rpc.sql`).

| Tier | Successful sales | Commission |
| ---: | --- | ---: |
| 1 | 0 | 5% |
| 2 | 1–2 | 10% |
| 3 | 3–6 | 15% |
| 4 | 7–14 | 20% |
| 5 | 15–29 | 25% |
| 6 | 30–49 | 30% |
| 7 | 50–99 | 35% |
| 8 | 100+ | 40% |

### Anti-fraud hardening (v2)

The `track_referral_event` RPC and the surrounding client code were hardened this session:

- **Self-referral block** at three layers: the coupon input (`utils/couponSystem.ts > validateCouponCode(code, currentUserId?)`), the client `trackReferral` function (`utils/referralSystem.ts`), and the server-side `track_referral_event` RPC. A direct-API call with `p_user_id = referrer` silently no-ops.
- **Visitor IP capture** on every event, written to `referral_analytics.visitor_ip` and snapshotted to `referral_stats.last_referral_ip`. Tracked at the `/24` (IPv4) and `/32` (IPv6) prefix level for fraud review; full-IP retention is deferred to a GDPR consent + retention job (TODO in the migration).
- **Atomic tier recompute** in the RPC using the same exponential progression as the client. The RPC is the single source of truth for `current_tier` / `current_commission_rate`; the client's `updateReferralStats` no longer writes those fields.
- **22 reserved words** for custom referral codes (ADMIN, SUPPORT, STAFF, HELP, INFO, ROOT, etc.) seeded into `referral_banned_codes` with RLS-locked-down mutations (anon + authenticated can SELECT, only service_role can INSERT/UPDATE/DELETE).
- **Reserved-prefix regex** in the `is_referral_code_available` RPC blocks `ADMIN-`, `STAFF-`, `SUPPORT-`, `TEST-` prefixed codes. The same set is mirrored client-side in `utils/customizeReferralCode.ts` for instant error messages.
- **Storage consolidation** — `getActiveReferralCode()` in `utils/referralSystem.ts` is the single source of truth for "what code should this checkout use?". `utils/couponSystem.getAppliedCouponCode` re-exports it.

### Earnings accounting fix

The prior `updateReferralStats` summed `status='completed'` twice (once for `totalEarnings`, once for `pendingEarnings`), making the dashboard's two numbers identical. v2 partitions a single `.in('status', ['completed', 'paid'])` query by status: `pendingEarnings = Σ completed`, `paidEarnings = Σ paid`, `totalEarnings = pendingEarnings + paidEarnings`. The dashboard's "Current tier" highlight is now computed client-side from `stats.successful_referrals` (via `calculateCommissionTier`) so it cannot drift between RPC events.

### Program sunset & community vote (Dec 31, 2026)

The Coalition referral program is scheduled to run through **December 31, 2026**. A community vote in mid-December will decide whether the program continues into 2027 or wraps for the year.

- A dismissible amber sunset banner is live at the top of `components/ReferralDashboard.tsx` (localStorage-persisted dismiss key: `sgcoalition.referral.sunsetNoticeDismissed.v1`).
- A referendum blog post is seeded at `/blog/referendum-referral-program-2027` in both `data/blogPosts.ts > blogFallbackPosts` AND the production `posts` table (via `supabase/migrations/20260711_referendum_referral_2027.sql` — idempotent `INSERT ... ON CONFLICT (slug) DO UPDATE`).
- The existing `components/VotingSystem.tsx` is auto-mounted by `pages/BlogPostView.tsx` — no further wiring needed. Upvote = continue, downvote = sunset. Vote weight = `user.v2Balance`.
- The dashboard banner's "Cast your vote →" link routes to the referendum post.
- To close the vote when tallying, the operator runs `UPDATE posts SET is_published = false WHERE slug = 'referendum-referral-program-2027';` in the Supabase SQL editor. The `VotingSystem` has no `closed_at` path; flipping `is_published` is the canonical close.

### Where to read it

- Client tier math: `utils/referralSystem.ts > COMMISSION_TIERS`, `calculateCommissionTier`
- Client stats: `getReferralStats`, `getReferralHistory`, `updateReferralStats` (earnings only — tier is RPC-owned)
- Storage: `storeReferralCode`, `getStoredReferralCode`, `clearReferralCode`, `getActiveReferralCode`
- Coupon validation: `utils/couponSystem.ts > validateCouponCode(code, currentUserId?)` (self-referral block on the second arg)
- Custom code: `utils/customizeReferralCode.ts` (banned-words list, reserved-prefix regex, graceful pre-v2 fallback)
- Event tracking: `utils/referralAnalytics.ts > trackReferralEvent`, `getReferrerAnalytics`, `getTopReferrers`
- User dashboard: `components/ReferralDashboard.tsx` (banner + tier cards + analytics cards + code/link/tier-table/history)
- Admin view: `admin/ReferralAnalytics.tsx`
- DB schema + RPC: `supabase/migrations/20260711_referral_v2_columns_and_rpc.sql`
- Referendum seed: `supabase/migrations/20260711_referendum_referral_2027.sql`
- Operator runbook: [FOLLOWUPS.md](./FOLLOWUPS.md)

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy to Vercel:
```bash
vercel
```

## Project Structure

```
api/                    # Vercel serverless functions
api/_handlers/          # One file per API endpoint loaded by api/[...slug].ts
components/             # React components
context/                # React context providers
pages/                  # Page components
public/                 # Static assets
services/               # Client-side service wrappers
supabase/migrations/    # Database schema changes
utils/                  # Shared frontend/backend helpers
vite.config.ts          # Vite configuration
vercel.json             # Vercel deployment config and rewrites
```

## Environment Variables

### Development (.env.local)
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe test publishable key
- `STRIPE_SECRET_KEY` - Stripe test secret key
- `RESEND_API_KEY` - Resend API key
- `VITE_APP_URL` - Local development URL

### Production (Vercel Dashboard)
- Same variables but with LIVE Stripe keys
- Update `VITE_APP_URL` to your production domain

## Contributing

This is a private project. For questions, contact the development team.

## License

All rights reserved © 2024 Coalition Brand


## Customer Profile

The customer-profile feature lets the maintainer (a) credit a customer's SGCoin
balance with an audit trail, and (b) attribute an existing order to a social
account (Facebook initially; Instagram/Twitter/TikTok slots already existed).
It does NOT auto-issue any bonus on first wallet link — credits are
intentionally manual so the operator controls the roll-out.

### How a profile is built

1. **profiles** row is created by Supabase on first signup (`auth.users` →
   public trigger). New columns added by
   `supabase/migrations/20260702_add_customer_profile_rewards.sql`:
   * `wallet_linked_at TIMESTAMPTZ` — first crypto-wallet link stamp
   * `lifetime_spend_usd NUMERIC` — Σ orders.total across PAID orders
   * `lifetime_orders INT` — count of PAID orders
   * `last_reward_credit_at / last_reward_credit_amount` — mirrors the latest audit row
   * `customer_notes TEXT` — admin-only via RLS
2. **social_accounts.platform** CHECK widened to include `'facebook'`
   alongside `instagram|twitter|tiktok`.
3. **orders.facebook_username** — written by the admin attribution tool, never
   by the customer.
4. **customer_reward_credits** — append-only `id, profile_id, order_id,
   amount_sgc, amount_usd, awarded_by_user_id, reason, created_at`. Every credit
   produces a new row.

### Admin tools

There are two API endpoints, both POST-only, both backed by the service-role
Supabase client:

* `POST /api/credit-customer-reward`
  Body: `{ profileId, amountSgc, reason, orderId?, amountUsd? }`
  Writes a `customer_reward_credits` row first (audit-first), then bumps
  `profiles.sg_coin_balance` and the `last_reward_credit_*` mirrors.
* `POST /api/attribute-order-to-facebook`
  Body: `{ orderId, facebookUsername, note? }`
  Normalizes `facebook.com/foo` / `@foo` / `foo` → `foo`, validates handle
  rules, stamps `orders.facebook_username` plus a stamp line in `orders.notes`.

The admin UI lives in `components/admin/CustomerProfileAdmin.tsx` and is
surfaced under the `/admin` "Customers" tab (added in `pages/Admin.tsx`).

### Where to read it

* Schema: `supabase/migrations/20260702_add_customer_profile_rewards.sql`
* Handlers: `api/_handlers/credit-customer-reward.ts`,
  `api/_handlers/attribute-order-to-facebook.ts`
* Router wire-up: `api/[...slug].ts`
* Type surfaces: `types.ts` (UserProfile, Order, SocialAccount); `api/_types.ts`
* Service-side platform union: `services/socialLinking.ts`
* App context actions + first-link stamp: `context/AppContext.tsx`
* Admin UI: `components/admin/CustomerProfileAdmin.tsx`
* Tests: `tests/creditCustomerReward.test.ts`,
  `tests/attributeOrderToFacebook.test.ts`,
  `tests/apiRouterCustomerProfile.test.ts`

### Adding a new social-attribution endpoint later

The pattern is intentionally tiny: a 90-line handler file that fetches the
existing rows, normalizes the new platform's handle format, validates it
against the platform's safe-character set, and writes a copy of the value
into the matching `orders.<platform>_username` column. The admin UI gains
one button row per panel. RLS already covers the read/write via the
`admin_users` table.

### Instagram attribution (added 2026-07-04)

The `instagram_username` column was added to `public.orders` by
`supabase/migrations/20260704_add_instagram_username_to_orders.sql`,
mirroring the `facebook_username` column from 20260702. The TypeScript
mirror lives in `types.ts > Order.instagramUsername`. Both are
admin-attributed, never set by the customer.

#### Seeding the @friiqy offline sales (wholesale + denim patchwork + verified-customer)

There are THREE scripts to run, in order, to fully mirror all of
@friiqy's offline sales into production. Each script has a single
responsibility and lives in its own file:

1. **`npm run seed:friiqy-wholesale`**
   (`scripts/upsertFriiqyWholesale.ts`) - writes the wholesale orders
   row (7 archived wallets, $175 total, 2026-05-22). Imports
   `INITIAL_ORDERS` from `constants.ts` as the single source of truth
   (finds the wholesale row by
   `id === 'public-md-wholesale-wallets-2026_05_22'`), transforms the
   camelCase `Order` shape into the snake_case `orders` table columns,
   and calls `upsert(payload, { onConflict: 'id' })`. Re-running
   rewrites the existing row with the canonical data; the script can
   never drift from `constants.ts` because it imports the row instead
   of redefining it. The same id is the dedup key used by
   `buildLiveOrdersFeed` in `utils/liveOrdersFeed.ts`.

2. **`npm run seed:friiqy-denim-patchwork`**
   (`scripts/upsertFriiqyDenimPatchwork.ts`) - writes the 1/1 Denim
   Patchwork jeans orders row (size 30, $140, 2024-11-08, posted on
   Instagram at https://www.instagram.com/p/DCIqPY4Msk_/?img_index=1).
   Same single-source-of-truth pattern as the wholesale script: finds
   the row by `id === 'public-md-denim-patchwork-2024_11_08'` from
   `INITIAL_ORDERS`, mirrors the same snake_case columns (including
   `instagram_username: 'friiqy'` so the admin Orders dashboard can
   filter by Instagram handle), and reads the full street address from
   `shipping_internal.json` at runtime. The seed script prints the
   expected admin-dashboard verification steps at the end
   (lifetime spend = $140 + $140 + $175 = $455 across 3 orders).

3. **`npm run seed:verified-customers`**
   (`scripts/seedVerifiedCustomers.ts`) - registers @friiqy as a
   verified past_customer so the test-campaign guard fires. Mirrors
   `scripts/seedSmsContact.ts`'s structure (idempotent lookup-then-insert
   via the service role key) but is purpose-built for verified
   past_customers WITHOUT a phone number: no `phone_e164`, no
   `country_code`, no `marketing_consent_log` write. The instagram
   handle lives in `metadata.instagram_username` for
   join / reconciliation. The script enforces `source in
   {manual_seed, past_customer}` at runtime - any other value is
   rejected with a clear error so the test-campaign guard can never
   silently fail to exclude the contact. The single row's
   `metadata.related_order_ids` is auto-derived by joining
   `metadata->>instagram_username` against the `orders.instagram_username`
   column populated by scripts 1 and 2 above.

The orders row alone is NOT enough to suppress friiqy from test
campaigns. `api/_handlers/marketing-send.ts` derives the
`source='past_customer'` tag at audience-fetch time by joining
`orders.customer_email` to the audience - it is NOT stored on the
orders row itself. A dedicated `marketing_contacts` row is what gives
friiqy a stable identity for the test-campaign filter across sends.
Run ALL THREE scripts to fully mirror all of @friiqy's offline sales.

All three scripts read `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from
`.env` (same pattern as `npm run seed:sms`). All are idempotent - re-
running any one is safe; the orders upserts overwrite by `id`, the
marketing_contacts insert looks up by `metadata.instagram_username` and
is a no-op when the row already exists.

The wholesale row carries 7 separate `OrderItem` entries (one per
wallet: GreenCamoWallet, SKYYBLUEWALLET1_2, prod_wallet_004, Coalition
Racing Team 1/4 through 4/4) at $25 each = $175 total. Same buyer as
the public-ny-true-religion-s1 row, joined via `instagram_username:
'friiqy'`. The full Abingdon shipping address (address1 + zip) is
populated at runtime from the gitignored `shipping_internal.json` —
see the next subsection for the privacy contract + setup steps. The
`INITIAL_ORDERS` row in `constants.ts` keeps `address1` + `zip` as
empty strings so the full street address is never committed to the
codebase; the live map privacy contract also strips address1 + zip
from the `PUBLIC_RECENT_ORDER_SEED`.

**Prerequisite**: apply the 20260704 migration first
(`supabase db push` or paste into the Supabase SQL editor). The orders
script's error message points at the migration file if the
`instagram_username` column is missing.

After running BOTH scripts, verify the two writes:

```sql
-- orders row present, total $175, instagram_username = friiqy
SELECT id, order_number, total, instagram_username
FROM orders WHERE id = 'public-md-wholesale-wallets-2026_05_22';

-- marketing_contacts row present, source = past_customer
SELECT id, status, source, metadata->>'instagram_username' AS instagram
FROM marketing_contacts
WHERE metadata->>'instagram_username' = 'friiqy';
```

Then verify the Live Orders Map surfaces the wholesale at
https://sgcoalition.xyz/live-orders under the 90d or all-time chip.

To test the suppression, send a campaign whose name contains "test"
from the admin Marketing Manager UI - friiqy should NOT appear in the
sent log. The `[marketing-send] test campaign excluded N verified-customer
rows` line on the server console will tick up by 1 for each test send.

#### Admin-only shipping data (shipping_internal.json)

The full street address for an offline-cash order (e.g. an offline
wholesale shipped to a buyer's home address) is never committed to the
codebase. It lives in `shipping_internal.json` at the repo root, which
is gitignored. The template at `shipping_internal.example.json` IS
committed and shows the schema (with `REDACTED` placeholder values so
the real address never appears in a committed file):

```json
{
  "<INITIAL_ORDERS id>": {
    "address1": "REDACTED — see shipping_internal.json for the real address",
    "zip": "REDACTED"
  }
}
```

The key is the `INITIAL_ORDERS` `id` value; the value is the
fulfillment address to write to `orders.shipping_address.address1` /
`.zip` in Supabase. `city` and `state` are NOT in this file because
they're safe to commit — they're what the live map surfaces and they
live on the public seed.

**Setup (operator):**

```bash
cp shipping_internal.example.json shipping_internal.json
# Then edit shipping_internal.json to fill in the real addresses.
```

`scripts/upsertFriiqyWholesale.ts` reads the file at runtime:

- If the file is missing → the script logs a warning and falls back
  to empty address fields. The Supabase row is still upserted (the
  upsert never blocks on a missing fulfillment address).
- If the file is present but has no entry for the order id → same
  fallback: warning + empty address fields.
- If the file is present and has an entry → the script populates
  `address1` + `zip` from the JSON and logs a one-line confirmation.

The Vercel deploy never has `shipping_internal.json` in its build
output, so production has no access to the full address. The
storefront never reads the file — it only ever sees the public seed
which strips address1 + zip per the live map privacy contract.

**Hard rules:**

- The full street address MUST live in `shipping_internal.json` only.
  Never in `constants.ts`, never in an `INITIAL_ORDERS` row, never
  in `PUBLIC_RECENT_ORDER_SEEDS`, never in a Supabase row that's
  reachable by anon-key RLS.
- `shipping_internal.example.json` is the only place a sample
  address may appear (and only as `REDACTED` placeholders). Update
  the template when you add a new offline-cash order, not the real
  file (the real file is gitignored).
- Do not commit `shipping_internal.json`. If you accidentally do,
  treat the address as compromised: notify the buyer, move the
  address, and rewrite the file under a new path.

### Worked example: starrboii067 Grey Wave Wallet 1/2 sale

Context: customer bought Coalition 'Grey Wave' Wallet 1/2 over FB DM with
the handle `starrboii067`. To record this in the admin tool:

1. Open `/admin` → **Customers** tab.
2. Find the buyer by email (`customer@example.com`) or `wallet_address`.
3. **Attribute Order to Facebook** panel: paste `orderId`, paste
   `facebook.com/starrboii067` (URL form is normalized), add a note like
   "Confirmed via DM 2026-07-02", click **Attribute order**.
4. The order row now has `facebook_username = 'starrboii067'` and a
   `[fb @<ts>] attributed to @starrboii067` line in `notes`.
5. To thank the buyer, **Credit SGC Reward** panel: `50` SGC, reason
   `"Starrboii067 — wallet bonus"`, click **Credit reward**.The customer's `sg_coin_balance` jumps and a `customer_reward_credits` row is appended.

## /admin Verified Buyers tab

The Verified Buyers tab (`components/admin/VerifiedBuyersAdmin.tsx`) is the operator's view for every `marketing_contacts` row whose `source ∈ {past_customer, manual_seed}` plus the orders joined by `instagram_username`. It exists so that @friiqy's $455 / 3-orders tuple, the York PA Grey Wave wallet sales, and any other operator-seeded offline cash purchase are first-class surface area in `/admin` without requiring an existing `profiles` row for the buyer.

### Data flow

Two-step in-component aggregate - no PostgREST RPC, no new migration. The verified-row count is small enough that the join + sum path lives in `useMemo`:

1. `marketing_contacts` `.in('source', ['past_customer','manual_seed'])`, ordered by `created_at` desc.
2. For each contact, read `metadata.instagram_username`; union into a deduplicated `handles` list.
3. `orders` `.in('instagram_username', handles)`, ordered by `created_at` desc, `limit(200)`.
4. Memo `ordersByHandle` keyed on `instagram_username` -> `lifetime = Σ orders.total`, `orderCount = orders.length`, `lastAt = orders[0].created_at`.
5. Rows sorted `lifetime DESC -> orderCount DESC -> handle ASC`. friiqy tops the list at an **expected $455 / 3 orders** once all three friiqy seed scripts have run (`seed:friiqy-wholesale` + `seed:friiqy-denim-patchwork` + `seed:true-religion-s1`). Verify on prod with `SELECT sum(total) FROM orders WHERE instagram_username = 'friiqy' AND payment_status = 'paid';` - if it returns 455, all three seeds are online; a lower value means a row is still missing. The York PA Grey Wave wallets and the Abingdon Denim Patchwork follow, then any manual_seed row with no profile.

### Contract

- Search across `handle`, `metadata.customer_name`, `email`, and `source` - case-insensitive partial.
- Each row expands to show the joined `orders` rows with a `paid` / `pending` / `cancelled-or-refunded` palette (paid = emerald, pending = amber, anything else = muted gray), city + state, product name, total. No `address1` / `zip` / email-raw is rendered; only `shippingAddress.city + state` is surfaced.
- If a contact lacks `metadata.instagram_username`, the handle pill reads `(no handle)` and the row shows `0` orders / lifetime $0; it is still search-able by `email` / `customer_name` / `source`.
- Suppression footer: the rail at the bottom of the tab repeats the suppression contract from `utils/marketingAudience.ts > filterVerifiedCustomers()` - contacts in this tab are filtered out of any campaign whose name contains the substring `test` (case-insensitive). Use this footer as the answer when an operator asks "why didn't everyone receive this campaign?".

### Wiring

- `components/admin/AdminLayout.tsx` adds `'verified-buyers'` to the `activeTab` union and the `navItems` entry, with a `UserCheck` icon from `lucide-react`.
- `pages/Admin.tsx` adds `React.lazy(() => import('../components/admin/VerifiedBuyersAdmin'))` and a `case 'verified-buyers': return <VerifiedBuyersAdmin />` branch in `renderContent`. The lazy import keeps the eager `index-*.js` chunk from absorbing `VerifiedBuyersAdmin`'s markdown + table JSX.

### Adding a new verified-buyer seeding

Use `npm run seed:verified-customers` (`scripts/seedVerifiedCustomers.ts`). The Verified Buyers tab picks up the new row on the operator's next Refresh click (or any other `customers` / `marketing_contacts` change that re-renders the component). See [Customer Profile](#customer-profile) for the three-step friiqy seed runbook.

## /admin Instagram-handle filter chips

Two existing `/admin` tabs (Orders + Customer Profiles) now carry a second filter input beside the existing search field. Both accept an Instagram handle with or without the leading `@`, do case-insensitive partial match, and bypass cleanly when the input is empty. They share the same prefix-stripping utility but read from different sources - they are not backed by one shared predicate.

### OrderManager - `components/admin/OrderManager.tsx`

- Reads `order.instagramUsername` (TS field) with a single scoped `as any` bridge for runtime resilience if a future row comes back snake_case from the supabase-js client. The DB column is `instagram_username`, added by `supabase/migrations/20260704_add_instagram_username_to_orders.sql`.
- AND-combines with the existing `searchTerm` / `filterStatus` / `filterType` clauses.
- A pink `@` icon (lucide `AtSign`) marks the input; the helper text on the right edge of the row reads `Reads orders.instagram_username - case-insensitive partial` so the operator knows exactly which column is hit. Type `friiqy` -> all 3 sales render side-by-side; type `@friiqy` -> same set (the `@` is stripped).

### CustomerProfileAdmin - `components/admin/CustomerProfileAdmin.tsx`

The IG filter walks two sources so a buyer is discoverable even without a matching `profiles` row:

1. **Per profile** - `social_accounts.username` joined via `social_accounts.user_id = profile.id`, restricted to `platform = 'instagram'`. Fetched once after `profiles` loads, snapshotted into `instaHandlesByProfile: Record<profileId, string[]>`. The in-memory table filter runs synchronously on this map so the operator sees instant feedback as they type.
2. **Marketing contacts fallback** - when the IG filter is non-empty, a debounced ~`300ms` `useEffect` fires a single `marketing_contacts` query via `.ilike('metadata->>instagram_username', '%<escaped_handle>%')` against the JSONB-extracted handle. ILIKE pattern is run through a `/[%_\\]/g` escape first so a future handle containing `%` / `_` / `\` cannot broaden the match. Email-join: the row is "matched" if `marketing_contacts.email` lowercases into the `profileEmailsRef.current` set; otherwise it surfaces in the pink rail banner with a pointer to `/admin Verified Buyers`.

A pink rail banner surfaces the matched marketing contacts whose email is **not** linked to a profile row - they are reachable via the `/admin Verified Buyers` tab instead.

### Debounce + ref snapshot for perf

- The marketing_contacts lookup is debounced through a `debouncedIgFilter` state with a `setTimeout(..., 300)` reset, then a separate `useEffect` keyed on `[debouncedIgFilter]` fires one query per pause-typing burst. Typing `friiqy` produces 1 query, not 6.
- The `profileEmailsRef` snapshots the profile-email set on every `customers` change without invalidating the marketing_contacts effect's deps, so a profile refresh (clicking the Refresh button) does NOT re-fire the ILIKE query. The race-guard `cancelled` flag drops late returns if the operator clicks Refresh mid-typing.

### Privacy

Both chips preserve the live-map privacy contract: no `address1`, no `zip`, no real email-raw. The CustomerProfileAdmin unmatched-handles rail shows only the instagram handle (`@friiqy`), never the buyer email or address. Operator-only data goes through the existing RLS admin gate.

### Tests

No new vitest required - both filters are in-component `useMemo` predicates, not exported functions. If a future refactor extracts them to `utils/instagramFilter.ts` (recommended for shared reuse), add a focused test file then.

## Reel + post recipe (1/1 process videos)

My playbook for posting any reel that shows a hand-built process — wallet, patch, custom piece — and drives a 1/1 sale. This is what I run every time I have B-roll of the build with a song on in the background. Followed top-to-bottom, this lands an IG drop and a delayed FB cross-post without re-deciding anything.

### When this applies

- Item is a one-of-one (1/1) or hard-cap drop, not evergreen catalog.
- I have process B-roll I'm cutting into a reel.
- I'm running an audio track on top — usually unreleased or snippet-only.

If any of those is missing, this is not the right recipe — pick the matching template triple:

- **Visual drop** (5-slide Story thread or Grid carousel) → [the Grey-Wave-style triple in `docs/README.md`](docs/README.md)
- **Reel drop** (process video, which is almost always what brings you here) → the **reel template triple** under [`docs/templates/reel/`](docs/templates/reel/) — clone the three master files into `docs/drop-{kit,copy,storyboard}-{slug}.{md,html}` at the top of `docs/`, find-replace every `{{ }}` token, then return here for the pre-publish audit gate.

The triple captures the *what to fill in*. This recipe captures the *why* and the gate. They live in different docs on purpose.

### The 5-step chain

1. **Title** — keep the same shape every time so followers recognize it as part of the build series. Default: `<Product type> 1/1` (e.g., "Custom Coalition Wallet 1/1"). Only swap if the audio is unreleased + snippet-only and the song hook deserves the real estate; then the song hook IS the title.
2. **Caption** — IG-tuned. Hook line = song phrase welded to the craft verb, ≤125 chars so it lands above the "...more" fold. Body mirrors my last reel's closing triptych (*No factory. No shortcuts. Just the process. Trust Yourself.*). Hashtags go in the **first comment**, not inline — cleaner read, IG indexes them either way.
3. **Timing** — IG first, FB **48h later**. Never same-day cross-post; the algorithm splits the engagement signal in half and amplifies neither. IG fires at the **6–8pm evening window** (when Gen-Z streetwear buyers scroll, not lunchtime). FB fires at the platform's suggested time (1pm weekday, derived from my historical follower activity).
4. **Cover frame** — needle-pierce moment. Tightest crop possible, single point of action, red thread against leather = natural focal accent. **Square-safe composition** — keep focal action in the middle horizontal band so it still reads at 1:1 grid thumbnail. On-screen text ≤4 words, all caps, white + drop shadow, bottom-right.
5. **Cross-post variant** — FB and TikTok get the IG caption with **~10% drift**: swap one word, swap one emoji. Otherwise the platform flags it as duplicate content and suppresses reach. Same reel, different headline surface.

### Default templates (paste-ready)

**Title** (auto-pick up from the item at hand — don't overthink):
```
Custom Coalition <Item Type> 1/1
```

**IG caption** (worked example: 1huemoney — Balling Like the Pacers, item = Custom Coalition Wallet):
```
Balling like the Pacers… stitch by stitch.🪡🫡

The next 1/1 Custom Coalition Wallet is coming together from scratch — balling like the Pacers, stitch by stitch. Same no-factory energy as the last build, rebuilt into an everyday carry piece. Hand-cut, hand-finished, red and white Coalition mark, one bag only. No second copy. No factory. No shortcuts. Just the process.

Trust Yourself — available now at sgcoalition.xyz
```

**First comment hashtags** (paste within 5 sec of posting IG):
```
#sgcoalition #coalition #trustyourself #unity #gmoneyworld #1huemoney #ballinglikethepacers #wallet #madebyhand #1of1
```

**Cover frame on-screen text** — default `HANDMADE · 1/1`:
```
HANDMADE · 1/1
```
Fallbacks (only swap if I A/B'd and Default underperformed on grid-tap rate):
```
NO FACTORY · 1/1
BUILT · 1/1
```

**FB cross-post variant** — ≥10% drift from IG so duplicate-content penalty doesn't kill reach. Two swaps minimum: one verb, one emoji.
```
Balling like the Pacers… stitch by stitch.🪡🔥

The next 1/1 Custom Coalition Wallet is pulling together from scratch — Pacers tempo, one stitch at a time. Same no-factory energy as the last build, rebuilt into an everyday carry piece. Hand-cut, hand-finished, red and white Coalition mark, one bag only. No second copy. No factory. No shortcuts. Just the process.

Trust Yourself — live at sgcoalition.xyz
```

### Pre-publish audit (the gate)

The final 30 seconds between "build ready" and tapping Post. This table runs every time. Every row is a hard gate — if the read fails, do not post. Don't argue with it, don't tap past it, don't "fix in the DMs later." Fail means stop, repair, re-audit.

| # | Gate | What good looks like | Fail → fix |
|---|---|---|---|
| 1.1 | Title | Reads `<Product type> 1/1` exactly. No emoji in the title; emoji lives in the caption. | Stop. Rename. Only swap title to the song hook if the audio is unreleased snippet-only. |
| 1.2 | Title | Matches last week's series shape (drops read as a series, not one-offs). | Pick a series anchor from the last 2 reels and rename. |
| 2.1 | Caption hook | Line 1 ≤125 chars. Lands the song phrase + a craft verb in one breath. | Rewrite line 1. Pull the song hook + the action verb from the audio. |
| 2.2 | Caption body | Closing triptych present verbatim: `No factory. No shortcuts. Just the process. Trust Yourself.` | Restore verbatim from the recipe template. Don't paraphrase, don't abbreviate. |
| 2.3 | Caption CTA | `Trust Yourself` line + `sgcoalition.xyz` URL present at the bottom. | Append both. Without these the post is a vibe post, not a sale post. |
| 2.4 | Caption → CTA resolves | The `sgcoalition.xyz` URL resolves to a live PDP: 200, stock=1, price matches the caption. | Hard-fix the PDP before posting. A 404 link makes the whole post a vibe post. |
| 2.5 | Hashtags | First comment only. NOT inline in the caption body. | Move inline tags to the first comment within 5 sec of posting. |
| 3.1 | Timing — IG | Inside the 6–8pm evening window. Not lunch, not midnight. | Schedule for the next evening window. Don't post against this gate. |
| 3.2 | Timing — FB | Cross-post scheduled ≥48h after IG. | Pull same-day FB; reschedule to the 48h slot. Same-day splits the algorithm signal. |
| 4.1 | Cover frame | Process shot — needle pierces leather, hands mid-stitch, thread under tension. NOT a finished product flat-lay. | Select a different frame from the timeline. Static finished frames read as commerce, suppress in Reels. |
| 4.2 | Cover text | ≤4 words, all caps, bottom-right placement. | Trim to ≤4 words. Force caps. Move to bottom-right. Everything longer is unreadable at thumbnail size. |
| 4.3 | Cover crop — square-safe | Focal action sits in the middle horizontal band (still readable at 1:1 grid thumbnail). | Re-crop. Center the action vertically so the platform's 1:1 crop doesn't lop off hands or thread. |
| 5.1 | Cross-post drift | FB / TikTok caption has ≥10% drift from IG (minimum: one verb swap + one emoji swap). NOT the same headline. | Rewrite the FB caption. Two swaps minimum so the duplicate-content penalty doesn't kill reach. |
| 5.2 | Cross-post queued | FB post scheduled at the 48h mark, not in a "I'll remember" mental note. | Queue it now in-platform. If the post fails 5.2 tomorrow, it fails 3.2 too — both want queue, not memory. |

**Soft notes (do not gate Post, but check):**

- **Audio uniqueness** — if the audio matches the last reel, expect lower velocity + reach suppression. Reuse only if the snippet *is* the value prop.
- **First-comment taxonomy** — 7–10 hashtags is the proven band. Going to 25+ triggers IG spam heuristics; under 5 sacrifices discovery. Use the bank from the recipe; do not freestyle.

**Time budget:** under 90 seconds. Going over means I'm arguing with myself on a row that already failed — drop back, repair, and re-audit.

### First-30-minute litmus test

The minute I post IG I watch velocity for 30 min. It's the only honest A/B test and it tells me whether the FB cross-post is worth firing 48h later:

- **<5 likes in first 15 min** — cover frame or hook weak. Pull + re-cut **before** the FB crosspost so FB doesn't inherit a bad asset.
- **5–15 likes / first 15 min** — healthy. Let it ride.
- **>15 likes / first 15 min** — algorithm amplifies. Crosspost FB at the 48h mark with confidence.

### Why this works (don't drift from it)

- **Pattern-matching beats creativity for 1/1s.** Same title shape, same closing triptych, same hashtags = my audience sees each drop as part of a series, not one-offs. Series = repeat buyers knowing what to expect.
- **Two platforms, 48h apart.** Same-day cross-posting splits the engagement signal in half — the algorithm can't tell which platform to amplify on, so it amplifies neither. 48h gives the winning platform time to seed, then the crosspost carries proven social proof, not a cold asset.
- **Mute-thumbs need visual proof.** The needle-pierce frame proves "this is a video, this is a real build" **before** the audio plays. Static finished-product frames read as commerce → IG suppresses in Reels feed.
- **3-second readability.** Everything below 4 words on the cover frame is unreadable at thumbnail size. `HANDMADE · 1/1` stacks both my best signals — craft + scarcity — inside that window.
- **Evening over lunch.** Streetwear buyers impulse-buy when scrolling in bed, not at 1pm weekday. IG platform suggestions often default to mid-day; I override for this SKU type.

### Common failures + fixes

| Symptom | Root cause | Fix |
|---|---|---|
| Reel title doesn't match last week's series | Title drift | Stop and switch back to `<Product type> 1/1` shape |
| Hashtags are inline in the body | First-comment rule forgotten | Move them to the first comment within 5 sec of posting |
| Same audio as the last reel | Audio reuse | Algorithm treats as duplicate. Pick fresh or unreleased snippet |
| Cover frame is the finished product flat-lay | Wrong frame picked | Read as commerce, suppresses in Reels. Use a process shot |
| IG + FB posted same day | Timing shortcut | Pull FB, repost at the 48h mark |
| Engagement dies after 2 hours | Hook line weak above the fold | Rewrite line 1 with the song hook welded to the craft verb |

### Worked example (Balling Like the Pacers — Custom Wallet 1/1, 2026-07-06)

This is the recipe was extracted from. Use it as a reference when in doubt:

- **Audio:** unreleased 1huemoney snippet; hook = `Balling Like the Pacers`
- **Item:** Custom Coalition Wallet, hand-sewn
- **Title:** `Custom Coalition Wallet 1/1` (default shape, not swapped — series recognition won out)
- **IG caption hook:** `Balling like the Pacers… stitch by stitch.🪡🫡` — song phrase + sewing verb in one breath
- **Closing triptych:** unchanged from last week's "Above as Below" wallet caption (`No factory. No shortcuts. Just the process.`)
- **Hashtags:** first comment, 7 brand + 2 product-discovery tags + audio tags
- **Cover frame:** needle piercing leather, tight crop, `HANDMADE · 1/1` burned bottom-right
- **Timing:** IG dropped 2026-07-06 ~6–8pm; FB cross-post scheduled for 2026-07-09 ~1pm
- **First 30 min velocity:** healthy 5–15 band → ride original, no re-cut

### When to fork this recipe

- **One-of-many limited run (not 1/1)** — still use this recipe but expect lower velocity; cover frame text drops the `· 1/1` suffix (`HANDMADE`) because scarcity isn't the lead signal.
- **Sneaker / apparel drop with hero image instead of B-roll** — this recipe doesn't fit. Use the `docs/drop-copy-grey-wave.md` template trio instead.
- **Pre-order sale (no inventory)** — keep everything but flip the closing triptych to lead with `Locked in.` so the buyer knows their slot is reserved, not shipped.

## Public site map

One H3 per page the visitor can land on. `/shop` and `/live-orders` get sections of their own above because they carry richer mechanics (catalog merge order + size inventory; live order feed + window-filter logic) that need dedicated documentation rather than a one-line summary here. `/`, `/cart`, `/checkout`, and `/product/:id` are intentionally NOT listed below because their behavior is already covered across the existing `## Current Product Catalog Baseline`, `## Backend Architecture`, and `## Backend Bug-Fix Checklist` sections (cross-link from those, not duplicated here). Routes not listed below are intentional gaps — either leaderboard-style public surfaces protected by auth, or operator-only screens surfaced under `/admin`.

### Custom builds + community

- **/custom-wallets** (`pages/CustomWallets.tsx`) — operator-curated custom-wallet landing page. Walks through the same intake flow as `/inquire` but pitched at the wallet category. Single intake form reuses the Custom Inquiry API.
- **/inquire** (`pages/CustomInquiry.tsx`) — full custom-build intake form. POSTs to `/api/product-upload` (custom-inquiry branch). Buyer PII in Supabase only; inquiry upload keys live in `services/inquiryUpload.ts` at runtime.
- **/favorites** (`pages/Favorites.tsx`) — logged-in favorited products. Renders from `profile.favorites[]` in `context/AppContext.tsx`; no separate table.
- **/wishlist/:shareId** (`pages/PublicWishlist.tsx`) — public, share-token-only view of a buyer's favorited products. Token minted server-side; rows are filtered to a single `profile.id`.
- **/help** (`pages/Help.tsx`) — FAQ + contact entry to the marketing `marketing_contacts` opt-in form.

### Crypto + Web3

- **/portal** (`pages/SGCoalitionPortal.tsx`) — gateway page for whichever Coalition-on-Polygon surface the buyer came in for. Conditional `<Navbar />` hides the storefront nav.
- **/sgminiwizards** (`pages/WizardsPortal.tsx`) — Wizards NFT portal entry. Mirrors the SGCoin tutorial flow but pitched at the Wizards (Mini Wizards ERC-1155) collection specifically.
- **/sgminiwizards/dashboard** (`pages/WizardsDashboard.tsx`) — Wizards owner dashboard. Pulls `mini_wizards_contract_address` from `constants.ts` and shows the buyer's holdings via `services/web3Service.ts`.
- **/sgminiwizards/treasury** (`pages/TreasuryPage.tsx`) — SGCoin treasury + treasury wallet address display. Reads `constants.TREASURY_WALLET_ADDRESS`, `QUICKSWAP_LP_ADDRESS`, and the static `LIQUIDITY_TARGET_POL` for the live POL balance banner.
- **/sgcoin** (`pages/BuySGCoin.tsx`) — buy SGCoin landing. CTA drives into the 6-step tutorial (/tutorial/welcome -> /tutorial/use) and Quickswap.
- **/migrate** (`pages/MigrationPage.tsx`) — V1 → V2 SGCoin migration wizard. Drives `constants.calculateV2Amount` against the connected wallet's V1 balance; `MIGRATION_RATIO = 1_000_000:1` is the operator-set flat ratio (whale-tier worst-case fairness).
- **/membership** (`pages/Membership.tsx`) — Coalition membership gates + perks. Currently read-only marketing surface; subscription checkout runs through `/api/create-subscription-session` if a tier is wired.

### Buyer account + history

- **/profile** (`pages/Profile.tsx`) — authed buyer profile. Pinned-to-wallet buyers see their SGCoin balance, wallet link status, and first-link timestamp.
- **/order-history** (`pages/OrderHistory.tsx`) — authed order history. Pulls from Supabase `orders` filtered by `customer_email`.
- **/order/:orderId** (`pages/OrderDetails.tsx`) — single-order detail page.
- **/order/success** (`pages/OrderSuccess.tsx`) — Stripe + PayPal dual-mode landing. Reads `payment_method` from the URL.
- **/order/cancel** (`pages/OrderCancel.tsx`) — Stripe/crypto/paypal handoff-cancel landing.
- **/saved-addresses** (`pages/SavedAddresses.tsx`) — authed multi-address book. Saved addresses boost the customer's reorder flow.
- **/my-reviews** (`pages/MyReviews.tsx`) — buyer-authored reviews list. Only visible to the buyer who wrote them; the public PDP reads from the same `reviews` table but without the buyer-side filter.
- **/search** (`pages/SearchResults.tsx`) — full-catalog search. Matches product.name + product.description + product.category against the live merged catalog (Supabase + INITIAL_PRODUCTS + PRODUCT_LOCAL_OVERRIDES).
- **/login, /signup, /forgot-password, /reset-password, /update-password** — Supabase Auth flow. Reset + update are reachable only via Supabase email links; the forget/reset pair shares one form pattern.

### Marketing + content

- **/about** (`pages/About.tsx`) — Coalition origin story. Single static render from `constants.ts > ABOUT_TEXT`.
- **/ecosystem** (`pages/Ecosystem.tsx`) — Coalition ecosystem map. Linking tile -> external SGCoin contract + Quickswap + Treasury.
- **/archive** (`pages/Archive.tsx`) — archived / 1-of-1-only catalog. Surfaces every `INITIAL_PRODUCTS` row with `archived: true` outside the live `/shop` flow.
- **/blog** (`pages/Blog.tsx`) + **/blog/:slug** (`pages/BlogPostView.tsx`) — public blog list + per-post view. Admin editor lives at `/admin/blog` (BlogManager).
- **/giveaway/:id** (`pages/GiveawayEntry.tsx`) + **/youtube-giveaway** (`pages/YoutubeGiveaway.tsx`) — giveaway entry forms. Both POST to Supabase `giveaways`; operator curation lives at `/admin/giveaways`.
- **/privacy**, **/terms** — legal copy, no auth gate.
- **/not-found** (`pages/NotFound.tsx`) — 404 page.

## Admin operator map

One H3 per `/admin/*` tab the operator can land on. The sidebar navigation is organized into five grouped sections:

| Group | Tabs |
|---|---|
| **Commerce** | Products, Orders, Reviews |
| **Content** | Blog Manager, Image Manager |
| **Community** | Giveaways, Custom Inquiries, Instagram Links, Signal Broadcast, User Directory |
| **Finance** | SGCoin Distribution, SGCoin Requests, Referral Analytics |
| **System** | Command Center, Analytics, Version Control, Coalition Brain |

Each group has a section header in the sidebar. The active tab is indicated by a bold white background and a pulsing dot indicator. The mobile menu mirrors the same grouped structure with a backdrop blur overlay. The Verified Buyers and Customer Profile tabs already have their own dedicated sections above (gated contract, dedupe-by-id, privacy promises) and are referenced here for completeness. The Brain tab is authed via `ProtectedRoute` outside the admin shell — `/brain` covers the same surface for the founder wallet address.

### Catalog + fulfillment

- **Command Center** (`components/admin/EcosystemCommandCenter.tsx`) — operator landing tab after sign-in. Surfaces signal-broadcast status, recent orders, marketing campaigns in flight, and 4-5 at-a-glance stats.
- **Products** (`components/admin/ProductManager.tsx`) — full CRUD over the Supabase `products` table. Action buttons (Edit, Duplicate, Delete) are always visible (opacity-60, full on hover) for one-click access on any device. Image-role editor + named slot targets are wired through this tab; halo and above-as-below products ship here.
- **Orders** (`components/admin/OrderManager.tsx`) — operator order dashboard. Now carries the IG-handle filter chip (see [that section](#admin-instagram-handle-filter-chips) above).
- **Custom Inquiries** (`components/admin/CustomInquiryManager.tsx`) — intake queries from the `/inquire` form. CSV export + manual reply workflow.
- **Giveaways** (`components/admin/GiveawayManager.tsx`) — operator curation for `/giveaway/:id` + YouTube giveaway flows. Draw winner + CSV export shared with Inquiries tab.
- **Version Control** (`components/admin/GitControl.tsx`) — operator-facing thin wrapper over `services/gitService.ts`. Lists last-10 commits + a non-destructive `git status` readout; never auto-commits.

### Marketing + reach

- **Marketing** (`components/admin/MarketingManager.tsx`) — campaigns sender. Composer view shows an amber advisory banner the moment the campaign name contains `test` (full suppression contract is documented in [Marketing and SMS](#marketing-and-sms) above).
- **Instagram Links** (`components/admin/InstagramLinksManager.tsx`) — `@sgcoalition` link-in-bio manager. Reads + writes through the Instagram links API.
- **Signal Broadcast** (`components/admin/SignalManager.tsx`) — `SignalAlert` overlay + PromoBar coordination. One-shot banners the operator can fire without redeploying.
- **Reviews** (`components/admin/ReviewManager.tsx`) — buyer-review moderation queue.
- **Blog Manager** (`pages/admin/BlogManager.tsx`) — `/blog` post editor. Mounted at `/admin/blog` (separate route, not a tab).

### Wallet + identity

- **User Directory** (`components/admin/UserManager.tsx`) — Supabase `profiles` + `auth.users` directory. Read-only by default; admin wallet toggle for editing.
- **Referrals** (`components/admin/ReferralAnalytics.tsx`) — referral-tracking dashboard. Reads `referrals` rows joined to `marketing_contacts` by `metadata.referred_by_code`.
- **SGCoin Distribution** (`components/admin/SGCoinDistribution.tsx`) — manual SGC credit batching. Audit-first: every write produces a `customer_reward_credits` row before bumping `profiles.sg_coin_balance`.
- **SGCoin Requests** (`components/admin/SGCoinRequestManager.tsx`) — buyer-submitted SGC requests queue. Approve toggles the matching `marketing_contacts` row to `approved`.
- **Coalition Brain** (`components/admin/BrainManager.tsx`) + **/brain** (`pages/Brain.tsx`) — Brain table editor (mirrors the authed `/brain` route accessed by the founder wallet). One source of truth for `brain_entries` rows.

### Analytics + telemetry

- **Analytics** (`components/admin/AnalyticsDashboard.tsx`) — order totals + revenue + cohort counts. Reads Supabase aggregations direct.
- **Customers** — see [Customer Profile](#customer-profile) above; also has its own IG-handle filter chip per [the IG filter section](#admin-instagram-handle-filter-chips).
- **Verified Buyers** — see [/admin Verified Buyers tab](#admin-verified-buyers-tab) above for the suppression-contract deep dive.

### Product sync workflow (Supabase → constants.ts → GitHub)

The **Sync Code** button on the Products admin tab reconciles `constants.ts` with the current Supabase `products` table and commits the result to `origin/main`. It works in local dev AND in production through the same admin UI.

#### Step-by-step (one button click)

1. Frontend `components/admin/ProductManager.tsx > handleSync` POSTs to `/api/git-operations?action=sync-constants`.
2. The serverless handler (`api/_handlers/git-operations.ts` on Vercel, `server.cjs` locally) fetches every row from `products` via the Supabase **service-role** client — bypasses RLS.
3. Each row is mapped to the `Product[]` shape in `types.ts` — camelCased keys, trimmed strings, normalized categories (legacy `"accessories"` → `"accessory"`). Same shape `scripts/syncProducts.ts` produces.
4. The handler regex-replaces the `export const INITIAL_PRODUCTS: Product[] = [...]` block in `constants.ts` (everything OUTSIDE the block stays untouched).
5. If the file is unchanged → return `{ noChanges: true, hash: <blob-sha> }`, no commit.
6. Otherwise PUT the new content via the **GitHub Contents API** — a real commit on `origin/main` with message `Sync products from Supabase`.
7. Return `{ success: true, hash: <commit-sha> }`. The admin toast shows the hash so the operator can verify on GitHub.

#### Architecture

```
[admin ProductManager.handleSync]
    | POST /api/git-operations?action=sync-constants
    v
[server.cjs]                                                [api/_handlers/git-operations.ts]
(local dev, port 4242)                                     (Vercel serverless)
    |                                                          |
    |                                                          v shared module
    +--> services/githubSync.cjs (syncFileOnGitHub) <----------+
              |
              +--> fetch products via SUPABASE_SERVICE_ROLE_KEY   (Supabase PostgREST)
              +--> GET /repos/{owner}/{repo}/contents/constants.ts (GitHub Contents API)
              +--> apply INITIAL_PRODUCTS regex replace (in-process)
              +--> PUT constants.ts with prior sha                  (GitHub Contents API -> real commit)
```

`services/githubSync.cjs` is the shared helper used by both runtimes. Local Express falls back to `fs + gitService.cjs` only when `GITHUB_TOKEN` is unset (fast local loop, no API).

#### Why GitHub Contents API, not `git commit`

Vercel serverless can’t run `git` — no binary, read-only filesystem (only `/tmp` is writable, doesn’t affect deployed repo). The Contents API commits over HTTPS, so it works in any network-capable runtime — Vercel, Render, Fly, Cloudflare Workers, etc.

#### Required env vars (set in BOTH `.env` locally and Vercel dashboard)

| Var | Used by | Purpose |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | both | read `products` bypassing RLS |
| `SUPABASE_URL` (or `VITE_SUPABASE_URL` fallback) | both | the Supabase project URL |
| `GITHUB_TOKEN` | both | fine-grained PAT with `contents:write` on this repo |
| `REPO_OWNER` | both | `sgctrustyourself-sys` |
| `REPO_NAME` | both | `sgcoalition` |
| `GITHUB_BRANCH` (optional) | both | defaults to `main` |

Mark `SUPABASE_SERVICE_ROLE_KEY` and `GITHUB_TOKEN` as **Sensitive** in Vercel.

#### Branch behavior — what gets committed where

| Runtime | Sync Code hits path | Commits to |
|---|---|---|
| Local dev, no `GITHUB_TOKEN` | local `fs` + `gitService.cjs` (real local commit) | local `main`, manual `git push` to publish |
| Local dev, `GITHUB_TOKEN` set | `services/githubSync.cjs` (Contents API, dev/prod parity) | `GITHUB_BRANCH` (default `main`) |
| Vercel preview (PR branch) | `services/githubSync.cjs` (Contents API, always) | branch the preview was built from (usually `main`) |
| Vercel production | `services/githubSync.cjs` (Contents API, always) | `main` (or `GITHUB_BRANCH` override) |

#### Error surface — what the admin toast says

| HTTP | Cause | Toast text |
|---|---|---|
| **200** `{success, hash}` | catalog diverged → real commit landed | green: `Sync Complete! ...(hash)` |
| **200** `{noChanges, hash}` | catalog already in sync | green: `Already up to date - no changes since last sync (HEAD <hash>)` |
| **500** `{error:"Invalid API key", devOnly:false}` | `SUPABASE_SERVICE_ROLE_KEY` is wrong | operator-fixable: re-paste the `service_role` JWT from Supabase → Settings → API |
| **502** `{error:"GITHUB_TOKEN is invalid or expired."}` | PAT revoked / wrong scope | re-issue the fine-grained PAT with `contents:write` |
| **502** `{error:"GitHub repo or file not found..."}` | wrong `REPO_OWNER` / `REPO_NAME` | fix the env vars |
| **503** `{error:"Sync requires these env vars on this server: GITHUB_TOKEN, ..."}` | one or more GitHub vars missing on Vercel | follow the message — also confirms `contents:write` scope is needed |
| **413** | `constants.ts` would exceed 1 MB after the replace | trim INITIAL_PRODUCTS before syncing |
| **422** | GitHub returned an unsupported encoding | structural issue — encoding value echoed in the message |
| **409** | concurrent edit after a single 409 retry | retry in a few seconds |

#### Local smoke test (Express on port 4242)

```bash
curl -s -X POST 'http://localhost:4242/api/git-operations?action=sync-constants'   -H 'Content-Type: application/json' -d '{}'
```

Returns `{ noChanges: true, hash: <git short-sha> }` when nothing has changed in Supabase, or `{ success: true, hash: <git short-sha> }` after a local git commit.

#### Production verification (post-deploy)

```bash
curl -s -X POST 'https://sgcoalition.xyz/api/git-operations?action=sync-constants'   -H 'Content-Type: application/json' -d '{}'
```

- `{ noChanges: true, hash: "<40-char SHA>" }` → already in sync; hash is the GitHub blob SHA, not a git commit SHA
- `{ success: true, hash: "<40-char SHA>" }` → a fresh commit on `origin/main`; verify at https://github.com/sgctrustyourself-sys/sgcoalition/commits/main

#### One-time GitHub PAT provisioning (operator recipe)

1. Open https://github.com/settings/personal-access-tokens/new
2. Token name: `Coalition Vercel Sync` (or anything memorable)
3. Resource owner: `sgctrustyourself-sys`
4. Repository access: **Only select repositories** → choose `sgctrustyourself-sys/sgcoalition`
5. Permissions → **Repository permissions** → **Contents** → **Read and write**
6. Click **Generate token** — copy it IMMEDIATELY (GitHub only shows it once)
7. Paste into Vercel → Settings → Environment Variables as `GITHUB_TOKEN`, mark Sensitive

#### Other git actions on this endpoint stay dev-only

The `commit`, `log`, `branches`, `checkout`, `reset`, `diff`, `status` actions on `/api/git-operations` still 501 on Vercel (no git binary, read-only FS). Only `sync-constants` is wired through the GitHub API path; the others require the local Express server.

#### Where to read it

- Shared helper: `services/githubSync.cjs`
- Vercel handler: `api/_handlers/git-operations.ts` (`syncConstantsHandler` + the Vercel short-circuit)
- Local handler: `server.cjs` (`case 'sync-constants'` — local priority when `GITHUB_TOKEN` is not set)
- Mapper standalone: `scripts/syncProducts.ts` (same mapping logic, runnable as a CLI for one-off dumps; not the runtime path)
- Product type: `types.ts > Product`
- Client entrypoint: `components/admin/ProductManager.tsx > handleSync`
- Sync API client: `services/imgurService.ts > syncProductsToCode`

### Settings (placeholder)

- **Settings** — placeholder tab in `AdminLayout.tsx > navItems`, currently commented out in the production nav. Reserved for future toggle surfaces (env-var preview, feature flags, rates tables). Surface via `AdminLayout.tsx > navItems` when first wired.
