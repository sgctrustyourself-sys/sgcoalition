# Domain cutover runbook — `sgcoalition.shop` → Vercel

Moving `sgcoalition.shop` off the Whop-hosted storefront onto this Vercel
deployment. Written 2026-10-20, updated the same day after the storefront
was moved back to `sgcoalition-five.vercel.app`.

## Decision: this is not planned

The transfer below is **not being done**. The storefront's canonical origin is
`https://sgcoalition-five.vercel.app` and stays there: it is what `VITE_APP_URL`,
`SITE_ORIGIN`, the canonical and OG tags, the sitemap, the robots line, the CORS
echo and every transactional email link name.

This file is kept only as the record of what a transfer out of Whop would
involve, should that decision ever be revisited. Nothing in the app, the deploy
pipeline or the post-deploy gate waits on it.

## The two URLs, up front

| Role | URL | What it is |
| --- | --- | --- |
| **Storefront origin** | `https://sgcoalition-five.vercel.app` | The site. `VITE_APP_URL` and `SITE_ORIGIN`; canonical/OG tags, transactional email links, the CORS echo, the sitemap, the robots line, the webhook URLs. |
| **Main sharing link** | `https://linktr.ee/sgcoalition` | What the brand prints when it says "link in bio". The linktree carries the portfolio next to the shop, so one URL does both jobs. |

They are different things and they are not interchangeable. Changing the
storefront origin must never change the sharing link, and vice versa.
`tests/downDomain.test.ts` pins both halves: no source file may point at a
retired host, and the storefront origin may not be a linktree.
`tests/sharingLink.test.ts` pins the other direction: the sharing link IS
the linktree, every drop poster prints that same link, and the storefront
itself (footer, about page, product page) links the portfolio next to the
shop.

## Why the domain has to be transferred

`sgcoalition.shop` was bought through Whop, and Whop runs its DNS
(nameservers `ns1.whop-dns.com` / `ns2.whop-dns.com`). Whop's Domains API
exposes `name_servers` only as read-only registry data — it is not a
settable field — so there is no supported way to hand the domain to
Vercel's nameservers while Whop holds the registration.

The only route to the apex on Vercel is a transfer out of Whop.

```
Registrar (Name.com)  <-- upstream reseller
   ^
   |  auth code + unlock
   v
Whop (reseller, holds the registration, runs the DNS)
   |
   |  transfer
   v
Your registrar (Name.com / Cloudflare)  -->  nameservers -->  Vercel
```

## Current state (verified 2026-10-20)

| Host | Serves | `/api/stripe-webhook` |
| --- | --- | --- |
| `sgcoalition-five.vercel.app` | this deployment | live, verifying signatures |
| `sgcoalition.shop` | Whop's "Nothing here yet" 404 page | 404 — no such route |
| `sgcoalition.xyz` | Vercel, deployment disabled | 402 `DEPLOYMENT_DISABLED` |

Production `VITE_APP_URL` is `https://sgcoalition-five.vercel.app` — the host
this deployment actually serves. The CORS header on every `/api/*` response
echoes it, and it is the canonical origin in `utils/seo.ts` (canonical/OG
tags, sitemap, robots).

Two hosts are retired and **nothing may point at either**:

- `sgcoalition.xyz` answers 402 and has no MX records, so the address that
  used to live on it cannot receive mail either.
- `sgcoalition.shop` still resolves, but the Whop app was detached from it
  and the apex now serves Whop's empty "Nothing here yet" page. A link
  there lands a customer on a blank page, not on the shop.

No paid order has landed since 2026-09-23 and the `shipments` table is
empty, so nothing has been lost yet. The webhook breakage is **latent,
not yet costly** — it becomes costly the moment traffic arrives.

## The order that matters

Two of these are silent failures. A webhook aimed at a host that does not
serve this deployment never arrives, so no error is raised anywhere: the
app looks healthy while paid orders never reconcile and shipping labels
are never bought. Fix the webhooks **before** the DNS moves, and verify.

---

### 1. Whop — get the auth code and release the lock

The domain's RDAP status is `client transfer prohibited, add period` — the
standard post-registration transfer lock. Whop models it as a first-class
state (`transfer_locked` in the Domains API issue codes).

- Whop Dashboard → **Domains** → `sgcoalition.shop`
- Start the transfer, or contact Whop support to release the lock and
  issue the **EPP auth code**

**Do not** send `registration: null`. The API scopes that to "release an
unpaid or failed purchase"; on a healthy paid registration it would move
the domain into `releasing` and could stop the renewal.

### 2. Transfer in, then hand the domain to Vercel

- **Name.com** — transfer in, then set nameservers to
  `ns1.vercel-dns.com` / `ns2.vercel-dns.com`
- **Cloudflare Registrar** — cheapest, but it does *not* allow custom
  nameservers. Use Cloudflare DNS and point records at Vercel instead:
  A record `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`

### 3. Vercel — project `coalition-brand`

- Settings → **Domains** → Add `sgcoalition.shop` → it returns the
  nameservers (or records) from step 2
- Settings → **Environment Variables** → `VITE_APP_URL` =
  `https://sgcoalition.shop`, **Production** scope at minimum
  (it is `https://sgcoalition-five.vercel.app` until the transfer lands)
- **Redeploy.** `VITE_` vars are inlined at build time; without a
  redeploy the running bundle still carries the old origin.

### 4. Stripe and Shippo — the silent ones

- Stripe → Developers → Webhooks → `https://sgcoalition-five.vercel.app/api/stripe-webhook`
- Shippo → `https://sgcoalition-five.vercel.app/api/shippo-webhook?token=...`

These move to the apex in the same session as the DNS change, or payments
keep reconciling against the old host.

Confirm neither endpoint is still pointing at `sgcoalition.xyz` or
`sgcoalition.shop` — one answers 402 and the other serves an empty Whop
page, so a webhook aimed at either has been failing silently.

### 5. Whop — stop serving the app on the domain

**Done** (2026-10-20): the domain was detached from the Whop app, which is
why the apex now serves Whop's "Nothing here yet" page. The remaining work
is the transfer itself.

Dashboard: remove the domain from the app. Or via the API:

```
PATCH /domains/{id}   { "website": null }
```

"Pass null to stop serving it; the domain keeps its other capabilities."

### 6. Verify

```bash
# Does the host actually serve the webhook handler, and does the secret match?
STRIPE_WEBHOOK_SECRET=<the endpoint's secret> npm run verify:webhook -- https://sgcoalition-five.vercel.app

# The health probe reports the configured origin next to the serving host.
curl -s https://sgcoalition-five.vercel.app/api/health | jq '.origin'

# The full browser checkout.
npm run smoke:checkout
```

`verify:webhook` signs a synthetic `payment_intent.succeeded` event with
no `order_id` in its metadata. The handler takes its documented
"expected for off-checkout payments" branch: it logs, returns 200, and
touches no order and sends no admin email. It is safe against production.

The admin Command Center shows the same information: **Admin → Payment
Processing**. A host mismatch raises a warning naming the exact webhook
URLs to paste into the Stripe and Shippo dashboards.

## After the move

The 30% Whop affiliate program does not travel. Whop's affiliate
tracking only fires on Whop checkout, so with the storefront on Vercel
the site's own tiered program (5%–40% in `utils/referralSystem.ts`) is
the only referral program. Whop's marketplace affiliate offer still
works for a Whop-hosted store, if one is kept.

`sgcoalition.xyz` currently answers 402. Reattach it to the same project
or let it go — but never point a webhook at it.

## Where each URL lives in the repo

| Surface | File | Value |
| --- | --- | --- |
| Canonical origin | `utils/seo.ts` (`SITE_ORIGIN`) | storefront origin |
| CORS echo / public origin | `api/_helpers.ts` (`DEFAULT_PUBLIC_ORIGIN`) | storefront origin |
| SEO generator | `scripts/generateSeoArtifacts.mjs` (`SITE_ORIGIN`) | storefront origin |
| Environment template | `.env.production.template` (`VITE_APP_URL`) | storefront origin |
| Vercel env guard | `scripts/verify-app-url.mjs` (post-deploy gate) | storefront origin — fails the deploy unless the live `VITE_APP_URL` is the canonical origin |
| **Main sharing link (the one owner)** | `utils/sharingLinks.ts` (`MAIN_SHARING_LINK`, `MAIN_SHARING_LABEL`) | main sharing link |
| Portfolio link in the footer, about page, product page, mobile nav, announcement bar | `components/Footer.tsx`, `pages/About.tsx`, `pages/ProductDetails.tsx`, `components/MobileBottomNav.tsx`, `components/AnnouncementBar.tsx` | main sharing link (imported, never pasted) |
| Drop copy decks, story/grid/x slides, reel CTAs | `scripts/story-reveal-specs/drops.ts` (`shopUrl`, CTA `url`), `scripts/reels/*.html` | main sharing link |

The sharing link has one owner. `utils/sharingLinks.ts` holds the URL; the
app surfaces import it, the drop registry imports it. Nothing pastes
`linktr.ee/sgcoalition` into a second place by hand — `tests/sharingLink.test.ts`
fails if one does, and if a second linktree handle ever appears.

Regenerate the generated SEO artifacts after any origin change:
`npm run generate:seo` (sitemap, robots, static page meta). The drop docs
come from `npm run drop:docs`.
