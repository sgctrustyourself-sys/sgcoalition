# The Trusted Few — Partner Program Design

**Date:** 2026-08-06
**Status:** Approved (tier naming, 20% flat Trust Circle rate, form fields, sunset retirement all confirmed by owner)

## 1. Overview

Replace the existing "Referral Program" (scheduled to sunset Dec 31, 2026) with **The Trusted Few** — a permanent, two-tier partner program:

- **The Trusted Few** — the program name for every account holder. They earn commission by sharing their code/link. This is the existing referral engine, rebranded, with the sunset/vote messaging removed.
- **Trust Circle** — the inner branding team. Higher flat commission (20%), free product on drops, early access, a site profile. Members enter via **admin invite** or a **brand-voice application form**; admin approves/declines with full customer context.

Internal schema keeps its `referral_*` names (schema renames are churn with zero user value). Only user-facing copy changes. One commission engine, one analytics pipeline, one tier flag.

## 2. Tiers & Perks

| | The Trusted Few | Trust Circle |
|---|---|---|
| Who | Every account holder | Hand-picked / approved brand team |
| Commission | Existing 8-tier progression (5% → 40%) | Flat **20%** override (immune to tier recompute) |
| Code / link | Yes (customizable once) | Yes (same) |
| Free drops | — | 100%-off voucher issued per drop by operator |
| Early access | — | Yes (announced via email/notification) |
| Site profile | — | Listed in a "Trust Circle" showcase |
| Sunset/vote banner | Removed | Removed |

## 3. Data Model — one additive migration

**`referral_stats` — add columns:**
- `partner_tier TEXT NOT NULL DEFAULT 'trusted_few'` (`'trusted_few' | 'trust_circle'`)
- `trust_circle_commission_rate NUMERIC(5,2)` (20.00 when in circle)
- `invited_at TIMESTAMPTZ` (admin invite timestamp)
- `circle_member_since TIMESTAMPTZ`

**New table `trust_circle_applications`:**
- `id UUID PK DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES auth.users(id)`
- `status TEXT NOT NULL DEFAULT 'pending'` (`pending | approved | declined`)
- `why_join TEXT`, `what_you_create TEXT`, `platforms TEXT[]`, `handles JSONB` (ig/tiktok/youtube/x), `audience_size TEXT`, `portfolio_url TEXT`
- `created_at TIMESTAMPTZ DEFAULT now()`, `reviewed_at TIMESTAMPTZ`, `reviewed_by UUID`, `review_note TEXT`
- Unique partial index: one pending application per user (`UNIQUE (user_id) WHERE status = 'pending'`)
- RLS: follow the codebase's established pattern (consistent with `custom_inquiries` and `referral_stats`): INSERT with `WITH CHECK (user_id = auth.uid())` so users can only file their own application; SELECT `USING (true)` and permissive UPDATE so the admin dashboard (gated by `ADMIN_WALLETS` in the UI) can read and review client-side. Note: this mirrors the existing lax posture — harden later by moving review writes behind a SECURITY DEFINER RPC.

**RPC change (`track_referral_event`):** when the referrer's `partner_tier = 'trust_circle'`, set `current_commission_rate = trust_circle_commission_rate` (and keep tier at current value) instead of recomputing from successful_referrals. Prevents the tier ladder from clobbering the flat rate on the next analytics event.

**Drop vouchers:** no new checkout math. Operator issues a one-time 100%-off voucher from the admin Trust Circle tab by **creating a coupon via the existing coupon system** (`coupons` table + `utils/couponSystem.ts` — same path the admin already uses for manual coupons). Mark it in a lightweight `drop_vouchers` ledger (member, coupon_code, status, issued_at) so the admin can see who got what per drop. If the coupon shape doesn't fit, fall back to a standalone `drop_vouchers` table; simplest thing that works first.

## 4. Customer-Facing Changes

- **`components/ReferralDashboard.tsx`** → rebrand to "The Trusted Few":
  - Header/hero copy, tier cards, commission table keep the existing stats but speak the new language
  - **Delete** the sunset banner, `PROGRAM_SUNSET_DATE`, `VOTE_RECOMMENDED_WINDOW`, `VOTE_BLOG_SLUG`, and the localStorage dismiss key
  - Trust Circle section (replaces nothing — new):
    - *Member:* "Welcome to the Trust Circle" — flat 20% rate, drop allowance, profile status
    - *Invited:* "You've been invited" banner → Accept (flips tier) / Decline
    - *Everyone else:* "Join the Trust Circle" card → Apply button
- **New `pages/TrustCircle.tsx`** (route `/trust-circle`): the brand-voice application form — *Why do you want in? What do you create? Where do you post (IG/TikTok/YouTube/X handles)? How big is your audience + where? Link to your content.* Order history + referral stats auto-attach server-side (no typing). Post-submit: confirmation state, one application per user enforced.
- **`pages/Profile.tsx`:** "Referrals" tab renamed "Partner Program" (or "Trusted Few"); keep lazy import; Trust Circle quick-access card if member.
- **`pages/OrderSuccess.tsx` / `pages/ProductDetails.tsx`:** copy-only tweaks where they say "referral" — "earn commission" language stays, brand names change.

## 5. Admin Changes

**New admin tab "Trust Circle"** in `pages/Admin.tsx` (new `components/admin/TrustCircleManager.tsx`, lazy-loaded like the rest):

1. **Applications queue** — pending apps listed with inline context: applicant order count, total spend, referral stats, member since. Approve / Decline (+ optional note). Approve flips `partner_tier` and stamps `circle_member_since`.
2. **Invite** — search any user by email/name, send invite (sets `invited_at`; user sees banner on next dashboard visit).
3. **Members** — current circle list with rates, revoke (flips back to `trusted_few`, clears circle fields).
4. **Drop credit** — issue a 100%-off voucher to a member (MVP operator-driven).

**Retire:** `admin/ReferralAnalytics.tsx` tab label → "Trusted Few" (or keep "Referrals" internally); README/FOLLOWUPS sunset notes updated.

## 6. Services Layer (mirror `services/customInquiry.ts` pattern)

- `services/trustCircle.ts`: `getMembership(userId)` (tier + circle fields), `submitApplication(data, userId)`, `getMyApplication(userId)`, `getApplications()`, `reviewApplication(id, approve, note, adminId)`, `inviteUser(userId, adminId)`, `revokeMember(userId, adminId)`.
- All reads/writes via Supabase with the RLS policies above; no new API route needed (client + RLS, same as inquiries).

## 7. Testing

- Migration idempotency check (additive, `IF NOT EXISTS`, runnable twice)
- `tests/trustCircle.test.ts`: tier default, application uniqueness, approve flips tier, decline leaves tier, flat-rate survives a `track_referral_event` (RPC override)
- Rebrand regression: existing `tests/referralFlows.test.ts` etc. keep passing (engine untouched)
- Typecheck + full vitest suite

## 8. Non-Goals (this iteration)

- Self-serve free-drop checkout logic (operator issues vouchers)
- Circle member public showcase page (site profile) — announced, built after core flow is live
- Schema renames of `referral_*` tables
- Marketing-cookie/automation for the circle

## 9. Rollout Order

1. Migration (additive) + RPC tweak
2. `services/trustCircle.ts` + tests
3. Dashboard rebrand (delete sunset) + Trust Circle section
4. `/trust-circle` application page
5. Admin Trust Circle tab (queue / invite / members / drop credit)
6. Copy sweep (Profile tab label, OrderSuccess, ProductDetails, README/FOLLOWUPS)
7. Full suite + deploy
