/**
 * scripts/generateDropDocs.ts — emit a release's docs trio from the registry.
 *
 *   npx tsx scripts/generateDropDocs.ts                                  # dry run: newest drop group
 *   npx tsx scripts/generateDropDocs.ts --slug pink-silver-crop-top --confirm
 *   npx tsx scripts/generateDropDocs.ts --all --confirm --force          # all, overwriting
 *
 * Emits, per release:
 *   docs/drop-kit-<slug>-<x>-<y>.md       visual spec (layouts, brand tokens, checklists)
 *   docs/drop-copy-<slug>-<x>-<y>.md      copy deck (IG / X / Story / hashtags / A-B-C)
 *   docs/storyboard-<slug>-<x>-<y>.html   reviewer aid (rendered frames + checklist)
 * and upserts the release's row in docs/drops-registry.md.
 *
 * This replaces the hand `sed` pass across three documents: the trio is generated
 * from the same entry the renderer and the storefront read, so the poster, the
 * deck and the PDP cannot disagree. The existing Grey Wave trio is hand-authored
 * and deliberately left alone — this refuses to overwrite without --force.
 *
 * Every number quoted here (price, X OF Y, run size, char counts) is computed from
 * the registry, never typed twice.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { argValue, hasFlag, logHeader, logRow } from './cli';
import { PROJECT_ROOT, slugsFromArgs } from './dropKit';
import { getDrop, assetBase, assetRelPath } from './story-reveal-specs/drops';
import type { DropRelease, SlideLayout, SlideSpec } from './story-reveal-specs/drops';

const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const REGISTRY_PATH = path.join(DOCS_DIR, 'drops-registry.md');

// ─── Layout descriptors (constant across drops) ──────────────────────────────

const LAYOUT_TITLES: Record<SlideLayout, string> = {
  hero: 'HERO',
  detail: 'DETAIL',
  scarcity: 'SCARCITY',
  manifesto: 'MANIFESTO',
  cta: 'CTA',
};

/** Layer recipes per layout. Constant — the values come from the slide spec. */
function layerRows(layout: SlideLayout, slide: SlideSpec, drop: DropRelease): string {
  const front = `\`${drop.spec.images.front}\``;
  const back = `\`${drop.spec.images.back}\``;
  const bodyish = (slide.body || []).join(' ');
  switch (layout) {
    case 'hero':
      return [
        `| Background | full bleed | ${front} |`,
        `| Wordmark | top-left, ~80 px wide, white | \`${slide.wordmark ?? 'COALITION'}\` |`,
        `| Display title | center-top, 96–120 px Display | \`${slide.headline ?? ''}\` |`,
        `| Subtitle | below, 32 px body \`#C8C8C8\` | \`${bodyish}\` |`,
      ].join('\n');
    case 'detail':
      return [
        `| Background | full bleed | ${back} |`,
        `| Gradient | bottom 35 % | \`#000\` 0 % → 70 % opacity |`,
        `| Display headline | center-bottom, 56–64 px | \`${slide.headline ?? ''}\` |`,
        `| Body subtext | below, 24–32 px \`#C8C8C8\` | \`${bodyish}\` |`,
      ].join('\n');
    case 'scarcity':
      return [
        `| Top half | upper 50 % | ${front} |`,
        `| Bottom half | lower 50 % | solid \`#000\` |`,
        `| Eyebrow | above the big number, 14–16 px \`#6B6B6B\`, tracking 0.3em | \`${slide.eyebrow ?? ''}\` |`,
        `| Scarcity lockup | center of bottom half, 96–140 px Display | \`${slide.headline ?? ''}\` |`,
        `| Price | below, 40–60 px Display \`#C8C8C8\` | \`${slide.price ?? drop.spec.price}\` |`,
      ].join('\n');
    case 'manifesto':
      return [
        `| Background | pure \`#000\` | — |`,
        `| Backdrop | full bleed, ~10–15 % opacity | ${front} (texture only) |`,
        `| Display headline | center, 120–160 px Display | \`${slide.headline ?? ''}\` |`,
        `| Body subtext | below, 28–32 px \`#6B6B6B\` | \`${bodyish}\` |`,
      ].join('\n');
    case 'cta':
      return [
        `| Top 60 % | upper portion | ${front} cropped tight |`,
        `| Bottom 40 % | lower portion | solid \`#000\` panel |`,
        `| Eyebrow | top of black panel, 24–26 px \`#6B6B6B\` | \`${slide.eyebrow ?? ''}\` |`,
        `| Display CTA | mid panel, 70 px white | \`${slide.headline ?? 'SHOP NOW'}\` + arrow \`→\` |`,
        `| URL | bottom of panel, 28 px \`#C8C8C8\` | \`${slide.url ?? drop.spec.shopUrl}\` |`,
      ].join('\n');
  }
}

function stickerList(slide: SlideSpec): string {
  if (!slide.stickers?.length) return '_No stickers on this slide._';
  return slide.stickers
    .map((s) => `- **${s.type}** (${s.anchor}) — ${s.label}`)
    .join('\n');
}

// ─── Kit document ────────────────────────────────────────────────────────────

function renderKit(drop: DropRelease): string {
  const { spec } = drop;
  const filename = `drop-kit-${spec.slug}-${spec.x}-${spec.y}.md`;

  const slideSections = spec.slides
    .map(
      (slide, i) => `## Slide ${i + 1} — ${LAYOUT_TITLES[slide.layout]}

**Layout:** composed by \`render-story.ts\` from this release's registry entry, at
1080×1920 (Story) / 1080×1350 (grid) / 1200×628 (X).

| Layer | Position | Content |
|---|---|---|
${layerRows(slide.layout, slide, drop)}

**Stickers (reviewer aid — added in-app, never baked into the PNG):**

${stickerList(slide)}`,
    )
    .join('\n\n---\n\n');

  return `# Coalition Drop Kit — ${spec.productName}

Generated from \`scripts/story-reveal-specs/drops.ts\` — **do not hand-edit this file.**
Edit the registry entry and re-run \`npm run drop:docs\`.

> **Drop date:** ${drop.dropDate} · **Drop group:** \`${drop.dropId}\`
> **Variant:** ${spec.x}/${spec.y} · **Price:** ${spec.price}
> **Channels:** Instagram grid · Instagram Stories · X (single-post + 3-tweet thread)
> **Pair with:** [\`drop-copy-${spec.slug}-${spec.x}-${spec.y}.md\`](${filename.replace('drop-kit', 'drop-copy')}) — the text counterpart
> **Reviewer aid:** [\`storyboard-${spec.slug}-${spec.x}-${spec.y}.html\`](storyboard-${spec.slug}-${spec.x}-${spec.y}.html)

---

## Brand specs (apply across every slide)

| Token | Value |
|---|---|
| Canvas — IG portrait (grid) | 1080 × 1350 |
| Canvas — X card | 1200 × 628 |
| Canvas — Story | 1080 × 1920 |
| Palette — base | \`#000000\` |
| Palette — text | \`#FFFFFF\` |
| Palette — frame | \`#1A1A1A\` |
| Palette — stone | \`#6B6B6B\` |
| Palette — mist | \`#C8C8C8\` |
| Display font | Bebas Neue · Anton · Druk Wide |
| Body font | Inter · Söhne |
| Outer margin (portrait) | 80–120 px |
| Wordmark position | top-left, ~10–12 % page width, white |

---

## Image assets

| Asset | Local path | Storage object |
|---|---|---|
| Hero (front) | \`${assetRelPath(spec, 'front')}\` | \`images/${assetBase(spec)}-front.png\` |
| Detail (back) | \`${assetRelPath(spec, 'back')}\` | \`images/${assetBase(spec)}-back.png\` |

Local copies live at \`public/images/${assetBase(spec)}-{front,back}.png\` (alpha-free RGB,
served by the live site and uploaded to the \`products\` bucket by
\`npm run drop:assets -- --slug ${spec.slug} --confirm\`).

---

${slideSections}

---

## Render

\`\`\`bash
npm run drop:render -- --slug ${spec.slug}     # story + grid + x, one command
\`\`\`

Outputs (gitignored — re-run to refresh):

| Format | Output dir | Filenames |
|---|---|---|
| IG Stories | \`docs/story-reveal/\` | \`${spec.slug}-slide-{1..5}.png\` + \`-{layout}.html\` reviewer aids |
| IG Grid | \`docs/grid-reveal/\` | \`grid-${spec.slug}-slide-{1..5}.png\` |
| X | \`docs/x-reveal/\` | \`x-${spec.slug}-{single,thread-1,thread-2,thread-3}.png\` |

---

## Sticker strategy (priority order)

1. **Countdown** — drives reminder sets; slides 1 + 3.
2. **Poll** — earliest demand signal; slides 2 + 3.
3. **Link sticker** — the only Story → PDP conversion path; slide 5.
4. **Mention** — \`@sgcoalition\` cross-pollination; slides 4 + 5.
5. **Emoji slider** — retention only; slide 4. Optional.

---

## Pre-publish checklist

- [ ] Drop time for the countdown sticker matches the publish time exactly.
- [ ] Link sticker URL is \`${spec.shopUrl}\` and resolves to this product's PDP.
- [ ] \`@sgcoalition\` resolves to the active handle.
- [ ] Poll options are short (≤ 24 chars), mutually exclusive, on-brand.
- [ ] Safe-zone clearance: nothing inside the top 250 px or bottom 320 px of a Story.
- [ ] Cross-check the copy deck: ${spec.x} OF ${spec.y} and ${spec.price} must match the slides verbatim.
- [ ] Local PNGs are alpha-free RGB before upload.

---

## Canva / Figma recipe

1. **Canva:** custom size 1080×1350, black background, drop the front PNG full-bleed.
2. Add Display text (Bebas Neue is free) and a transparent→black gradient behind it.
3. Duplicate per slide, swap the image, export PNG @2x.
4. **Figma:** one 1080×1350 frame per slide, text styles for Display + Body, auto-layout the manifesto slide, export @2x.
`;
}

// ─── Copy deck ───────────────────────────────────────────────────────────────

const chars = (s: string): number => s.length;

function countLine(label: string, value: string, limit: number): string {
  const n = chars(value);
  return `**${label}:** ${n} chars ${n <= limit ? '✓' : `✗ over ${limit}`}`;
}

function renderCopy(drop: DropRelease): string {
  const { spec, copy } = drop;
  const canonical = copy.hashtagsCanonical.join(' ');
  const tier2 = copy.hashtagsTier2.join(' ');

  const variants = [
    {
      name: 'Variant A — scarcity-led',
      account: 'Best when scarcity is the only signal that matters.',
      text: `${spec.releaseName}. ${spec.x} of ${spec.y} — ${spec.price}. ${spec.slides[1]?.headline ?? ''} Once it's gone, it's gone. Link in bio.\n\n${copy.hashtagsCanonical.slice(0, 3).join(' ')}`,
    },
    {
      name: 'Variant B — story-led',
      account: 'Best for narrative-led brand weeks, or after a drop with momentum.',
      text: `${(spec.slides[1]?.body || []).join(' ')}\n\n${spec.productName} — ${spec.price}. ${spec.slides[1]?.headline ?? ''} ${spec.x} of ${spec.y}.\n\n🔗 Link in bio.\n\n${canonical}`,
    },
    {
      name: 'Variant C — collectibility-led',
      account: 'Best for collector audiences and build-up posts.',
      text: `${spec.x === 1 ? 'First' : `Number ${spec.x}`} of ${spec.y} ${spec.productName}. Each is finished by hand — no two alike.\n\n${spec.price}. When this one's gone, it's gone.\n\n🔗 Link in bio.\n\n${copy.hashtagsCanonical.slice(0, 4).join(' ')}`,
    },
  ];

  return `# Coalition Drop Copy — ${spec.productName}

Generated from \`scripts/story-reveal-specs/drops.ts\` — **do not hand-edit this file.**
Edit the registry entry and re-run \`npm run drop:docs\`.

> **Pair with:** [\`drop-kit-${spec.slug}-${spec.x}-${spec.y}.md\`](drop-kit-${spec.slug}-${spec.x}-${spec.y}.md) — the visual counterpart
> **Drop date:** ${drop.dropDate} · **Variant:** ${spec.x}/${spec.y} · **Price:** ${spec.price}
> **Channels:** Instagram caption · Instagram Stories · X single-post · X 3-tweet thread

---

## Hashtag bank

Always include, in this order:

\`\`\`
${canonical}
\`\`\`

Tier-2 (rotate 2–3 per post for reach — never all at once):

\`\`\`
${tier2}
\`\`\`

---

## Instagram caption — long (carousel feed)

\`\`\`
${copy.igCaptionLong}
\`\`\`

${countLine('Length', copy.igCaptionLong, 2200)}

## Instagram caption — short (Stories-first / casual feed)

\`\`\`
${copy.igCaptionShort}
\`\`\`

${countLine('Length', copy.igCaptionShort, 2200)}

---

## X — single post

\`\`\`
${copy.xSingle}
\`\`\`

${countLine('Length', copy.xSingle, 280)}

---

## X — 3-tweet thread

${copy.xThread
  .map(
    (tweet, i) => `### Tweet ${i + 1}/3

\`\`\`
${tweet}
\`\`\`

${countLine('Length', tweet, 280)}

*Pair image:* ${['drop-kit Slide 1 hero', 'drop-kit Slide 3 scarcity', 'drop-kit Slide 5 CTA'][i]} at 1200×628.`,
  )
  .join('\n\n')}

---

## IG Story copy stack (1080×1920)

${spec.slides
  .map(
    (slide, i) => `### Story ${i + 1} — ${LAYOUT_TITLES[slide.layout]}

\`\`\`
${[slide.eyebrow, slide.wordmark, slide.headline, ...(slide.body || []), slide.price, slide.url]
  .filter(Boolean)
  .join('\n')}
\`\`\`

**Stickers:**

${stickerList(slide)}`,
  )
  .join('\n\n')}

---

## Caption variants for A/B testing

${variants
  .map(
    (v) => `### ${v.name}

\`\`\`
${v.text}
\`\`\`

${countLine('Length', v.text, 2200)} ${v.account}`,
  )
  .join('\n\n')}

---

## Internal Slack one-liner

\`\`\`
${copy.slackOneLiner}
\`\`\`

${countLine('Length', copy.slackOneLiner, 200)}

---

## Per-channel publish order (drop day, Eastern)

1. **T-2h** — pin the IG grid carousel to start building anticipation.
2. **T-30m** — publish Stories 1–3 with the countdown and poll live.
3. **T-0** — publish Stories 4–5 with the link sticker, drop the X thread.
4. **T+1h** — reply with the live stock count.
5. **T+6h** — ticker Story if the piece is still available.
6. **T+12h** — seed the next release if it sold through.

---

## Copy checklist

- [ ] IG long caption within 2,200 chars (${chars(copy.igCaptionLong)}).
- [ ] X single post within 280 chars (${chars(copy.xSingle)}).
- [ ] Every thread tweet within 280 chars.
- [ ] ${spec.x} OF ${spec.y} and ${spec.price} match the drop-kit slides verbatim.
- [ ] Read the long caption aloud once before pasting.
- [ ] Tags rotate: never more than 3 tier-2 tags per post.
`;
}

// ─── Storyboard reviewer aid ─────────────────────────────────────────────────

function renderStoryboard(drop: DropRelease): string {
  const { spec, copy } = drop;
  const frames = spec.slides
    .map((slide, i) => {
      const n = i + 1;
      const storyPng = `story-reveal/${spec.slug}-slide-${n}.png`;
      const gridPng = `grid-reveal/grid-${spec.slug}-slide-${n}.png`;
      return `  <section class="slide">
    <div class="head">
      <span class="n">SLIDE ${n}</span>
      <span class="layout">${LAYOUT_TITLES[slide.layout]}</span>
    </div>
    <div class="frame">
      <img src="${storyPng}" alt="${spec.slug} slide ${n}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'missing',textContent:'Not rendered yet — run:  npm run drop:render -- --slug ${spec.slug}'}))" />
    </div>
    <div class="meta">
      <p class="copy"><strong>Copy</strong><br />${[slide.eyebrow, slide.wordmark, slide.headline, ...(slide.body || []), slide.price, slide.url].filter(Boolean).map((l) => `<span>${escapeHtml(String(l))}</span>`).join('')}</p>
      <p><strong>Stickers</strong></p>
      ${slide.stickers?.length ? `<ul>${slide.stickers.map((s) => `<li><b>${s.type}</b> · ${s.anchor} — ${escapeHtml(s.label)}</li>`).join('')}</ul>` : '<p class="dim">None on this slide.</p>'}
      <p class="dim">Grid crop: <code>${gridPng}</code></p>
    </div>
  </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coalition ${spec.releaseName} — Story Board</title>
<style>
  :root { --display:#fff; --body:#c8c8c8; --eyebrow:#6b6b6b; --line:#1f1f1f; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background:#050505; color:#E5E5E5; font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; font-size:14px; line-height:1.65; padding:32px 24px 72px; max-width:1180px; margin:0 auto; }
  h1 { font-size:22px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px; }
  .lead { color:var(--eyebrow); margin-bottom:22px; }
  .strip { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:26px; }
  .chip { border:1px solid var(--line); border-radius:999px; padding:4px 10px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--body); }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:20px; }
  .slide { border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#0b0b0b; }
  .head { display:flex; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--line); font-size:11px; letter-spacing:.14em; text-transform:uppercase; }
  .head .layout { color:var(--eyebrow); }
  .frame { background:#000; aspect-ratio:9/16; display:flex; align-items:center; justify-content:center; }
  .frame img { width:100%; height:100%; object-fit:contain; }
  .missing { color:var(--eyebrow); font-size:12px; padding:24px; text-align:center; }
  .meta { padding:14px; border-top:1px solid var(--line); }
  .meta p { margin-bottom:8px; }
  .meta strong { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--eyebrow); }
  .copy span { display:block; color:var(--display); }
  .copy span + span { color:var(--body); font-size:13px; }
  ul { padding-left:18px; }
  .dim { color:var(--eyebrow); font-size:12px; }
  code { background:#141414; padding:1px 5px; border-radius:4px; font-size:12px; }
  .checklist { margin-top:30px; border:1px solid var(--line); border-radius:10px; padding:20px; background:#0b0b0b; }
  .checklist h2 { font-size:13px; letter-spacing:.14em; text-transform:uppercase; margin-bottom:12px; }
  .checklist li { margin-bottom:7px; }
  a { color:#E5E5E5; }
  @media print { body { background:#fff; color:#000; } .slide,.checklist { background:#fff; border-color:#ccc; } .copy span { color:#000; } }
</style>
</head>
<body>
<h1>Coalition ${spec.releaseName} — story board</h1>
<p class="lead">${spec.productName} · ${spec.x}/${spec.y} · ${spec.price} · drop ${drop.dropDate}. Frames below are the actual rendered PNGs — boxes say "not rendered yet" until you run the renderer.</p>

<div class="strip">
  <span class="chip">Drop group ${drop.dropId}</span>
  <span class="chip">Story 1080×1920</span>
  <span class="chip">Grid 1080×1350</span>
  <span class="chip">X 1200×628</span>
  <span class="chip"><a href="drop-kit-${spec.slug}-${spec.x}-${spec.y}.md">Visual spec</a></span>
  <span class="chip"><a href="drop-copy-${spec.slug}-${spec.x}-${spec.y}.md">Copy deck</a></span>
</div>

<div class="grid">
${frames}
</div>

<div class="checklist">
  <h2>Reviewer checklist · pre-publish</h2>
  <ol>
    <li>Every frame above shows a rendered PNG (no "not rendered yet" boxes).</li>
    <li>Safe-zone clearance on all five: nothing inside the top 250 px or bottom 320 px.</li>
    <li>Copy matches the deck verbatim: <b>${spec.x} OF ${spec.y}</b> and <b>${spec.price}</b>.</li>
    <li>Story 5's link sticker routes to this product's PDP, not the grid.</li>
    <li>Countdown sticker's end time equals the publish time.</li>
    <li>Poll options read as questions a buyer would actually answer.</li>
    <li>Grid crops stay legible at thumbnail size.</li>
    <li>X thread publishes 1 → 2 → 3, brand line last.</li>
    <li>One price across every surface: poster, deck, listing, email${copy.postSlug ? `, and /blog/${copy.postSlug}` : ''}.</li>
  </ol>
</div>

<p class="dim" style="margin-top:24px;">Generated from <code>scripts/story-reveal-specs/drops.ts</code> — edit the registry entry, not this file.</p>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Registry ledger row ─────────────────────────────────────────────────────

function registryRow(drop: DropRelease): string {
  const { spec, listing } = drop;
  const kit = `drop-kit-${spec.slug}-${spec.x}-${spec.y}.md`;
  const copy = `drop-copy-${spec.slug}-${spec.x}-${spec.y}.md`;
  const board = `storyboard-${spec.slug}-${spec.x}-${spec.y}.html`;
  const base = assetBase(spec);
  return `| ${drop.dropDate} | ${spec.releaseName} | ${spec.x}/${spec.y} | [\`${kit}\`](${kit}) | [\`${copy}\`](${copy}) | [\`${board}\`](${board}) | [\`drops.ts\`](../scripts/story-reveal-specs/drops.ts) | [\`${base}-front.png\`](../public/images/${base}-front.png) · [\`-back.png\`](../public/images/${base}-back.png) |`;
}

/** Upsert each release's row into the ledger table, most recent first. */
async function updateRegistry(drops: DropRelease[], confirm: boolean): Promise<void> {
  const source = await fs.readFile(REGISTRY_PATH, 'utf8');
  const lines = source.split('\n');
  const headerIndex = lines.findIndex((l) => l.startsWith('| Drop date | Release |'));
  if (headerIndex === -1) {
    console.warn('  ⚠️  could not find the drops table in docs/drops-registry.md — skipping ledger update.');
    return;
  }
  const separatorIndex = headerIndex + 2; // header, separator, then data rows
  let end = separatorIndex;
  while (end < lines.length && lines[end].startsWith('|')) end++;

  const existing = lines.slice(separatorIndex, end);
  const bySlug = new Map<string, string>();
  for (const row of existing) {
    const match = row.match(/drop-kit-([a-z0-9-]+?)-\d+-\d+\.md/);
    if (match) bySlug.set(match[1], row);
  }
  for (const drop of drops) bySlug.set(drop.spec.slug, registryRow(drop));

  const rows = [...bySlug.values()].sort((a, b) => b.localeCompare(a)); // ISO date first column → desc
  const next = [...lines.slice(0, separatorIndex), ...rows, ...lines.slice(end)];
  for (const row of rows) console.log(`  ledger  ${row.match(/drop-kit-[a-z0-9-]+/)?.[0] ?? row.slice(0, 40)}`);
  if (!confirm) return;
  await fs.writeFile(REGISTRY_PATH, next.join('\n'), 'utf8');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slugs = slugsFromArgs(argv);
  const confirm = hasFlag(argv, 'confirm');
  const force = hasFlag(argv, 'force');
  const drops = slugs.map((slug) => getDrop(slug));

  logHeader(confirm ? '📄 drop:docs' : '📄 drop:docs — dry run');
  logRow('releases', slugs.join(', '));
  logRow('overwrite', force ? 'yes (--force)' : 'no — existing files are kept');

  await fs.mkdir(DOCS_DIR, { recursive: true });

  for (const drop of drops) {
    const { spec } = drop;
    const files: Array<[string, string]> = [
      [`drop-kit-${spec.slug}-${spec.x}-${spec.y}.md`, renderKit(drop)],
      [`drop-copy-${spec.slug}-${spec.x}-${spec.y}.md`, renderCopy(drop)],
      [`storyboard-${spec.slug}-${spec.x}-${spec.y}.html`, renderStoryboard(drop)],
    ];
    console.log(`\n▸ ${spec.slug}`);
    for (const [name, content] of files) {
      const target = path.join(DOCS_DIR, name);
      const exists = await fs
        .access(target)
        .then(() => true)
        .catch(() => false);
      if (exists && !force) {
        console.log(`  ⊘ ${name}  (exists — pass --force to regenerate)`);
        continue;
      }
      if (confirm) await fs.writeFile(target, content, 'utf8');
      console.log(`  ${confirm ? '✓' : '•'} ${name}  (${(content.length / 1024).toFixed(1)} KB)`);
    }
  }

  console.log('');
  await updateRegistry(drops, confirm);
  console.log(
    confirm
      ? `\nDone. ${drops.length} release(s) documented.\n`
      : `\nDry run — nothing written.\n`,
  );
}

main().catch((err) => {
  console.error('\n❌ drop:docs failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
