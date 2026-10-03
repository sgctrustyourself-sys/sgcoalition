# Coalition Drop Kit — Coalition Fleece Hoodie

Generated from `scripts/story-reveal-specs/drops.ts` — **do not hand-edit this file.**
Edit the registry entry and re-run `npm run drop:docs`.

> **Drop date:** 2026-09-17 · **Drop group:** `drop-2026-09-17`
> **Variant:** 1/15 · **Price:** $100
> **Channels:** Instagram grid · Instagram Stories · X (single-post + 3-tweet thread)
> **Pair with:** [`drop-copy-coalition-fleece-hoodie-1-15.md`](drop-copy-coalition-fleece-hoodie-1-15.md) — the text counterpart
> **Reviewer aid:** [`storyboard-coalition-fleece-hoodie-1-15.html`](storyboard-coalition-fleece-hoodie-1-15.html)

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
| Hero (front) | `public/images/coalition-fleece-hoodie-front.png` | `images/coalition-fleece-hoodie-front.png` |
| Detail (back) | `public/images/coalition-fleece-hoodie-back.png` | `images/coalition-fleece-hoodie-back.png` |

Local copies live at `public/images/coalition-fleece-hoodie-{front,back}.png` (alpha-free RGB,
served by the live site and uploaded to the `products` bucket by
`npm run drop:assets -- --slug coalition-fleece-hoodie --confirm`).

---

## Slide 1 — HERO

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Background | full bleed | `../../public/images/coalition-fleece-hoodie-front.png` |
| Wordmark | top-left, ~80 px wide, white | `COALITION` |
| Display title | center-top, 96–120 px Display | `COALITION FLEECE` |
| Subtitle | below, 32 px body `#C8C8C8` | `Coalition Fleece Hoodie` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **countdown** (top-right) — ⏱ Countdown → drop time
- **mention** (bottom-left) — @sgcoalition mention

---

## Slide 2 — DETAIL

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Background | full bleed | `../../public/images/coalition-fleece-hoodie-back.png` |
| Gradient | bottom 35 % | `#000` 0 % → 70 % opacity |
| Display headline | center-bottom, 56–64 px | `Brushed fleece, built to be worn out.` |
| Body subtext | below, 24–32 px `#C8C8C8` | `Midweight fleece with a brushed interior and a cut that holds its shape.` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **poll** (center-right) — "Hood up or down?" Up / Down

---

## Slide 3 — SCARCITY

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Top half | upper 50 % | `../../public/images/coalition-fleece-hoodie-front.png` |
| Bottom half | lower 50 % | solid `#000` |
| Eyebrow | above the big number, 14–16 px `#6B6B6B`, tracking 0.3em | `LIMITED RUN` |
| Scarcity lockup | center of bottom half, 96–140 px Display | `1 OF 15` |
| Price | below, 40–60 px Display `#C8C8C8` | `$100` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **countdown** (top-right) — ⏱ Drop time (primary urgency driver)
- **poll** (bottom-left) — "Second colorway?" Yes / Wait

---

## Slide 4 — MANIFESTO

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Background | pure `#000` | — |
| Backdrop | full bleed, ~10–15 % opacity | `../../public/images/coalition-fleece-hoodie-front.png` (texture only) |
| Display headline | center, 120–160 px Display | `TRUST YOURSELF.` |
| Body subtext | below, 28–32 px `#6B6B6B` | `Coalition is action. Show up.` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **mention** (bottom-right) — @sgcoalition mention
- **emoji** (center-left) — 🔥 Trust Yourself (emoji slider, optional)

---

## Slide 5 — CTA

**Layout:** composed by `render-story.ts` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
| Top 60 % | upper portion | `../../public/images/coalition-fleece-hoodie-front.png` cropped tight |
| Bottom 40 % | lower portion | solid `#000` panel |
| Eyebrow | top of black panel, 24–26 px `#6B6B6B` | `COALITION FLEECE · HOODIE` |
| Display CTA | mid panel, 70 px white | `SHOP NOW` + arrow `→` |
| URL | bottom of panel, 28 px `#C8C8C8` | `sgcoalition.xyz/shop` |

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

- **link** (center-right) — Story → PDP conversion path
- **mention** (bottom-left) — @sgcoalition mention

---

## Render

```bash
npm run drop:render -- --slug coalition-fleece-hoodie     # story + grid + x, one command
```

Outputs (gitignored — re-run to refresh):

| Format | Output dir | Filenames |
|---|---|---|
| IG Stories | `docs/story-reveal/` | `coalition-fleece-hoodie-slide-{1..5}.png` + `-{layout}.html` reviewer aids |
| IG Grid | `docs/grid-reveal/` | `grid-coalition-fleece-hoodie-slide-{1..5}.png` |
| X | `docs/x-reveal/` | `x-coalition-fleece-hoodie-{single,thread-1,thread-2,thread-3}.png` |

---

## Sticker strategy (priority order)

1. **Countdown** — drives reminder sets; slides 1 + 3.
2. **Poll** — earliest demand signal; slides 2 + 3.
3. **Link sticker** — the only Story → PDP conversion path; slide 5.
4. **Mention** — `@sgcoalition` cross-pollination; slides 4 + 5.
5. **Emoji slider** — retention only; slide 4. Optional.

---

## Pre-publish checklist

- [ ] Drop time for the countdown sticker matches the publish time exactly.
- [ ] Link sticker URL is `sgcoalition.xyz/shop` and resolves to this product's PDP.
- [ ] `@sgcoalition` resolves to the active handle.
- [ ] Poll options are short (≤ 24 chars), mutually exclusive, on-brand.
- [ ] Safe-zone clearance: nothing inside the top 250 px or bottom 320 px of a Story.
- [ ] Cross-check the copy deck: 1 OF 15 and $100 must match the slides verbatim.
- [ ] Local PNGs are alpha-free RGB before upload.

---

## Canva / Figma recipe

1. **Canva:** custom size 1080×1350, black background, drop the front PNG full-bleed.
2. Add Display text (Bebas Neue is free) and a transparent→black gradient behind it.
3. Duplicate per slide, swap the image, export PNG @2x.
4. **Figma:** one 1080×1350 frame per slide, text styles for Display + Body, auto-layout the manifesto slide, export @2x.
