# Domain cutover runbook — `sgcoalition.shop` → Vercel

Moving `sgcoalition.shop` off the Whop-hosted storefront onto this Vercel
deployment. Written 2026-10-20.

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
| `sgcoalition.shop` | Whop app `app_5CA056S8qOljcB` | 404 — no such route |
| `sgcoalition-five.vercel.app` | this deployment | live, verifying signatures |
| `sgcoalition.xyz` | Vercel, deployment disabled | 402 `DEPLOYMENT_DISABLED` |

Production `VITE_APP_URL` is `https://sgcoalition.xyz` — a domain that
answers 402. The CORS header on every `/api/*` response still echoes it.

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
- **Redeploy.** `VITE_` vars are inlined at build time; without a
  redeploy the running bundle still carries the old origin.

### 4. Stripe and Shippo — the silent ones

- Stripe → Developers → Webhooks → `https://sgcoalition.shop/api/stripe-webhook`
- Shippo → `https://sgcoalition.shop/api/shippo-webhook?token=...`

Confirm the Stripe endpoint URL was not pointing at `sgcoalition.xyz`
already — that host answers 402, so such a webhook has been failing
silently.

### 5. Whop — stop serving the app on the domain

Dashboard: remove the domain from the app. Or via the API:

```
PATCH /domains/{id}   { "website": null }
```

"Pass null to stop serving it; the domain keeps its other capabilities."

### 6. Verify

```bash
# Does the host actually serve the webhook handler, and does the secret match?
STRIPE_WEBHOOK_SECRET=<the endpoint's secret> npm run verify:webhook -- https://sgcoalition.shop

# The health probe reports the configured origin next to the serving host.
curl -s https://sgcoalition.shop/api/health | jq '.origin'

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
