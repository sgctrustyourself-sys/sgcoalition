# Coalition Drops Registry

Living ledger of every past (and current) drop — kit, copy deck, storyboard, Supabase upsert script, and local asset paths all indexed per release. Use this as the source-of-truth for cross-referencing docs and for cloning the trio when starting a new drop.

> **Pair with:** [`README.md`](README.md) (the doc-folder index) · [`../constants.ts`](../constants.ts) (the local dev `INITIAL_PRODUCTS` source-of-truth)

---

## 📚 Convention: filenames per drop

Every drop ships with **the trio + the script + the assets** in a consistent layout:

| Asset type | Convention | Example |
|---|---|---|
| Visual spec | `drop-kit-{slug}-{x}-{y}.md` | `drop-kit-grey-wave-1-2.md` |
| Text spec | `drop-copy-{slug}-{x}-{y}.md` | `drop-copy-grey-wave-1-2.md` |
| Reviewer aid | `storyboard-{slug}-{x}-{y}.html` | `storyboard-grey-wave-1-2.html` |
| Supabase upsert | `scripts/add{Product}{XofY}Wallet.ts` | `scripts/addGreyWaveWallet.ts` |
| Local image (front) | `public/images/{slug}-{kind}-{x}-{y}-front.png` | `public/images/grey-wave-wallet-1-2-front.png` |
| Local image (back) | `public/images/{slug}-{kind}-{x}-{y}-back.png` | `public/images/grey-wave-wallet-1-2-back.png` |

---

## 📜 Drops table

One row per drop. Most recent first. The Grey Wave 1/2 entry is the only one live so far; clone its row to start any new drop.

| Drop date | Release | Variant | Visual spec | Text spec | Storyboard | Supabase script | Asset paths |
|---|---|---|---|---|---|---|---|
| 2026-06-20 | Grey Wave | 1/2 | [`drop-kit-grey-wave.md`](drop-kit-grey-wave.md) | [`drop-copy-grey-wave.md`](drop-copy-grey-wave.md) | [`storyboard-grey-wave.html`](storyboard-grey-wave.html) | [`scripts/addGreyWaveWallet.ts`](../scripts/addGreyWaveWallet.ts) | [`grey-wave-wallet-1-2-front.png`](../public/images/grey-wave-wallet-1-2-front.png) · [`-back.png`](../public/images/grey-wave-wallet-1-2-back.png) |

> **Archive convention:** past drops stay listed here but their trio files move into a future `docs/archive/{year}/` subfolder once the next release runs. The Supabase upsert script and local asset paths stay in their canonical locations (`scripts/` + `public/images/`).

---

## 🚀 How to start a new drop from this registry

This 7-step sequence clones Grey Wave, casts it to the new release, and only leaves you editing copy + assets.

### 1. Clone the trio under the new slug

```bash
# From the repo root
cp docs/drop-kit-grey-wave.md            docs/drop-kit-{NEW_SLUG}-{X}-{Y}.md
cp docs/drop-copy-grey-wave.md           docs/drop-copy-{NEW_SLUG}-{X}-{Y}.md
cp docs/storyboard-grey-wave.html        docs/storyboard-{NEW_SLUG}-{X}-{Y}.html
```

### 2. Clone the Supabase upsert script

```bash
cp scripts/addGreyWaveWallet.ts          scripts/add{NewProduct}Wallet.ts
```

### 3. Copy the local PNG assets

```bash
mkdir -p public/images/
cp public/images/grey-wave-wallet-1-2-front.png  public/images/{NEW_SLUG}-wallet-{X}-{Y}-front.png
cp public/images/grey-wave-wallet-1-2-back.png   public/images/{NEW_SLUG}-wallet-{X}-{Y}-back.png
```

### 4. Token-replace across the trio

The template tokens to replace (`{{ }}`) are listed in [`README.md`](README.md). One pass per token; do the kit + copy + storyboard in the same edit session so the trio stays in sync.

```bash
# Example: cast Grey Wave → Ironclad 1/2
sed -i 's/{{release_slug}}/ironclad/g'   docs/drop-kit-ironclad-1-2.md docs/drop-copy-ironclad-1-2.md
sed -i 's/{{release_name_uppercase}}/IRONCLAD/g'        docs/drop-kit-ironclad-1-2.md docs/drop-copy-ironclad-1-2.md
sed -i 's/{{release_name_title_case}}/Ironclad/g'        docs/drop-kit-ironclad-1-2.md docs/drop-copy-ironclad-1-2.md
sed -i 's/{{release_hashtag}}/Ironclad/g'                docs/drop-copy-ironclad-1-2.md
sed -i 's/{{x}}/1/g; s/{{y}}/2/g'                        docs/drop-kit-ironclad-1-2.md docs/drop-copy-ironclad-1-2.md
sed -i 's/{{price}}/45/g'                                docs/drop-kit-ironclad-1-2.md docs/drop-copy-ironclad-1-2.md
sed -i 's/{{shop_url}}/sgcoalition.xyz\/shop/g'          docs/drop-kit-ironclad-1-2.md docs/drop-copy-ironclad-1-2.md

# Per-drop custom copy stays in the copy deck only:
#   {{detail_headline}}, {{detail_subtext}},
#   {{manifesto_headline}}, {{manifesto_subtext}}
# Edit those by hand — they're bespoke per release.
```

### 5. Update the upsert script's product payload

In the cloned `scripts/add{NewProduct}Wallet.ts`, swap the inline `id`, `name`, `description`, `price`, `images`, and `category` to match the new release. `category: 'wallet'` is correct for any wallet drop; swap only if the drop is apparel, hat, jeans, accessory.

### 6. Add the new row to this registry

Insert a row at the **top** of the table above (most-recent-first). Use the row template:

```markdown
| YYYY-MM-DD | {Release} | X/Y | [`drop-kit-{slug}-X-Y.md`](drop-kit-{slug}-X-Y.md) | [`drop-copy-{slug}-X-Y.md`](drop-copy-{slug}-X-Y.md) | [`storyboard-{slug}-X-Y.html`](storyboard-{slug}-X-Y.html) | [`scripts/add{Product}Wallet.ts`](../scripts/add{Product}Wallet.ts) | [`{slug}-wallet-X-Y-front.png`](../public/images/{slug}-wallet-X-Y-front.png) · [`-back.png`](../public/images/{slug}-wallet-X-Y-back.png) |
```

### 7. Open a single PR

One PR = one drop. Include:
- The trio files
- The upsert script
- The local PNG assets
- The updated `constants.ts` entry (local seed — match the script's payload)
- The new row in this registry
- A new commit in `../DEPLOYMENT_CHECKLIST.md`'s redeploy step (referenced build cache)

Apply the script locally with `npx tsx scripts/add{NewProduct}Wallet.ts` **before** opening the PR so the Supabase row is the source-of-truth and the local seed mirrors it.

### 8. Render the drop assets (3 formats)

Once the trio + PNG assets + Supabase row are in, render postable PNGs for **all three coalition channels** — IG Stories, IG Grid carousel, X feed — via three format-specific commands (or one combined command):

```bash
# 1. Clone the spec under the new slug:
cp scripts/story-reveal-specs/grey-wave.ts scripts/story-reveal-specs/{NEW_SLUG}.ts
# Edit per-drop tokens directly in the cloned spec.

# 2. Wire up the new slug in scripts/render-story.ts → loadSpec()
#    (single-line unconditional return).

# 3. Render every format the drop will be posted to:
npm run story:reveal -- --slug {NEW_SLUG}      # IG Stories (1080×1920)
npm run grid:reveal  -- --slug {NEW_SLUG}      # IG Grid carousel (1080×1350)
npm run x:reveal     -- --slug {NEW_SLUG}      # X feed (1200×628)

# Or chain the three commands for a one-line all-formats render:
npm run story:reveal -- --slug {NEW_SLUG} && \
  npm run grid:reveal -- --slug {NEW_SLUG} && \
  npm run x:reveal -- --slug {NEW_SLUG}

# Note: `npm run reveal -- --slug <slug>` is just a default-format alias — equivalent to
# `npm run story:reveal`. It does NOT run all three formats.
```

**Output directory convention** (all three output dirs are gitignored — re-run to refresh):

| Format | Command | Output dir | Output filenames | Post viewport |
|---|---|---|---|---|
| IG Stories (default) | `npm run story:reveal -- --slug <slug>` | `docs/story-reveal/` | `<slug>-slide-{1..5}.png` + matching `<slug>-slide-{n}-{layout}.html` reviewer aids | 1080×1920 (9:16) |
| IG Grid carousel | `npm run grid:reveal -- --slug <slug>` | `docs/grid-reveal/` | `grid-<slug>-slide-{1..5}.png` + matching `grid-<slug>-slide-{n}-{layout}.html` reviewer aids | 1080×1350 (4:5) |
| X feed (1 single-post + 3 thread crops) | `npm run x:reveal -- --slug <slug>` | `docs/x-reveal/` | `x-<slug>-single.png` + `x-<slug>-thread-1.png` + `x-<slug>-thread-2.png` + `x-<slug>-thread-3.png` + matching `x-<slug>-{variant}.html` reviewer aids (no `-layout` suffix — the X fileId is self-describing) | 1200×628 (1.91:1) |

> **Why three formats?** `docs/drop-kit-<slug>.md` specifies the same 5-slide composition at three viewports — Stories (9:16 vertical, full-screen IG UI debits), Grid (4:5 portrait feed thumb), and X (1.91:1 landscape card or 3-tweet thread crops). Render every format the drop will publish to. Drops that only post Stories can stop after the first command.

> **One-time setup** (already done on this machine, redo on new clones): `npx playwright install chromium` (~150 MB browser binary, cached in `~/.cache/ms-playwright/`).

### After render — review pass before publish

Reviewer-aid HTMLs are written next to every rendered PNG so reviewers can spot-check sticker-tray alignment, copy placement, and safe-zone clearance before posting. The exact path pattern depends on which format you rendered:

| Format | Reviewer-aid HTML path pattern |
|---|---|
| Stories | `docs/story-reveal/{slug}-slide-{n}-{layout}.html` |
| Grid    | `docs/grid-reveal/grid-{slug}-slide-{n}-{layout}.html` |
| X       | `docs/x-reveal/x-{slug}-{single,thread-N}.html` |

**Story-specific checklist** (most safety-sensitive because IG imposes UI debits for safe zones and a link sticker that needs to actually resolve):

1. Open each reviewer-aid HTML in a browser. Verify the orange sticker-hint boxes sit in-slot with the headline / body / URL lockup.
2. Open each Story PNG (`docs/story-reveal/{slug}-slide-{1..5}.png`) in a viewer. Confirm safe-zone clearance (top 250 px, bottom 320 px) for every slide.
3. **Live-preview** the Story thread on the actual Android/iOS IG account. Canva preview is soft — IG lays sticker trays differently and may snap hint positions off-canvas.
4. **Touch the URL.** Open Story 5's link sticker URL in IG and confirm it routes to the PDP, not the grid.

**Grid + X checklist** (no IG sticker trays / no link stickers — these are post-as-image only):

1. Open each PNG in a viewer. Confirm copy legibility at thumbnail size — Grid shows small in-carousel, X is compact in-feed, so a 24 px body still needs to read.
2. Scan for any cross-format copy drift: Story price vs Grid price vs X price vs the caption short-form price — all should match `{{price}}` from `docs/drop-copy-<slug>.md` verbatim.
3. For X thread specifically: confirm tweet-1 / tweet-2 / tweet-3 publish *in that order* (greedy-engagement reads the thread sequentially, and the manifesto's brand beat lands last).

### Adding a subsequent variant (e.g., Grey Wave 2/2)

`cp scripts/story-reveal-specs/grey-wave.ts scripts/story-reveal-specs/grey-wave-2.ts`, swap the numeric + URL tokens, add a one-line `loadSpec()` branch, run the renderer. The flow is one command.

---

## 📋 Field reference (what each column means)

- **Drop date** — ISO format (`YYYY-MM-DD`). Sorts naturally; unambiguous globally.
- **Release** — short name of the drop (e.g., "Grey Wave"). Used in `{{release_name_uppercase}}` and `{{release_name_title_case}}`.
- **Variant** — `X/Y` form. Used in `{{x}}` / `{{y}}` substitutions.
- **Visual spec** — the markdown kit doc with layouts + Canva/Figma recipe.
- **Text spec** — the markdown copy deck with IG/X/Story copy + hashtags + A/B variants.
- **Storyboard** — the self-contained HTML reviewer aid.
- **Supabase script** — the `npx tsx` script that pushes the new product row.
- **Asset paths** — the alpha-free PNG front + back, locally served.

---

## 🗃 Future expansion

- After 5+ drops, sort the table by drop date descending (default already).
- After Grey Wave's `2/2` ships, add a second row for `2/2` with variant `2/2` and link both rows to a shared "Iron Wave" family entry at the top of the table.
- When archiving past drops into `docs/archive/{year}/`, also move the trio + Supabase script into a sibling `scripts/archive/` for safe history. Local asset PNGs stay put — they're served by the live site.

---

**Last registry update:** 2026-06-20 (Grey Wave 1/2 added).
**Last workflow update:** 2026-06-20 — multi-format renderer wired (`npm run story:reveal`, `npm run grid:reveal`, `npm run x:reveal`; `npm run reveal` is a default-format alias equivalent to `npm run story:reveal` and does not run all three). Outputs to `docs/story-reveal/`, `docs/grid-reveal/`, `docs/x-reveal/` — all gitignored.
