# Pieces Proposal — what we can build from the items on hand

**Date:** 2026-10-16 · **Status:** proposal — **Parts 3/4 + 4/4 built 2026-10-16** (see [§9](#9-outcome-2026-10-16)); social render pending Chromium
**Scope decided:** short-form **reels** + **drop kits** for un-kitted items.
**Focus item(s):** Coalition 'Parts' Wallet **3/4 + 4/4** — the closing of the run.
**Parked:** Halo Mini Dress (see [§6](#6-parked-halo-mini-dress)).

> Pair with: [`drops-registry.md`](drops-registry.md) (the ledger + workflow) · [`README.md`](README.md) (doc index) · [`../scripts/story-reveal-specs/drops.ts`](../scripts/story-reveal-specs/drops.ts) (the single owner of every drop).

---

## 1. How a "piece" gets made

A drop piece is **not hand-written docs**. It is one object literal in `scripts/story-reveal-specs/drops.ts`, and that entry fans out to every surface:

| Consumer | Reads | Produces |
|---|---|---|
| `scripts/render-story.ts` | `spec` | social PNGs at 1080×1920 / 1080×1350 / 1200×628 |
| `scripts/generateDropDocs.ts` | `spec` + `copy` | the kit + copy trio, plus the registry row |
| `scripts/upsertDropProduct.ts` | `listing` | the Supabase products row, then reseeds `constants/products.ts` |
| `scripts/generateDropPost.ts` | `copy.post*` | the `drop`-category blog post |
| Marketing tab (`/admin?tab=marketing`) | `dropId` grouping | one campaign per drop day |

`tests/dropRegistry.test.ts` fails the suite if the price, the run size, the five slides, or the copy ever disagree across surfaces. So a piece is a **data entry + photos**, and the tests are the guardrail.

**Two rules that decide readiness:**

1. **Photos.** A shippable piece needs `public/images/<slug>-front.png` + `<slug>-back.png`. The registry tolerates a mid-shoot draft via `awaitingPhotos: true`, but nothing renders without the PNGs.
2. **The reel recipe is gated to 1/1 or hard-cap drops — "not evergreen catalog"** ([`../README.md`](../README.md) §*Reel + post recipe*, line ~1895). A numbered, one-unit-left run qualifies; a restockable evergreen SKU does not.

---

## 2. What's on hand (survey)

**Only 5 drops have ever been built:** grey-wave, pink-silver-crop-top, coalition-fleece-hoodie (draft, `awaitingPhotos`), above-as-below-thermal (draft, `awaitingPhotos`), ghost-riders-after-dark.

**Un-kitted live items** (photos in the catalog, no piece built):

| Item | Price | Notes |
|---|---|---|
| **Coalition 'Parts' Wallet 3/4** | **$45** | live, 1 unit, numbered run closing |
| **Coalition 'Parts' Wallet 4/4** | **$60** | live, 1 unit, the closing piece |
| Above as Below 1/1 Wallet | $85 | live, 1 unit |
| Coalition Shark Tee 1/1 | $40 | live (S:1) |
| Above as Below line — Tee / Shorts / Set | $75 / $75 / $120 | live, real stock |
| Women's Above as Below — Tank / Shorts / Set | $40 / $40 / $75 | live, 1 unit each |
| Halo Mini Dress | $50 | live, **12–13 per size** (only real inventory) — parked |
| Halo Contrast Tee | $40 | live, 1 per size |
| Overwhelmingly Patient Hoodie | $100 | pre-order, 1 per size, chakra narrative |
| Coalition NF-Tee | $40 | live, NFC / phy-gital |
| Unity No. 4 Polo | $400 | live, featured, high-ticket |
| The sold archive (14 items) | — | Camo, Chrome Hearts × Coalition, Racing Team 1–4, True Religion, Grey Wave |

---

## 3. Focus piece A — PARTS: CLOSING THE RUN (drop kit)

Two registry entries sharing **one `dropId`**, so they go out in **one email** (same pattern as the three releases on `drop-2026-09-17`).

**Family tagline is already written** in the catalog — reuse it, don't invent:
> *"Each piece is a distinct part of the whole — built different, numbered once, gone forever."*

And 4/4's closing line gives the scarcity copy for free:
> *"The closing piece — once sold, the full four-part assembly is gone forever."*

### Proposed registry entries

| Field | `parts-wallet-3-4` | `parts-wallet-4-4` |
|---|---|---|
| `dropId` | `drop-2026-1?-??` (TBD — one shared date) | same |
| `releaseName` | `PARTS` | `PARTS` |
| `productName` | `Coalition 'Parts' Wallet 3/4` | `Coalition 'Parts' Wallet 4/4` |
| `x` / `y` | `3` / `4` | `4` / `4` |
| `price` | `'$45'` | `'$60'` |
| `listing.id` | `Coalition_Parts_Wallet_3_4` | `Coalition_Parts_Wallet_4_4` |
| `listing.price` | `45` | `60` |
| `category` | `wallet` | `wallet` |
| `sizes` / `sizeInventory` | `['One Size']` / `{'One Size': 1}` | same |
| `isLimitedEdition` | `true` | `true` |
| `isFeatured` | `false` | `false` |
| `images.front` / `.back` | local PNGs — **not yet on disk** | local PNGs — **not yet on disk** |

### Slide outline (5 slides each, per the fixed skeleton)

Both pieces run hero → detail → scarcity → manifesto → CTA. The differentiator is the scarcity slide:

| Slide | 3/4 | 4/4 |
|---|---|---|
| 1 · hero | "PARTS" / Coalition 'Parts' Wallet 3/4 | "PARTS" / Coalition 'Parts' Wallet 4/4 |
| 2 · detail | "Industrial detailing. Raw-edge construction." | "The closing piece." |
| 3 · scarcity | eyebrow `THE RUN CLOSES` · **3 OF 4** · $45 | eyebrow `THE FINAL PIECE` · **4 OF 4** · $60 |
| 4 · manifesto | TRUST YOURSELF. / Coalition is action. Show up. | same |
| 5 · cta | PARTS / WALLET 3/4 — SHOP NOW → linktr.ee/sgcoalition | PARTS / WALLET 4/4 — SHOP NOW → linktr.ee/sgcoalition |

> **Copy flag — the run is not one price.** 1/4 and 2/4 sold at **$85**; 3/4 is **$45** and 4/4 is **$60** (3/4's copy says "Priced at $45 with standard shipping included"). A "closing the run" piece should say out loud why the closing pieces price differently, or the scarcity slide will read as a price drop on the same run. Decide the line before the copy deck is written.

---

## 4. Focus piece B — Parts assembly reel

**Qualifies** for the 1/1 process recipe (numbered run, one unit left each). The natural cut is **one reel for the pair**, structured on the four-part assembly closing: 1/4 → 2/4 → 3/4 → 4/4.

Map onto the recipe ([`../README.md`](../README.md) §*Reel + post recipe*):

| Recipe element | Proposed value |
|---|---|
| Title | deviate from the `<Product type> 1/1` default — this is a run, not a one-off. Suggested: `Custom Coalition Wallet · Parts 3/4` (or the run title `PARTS: CLOSING THE RUN`) |
| Cover frame | needle-pierce process shot, square-safe, focal action in the middle band (recipe gate 4.1/4.3) |
| Cover text | ≤4 words, all caps, bottom-right — e.g. `THE RUN CLOSES` |
| Caption close | **verbatim triptych required**: *No factory. No shortcuts. Just the process. Trust Yourself.* (recipe gate 2.2) |
| Hashtags | **first comment only**, 7–10 tags (recipe gate 2.5) |
| Timing | IG 6–8pm window → FB **48h later** with ≥10% drift (gates 3.1/3.2/5.1) |
| CTA | `linktr.ee/sgcoalition` line the recipe requires — the URL must resolve to a live PDP (gate 2.4) |

**Reel renderer to clone** — pick one:
- `scripts/reels/ghost-riders-y2k-reel.html` + `scripts/render-reel.ts` (Playwright frame-by-frame → ffmpeg, deterministic `window.seek(t)`), or
- `docs/logo-reveal/reel-pink/` (HyperFrames two-act reel with `verify-reel-pink.py` gates + a documented beat map) — the closer analogue since it's an apparel/wallet drop-announcement reel with a scored audio bed.

---

## 5. Inputs / blockers

| # | Blocker | Detail | Resolves by |
|---|---|---|---|
| 1 | **No local photos** | 3/4 and 4/4 exist only as remote `i.imgur.com` URLs. The pipeline wants `public/images/<slug>-{front,back}.png`. | Pull + normalise + upload (`npm run drop:assets`; precedent `scripts/uploadAboveAsBelowImages.ts`) |
| 2 | **Reel B-roll unknown** | The recipe needs process footage (needle-pierce). Do we have build B-roll for the Parts run? | Operator to confirm |
| 3 | **`docs/templates/reel/` is missing** | README line ~1902 points reel builders at it; `Test-Path docs/templates/reel` is `False`. | Clone from an existing reel (see §4) — don't follow the broken pointer |
| 4 | **Drop date not set** | `dropId` + `dropDate` need a real date before `drop:docs`. | Operator decision |
| 5 | **Price-difference line** | See the copy flag in §3. | Copy decision |

---

## 6. Parked — Halo Mini Dress

Parked **for now** by decision (2026-10-16). Reasoning worth keeping:

- **Drop kit mismatch.** Halo is **evergreen** ($50, 12–13 per size, `isLimitedEdition: false`). The fixed 5-slide skeleton forces a scarcity slide; Halo has no scarcity and would have to overclaim "1 OF N · once it's gone" to fill it — the exact overclaim the repo's copy rules guard against. Building a Halo kit means **reframing** the skeleton (volume/line slide in place of scarcity), not filling in the blank.
- **Reel disqualified as-is.** The recipe's own gate excludes evergreen catalog. A Halo reel would be a different format (style/velocity), not the 1/1 process recipe.
- **Photos.** Halo exists only as Supabase `migrated/imgur_*.png` — no local front/back PNGs.

Revisit when a volume/style piece is wanted, or fold Halo into an Above as Below line piece.

---

## 7. Execution sequence (when assets + date land)

```bash
# 0. Photos on disk
#    public/images/parts-wallet-3-4-front.png  + -back.png
#    public/images/parts-wallet-4-4-front.png  + -back.png

# 1. Add the two entries to scripts/story-reveal-specs/drops.ts
#    (slug, 5 slides, listing, copy) — one shared dropId

npm run drop:docs   -- --slug parts-wallet-3-4 --confirm   # kit + copy + storyboard + ledger row
npm run drop:docs   -- --slug parts-wallet-4-4 --confirm
npm run drop:render -- --slug parts-wallet-3-4             # Stories + Grid + X
npm run drop:render -- --slug parts-wallet-4-4
npm run drop:assets -- --slug parts-wallet-3-4 --confirm   # normalise + upload
npm run drop:assets -- --slug parts-wallet-4-4 --confirm
npm run drop:list   -- --slug parts-wallet-3-4 --confirm   # products row + reseed constants/products.ts
npm run drop:list   -- --slug parts-wallet-4-4 --confirm
npm run drop:post   -- --slug parts-wallet-3-4 --confirm   # blog post
npm run drop:post   -- --slug parts-wallet-4-4 --confirm
npm test                                                    # tests/dropRegistry.test.ts must pass
```

Then the email from the Marketing tab (one campaign per `dropId`, covering both releases), and the reel cut on its own track (§4).

---

## 8. Open questions

1. **Drop date** for the Parts closing group?
2. **Photos** — do the source shots exist, or are the imgur images all we have?
3. **Reel B-roll** — do we have Parts process footage?
4. **Price-difference line** — how does the copy explain $45/$60 against the $85 opening pieces?
5. **Do the pair ship as one dropId, or separately?** (Recommend together — "closing the run" is one story.)

---

## 9. Outcome (2026-10-16)

The Parts pair is built and committed to the registry.

**Decisions locked**
- **Prices: $45 (3/4) and $60 (4/4)** — the catalog stands; earliest numbers ($60 / $40) were a misread and are not applied.
- **Framed as a reveal with an assigned date** — `dropId: drop-2026-10-16`, `dropDate: 2026-10-16`. The two entries share it, so Marketing sends **one** email. Countdown / "drop time" stickers are omitted (there is no launch window).

**Registry change — `unitsHeld`**

`tests/dropRegistry.test.ts` compared the run size (`y`) against physical stock, which is right for a uniform run but wrong for a numbered run sold one at a time: a Parts 3/4 is one unit of a four-piece run, so `y` would have had to be 1, forcing the scarcity slide to claim "1 OF 1" — the thing `FOLLOWUPS.md:324` forbids. `DropSpec` now carries an optional **`unitsHeld`** (defaults to `y`). `x`/`y` stay the **display** run counter ("3 OF 4") that every generated surface prints; `unitsHeld` is the **stock** claim the guard checks against `sizeInventory`. No generator change was needed for the counter, because the generator already prints `x`/`y`.

**Docs-generator coherence fix**

The kit's "Sticker strategy" section and the storyboard checklist were hard-coded to name a **Countdown** sticker and a *"drop time matches publish time"* gate — wrong for a reveal. Both now derive from the stickers the slides actually declare (`stickerStrategy(drop)` / `hasCountdown(drop)`), so these pieces read *"No countdown sticker — the item is already available."*

**Done**
- `public/images/parts-wallet-{3-4,4-4}-{front,back}.png` — pulled from imgur + normalised (`scripts/pullPartsImages.ts`)
- Two `drops.ts` entries (5 slides each, no countdown)
- Trio generated: `docs/drop-kit-*`, `docs/drop-copy-*`, `docs/storyboard-*` (`-3-4` / `-4-4`) + two ledger rows
- `tests/dropRegistry.test.ts` 17/17; full suite green

**Pending**
- Social render (`docs/{story,grid,x}-reveal/`) — blocked on the Playwright Chromium download
- Reel (Piece B) — needs Parts build B-roll

