# Member discount, referral commission, and the Whop promoter cut

How the three "30%"s relate, and what actually happens to the money on a
single order. Written because the three are easy to confuse: two of them are
30% and they sit on opposite sides of different transactions.

**Short version:** the member 30% and the Whop 30% can never be on the same
order, because they live on different checkouts. The only place two
marketing costs meet is a **member buying on the site through a referral
code** — and there the commission is a percentage of what the buyer actually
paid, so the worst case is bounded at 45% of list, not 0%.

---

## 1. The three mechanisms

| | **Member discount** | **Referral program** | **Whop promoter cut** |
|---|---|---|---|
| Side | buyer (price off) | referrer (commission) | promoter (revenue share) |
| Where it applies | the SITE checkout only | the SITE checkout only | WHOP only |
| Who is owed | the buyer | the referrer | the promoter |
| Who pays | Coalition | Coalition | Coalition (via Whop) |
| Size | 30% off items | 5%–40% by tier | 30% of the sale |
| Base | the bundle price (post set-bonus), items only | the amount the buyer actually paid | the sale total on Whop |
| Enforced by | `services/orderIntake.ts` → `resolvePricing` | `utils/referralSystem.ts` + the `track_referral_event` RPC | Whop (affiliate code on the checkout configuration) |
| Blocked from stacking | coupon, crypto incentive, legacy client discount | — | — |

### The member discount is SITE-ONLY, and that is structural

Whop owns the price on a Whop checkout. The member discount is applied by
`resolvePricing` on the site, so it simply does not exist on a Whop order —
there is no code path that could apply it, and no way for a member to
"unlock" 30% off a promoter's Whop link. The buyer's membership is
irrelevant to what they pay through a promoter.

### The one discount per order (the ladder)

`resolvePricing` resolves exactly ONE promotional discount, in this order:

1. **Set bonus** — the bundle *price* (tee + shorts cost $120, not $150).
   Applied first; the member discount is a percentage of what is left, so the
   two do not stack on the same dollars.
2. **Member discount (30%)** — signed-in account holders. Wins outright: a
   member never sees their price go UP by typing a coupon.
3. **Admin coupon** — for everyone else.
4. **Crypto (SGCoin) incentive** — crypto method only, and only when nothing
   above applied.
5. **Store credit** — always, capped at what is owed. Not a markdown: it is
   money the buyer already earned.

Pinned by `tests/discountLadder.test.ts` (22 tests), including an invariant
that asserts exactly one promotional discount across the whole matrix.

---

## 2. The money, per $100 of list price

Shipping is excluded from the member discount (it is charged at cost), so
assume $0 shipping for clarity.

| Scenario | Buyer pays | Referrer gets | Promoter gets | Coalition keeps |
|---|---|---|---|---|
| Guest, site, no referral | $100 | — | — | **$100** |
| Member, site, no referral | $70 | — | — | **$70** |
| Member, site, Tier-1 referrer (5%) | $70 | $3.50 | — | **$66.50** |
| Member, site, Tier-8 referrer (40%) | $70 | $28 | — | **$42** |
| Guest, site, Tier-8 referrer (40%) | $100 | $40 | — | **$60** |
| Whop promoter link, buyer is a member | $100 | — | $30 | **$70** |
| Whop promoter link, buyer is a guest | $100 | — | $30 | **$70** |

Read the last two rows carefully: **the member bought at full price.** Their
membership did not discount the Whop sale — Whop owns that price. Coalition
kept 70% because the promoter took 30%, and the member's 30% never entered
the picture.

### Why Tier 8 + member is $42 and not $30

The referral commission is `orderTotal * commissionRate / 100`, where
`orderTotal` is the amount the buyer **actually paid** (post-discount,
post-credit) — not the list price. So on a member order the referrer earns
40% of $70, not 40% of $100. Coalition keeps 70 − 28 = $42.

That is the correct behaviour, and it is worth keeping: if the commission
were computed on the PRE-discount amount, a referrer could earn $40 on an
order Coalition only collected $70 on, and Coalition would keep $30 — the
acquisition discount and the referrer's tier would both scale down together
against a referrer who did nothing wrong. The current rule means a referrer
only ever earns on money that was actually collected.

The cost of the member discount, in margin terms, is therefore:

| | Coalition keeps |
|---|---|
| Guest order, Tier-8 referrer | $60 |
| Member order, Tier-8 referrer | $42 |
| **Cost of the member offer at Tier 8** | **$18 (18% of list)** |

At Tier 1 it costs $3.50. The discount gets more expensive as the referrer
program matures — worth watching, not worth blocking.

---

## 3. "A new referral arrives and the seller is already getting 30%"

The concrete scenario, and what happens:

### 3a. New person clicks a partner's link, signs up, buys on the site

1. The referral code is captured (`sessionStorage.referralCode`) and the
   click is attributed to the referrer.
2. They create an account. **From that moment they are a member** — every
   order they place is priced with the 30% member discount.
3. They buy. The order is priced with the member discount. The referrer
   earns their tier commission on the amount paid.
4. Coalition keeps what is left: $42 at Tier 8, $66.50 at Tier 1.

This is the only case where both marketing costs land on one order, and it
is bounded (see above). It is also the intended behaviour: the partner
program is the retention lever, the member discount is the acquisition lever,
and a member who arrives through a partner is worth more to Coalition over
their lifetime than the 18% the discount costs on their first order.

### 3b. New person buys through a promoter's Whop link

1. No site checkout happens. The buyer pays the full price on Whop.
2. Whop attributes the sale to the promoter's affiliate code and pays the
   promoter 30%.
3. Coalition keeps 70%, and the order reaches the site through
   `api/whop-webhook.ts` → `reconcilePayment`.
4. The buyer's membership is irrelevant. **There is no member discount on
   this order, and there is no referral commission either** — the referral
   program is a site mechanism, and a Whop sale never touches it.

### 3c. The abuse case: a member buys through their OWN Whop link

Coalition would pay 30% of the sale to a promoter who is also the buyer.
The member discount does not apply (it is a Whop sale), so the loss is the
promoter's 30% — Coalition keeps 70% of a sale it could have made at 100%.

Whop's affiliate attribution is Whop's side, so Coalition cannot block this
at the API. What Coalition controls:

- **Do not issue a link to a promoter for their own purchase.** The link is
  minted by an admin (`POST /api/create-whop-checkout-link`, admin-gated),
  so it is a human decision, and the affiliate code is per promoter.
- The site's own referral program already blocks the equivalent case at four
  independent layers (`trackReferral`, `processReferralOnPurchase`,
  `trackSignupReferral`, and the `track_referral_event` RPC): a user cannot
  use their own code.

### 3d. A member is also a promoter — no conflict

A promoter's membership discounts THEIR OWN site purchases. Their
promoter cut is earned on sales THEY made. The two are separate, and a
buyer who happens to be a member pays full price on the promoter's Whop
link — which means the promoter is the only one taking a cut, and Coalition
keeps 70% of a sale it did not have to discount.

---

## 4. What each of these is FOR (and that is why they coexist)

| Mechanism | Job | Success metric |
|---|---|---|
| Member discount | turn a guest into a contact: email, name, phone, address | new accounts, and contact reachability |
| Referral program | turn a member into a promoter who recruits buyers | referred orders, tier progression |
| Whop promoter cut | reach an audience that is NOT on the site, at zero discount cost | promoter-attributed sales, new eyes |

The member discount is the expensive one — it costs margin on every member
order. It buys a member and a contact. The Whop cut costs 30% only on sales
that would not otherwise have happened, and it discounts nothing. Those are
very different economics and they are the reason both are worth having.

---

## 5. The rules as they stand (and where they live)

| Rule | Enforced in |
|---|---|
| One promotional discount per order | `services/orderIntake.ts` → `resolvePricing` |
| Member discount only for a real account | `resolvePricing` (a UUID userId) |
| Member discount not on shipping | `resolvePricing` (items only) |
| The member discount beats the coupon | `resolvePricing` (ladder) + `couponSuppressed` in the preview response |
| The crypto incentive does not stack | `resolvePricing` + `cryptoDiscountSuppressed` |
| Store credit is capped at what is owed | `resolvePricing` |
| A user cannot use their own referral code | 4 layers (see 3c) |
| The Whop channel can be switched off | `services/paymentSettings.ts` → `whop` flag → gates `POST /api/create-whop-checkout-link` |
| A Whop link is priced by the server, not the caller | `api/_handlers/create-whop-checkout-link.ts` (reads the `products` table) |
| A Whop link can only be minted by an admin | `withAdminAuth` on the same handler |

---

## 6. Decisions taken (owner signed off, 2026-10-20)

These were judgement calls, not bugs. Each one is now settled — the
recommendation is what the code does, and the alternative is recorded so the
reasoning survives.

1. **Does the member discount apply to an order that carries a referral
   code?** **Yes.** The discount is what grows the base the referrer earns
   on, and the commission is computed on the amount the buyer actually paid,
   so the worst case is $42 of $100 at Tier 8. The alternative (commission on
   the pre-discount amount) would cost up to $10 more per order at Tier 8 and
   make a partner's tier erode against an offer the partner did not create.
2. **Should the member discount be reduced for members who arrive through a
   partner?** **No.** Not unless a Tier-8 partner's volume starts to
   dominate the order book.
3. **Should a member's discount be worth more on their first order?**
   **Not yet.** A first-order boost is a classic acquisition pattern, but it
   needs a per-order history field the pricing authority does not have
   today. Get the volume first.
4. **Should the Whop promoter cut be tiered to match the referral program?**
   **No — it stays flat at 30%.** A promoter who moves 100 units should not
   need a tier table to be worth working with, and tiering it would mean
   either moving the tier table to Whop or paying promoters manually out of
   Coalition's own ledger. The rate itself is set on the Whop product
   (`global_affiliate_percentage` in the Whop dashboard); the site only
   attaches the promoter's `affiliate_code`, which is what
   `POST /api/create-whop-checkout-link` does.

### What "no stacking" means in practice, restated

- The member discount beats an admin coupon and beats the SGCoin incentive.
- A coupon beats the SGCoin incentive.
- Store credit is always honored on top (it is the buyer's own money) and is
  capped at what is owed.
- The set bonus is the bundle PRICE, not a markdown, and the member
  discount is a percentage of the post-bonus amount — so the two never
  compound on the same dollars.
- A Whop sale carries NO member discount, because Whop owns that price.
