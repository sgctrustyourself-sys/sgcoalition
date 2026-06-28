# Vercel Deployment Checklist

> **Docs index:** [`docs/README.md`](./docs/README.md) (trio · drops registry) · [`README.md`](./README.md) (project + local dev).

To resolve the Supabase connection issues and ensure all 4 products are visible on [sgcoalition.xyz](https://sgcoalition.xyz), please follow these steps:

## 1. Verify Vercel Environment Variables
Go to your Vercel Project Settings > Environment Variables and ensure the following are set for **Production**, **Preview**, and **Development**:

- **VITE_SUPABASE_URL**: Should be your Supabase Project URL (e.g., `https://xyz.supabase.co`)
- **VITE_SUPABASE_ANON_KEY**: Should be your Supabase Anon/Public Key.

> [!IMPORTANT]
> **UPDATE:** I have just committed a fix to `AppContext.tsx`. The previous version had a bug that caused the site to show "No products match your criteria" if Supabase was not connected. 
> 
> Once you **REDEPLOY** in Step 3, the site will correctly fall back to the 4 initial products (NF-Tee and Wallets) even if your Supabase keys are still being sorted out.

> [!IMPORTANT]
> Ensure there are no leading/trailing spaces in the values. Use the "Plaintext" view to double-check.

## 2. Check for "Build Time" vs "Runtime"
In Vercel, Vite environment variables (starting with `VITE_`) must be available at **Build Time**. If you added them recently, you **MUST** trigger a new deployment for them to be embedded in the JavaScript bundle.

## 3. Trigger a Fresh Deployment
1. Go to the **Deployments** tab in Vercel.
2. Find the latest deployment.
3. Click the three dots (...) and select **Redeploy**.
4. Ensure "Use existing Build Cache" is **NOT** checked (to ensure a clean build with the latest `constants.ts`).

## 4. Verify in Browser
After the deployment finishes:
1. Open [sgcoalition.xyz/#/shop](https://sgcoalition.xyz/#/shop) in an Incognito/Private window (to bypass any local cache).
2. Check the browser console (F12) for any "Supabase connection" errors.
3. Confirm all 4 products are visible:
    - [ ] Coalition NF-Tee
    - [ ] Custom Coalition x Chrome Hearts Wallet
    - [ ] Coalition Green Camo Wallet
    - [ ] Coalition Skyy Blue Wallet

## 5. PayPal Checkout Readiness
Apply `supabase/migrations/20260617_add_paypal_order_fields.sql`, then set these Vercel environment variables for the target environment:

- `VITE_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENV` (`sandbox` for preview testing, `live` for production)
- `VITE_APP_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ORDER_NOTIFICATION_EMAIL`

PayPal smoke test:

1. Redeploy after changing `VITE_PAYPAL_CLIENT_ID`; it is embedded at build time.
2. Add a physical product to cart and complete checkout with a PayPal sandbox buyer first.
3. Verify Supabase has exactly one paid `orders` row with `paypal_order_id` and `payment_reference`.
4. Verify the PayPal dashboard capture amount equals the Supabase `orders.total`.
5. Repeat the same flow with live credentials only after the sandbox flow passes.
