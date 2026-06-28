# Coalition Docs Index

Central index for every documentation file in this repo. **Start here** when picking up the project or planning a new drop.

> **Drop template trio (Grey Wave 1/2 is the worked example):** every future drop clones the trio + replaces tokens.

---

## 📦 Drop template trio

These three docs always ship together for every limited release. Order matters — `kit` is visual, `copy` is text, `storyboard` is the reviewer-facing flow summary.

| File | Owner | Purpose |
|---|---|---|
| [`drop-kit-grey-wave.md`](drop-kit-grey-wave.md) | Designer / asset prepper | Visual spec — 5-slide layouts, brand specs, IG Story variants (1080×1920), Canva + Figma recipes, templating tokens |
| [`drop-copy-grey-wave.md`](drop-copy-grey-wave.md) | Copywriter / social manager | Text spec — IG caption long + short, X single + 3-tweet thread, Story sequence copy per slide, hashtag bank, A/B variants, internal Slack one-liner, publish-order sequence |
| [`storyboard-grey-wave.html`](storyboard-grey-wave.html) | Non-designer reviewers | Self-contained ASCII storyboard with 9:16 ASCII frames + per-slide annotations + 12-item pre-publish reviewer checklist · print-friendly |

#### 🖼 Renderer output — ready-to-post PNGs (3 formats)

The next runtime artifact tier: Playwright-rendered PNGs at exactly the post viewport for every channel — 1080×1920 Stories, 1080×1350 IG Grid, 1200×628 X. Stickers are added in-app, not baked into the PNG.

| Path | Owner | Purpose |
|---|---|---|
| `docs/story-reveal/{slug}-slide-{1..5}.png` | Operator | **Postable** to IG Stories — clean 1080×1920 PNG, no reviewer aids baked in |
| `docs/grid-reveal/grid-{slug}-slide-{1..5}.png` | Operator | **Postable** to IG Grid carousel — clean 1080×1350 PNG |
| `docs/x-reveal/x-{slug}-{single,thread-1,thread-2,thread-3}.png` | Operator | **Postable** to X feed — X single-post + 3-thread crops at 1200×628 |
| `docs/story-reveal/{slug}-slide-{n}-{layout}.html` | Operator | **Reviewer aids** (Stories) — open in browser to see sticker hints (orange dashed boxes), review-mode caption strip, and lockup composition. Hidden during PNG capture. |
| `docs/grid-reveal/grid-{slug}-slide-{n}-{layout}.html` | Operator | **Reviewer aids** (Grid) — same as above; IG carousel has no sticker tray, so this is the only in-app overlay available |
| `docs/x-reveal/x-{slug}-{single,thread-N}.html` | Operator | **Reviewer aids** (X) — same as above; X is media-only (no native stickers, no link sticker) |

Render every format the drop posts to. Run them all in sequence:

```bash
npm run story:reveal -- --slug grey-wave   # 1080×1920 IG Stories (default)
npm run grid:reveal  -- --slug grey-wave   # 1080×1350 IG Grid carousel
npm run x:reveal     -- --slug grey-wave   # 1200×628 X feed
```

Or render all three with a one-line chain (recommended for full-coverage drops):

```bash
npm run story:reveal -- --slug grey-wave && npm run grid:reveal -- --slug grey-wave && npm run x:reveal -- --slug grey-wave
```

> `npm run reveal -- --slug grey-wave` is just an alias for the default format (renders Stories only — equivalent to `npm run story:reveal`); it does *not* run all three formats. Chain the three explicit scripts above for full coverage.

> First-time use requires `npx playwright install chromium` one-time (~150 MB browser binary, cached in `~/.cache/ms-playwright/`). The full worked-example workflow is in [`drops-registry.md`](drops-registry.md) step 8.

> **Always edit `drop-kit*` and `drop-copy*` together.** Both files share identical `{{ }}` placeholders, the same drop date, and the same hashtag bank. The storyboard updates independently when the visual flow changes.

### Template placeholders (carry across future drops)

| Token | What it controls |
|---|---|
| `{{release_name_uppercase}}` | Display title on the kit Slide 1 (e.g., "GREY WAVE") |
| `{{release_name_title_case}}` | Body subtitle for the same slide (e.g., "Grey Wave") |
| `{{release_slug}}` | Filename + URL slug for the drop |
| `{{release_hashtag}}` | Hashtag bank primary handle (e.g., #GreyWave) |
| `{{x}}` / `{{y}}` | Variant counter on the scarcity slide + Story 3 |
| `{{price}}` | Display price on Slides 3 + 5 |
| `{{detail_headline}}` / `{{detail_subtext}}` | Story 2 copy |
| `{{manifesto_headline}}` / `{{manifesto_subtext}}` | Story 4 copy |
| `{{shop_url}}` | Link sticker URL on Story 5 |

### How to start a new drop from this trio

1. **Clone the trio** into `docs/drop-{kit,copy,storyboard}-{slug}-{x}-{y}.*` (e.g., `docs/drop-kit-ironclad-1-2.md`).
2. **Find + replace** every `{{ }}` token in BOTH the kit and the copy doc with the new drop's specifics. **Never edit one without the other.**
3. **Update the drop date** in both files' header blockquote + per-channel publish-order sequence in the copy doc.
4. **Build the assets** following the kit's Canva / Figma recipes (Slide 1–5 + IG Story variants).
5. **Render all 3 formats + run the multi-format reviewer checklist.** Run `npm run story:reveal -- --slug <slug> && npm run grid:reveal -- --slug <slug> && npm run x:reveal -- --slug <slug>` for the Stories / Grid / X trio. Before publishing, walk the **format-specific** reviewer checklist in [`drops-registry.md`](drops-registry.md) → *After render — review pass*: Stories get live-previewed on the actual Android/iOS IG client (Canva is soft — IG snaps hint positions and may move them off-canvas, and Story 5's link-sticker URL must route to the PDP); Grid + X run the thumbnail-legibility and cross-format copy-drift checks instead.
6. **Walk the reviewer checklist** in the storyboard HTML before pressing publish.
7. **Pair archive it** by moving past drops into a `archive/` subfolder so the trio of current-drop files is always at the top level of `docs/`.

---

## 🏛 Project-level docs (root)

| File | Purpose |
|---|---|
| [`../README.md`](../README.md) | Project overview · brand + feature summary · tech stack · local dev setup (Node 18+, npm install, .env.local, `npm run dev`) · Stripe test cards · Coalition Brain bootstrap (`npm run bootstrap:brain`) · project structure tree · env-var catalog (dev + prod) |
| [`../DEPLOYMENT_CHECKLIST.md`](../DEPLOYMENT_CHECKLIST.md) | Vercel deployment runbook · Supabase env-var verification · build-time vs runtime variable distinction · clean redeploy steps · post-deploy smoke check via incognito browser session |

> Start with `README.md` for the first local boot. Reach for `DEPLOYMENT_CHECKLIST.md` only when pushing to production.

---

## 📁 Repo file map

```
/
├── README.md                              ← project + local dev start here
├── DEPLOYMENT_CHECKLIST.md                ← Vercel runbook
├── docs/
│   ├── README.md                          ← THIS FILE
│   ├── drop-kit-grey-wave.md              ← visual spec (next-drop clone)
│   ├── drop-copy-grey-wave.md             ← text spec (next-drop clone)
│   ├── storyboard-grey-wave.html          ← ASCII review aid
│   ├── drops-registry.md                  ← ledger of every past drop + index of trio filenames
│   ├── story-reveal/                      ← gitignored: 1080×1920 IG Story PNGs + reviewer HTML aids
│   ├── grid-reveal/                       ← gitignored: 1080×1350 IG Grid carousel PNGs + reviewer HTML aids
│   └── x-reveal/                          ← gitignored: 1200×628 X feed PNGs + reviewer HTML aids
├── public/
│   └── images/
│       └── grey-wave-wallet-1-2-{front,back}.png   ← alpha-free RGB local copies
└── scripts/
    ├── addGreyWaveWallet.ts               ← Supabase upsert script (use this as the template for new drops)
    ├── render-story.ts                    ← Playwright renderer with `--format story|grid|x` → ready-to-post PNGs at the matching viewport
    ├── story-reveal-specs/                ← typed DropSpecs (one TS file per drop)
    │   └── grey-wave.ts                   ← worked example
    └── templates/
        ├── story-slide.html               ← 1080×1920 IG Story template
        ├── grid-slide.html                ← 1080×1350 IG Grid carousel template
        └── x-slide.html                   ← 1200×628 X feed (single + thread×3) template
```

---

## Conventions applied across all docs

- **Templating tokens** use double-curly-brace `{{ token }}` for simple find/replace via `sed -i 's/{{release_slug}}/ironclad/g'`.
- **Drop dates** are spelled out as ISO (`YYYY-MM-DD`) for unambiguous sorting.
- **Hashtag bank** lives only in the copy deck — never duplicate across files.
- **ASCII frames** in the storyboard are 22 chars × 36 rows to preserve 9:16 visual ratio in monospace.
