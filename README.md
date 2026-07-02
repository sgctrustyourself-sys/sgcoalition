<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

> **Docs index:** [`docs/README.md`](docs/README.md) — drop template trio (kit + deck + storyboard), drops registry, project doc map.

# Coalition Brand - E-commerce Platform

Premium streetwear e-commerce platform built with React, Vite, and Stripe.

## Features

- 🛍️ **Product Catalog** - Browse and shop premium streetwear
- 💳 **Stripe Checkout** - Secure payment processing with card and crypto options
- 📧 **Order Confirmation** - Automated email receipts via Resend
- 🪙 **SGCoin Rewards** - Loyalty program with every purchase
- 🔗 **NFT Integration** - Products linked to Polygon NFTs
- 📱 **Responsive Design** - Mobile-first, beautiful UI

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

## Current Product Catalog Baseline

Last verified on July 2, 2026 against the live Supabase `products` table, then compared with `INITIAL_PRODUCTS` and `PRODUCT_LOCAL_OVERRIDES`.

Use this section as the starting point when a product disappears, has the wrong price, lands in the wrong category, or shows the wrong badge. The app's catalog merge order is:

1. Live Supabase row wins for matching product IDs.
2. Local-only `INITIAL_PRODUCTS` rows are appended so code-only products do not vanish.
3. `PRODUCT_LOCAL_OVERRIDES` is applied last.

If a live Supabase row exists, the Supabase price is the current storefront price. If no live row exists, the local fallback price is the current storefront price. This baseline has 24 merged products: 13 active and 11 archived/sold. The live Supabase query returned 17 rows with 17 unique product IDs.

### Active Products

| ID | Product | Price | Category | Status | Inventory | Source |
| --- | --- | ---: | --- | --- | --- | --- |
| `Coalition_Above_As_Below_Wallet_1_1` | COALITION ABOVE AS BELOW 1/1 WALLET | $85 | wallet | Live | stock 1; One Size: 1 | Supabase + local overrides |
| `Coalition_Grey_Wave_Wallet_2_2` | Coalition 'Grey Wave' Wallet 2/2 | $75 | wallet | Live | stock 1; One Size: 1 | Supabase + local |
| `Coalition_NF_Tee` | COALITION NF-TEE | $40 | shirt | Live | stock 350; size map S:1 M:1 L:1 XL:1 | Supabase + local |
| `prod_1773860269374` | Coalition Shark Tee - 1/1 Exclusive | $60 | shirt | Live | stock 1; S:1 M:0 L:0 XL:0 | Supabase + local |
| `prod_halo_mini_dress` | COALITION HALO MINI DRESS | $50 | dress | Live, standard release | stock 50; S:12 M:13 L:13 XL:12 | Supabase + local overrides |
| `prod_hoodie_overwhelmingly_patient` | COALITION OVERWHELMINGLY PATIENT HOODIE | $100 | sweatshirt | Live pre-order | stock 5; S:1 M:1 L:1 XL:1 2XL:1 | Supabase + local overrides |
| `prod_set_above_as_below` | COALITION ABOVE AS BELOW SET | $120 | apparel | Live set offer | stock 20; S:4 M:4 L:4 XL:4 2XL:4 | Supabase + local overrides |
| `prod_shorts_above_as_below` | COALITION ABOVE AS BELOW SHORTS | $75 | shorts | Live | stock 44; S:9 M:9 L:9 XL:9 2XL:8 | Supabase + local |
| `prod_tee_above_as_below` | COALITION ABOVE AS BELOW TEE | $75 | shirt | Live | stock 44; S:9 M:9 L:9 XL:9 2XL:8 | Supabase + local overrides |
| `prod_tee_distortion` | COALITION DISTORTION TEE | $60 | shirt | Live local fallback only | no live stock row | Local fallback only |
| `prod_womens_above_as_below_contrast_shorts` | WOMEN'S COALITION ABOVE AS BELOW CONTRAST SHORTS | $40 | shorts | Live | stock 4; S:1 M:1 L:1 XL:1 | Supabase + local overrides |
| `prod_womens_above_as_below_crop_tank` | WOMEN'S COALITION ABOVE AS BELOW CREWNECK CROP TANK | $40 | shirt | Live | stock 4; S:1 M:1 L:1 XL:1 | Supabase + local overrides |
| `prod_womens_above_as_below_set` | WOMEN'S COALITION ABOVE AS BELOW SET | $75 | apparel | Live set offer | stock 4; S:1 M:1 L:1 XL:1 | Supabase + local overrides |

### Archived Or Sold Products

| ID | Product | Price | Category | Status | Inventory | Source |
| --- | --- | ---: | --- | --- | --- | --- |
| `Coalition_Grey_Wave_Wallet_1_2` | Coalition 'Grey Wave' Wallet 1/2 | $75 | wallet | Archived/sold | stock 0; One Size: 0 | Supabase + local overrides |
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
