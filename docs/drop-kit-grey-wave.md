# Coalition Drop Kit — Grey Wave Wallet 1/2

A reusable spec for building brand-consistent drop kits (IG carousel, X thread, IG Story) for any Coalition limited-release product.

> **Worked example:** Coalition 'Grey Wave' Wallet 1/2
> **Drop date:** 2026-06-20
> **Channels:** Instagram grid · Instagram Stories · X (single-post + 3-tweet thread)
> **Pair with — [`docs/drop-copy-grey-wave.md`](drop-copy-grey-wave.md)** : this file's text counterpart. Same drop date, same `{{ }}` placeholders, same hashtag bank. Always edit the kit + deck together.
>
> **Storyboard preview — [`docs/storyboard-grey-wave.html`](storyboard-grey-wave.html)** : 9:16 ASCII frames + reviewer checklist for non-designers.

---

## Brand specs (apply across every slide)

These stay constant across drops — only the wallet imagery, price, and copy change.

| Token | Value |
|---|---|
| Canvas — IG portrait | 1080 × 1350 |
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
| Wordmark position | top-left, ~10–12% page width |
| Wordmark color | white |

> **Note:** No accent color — the wallet's own dye is the only color the slides show. Override this only if the release's dye demands one.

---

## Image assets (per drop)

For any drop, you'll have two CDN URLs:

- `image_front_url` — primary hero shot, used in Slides 1 + 3 + 5
- `image_back_url` — secondary detail shot, used in Slide 2

**Worked values for Grey Wave:**
- `image_front_url` = `https://i.imgur.com/7z2h8u6.jpeg`
- `image_back_url` = `https://i.imgur.com/UqtbJCq.jpeg`

**Local PNG copies (for direct Canva upload, alpha-free):**
- `public/images/grey-wave-wallet-1-2-front.png`
- `public/images/grey-wave-wallet-1-2-back.png`

For the next drop, swap these paths + URLs only.

---

## Slide 1 — HERO

**Layout:** full-bleed `{{image_front_url}}` with a dark gradient overlay (top-left, 30% opacity, #000 → transparent) so the wordmark reads cleanly.

| Layer | Content |
|---|---|
| Wordmark (top-left, ~80px wide, white) | `COALITION` |
| Center-top, 96–120px Display | `{{release_name_uppercase}}` (e.g., "GREY WAVE") |
| Below, 32px body, color `#C8C8C8` | `Coalition '{{release_name_title_case}}' Wallet {{x}}/{{y}}` |

**Grey Wave:** "GREY WAVE" / "Coalition 'Grey Wave' Wallet 1/2".

---

## Slide 2 — DETAIL

**Layout:** full-bleed `{{image_back_url}}`. Black vertical gradient from bottom (0% → 70% opacity). Copy sits on solid black.

| Layer | Content |
|---|---|
| Center-bottom, 56–64px Display | `{{detail_headline}}` |
| Below, 28–32px body, `#C8C8C8` | `{{detail_subtext}}` |

**Grey Wave:**
- `detail_headline` = "Hand-finished charcoal dye."
- `detail_subtext` = "Inspired by Baltimore harbor at dawn — the moment before anything moves."

---

## Slide 3 — SCARCITY

**Layout:** 50/50 split — top half = `{{image_front_url}}`, bottom half = pure `#000` for the type lockup.

| Layer | Content |
|---|---|
| Eyebrow above the big number, 14px tracked-out | `LIMITED EDITION`, color `#6B6B6B`, letter-spacing 0.3em |
| Center-bottom, 96–110px Display | `{{x}} OF {{y}}` |
| Below, 40px Display | `{{price}}`, color `#C8C8C8` |

**Story variant:** drop a 24-hour countdown sticker above the "X OF Y" line.

**Grey Wave:** "1 OF 2" / "$35".

---

## Slide 4 — MANIFESTO

**Layout:** pure `#000` background with a tiny wallet image tucked in as low-contrast backdrop (~15% opacity). Center text lockup.

| Layer | Content |
|---|---|
| Center, 120–160px Display | `{{manifesto_headline}}` |
| Below, 28px body, `#6B6B6B` | `{{manifesto_subtext}}` |

**Grey Wave:** "TRUST YOURSELF." / "Coalition is action. Show up."

---

## Slide 5 — CTA

**Layout:** split frame — left 60% = `{{image_front_url}}` cropped tight. Right 40% = clean black panel.

| Layer | Content |
|---|---|
| Top of black panel, 24px eyebrow, `#6B6B6B` | `{{release_name_uppercase}} / WALLET {{x}}/{{y}}` |
| Mid, 56–72px Display | `SHOP NOW` followed by `→` in `#C8C8C8` |
| Bottom of black panel, 24px body, `#C8C8C8` | `{{shop_url}}` |

**Story variant:** replace "SHOP NOW" with a "Shop Now" sticker + URL sticker. URL = `{{shop_url}}`.

**Grey Wave:** "GREY WAVE / WALLET 1/2" / "sgcoalition.xyz/shop".

---

## X single-post card (1200×628)

Use Slide 5 cropped to 1200×628 with a black header band:
- Above the wallet: `{{release_name_uppercase}}` 72px Display, white on black.
- Below the wallet: `{{price}} · {{x}} of {{y}} · Once it's gone, it's gone.` 24px body, `#C8C8C8`.

Don't fight the wallet's contrast — keep the type band under the image, not on top.

---

## X thread images (1 image per tweet)

- Tweet 1 image: Slide 1 (hero)
- Tweet 2 image: Slide 3 (scarcity)
- Tweet 3 image: Slide 5 (CTA)

---

## IG Story variants (1080×1920)

The grid carousel is 1080×1350. Stories flip to 1080×1920 vertical 9:16 and add IG-specific stickers (countdown, poll, mention, link) for engagement. Use these specs alongside the grid.

### Safe zones

| Zone | Distance from edge |
|---|---|
| Top safe (profile handle / IG UI) | 250 px from top |
| Bottom safe (CTA tray / sticker UI) | 320 px from bottom |
| Useable canvas | ~1080 × 1350 within safe area |

### Slide 1 — HERO (Story)

| Layer | Position | Content |
|---|---|---|
| Background | full bleed | `{{image_front_url}}` |
| Wordmark | top safe zone, 80 px wide, 60 px from top | `COALITION` |
| Display title | center, 88 px | `{{release_name_uppercase}}` |
| Subtitle | below title, 26 px body `#C8C8C8` | `Coalition '{{release_name_title_case}}' Wallet {{x}}/{{y}}` |

**Stickers:** Countdown sticker top-right (120 px from right, 200 px from top; end-time = drop time). `@sgcoalition` mention sticker bottom-left.

**Grey Wave:** title "GREY WAVE", subtitle "Coalition 'Grey Wave' Wallet 1/2"; countdown to 2026-06-20 launch.

### Slide 2 — DETAIL (Story)

| Layer | Position | Content |
|---|---|---|
| Background | full bleed | `{{image_back_url}}` |
| Bottom gradient | bottom 35 % of slide | `#000` 0 % → 70 % opacity |
| Display headline | center-bottom, 56 px | `{{detail_headline}}` |
| Body subtext | below, 24 px `#C8C8C8` | `{{detail_subtext}}` |

**Stickers:** Poll sticker right-side: "Harbor at dawn? Yes / No" (engagement bait).

**Grey Wave:** headline "Hand-finished charcoal dye.", subtext "Inspired by Baltimore harbor at dawn — the moment before anything moves."

### Slide 3 — SCARCITY (Story)

| Layer | Position | Content |
|---|---|---|
| Top half | upper 50 % | `{{image_front_url}}` |
| Bottom half | lower 50 % | solid `#000` |
| Eyebrow | above big number, 16 px `#6B6B6B` letter-spacing 0.3em | `LIMITED EDITION` |
| Display scarcity | center of bottom half, 140 px | `{{x}} OF {{y}}` |
| Price | below, 60 px `#C8C8C8` | `{{price}}` |

**Stickers:** Countdown sticker top-right (drop end-time, drives urgency); poll sticker bottom-left in black panel: "Should we run {{y}}/{{y}}? Yes / Wait" — most actionable data point in the campaign (early demand signal for the trailing release).

**Grey Wave:** "1 OF 2" / "$35".

### Slide 4 — MANIFESTO (Story)

| Layer | Position | Content |
|---|---|---|
| Background | pure `#000` | — |
| Subtle backdrop | full-bleed at ~10 % opacity | `{{image_front_url}}` (texture) |
| Display headline | center, 130 px white | `{{manifesto_headline}}` |
| Body subtext | below, 32 px `#6B6B6B` | `{{manifesto_subtext}}` |

**Stickers:** Mention sticker `@sgcoalition` bottom-right.

**Grey Wave:** "TRUST YOURSELF." / "Coalition is action. Show up."

### Slide 5 — CTA (Story)

| Layer | Position | Content |
|---|---|---|
| Top 60 % | upper portion | `{{image_front_url}}` cropped tight |
| Bottom 40 % | lower portion | solid `#000` panel |
| Eyebrow | top of black panel, 26 px `#6B6B6B` | `{{release_name_uppercase}} / WALLET {{x}}/{{y}}` |
| Display CTA | mid panel, 70 px white | `SHOP NOW` + arrow brand mark `→` (`#C8C8C8`) |
| URL | bottom of panel, 28 px `#C8C8C8` | `{{shop_url}}` |

**Stickers:** Link sticker on the `→` mark → `{{shop_url}}`; mention sticker `@sgcoalition` bottom-left. The link sticker is the actual Story → PDP conversion path.

**Grey Wave:** eyebrow "GREY WAVE / WALLET 1/2", URL "sgcoalition.xyz/shop".

### Sticker strategy (priority order)

1. **Countdown** (slides 1+3) — drives reminder sets; converts browsers to drop-night traffic.
2. **Poll** (slides 2+3) — earliest demand signal for the trailing release (the most actionable data point in the campaign).
3. **Link sticker** (slide 5) — direct Story → PDP path (the only one that converts).
4. **Mention sticker** (slides 4+5) — `@sgcoalition` cross-pollination to the IG grid.
5. **Emoji slider** (slide 4) — "🔥 Trust Yourself" (low value but lifts retention metrics; optional).

### Story-only templating checks (additions)

- [ ] Drop time for the countdown sticker **exactly matches** the publish time.
- [ ] Countdown sticker's `ends_at` is in the future at publish, in IG-recognized timezone (defaults to your local).
- [ ] Link sticker URL matches the PDP URL — no trailing slash, no redirect typos.
- [ ] Mention sticker's `@sgcoalition` resolves to the active handle.
- [ ] Poll sticker options are short (≤24 chars), mutually exclusive, on-brand.
- [ ] Stickers float OVER text (added after the canvas is composed), never under a black gradient.

### Story thumb-prep checklist

- [ ] Local PNGs at `public/images/{{release_slug}}-wallet-{{x}}-{{y}}-{front,back}.png` are alpha-free RGB.
- [ ] 1080×1920 frame in Canva or Figma, safe-zone rectangles drawn first.
- [ ] Sticker overlays added AFTER copy so copy stays clean inside the safe area.
- [ ] Mention + link stuck in the same Story slot to avoid sticker-tray collisions.
- [ ] Live preview on the actual IG account before publishing (stickers snap to tray edges differently than Canva previews).

---

## Canva recipe (under 5 minutes per slide)

1. **Custom size → 1080×1350.** Black background.
2. **Drop the image** via "Upload" (paste Imgur URL into embed element if Canva refuses uploads; or download from Imgur first).
3. **Position image full-bleed**, crop if needed.
4. **Add Display text** — Bebas Neue is free in Canva; or upload your brand font.
5. **Add a transparent-to-black linear gradient rectangle** behind any text overlay.
6. **Repeat** for each slide, then "Resize" → duplicate the design and swap image.

---

## Figma recipe

1. **New file → 1080×1350 frame.** Build a 5-page structure for the carousel.
2. **Use Figma's "Place image"** with the Imgur URLs (Figma embeds them).
3. **Create text styles once** (Display + Body), apply across all slides.
4. **Use Auto-layout** for the manifesto slide so resizing to X / Story is one click.
5. **Export each frame** as PNG @2x for IG.

---

## Templating checklist for the next drop

- [ ] Upload front + back Imgur albums, copy direct CDN URLs.
- [ ] Decide release name (e.g., "Grey Wave"), variant count (e.g., 1/2), price.
- [ ] Write `detail_headline`, `detail_subtext`, `manifesto_headline`, `manifesto_subtext`, `scarcity_subtext`.
- [ ] Duplicate this file to `docs/drop-kit-{{release_slug}}-{{x}}-{{y}}.md`.
- [ ] Replace all `{{ }}` placeholders with the new drop's specifics.
- [ ] Build in Canva or Figma following the same 5-slide grid.
- [ ] Verify `#000` background + alpha-free PNGs render cleanly before exporting.
- [ ] Schedule the IG + X posts.

---

## Asset prep reference

For Grey Wave, local PNGs are already saved alongside this template:

- `public/images/grey-wave-wallet-1-2-front.png` — alpha-free RGB, 1024×1024
- `public/images/grey-wave-wallet-1-2-back.png` — alpha-free RGB, 1024×1024

Generate these per drop by running the same Pillow pipeline (Pillow `optimize=True, compress_level=9`, JPEG input flattened onto pure black) — image shrink further requires lossy WebP variants for mobile Story uploads.
