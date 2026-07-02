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
- **Email**: Resend API
- **Blockchain**: Ethers.js for Web3 integration
- **Deployment**: Vercel

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

4. Start the API server:
   ```bash
   node server.js
   ```

5. Start the dev server (in a new terminal):
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

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

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy to Vercel:
```bash
vercel
```

## Project Structure

```
├── api/                    # Vercel serverless functions
├── components/             # React components
├── context/               # React context providers
├── pages/                 # Page components
├── public/                # Static assets
├── services/              # API services
├── server.js              # Local API server
├── vite.config.ts         # Vite configuration
└── vercel.json            # Vercel deployment config
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
