# Coalition Drop Kit — Coalition 'Parts' Wallet 3/4

Generated from `scripts/story-reveal-specs/drops.ts` — **do not hand-edit this file.**
Edit the registry entry and re-run `npm run drop:docs`.

> **Drop date:** 2026-10-16 · **Drop group:** `drop-2026-10-16`
> **Variant:** 3/4 · **Price:** $45
> **Channels:** Instagram grid · Instagram Stories · X (single-post + 3-tweet thread)
> **Pair with:** [`drop-copy-parts-wallet-3-4-3-4.md`](drop-copy-parts-wallet-3-4-3-4.md) — the text counterpart
> **Reviewer aid:** [`storyboard-parts-wallet-3-4-3-4.html`](storyboard-parts-wallet-3-4-3-4.html)

---

## Brand specs (apply across every slide)

| Token | Value |
|---|---|
| Canvas — IG portrait (grid) | 1080 × 1350 |
| Canvas — X card | 1200 × 628 |
| Canvas — Story | 1080 × 1920 |
| Palette — base | `#000000` |
| Palette — text | `#FFFFFF` |
| Palette — frame | `#1A1A1A` |
| Palette — stone | `#6B6B6B` |
| Palette — mist | `#C8C8C8` |
| Display font | Bebas Neue · Anton · Druk Wide |
| Body font | Inter · Söhne |
| Outer margin (portrait) | 80–120 px |
| Wordmark position | top-left, ~10–12 % page width, white |

---

## Image assets

| Asset | Local path | Storage object |
|---|---|---|
| Hero (front) | `public/images/parts-wallet-3-4-front.png` | `images/parts-wallet-3-4-front.png` |
| Detail (back) | `public/images/parts-wallet-3-4-back.png` | `images/parts-wallet-3-4-back.png` |

Local copies live at `public/images/parts-wallet-3-4-{front,back}.png` (alpha-free RGB,
served by the live site and uploaded to the `products` bucket by
`npm run drop:assets -- --slug parts-wallet-3-4 --confirm`).

---

## Slide 1 — HERO

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Background | full bleed | `../../public/images/parts-wallet-3-4-front.png` |
| Wordmark | top-left, ~80 px wide, white | `COALITION` |
| Display title | center-top, 96–120 px Display | `PARTS` |
| Subtitle | below, 32 px body `#C8C8C8` | `Coalition 'Parts' Wallet 3/4` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **mention** (bottom-left) — @sgcoalition mention

---

## Slide 2 — DETAIL

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Background | full bleed | `../../public/images/parts-wallet-3-4-back.png` |
| Gradient | bottom 35 % | `#000` 0 % → 70 % opacity |
| Display headline | center-bottom, 56–64 px | `Industrial detailing.` |
| Body subtext | below, 24–32 px `#C8C8C8` | `Raw-edge construction and a single Coalition mark on a numbered, hand-finished carry.` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **poll** (center-right) — "Wear it raw or box it?" Wear / Box

---

## Slide 3 — SCARCITY

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Top half | upper 50 % | `../../public/images/parts-wallet-3-4-front.png` |
| Bottom half | lower 50 % | solid `#000` |
| Eyebrow | above the big number, 14–16 px `#6B6B6B`, tracking 0.3em | `THE RUN CLOSES` |
| Scarcity lockup | center of bottom half, 96–140 px Display | `3 OF 4` |
| Price | below, 40–60 px Display `#C8C8C8` | `$45` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **poll** (bottom-left) — "Run it again?" Yes / Never

---

## Slide 4 — MANIFESTO

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Background | pure `#000` | — |
| Backdrop | full bleed, ~10–15 % opacity | `../../public/images/parts-wallet-3-4-front.png` (texture only) |
| Display headline | center, 120–160 px Display | `TRUST YOURSELF.` |
| Body subtext | below, 28–32 px `#6B6B6B` | `Coalition is action. Show up.` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **mention** (bottom-right) — @sgcoalition mention
- **emoji** (center-left) — 🧩 Trust Yourself (emoji slider, optional)

---

## Slide 5 — CTA

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Top 60 % | upper portion | `../../public/images/parts-wallet-3-4-front.png` cropped tight |
| Bottom 40 % | lower portion | solid `#000` panel |
| Eyebrow | top of black panel, 24–26 px `#6B6B6B` | `PARTS · WALLET 3/4` |
| Display CTA | mid panel, 70 px white | `SHOP NOW` + arrow `→` |
| URL | bottom of panel, 28 px `#C8C8C8` | `linktr.ee/sgcoalition` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **link** (center-right) — Story → PDP conversion path
- **mention** (bottom-left) — @sgcoalition mention

---

## Render

```bash
npm run drop:render -- --slug parts-wallet-3-4     # story + grid + x, one command
```

Outputs (gitignored — re-run to refresh):

| Format | Output dir | Filenames |
|---|---|---|
| IG Stories | `docs/story-reveal/` | `parts-wallet-3-4-slide-{1..5}.png` + `-{layout}.html` reviewer aids |
| IG Grid | `docs/grid-reveal/` | `grid-parts-wallet-3-4-slide-{1..5}.png` |
| X | `docs/x-reveal/` | `x-parts-wallet-3-4-{single,thread-1,thread-2,thread-3}.png` |

---

## Sticker strategy (priority order)

1. **Poll** — earliest demand signal; slides 2 + 3.
2. **Link** — the only Story → PDP conversion path; slide 5.
3. **Mention** — `@sgcoalition` cross-pollination; slides 1 + 4 + 5.
4. **Emoji** — retention only; slide 4. Optional.

---

## Pre-publish checklist

- [ ] Link sticker URL is `linktr.ee/sgcoalition` and resolves to this product's PDP.
- [ ] `@sgcoalition` resolves to the active handle.
- [ ] Poll options are short (≤ 24 chars), mutually exclusive, on-brand.
- [ ] Safe-zone clearance: nothing inside the top 250 px or bottom 320 px of a Story.
- [ ] Cross-check the copy deck: 3 OF 4 and $45 must match the slides verbatim.
- [ ] Local PNGs are alpha-free RGB before upload.

---

## Canva / Figma recipe

1. **Canva:** custom size 1080×1350, black background, drop the front PNG full-bleed.
2. Add Display text (Bebas Neue is free) and a transparent→black gradient behind it.
3. Duplicate per slide, swap the image, export PNG @2x.
4. **Figma:** one 1080×1350 frame per slide, text styles for Display + Body, auto-layout the manifesto slide, export @2x.
