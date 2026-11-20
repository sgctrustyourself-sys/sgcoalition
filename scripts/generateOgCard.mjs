// Renders the social share cards — public/og/card.jpg (the generic brand card)
// plus one card per prerendered route, public/og/<route>.jpg.
//
// Run by hand — `node scripts/generateOgCard.mjs` — and commit the results. It is
// deliberately NOT wired into prebuild/postbuild: sharp is a devDependency, so a
// production install (NODE_ENV=production) must never need it to build the site.
// Everything downstream just points <meta og:image> at the committed files.
//
// The route list is imported from scripts/generateSeoArtifacts.mjs, so a route
// cannot exist without a card: adding a route to STATIC_ROUTES without a
// `cardTitle` fails this script, and tests/seoMeta.test.ts fails if a carded
// route has no committed file.
//
// Why this exists at all: the site used to share /hero-cinematic.png, which was a
// 1024x1024 JPEG named .png — a small square thumbnail on every scraper, served
// with the wrong Content-Type. Worse, all ten routes shared that one image, so a
// link to /help and a link to /shop unfurled identically.
//
// Re-run it whenever public/hero-cinematic.png changes or a cardTitle changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { STATIC_ROUTES } from './generateSeoArtifacts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public', 'hero-cinematic.png');
const CARD_DIR = path.join(ROOT, 'public', 'og');

export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;

const PANEL_WIDTH = 620;
const PANEL_LEFT = OG_CARD_WIDTH - PANEL_WIDTH;
const TEXT_LEFT = 72;
const TEXT_MAX_WIDTH = PANEL_LEFT - TEXT_LEFT - 56;
const TEXT_MAX_HEIGHT = OG_CARD_HEIGHT - 110;
const ACCENT = '#8b5cf6';
const FONT_STACK = 'Arial, Helvetica, sans-serif';

// Largest first: a wrapped two-line headline at a big size reads better than a
// small single line, so each size is tried as one line, then as two.
const HEADLINE_SIZES = [76, 70, 64, 58, 52, 46, 40];

// The path rule, mirroring shareCardImage() in utils/seo.ts. '/' is the generic
// brand card, every other route gets its own.
export const shareCardPath = (routePath) =>
  !routePath || routePath === '/' ? '/og/card.jpg' : `/og${routePath}.jpg`;

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const wrapToTwoLines = (headline) => {
  const words = headline.split(' ');
  if (words.length < 2) return [headline];

  // Split nearest the middle so the two lines stay visually balanced.
  let best = null;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(' ');
    const second = words.slice(index).join(' ');
    const imbalance = Math.abs(first.length - second.length);
    if (!best || imbalance < best.imbalance) best = { lines: [first, second], imbalance };
  }

  return best ? best.lines : [headline];
};

// Accent bar, headline, brand tagline and domain — the left plate's whole text
// block. Rendered on a transparent canvas so it can be measured and centered.
const buildTextBlockSvg = (headlineLines, headlineSize) => {
  const lineHeight = Math.round(headlineSize * 1.06);
  // Baseline of the first headline line: the accent bar's height plus a gap that
  // scales with the type, so the bar never crowds a big headline.
  let cursorY = 5 + Math.round(headlineSize * 1.02);
  const parts = [`<rect x="0" y="0" width="58" height="5" fill="${ACCENT}"/>`];

  for (const line of headlineLines) {
    parts.push(
      `<text x="0" y="${cursorY}" font-family="${FONT_STACK}" font-size="${headlineSize}" `
      + `font-weight="bold" letter-spacing="2" fill="#ffffff">${escapeXml(line)}</text>`,
    );
    cursorY += lineHeight;
  }

  cursorY += 20;
  parts.push(
    `<text x="4" y="${cursorY}" font-family="${FONT_STACK}" font-size="20" font-weight="bold" `
    + `letter-spacing="6" fill="#a1a1aa">CRAFTED IN BALTIMORE</text>`,
  );
  cursorY += 30;
  parts.push(
    `<text x="4" y="${cursorY}" font-family="${FONT_STACK}" font-size="18" font-weight="bold" `
    + `letter-spacing="3" fill="#71717a">SGCOALITION.XYZ</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_CARD_WIDTH}" height="${OG_CARD_HEIGHT}">`
    + `${parts.join('')}</svg>`;
};

/** The block's real ink box, measured from the pixels rather than estimated from
 *  font metrics, so a headline that would collide with the artwork panel fails
 *  here instead of shipping. Scanned by hand instead of using sharp's trim():
 *  trim anchors on the top-left pixel, and the accent bar occupies that corner,
 *  which makes every candidate "fit" the whole canvas. */
const renderTextBlock = async (svg) => {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) throw new Error('Share-card text block rendered empty.');

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const buffer = await sharp(png).extract({ left: minX, top: minY, width, height }).png().toBuffer();

  return { buffer, width, height };
};

const fitTextBlock = async (headline) => {
  const candidates = headline.includes(' ') ? [wrapToTwoLines(headline), [headline]] : [[headline]];

  for (const size of HEADLINE_SIZES) {
    for (const lines of candidates) {
      const block = await renderTextBlock(buildTextBlockSvg(lines, size));
      if (block.width <= TEXT_MAX_WIDTH && block.height <= TEXT_MAX_HEIGHT) {
        return { ...block, headlineSize: size, lines };
      }
    }
  }

  throw new Error(
    `Share-card headline "${headline}" does not fit the plate at any size (max ${TEXT_MAX_WIDTH}x${TEXT_MAX_HEIGHT}).`,
  );
};

const panel = await sharp(SOURCE)
  .resize(PANEL_WIDTH, OG_CARD_HEIGHT, { fit: 'cover', position: 'centre' })
  .modulate({ brightness: 0.92, saturation: 0.95 })
  .toBuffer();

// Fades the artwork panel's left edge into the brand black instead of a hard seam.
const blend = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_CARD_WIDTH}" height="${OG_CARD_HEIGHT}">`
  + '<defs><linearGradient id="blend" x1="0" y1="0" x2="1" y2="0">'
  + '<stop offset="0" stop-color="#0a0a0a" stop-opacity="1"/>'
  + '<stop offset="1" stop-color="#0a0a0a" stop-opacity="0"/>'
  + '</linearGradient></defs>'
  + `<rect x="${PANEL_LEFT - 150}" y="0" width="300" height="${OG_CARD_HEIGHT}" fill="url(#blend)"/>`
  + '</svg>',
);

const renderCard = async ({ file, headline }) => {
  const block = await fitTextBlock(headline.toUpperCase());
  const top = Math.max(0, Math.round((OG_CARD_HEIGHT - block.height) / 2));

  const card = await sharp({
    create: { width: OG_CARD_WIDTH, height: OG_CARD_HEIGHT, channels: 3, background: '#0a0a0a' },
  })
    .composite([
      { input: panel, left: PANEL_LEFT, top: 0 },
      { input: blend, left: 0, top: 0 },
      { input: block.buffer, left: TEXT_LEFT, top },
    ])
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toBuffer();

  fs.writeFileSync(file, card);

  const written = await sharp(card).metadata();
  if (written.width !== OG_CARD_WIDTH || written.height !== OG_CARD_HEIGHT || written.format !== 'jpeg') {
    throw new Error(`Share card ${file} came out ${written.width}x${written.height} ${written.format}.`);
  }

  return {
    file: path.relative(ROOT, file),
    headline: block.lines.join(' / '),
    size: block.headlineSize,
    textWidth: block.width,
    bytes: card.length,
  };
};

fs.mkdirSync(CARD_DIR, { recursive: true });

const results = [];

for (const route of STATIC_ROUTES) {
  if (!route.cardTitle) {
    throw new Error(`Route ${route.path} has no cardTitle, so it would share the generic card.`);
  }

  results.push(
    await renderCard({
      file: path.join(ROOT, 'public', shareCardPath(route.path).replace(/^\//, '')),
      headline: route.cardTitle,
    }),
  );
}

results.push(await renderCard({ file: path.join(CARD_DIR, 'card.jpg'), headline: 'Coalition' }));

for (const result of results) {
  console.log(
    `[og] ${result.file.padEnd(24)} "${result.headline}" @${result.size}px `
    + `text ${result.textWidth}px wide, ${(result.bytes / 1024).toFixed(0)} kB`,
  );
}

console.log(`[og] Wrote ${results.length} cards, all ${OG_CARD_WIDTH}x${OG_CARD_HEIGHT} JPEG.`);
