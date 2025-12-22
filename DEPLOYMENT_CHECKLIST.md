# Vercel Deployment Checklist

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
