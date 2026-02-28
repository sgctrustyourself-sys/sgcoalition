# Daily Build Log: Feb 9, 2026

## 1. Daily Numbers
- **Started with**: $500 (Baseline for infra & inventory)
- **Spent**: $0 (Today was pure 12-hour grind on UI & strategy)
- **Balance**: $500

## 2. Infrastructure Updates
- **Micro-funding Introduced**: Added "Support the Build" section to the Buy SGCoin page. This allows supporters to tip via SOL/ETH or CashApp.
- **Brand Archetype Defined**: Committed to the "Underdog Operator" persona. Shifted from "Promises" to "Proof".
- **PayPal Verification**: Reviewed integration. Everything ready for direct SGCOIN purchases.

## 3. What Failed
- **Build Pipe Break**: Discovered a constant import error in the QuickSwap tutorial (`SGCOIN_CONTRACT_ADDRESS` vs `SGCOIN_V2_CONTRACT_ADDRESS`). 
- **Fix**: Synchronized all tutorial constants to point to the V2 contract. Build is green.
- **Site Refresh Issues**: Users reported 404s on refresh.
- **Fix**: Updated Service Worker (v2) to handle SPA navigation requests and added Vercel rewrite rules.

### Day 1 Update (Post-Launch)

## Day 2: Reality Check
**Date**: Feb 09, 2026

### 🚧 The Struggle
- **Issue**: "Black Screen of Death" at the root domain (`sgcoalition.xyz`).
- **Root Cause**: A legacy `basename="/CoalitionOS"` configuration was hardcoded in the deployment, preventing the app from matching the root path.
- **Fix**: 
  1. Transitioned from `HashRouter` to `BrowserRouter` for cleaner URLs.
  2. Anchorized the app to the root (`/`) and cleaned up legacy hash redirects.
  3. Bumped Service Worker to `v3` to force a clean update.
- **Victory**: Navigation is now professional (`/shop` instead of `/#/shop`) and the site is stable at the root domain.

### 📉 The Numbers
- **Hours spent debugging**: ~4.0 (total)
- **Lines of code changed**: ~120
- **Cost**: $0 (but +100 XP in Vercel routing)

---
## 4. What I Learned
- People don't want to fund a coin; they want to fund a *process*. By showing the grind before the token, we build a foundation that hype can't touch.
- "No pressure. Just trust." - This mantra needs to be everywhere.
