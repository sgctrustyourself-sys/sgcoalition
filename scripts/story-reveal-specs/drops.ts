/**
 * scripts/story-reveal-specs/drops.ts — the single owner of Coalition drop data.
 *
 * ONE entry per release. Every consumer reads THIS file, so a release can no
 * longer disagree with itself across surfaces:
 *
 *   - `scripts/render-story.ts`            → `DROPS[slug].spec`      (social PNGs, 3 formats)
 *   - `scripts/generateDropDocs.mjs`       → spec + copy             (docs trio + registry row)
 *   - `scripts/upsertDropProduct.ts`       → listing                 (Supabase products row)
 *   - `scripts/generateDropPost.ts`        → copy.post*              (blog drop post)
 *   - `scripts/sendDropEmail.ts`           → dropId grouping         (one email per drop day)
 *
 * Adding a release is one object literal. Nothing else needs editing:
 * `render-story.ts` resolves the spec from this registry by slug, and every
 * generator reads the same entry, so the poster, the docs, the listing and the
 * post cannot drift.
 *
 * Conventions inherited from docs/drops-registry.md:
 *   - slug is kebab-case; it names the rendered PNGs, the docs and the local assets.
 *   - `spec.price` is the DISPLAY string the slide templates read ("$85").
 *     `listing.price` is the numeric column. tests/dropRegistry.test.ts pins them
 *     to each other so a poster can never advertise a price the PDP rejects.
 *   - `spec.images.*` are relative to the rendered reviewer HTML in
 *     docs/{story,grid,x}-reveal/, i.e. '../../public/images/<name>.png'.
 */

// ─── Render-spec types (consumed by scripts/render-story.ts + the templates) ──

export type SlideLayout = 'hero' | 'detail' | 'scarcity' | 'manifesto' | 'cta';

export type StickerType = 'countdown' | 'poll' | 'mention' | 'link' | 'emoji';
export type StickerAnchor =
  | 'top-left'
  | 'top-right'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center-left';

export interface StickerHint {
  /** What kind of IG sticker the user should overlay in-app. */
  type: StickerType;
  /** Where on the rendered slide the sticker prompt sits (reviewer aid only). */
  anchor: StickerAnchor;
  /** Reviewer-aid text — explains what to overlay in IG. Not part of the post. */
  label: string;
}

export interface SlideSpec {
  layout: SlideLayout;

  /** HERO: small wordmark in top safe. SCARCITY + CTA: tracked eyebrow. */
  wordmark?: string;
  eyebrow?: string;

  /** Display copy (Bebas Neue 88–140 px in the rendered output). */
  headline?: string;

  /** 32 px body copy (Inter). */
  body?: string[];

  /** SCARCITY only: 60 px price lockup. CTA only: small URL. */
  price?: string;
  url?: string;

  /** Reviewer-aid stickers (NOT rendered on the post — added in IG in-app). */
  stickers?: StickerHint[];
}

export interface DropSpec {
  slug: string;

  /** Uppercase release name used in display text — "GREY WAVE" */
  releaseName: string;

  /** Title-cased used in long-form copy — "Coalition 'Grey Wave' Wallet 1/2" */
  productName: string;

  /** Variant numerator. 1 for first of two, 2 for second. */
  x: number;
  /** Variant denominator. 2 for a 1/2 run, 12 for a 12-piece run, etc. */
  y: number;

  /** "$85" with the dollar sign already prefixed. Mirrors listing.price. */
  price: string;

  /** "sgcoalition.xyz/shop" — used in CTA slide. */
  shopUrl: string;

  /** Relative paths from the rendered HTML file at docs/story-reveal/{slug}-slide-N.html back to project root. */
  images: {
    front: string;
    back: string;
  };

  /**
   * Exactly 5 slides: hero, detail, scarcity, manifesto, cta.
   * NOTE: Numeric `x` and `y` above are documentation/decoration only.
   * The template reads the formatted strings from each SlideSpec
   * (`headline`, `eyebrow`, `url`, etc.) directly.
   */
  slides: SlideSpec[];
}

// ─── Listing / copy types (consumed by the generators) ───────────────────────

/** The Supabase `products` row this release becomes. Columns mirror scripts/syncProducts.ts. */
export interface ReleaseListing {
  /** Supabase row id. Keep stable — a new id creates a duplicate row. */
  id: string;
  /** Numeric column. Must equal spec.price (pinned by tests/dropRegistry.test.ts). */
  price: number;
  category: string;
  sizes: string[];
  sizeInventory: Record<string, number>;
  isLimitedEdition: boolean;
  isFeatured: boolean;
  /** PDP copy. One or two sentences, matching the catalog's existing voice. */
  description: string;
  /**
   * Public image URLs written to products.images. Filled by
   * `npm run drop:assets -- --slug <slug> --confirm`, which uploads the local
   * PNGs to the Supabase `products` bucket and prints the URLs back here.
   * Empty until then — `upsertDropProduct --confirm` refuses to write a row
   * with no images rather than listing an imageless product.
   */
  storeImages: string[];
  /**
   * Production cost per unit, in dollars. The `products` table has no cost
   * column, so this is the one place the number lives and `drop:list` prints the
   * margin from it on every run.
   */
  unitCost?: number;
}

/** The copy deck. Mirrors docs/drop-copy-<slug>.md section for section. */
export interface ReleaseCopy {
  /** Carousel caption for the IG grid post (~570 chars in the worked example). */
  igCaptionLong: string;
  /** Stories-first / casual feed caption. */
  igCaptionShort: string;
  /** X single post (≤ 280 chars). */
  xSingle: string;
  /** Exactly 3, published in order. Tweet 3 ends on the brand line, not the URL. */
  xThread: [string, string, string];
  /** Always included, in this order. */
  hashtagsCanonical: string[];
  /** Rotate 2–3 per post for reach — never all at once. */
  hashtagsTier2: string[];
  /** ≤ 200 chars — internal Slack / Discord / SMS preview. */
  slackOneLiner: string;
  /** Blog drop post (same shape as data/blogPosts.ts entries). */
  postTitle: string;
  postSlug: string;
  postExcerpt: string;
  postTags: string[];
  /** HTML body. Uses the local /images/<slug>-*.png paths public/ serves. */
  postBody: string;
}

export interface DropRelease {
  /** Groups releases announced together — one email per dropId, not per piece. */
  dropId: string;
  /** ISO date (YYYY-MM-DD). */
  dropDate: string;
  spec: DropSpec;
  listing: ReleaseListing;
  copy: ReleaseCopy;
}

// ─── Asset path helpers ──────────────────────────────────────────────────────

/** Rendered-reviewer-HTML directory the spec's relative image paths are written against. */
export const REVEAL_DOC_DIR = 'docs/story-reveal';

/**
 * Project-relative path of a release's local source PNG. The spec stores paths
 * relative to docs/story-reveal/ (that is where the reviewer HTML lands), so the
 * renderer and this helper must agree on that base.
 */
export function assetRelPath(spec: DropSpec, which: 'front' | 'back'): string {
  const rel = spec.images[which];
  if (!rel.startsWith('../../')) {
    throw new Error(
      `Spec "${spec.slug}" image path "${rel}" must be relative to ${REVEAL_DOC_DIR}/ (i.e. start with ../../).`,
    );
  }
  return rel.replace(/^\.\.\/\.\.\//, '');
}

/** Local PNG filename base for a release — public/images/<base>-{front,back}.png */
export function assetBase(spec: DropSpec): string {
  const filename = assetRelPath(spec, 'front').split('/').pop() || '';
  return filename.replace(/-front\.(png|jpg|jpeg|webp)$/i, '');
}

// ─── The registry ────────────────────────────────────────────────────────────

/**
 * Release entries, keyed by slug.
 *
 * grey-wave is the migrated worked example (docs/drop-kit-grey-wave.md). Its
 * hand-authored trio in docs/ is intentionally NOT regenerated: `drop:docs`
 * refuses to overwrite an existing document without --force.
 */
export const DROPS: Record<string, DropRelease> = {
  // ───────────────────────────────────────────────────────────────────────────
  // Grey Wave 1/2 — drop date 2026-06-20 · migrated from grey-wave.ts
  // Mirror of docs/drop-kit-grey-wave.md "IG Story variants" section.
  // NOTE: the legacy hand-authored trio quotes $35 for this piece; the Supabase
  // row and every other wallet in the catalog are $85. The registry now owns the
  // price and says $85 — the legacy trio is stale on that one number.
  // ───────────────────────────────────────────────────────────────────────────
  'grey-wave': {
    dropId: 'drop-2026-06-20',
    dropDate: '2026-06-20',
    spec: {
      slug: 'grey-wave',

      releaseName: 'GREY WAVE',
      productName: "Coalition 'Grey Wave' Wallet 1/2",

      x: 1,
      y: 2,

      price: '$85',
      shopUrl: 'sgcoalition.xyz/shop',

      images: {
        front: '../../public/images/grey-wave-wallet-1-2-front.png',
        back: '../../public/images/grey-wave-wallet-1-2-back.png',
      },

      slides: [
        {
          layout: 'hero',
          wordmark: 'COALITION',
          headline: 'GREY WAVE',
          body: ["Coalition 'Grey Wave' Wallet 1/2"],
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Countdown → drop time' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
        {
          layout: 'detail',
          headline: 'Hand-finished charcoal dye.',
          body: ['Inspired by Baltimore harbor at dawn — the moment before anything moves.'],
          stickers: [
            { type: 'poll', anchor: 'center-right', label: '"Harbor at dawn?" Yes / No' },
          ],
        },
        {
          layout: 'scarcity',
          eyebrow: 'LIMITED EDITION',
          headline: '1 OF 2',
          price: '$85',
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Drop time (primary urgency driver)' },
            { type: 'poll', anchor: 'bottom-left', label: '"Should we run 2/2?" Yes / Wait' },
          ],
        },
        {
          layout: 'manifesto',
          headline: 'TRUST YOURSELF.',
          body: ['Coalition is action. Show up.'],
          stickers: [
            { type: 'mention', anchor: 'bottom-right', label: '@sgcoalition mention' },
            { type: 'emoji', anchor: 'center-left', label: '🔥 Trust Yourself (emoji slider, optional)' },
          ],
        },
        {
          layout: 'cta',
          eyebrow: 'GREY WAVE / WALLET 1/2',
          headline: 'SHOP NOW',
          url: 'sgcoalition.xyz/shop',
          stickers: [
            { type: 'link', anchor: 'center-right', label: 'Story → PDP conversion path' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
      ],
    },
    listing: {
      id: 'Coalition_Grey_Wave_Wallet_1_2',
      price: 85,
      category: 'wallet',
      sizes: ['One Size'],
      sizeInventory: { 'One Size': 0 },
      isLimitedEdition: false,
      isFeatured: false,
      description:
        "First piece in the Coalition 'Grey Wave' wallet run. Hand-finished with a custom charcoal-grey dye pattern inspired by Baltimore harbor at dawn. Built as a limited 1/2 collectible — once sold, it's gone forever.",
      storeImages: [
        'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_7z2h8u6.jpg',
        'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_UqtbJCq.jpg',
      ],
    },
    copy: {
      igCaptionLong:
        '🌊 GREY WAVE.\n\nCoalition \'Grey Wave\' Wallet 1/2 — $85.\n\nHand-finished charcoal dye. Inspired by Baltimore harbor at dawn — the moment before anything moves. 1 of 2 in this run. Limited edition.\n\nWhen it\'s gone, it\'s gone. Trust Yourself.\n\n🔗 Link in bio → sgcoalition.xyz/shop\n\n#Coalition #GreyWave #BaltimoreStreetwear #TrustYourself #LimitedEdition',
      igCaptionShort:
        '🌊 GREY WAVE.\n\nCoalition \'Grey Wave\' Wallet 1/2 — $85. 1 of 2. Hand-finished charcoal dye.\n\nWhen it\'s gone, it\'s gone.\n\n🔗 Link in bio.\n\n#Coalition #GreyWave #TrustYourself #LimitedEdition #BaltimoreStreetwear',
      xSingle:
        "🌊 GREY WAVE. Coalition 'Grey Wave' Wallet 1/2 — $85. Hand-finished charcoal dye. Inspired by Baltimore harbor at dawn. Limited 1/2. Once it's gone, it's gone. sgcoalition.xyz/shop",
      xThread: [
        "🌊 GREY WAVE.\n\nCoalition 'Grey Wave' Wallet 1/2 — $85. Hand-finished charcoal dye inspired by Baltimore harbor at dawn. Once it's gone, it's gone.\n\nsgcoalition.xyz/shop",
        '1 of 2. No reprints.\n\nEach wallet is finished by hand. Harbor-at-dawn dye pattern — the moment before anything moves.',
        'Coalition is action. Trust Yourself. 🖤',
      ],
      hashtagsCanonical: ['#Coalition', '#GreyWave', '#BaltimoreStreetwear', '#TrustYourself', '#LimitedEdition'],
      hashtagsTier2: ['#Streetwear', '#Baltimore', '#1of2', '#GreyWaveEdition', '#HandFinished', '#Drops'],
      slackOneLiner:
        "🌊 GREY WAVE. Coalition 'Grey Wave' Wallet 1/2 — $85. 1 of 2. Hand-finished charcoal dye. sgcoalition.xyz/shop",
      postTitle: "Coalition 'Grey Wave' Wallet 1/2",
      postSlug: 'coalition-grey-wave-wallet-1-2',
      postExcerpt:
        'First piece in the Grey Wave run: hand-finished charcoal dye, inspired by Baltimore harbor at dawn.',
      postTags: ['drop', 'wallet', 'limited', 'grey-wave'],
      postBody: `
<img src="/images/grey-wave-wallet-1-2-front.png" alt="Coalition Grey Wave Wallet 1/2 — front" style="width:100%;border-radius:16px;margin-bottom:24px;" />

The first Grey Wave wallet is a study in restraint. One dye pattern, worked by hand until it held the color of the harbor before anything moves.

<h2>THE BUILD</h2>

<ul>
<li><strong>Full-grain leather</strong>, cut and stitched in-house.</li>
<li><strong>Charcoal dye</strong>, applied by hand — no two pieces take it the same way.</li>
<li><strong>Copper grommet</strong> and a single Coalition mark.</li>
</ul>

<img src="/images/grey-wave-wallet-1-2-back.png" alt="Coalition Grey Wave Wallet 1/2 — back" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE RUN</h2>

Two pieces. This is the first. When they are gone, they do not come back.

<em>Trust the process. Trust yourself.</em>
`.trim(),
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Pink / Silver Crop Top — draft listing values, correct in ONE place.
  // ───────────────────────────────────────────────────────────────────────────
  'pink-silver-crop-top': {
    dropId: 'drop-2026-09-17',
    dropDate: '2026-09-17',
    spec: {
      slug: 'pink-silver-crop-top',

      releaseName: 'PINK / SILVER',
      productName: "Women's Leopard Print Crop T-Shirt",

      x: 1,
      y: 12,

      price: '$45',
      shopUrl: 'sgcoalition.xyz/shop',

      images: {
        front: '../../public/images/pink-silver-crop-top-front.png',
        back: '../../public/images/pink-silver-crop-top-back.png',
      },

      slides: [
        {
          layout: 'hero',
          wordmark: 'COALITION',
          headline: 'PINK / SILVER',
          body: ['Leopard Print Crop T-Shirt'],
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Countdown → drop time' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
        {
          layout: 'detail',
          headline: 'Silver on rose.',
          body: ['Pink leopard print, 3D silver puff lettering, cut fitted. Finished in-house, sized S–XL.'],
          stickers: [{ type: 'poll', anchor: 'center-right', label: '"Pink or silver first?" Pink / Silver' }],
        },
        {
          layout: 'scarcity',
          eyebrow: 'LIMITED RUN',
          headline: '1 OF 12',
          price: '$45',
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Drop time (primary urgency driver)' },
            { type: 'poll', anchor: 'bottom-left', label: '"Run it again?" Yes / Wait' },
          ],
        },
        {
          layout: 'manifesto',
          headline: 'TRUST YOURSELF.',
          body: ['Coalition is action. Show up.'],
          stickers: [
            { type: 'mention', anchor: 'bottom-right', label: '@sgcoalition mention' },
            { type: 'emoji', anchor: 'center-left', label: '💗 Trust Yourself (emoji slider, optional)' },
          ],
        },
        {
          layout: 'cta',
          eyebrow: 'PINK / SILVER · CROP TOP',
          headline: 'SHOP NOW',
          url: 'sgcoalition.xyz/shop',
          stickers: [
            { type: 'link', anchor: 'center-right', label: 'Story → PDP conversion path' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
      ],
    },
    listing: {
      id: 'prod_coalition_pink_silver_crop_top',
      price: 45,
      unitCost: 17.46,
      category: 'shirt',
      sizes: ['S', 'M', 'L', 'XL'],
      sizeInventory: { S: 3, M: 3, L: 3, XL: 3 },
      isLimitedEdition: true,
      isFeatured: false,
      description:
        "Women's Leopard Print Crop T-Shirt. Pink leopard print with 3D silver puff lettering — COALITION across the front, TRUST YOURSELF on the back. A 12-piece run, sized S–XL.",
      storeImages: [],
    },
    copy: {
      igCaptionLong:
        'PINK / SILVER.\n\nWomen\'s Leopard Print Crop T-Shirt — $45.\n\nPink leopard print, 3D silver puff lettering, cut fitted. Finished in-house. 1 of 12 in this run, sized S–XL.\n\nWhen it\'s gone, it\'s gone. Trust Yourself.\n\n🔗 Link in bio → sgcoalition.xyz/shop\n\n#Coalition #PinkSilver #BaltimoreStreetwear #TrustYourself #LimitedEdition',
      igCaptionShort:
        'PINK / SILVER.\n\nWomen\'s Leopard Print Crop T-Shirt — $45. 1 of 12. Sized S–XL.\n\nWhen it\'s gone, it\'s gone.\n\n🔗 Link in bio.\n\n#Coalition #PinkSilver #TrustYourself #LimitedEdition #BaltimoreStreetwear',
      xSingle:
        'PINK / SILVER. Women\'s Leopard Print Crop T-Shirt — $45. Pink leopard print, 3D silver puff lettering, cut fitted. 12-piece run, S–XL. Once it\'s gone, it\'s gone. sgcoalition.xyz/shop',
      xThread: [
        'PINK / SILVER.\n\nWomen\'s Leopard Print Crop T-Shirt — $45. Pink leopard print, 3D silver puff lettering, cut fitted. Sized S–XL. Once it\'s gone, it\'s gone.\n\nsgcoalition.xyz/shop',
        '1 of 12. No reprints.\n\nThe leopard print reads up close; the silver puff carries across a room.',
        'Coalition is action. Trust Yourself. 🖤',
      ],
      hashtagsCanonical: ['#Coalition', '#PinkSilver', '#BaltimoreStreetwear', '#TrustYourself', '#LimitedEdition'],
      hashtagsTier2: ['#Streetwear', '#Baltimore', '#1of12', '#PinkSilverEdition', '#HandFinished', '#Drops'],
      slackOneLiner:
        'PINK / SILVER. Women\'s Leopard Print Crop T-Shirt — $45. 1 of 12. Sized S–XL. sgcoalition.xyz/shop',
      postTitle: "Women's Leopard Print Crop T-Shirt",
      postSlug: 'coalition-pink-silver-crop-top',
      postExcerpt:
        'Pink leopard print, 3D silver puff lettering, cut fitted. A 12-piece run, finished in-house and sized S–XL.',
      postTags: ['drop', 'apparel', 'limited', 'pink-silver'],
      postBody: `
<img src="/images/pink-silver-crop-top-front.png" alt="Women's Leopard Print Crop T-Shirt — front" style="width:100%;border-radius:16px;margin-bottom:24px;" />

Two prints on one piece: a pink leopard base up close, 3D silver puff lettering that carries across a room.

<h2>THE BUILD</h2>

<ul>
<li><strong>Fitted crop</strong> with a clean neckline — built to sit right without adjusting all night.</li>
<li><strong>3D silver puff</strong> lettering — COALITION across the front, TRUST YOURSELF on the back.</li>
<li><strong>Twelve pieces</strong> in the run, sized S–XL.</li>
</ul>

<img src="/images/pink-silver-crop-top-back.png" alt="Women's Leopard Print Crop T-Shirt — back" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE RUN</h2>

Twelve pieces, one run. When they are gone, they do not come back.

<em>Trust the process. Trust yourself.</em>
`.trim(),
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Coalition Fleece Hoodie — draft listing values, correct in ONE place.
  // Copy rule: describe the silhouette, never the brand the blank is based on.
  // ───────────────────────────────────────────────────────────────────────────
  'coalition-fleece-hoodie': {
    dropId: 'drop-2026-09-17',
    dropDate: '2026-09-17',
    spec: {
      slug: 'coalition-fleece-hoodie',

      releaseName: 'COALITION FLEECE',
      productName: 'Coalition Fleece Hoodie',

      x: 1,
      y: 15,

      price: '$100',
      shopUrl: 'sgcoalition.xyz/shop',

      images: {
        front: '../../public/images/coalition-fleece-hoodie-front.png',
        back: '../../public/images/coalition-fleece-hoodie-back.png',
      },

      slides: [
        {
          layout: 'hero',
          wordmark: 'COALITION',
          headline: 'COALITION FLEECE',
          body: ['Coalition Fleece Hoodie'],
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Countdown → drop time' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
        {
          layout: 'detail',
          headline: 'Brushed fleece, built to be worn out.',
          body: ['Midweight fleece with a brushed interior and a cut that holds its shape.'],
          stickers: [{ type: 'poll', anchor: 'center-right', label: '"Hood up or down?" Up / Down' }],
        },
        {
          layout: 'scarcity',
          eyebrow: 'LIMITED RUN',
          headline: '1 OF 15',
          price: '$100',
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Drop time (primary urgency driver)' },
            { type: 'poll', anchor: 'bottom-left', label: '"Second colorway?" Yes / Wait' },
          ],
        },
        {
          layout: 'manifesto',
          headline: 'TRUST YOURSELF.',
          body: ['Coalition is action. Show up.'],
          stickers: [
            { type: 'mention', anchor: 'bottom-right', label: '@sgcoalition mention' },
            { type: 'emoji', anchor: 'center-left', label: '🔥 Trust Yourself (emoji slider, optional)' },
          ],
        },
        {
          layout: 'cta',
          eyebrow: 'COALITION FLEECE · HOODIE',
          headline: 'SHOP NOW',
          url: 'sgcoalition.xyz/shop',
          stickers: [
            { type: 'link', anchor: 'center-right', label: 'Story → PDP conversion path' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
      ],
    },
    listing: {
      id: 'prod_coalition_fleece_hoodie',
      price: 100,
      category: 'apparel',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      sizeInventory: { S: 3, M: 3, L: 3, XL: 3, '2XL': 3 },
      isLimitedEdition: true,
      isFeatured: true,
      description:
        'Coalition Fleece Hoodie. Midweight fleece with a brushed interior and a cut that holds its shape. 15 pieces in the run, sized S–2XL.',
      storeImages: [],
    },
    copy: {
      igCaptionLong:
        'COALITION FLEECE.\n\nCoalition Fleece Hoodie — $100.\n\nMidweight fleece, brushed inside, cut to hold its shape. Finished in-house. 1 of 15 in this run, sized S–2XL.\n\nWhen it\'s gone, it\'s gone. Trust Yourself.\n\n🔗 Link in bio → sgcoalition.xyz/shop\n\n#Coalition #CoalitionFleece #BaltimoreStreetwear #TrustYourself #LimitedEdition',
      igCaptionShort:
        'COALITION FLEECE.\n\nCoalition Fleece Hoodie — $100. 1 of 15. Sized S–2XL.\n\nWhen it\'s gone, it\'s gone.\n\n🔗 Link in bio.\n\n#Coalition #CoalitionFleece #TrustYourself #LimitedEdition #BaltimoreStreetwear',
      xSingle:
        'COALITION FLEECE. Coalition Fleece Hoodie — $100. Midweight fleece, brushed inside, cut to hold its shape. 15-piece run, S–2XL. Once it\'s gone, it\'s gone. sgcoalition.xyz/shop',
      xThread: [
        'COALITION FLEECE.\n\nCoalition Fleece Hoodie — $100. Midweight fleece, brushed inside. Sized S–2XL. Once it\'s gone, it\'s gone.\n\nsgcoalition.xyz/shop',
        '1 of 15. No reprints.\n\nWinter weight without the bulk. Our mark on the chest, nothing on the back that needs explaining.',
        'Coalition is action. Trust Yourself. 🖤',
      ],
      hashtagsCanonical: ['#Coalition', '#CoalitionFleece', '#BaltimoreStreetwear', '#TrustYourself', '#LimitedEdition'],
      hashtagsTier2: ['#Streetwear', '#Baltimore', '#1of15', '#CoalitionFleeceEdition', '#HandFinished', '#Drops'],
      slackOneLiner:
        'COALITION FLEECE. Coalition Fleece Hoodie — $100. 1 of 15. Sized S–2XL. sgcoalition.xyz/shop',
      postTitle: 'Coalition Fleece Hoodie',
      postSlug: 'coalition-fleece-hoodie',
      postExcerpt:
        'Midweight fleece, brushed inside, cut to hold its shape. A 15-piece run finished in-house, sized S–2XL.',
      postTags: ['drop', 'apparel', 'limited', 'fleece'],
      postBody: `
<img src="/images/coalition-fleece-hoodie-front.png" alt="Coalition Fleece Hoodie — front" style="width:100%;border-radius:16px;margin-bottom:24px;" />

The hoodie we wanted to wear through a Baltimore winter: real weight, brushed inside, and a cut that keeps its shape after the wash.

<h2>THE BUILD</h2>

<ul>
<li><strong>Midweight fleece</strong> with a brushed interior.</li>
<li><strong>Our mark</strong> across the chest — nothing on the back that needs explaining.</li>
<li><strong>Fifteen pieces</strong> in the run, sized S–2XL.</li>
</ul>

<img src="/images/coalition-fleece-hoodie-back.png" alt="Coalition Fleece Hoodie — back" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE RUN</h2>

Fifteen pieces, one run. When they are gone, they do not come back.

<em>Trust the process. Trust yourself.</em>
`.trim(),
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Above as Below Thermal — draft listing values, correct in ONE place.
  // Joins the existing Above as Below line (tee $75, shorts $75, set $120).
  // ───────────────────────────────────────────────────────────────────────────
  'above-as-below-thermal': {
    dropId: 'drop-2026-09-17',
    dropDate: '2026-09-17',
    spec: {
      slug: 'above-as-below-thermal',

      releaseName: 'ABOVE AS BELOW',
      productName: 'Coalition Above as Below Thermal',

      x: 1,
      y: 15,

      price: '$75',
      shopUrl: 'sgcoalition.xyz/shop',

      images: {
        front: '../../public/images/above-as-below-thermal-front.png',
        back: '../../public/images/above-as-below-thermal-back.png',
      },

      slides: [
        {
          layout: 'hero',
          wordmark: 'COALITION',
          headline: 'ABOVE AS BELOW',
          body: ['Coalition Above as Below Thermal'],
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Countdown → drop time' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
        {
          layout: 'detail',
          headline: 'Red thermal, Above as Below.',
          body: ['Waffle knit warmth with the Above as Below artwork, worked in red.'],
          stickers: [{ type: 'poll', anchor: 'center-right', label: '"Thermal or tee?" Thermal / Tee' }],
        },
        {
          layout: 'scarcity',
          eyebrow: 'LIMITED RUN',
          headline: '1 OF 15',
          price: '$75',
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Drop time (primary urgency driver)' },
            { type: 'poll', anchor: 'bottom-left', label: '"Match it to the set?" Yes / Wait' },
          ],
        },
        {
          layout: 'manifesto',
          headline: 'TRUST YOURSELF.',
          body: ['Coalition is action. Show up.'],
          stickers: [
            { type: 'mention', anchor: 'bottom-right', label: '@sgcoalition mention' },
            { type: 'emoji', anchor: 'center-left', label: '🔥 Trust Yourself (emoji slider, optional)' },
          ],
        },
        {
          layout: 'cta',
          eyebrow: 'ABOVE AS BELOW · THERMAL',
          headline: 'SHOP NOW',
          url: 'sgcoalition.xyz/shop',
          stickers: [
            { type: 'link', anchor: 'center-right', label: 'Story → PDP conversion path' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
      ],
    },
    listing: {
      id: 'prod_coalition_above_as_below_thermal',
      price: 75,
      category: 'shirt',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      sizeInventory: { S: 3, M: 3, L: 3, XL: 3, '2XL': 3 },
      isLimitedEdition: true,
      isFeatured: false,
      description:
        'Coalition Above as Below Thermal. Waffle-knit warmth with the Above as Below artwork worked in red — the layer for the months the tee cannot cover. 15 pieces in the run, sized S–2XL.',
      storeImages: [],
    },
    copy: {
      igCaptionLong:
        'ABOVE AS BELOW.\n\nCoalition Above as Below Thermal — $75.\n\nWaffle knit warmth with the Above as Below artwork, worked in red. Same lineage as the tee and the shorts. 1 of 15 in this run, sized S–2XL.\n\nWhen it\'s gone, it\'s gone. Trust Yourself.\n\n🔗 Link in bio → sgcoalition.xyz/shop\n\n#Coalition #AboveAsBelow #BaltimoreStreetwear #TrustYourself #LimitedEdition',
      igCaptionShort:
        'ABOVE AS BELOW.\n\nCoalition Above as Below Thermal — $75. 1 of 15. Waffle knit, red artwork. Sized S–2XL.\n\nWhen it\'s gone, it\'s gone.\n\n🔗 Link in bio.\n\n#Coalition #AboveAsBelow #TrustYourself #LimitedEdition #BaltimoreStreetwear',
      xSingle:
        'ABOVE AS BELOW. Coalition Above as Below Thermal — $75. Waffle knit warmth, red artwork, matching the tee and shorts. 15-piece run, S–2XL. Once it\'s gone, it\'s gone. sgcoalition.xyz/shop',
      xThread: [
        'ABOVE AS BELOW.\n\nCoalition Above as Below Thermal — $75. Waffle knit warmth with the Above as Below artwork in red. Sized S–2XL. Once it\'s gone, it\'s gone.\n\nsgcoalition.xyz/shop',
        '1 of 15. No reprints.\n\nSame lineage as the tee and the shorts — built for the months the tee cannot cover.',
        'Coalition is action. Trust Yourself. 🖤',
      ],
      hashtagsCanonical: ['#Coalition', '#AboveAsBelow', '#BaltimoreStreetwear', '#TrustYourself', '#LimitedEdition'],
      hashtagsTier2: ['#Streetwear', '#Baltimore', '#1of15', '#AboveAsBelowEdition', '#HandFinished', '#Drops'],
      slackOneLiner:
        'ABOVE AS BELOW. Coalition Above as Below Thermal — $75. 1 of 15. Sized S–2XL. sgcoalition.xyz/shop',
      postTitle: 'Coalition Above as Below Thermal',
      postSlug: 'coalition-above-as-below-thermal',
      postExcerpt:
        'Waffle knit warmth with the Above as Below artwork worked in red — same lineage as the tee and the shorts.',
      postTags: ['drop', 'apparel', 'limited', 'above-as-below'],
      postBody: `
<img src="/images/above-as-below-thermal-front.png" alt="Coalition Above as Below Thermal — front" style="width:100%;border-radius:16px;margin-bottom:24px;" />

Above as Below started as a tee and a pair of shorts. This is the layer for the months those cannot cover.

<h2>THE BUILD</h2>

<ul>
<li><strong>Waffle knit</strong> for warmth without weight.</li>
<li><strong>Above as Below artwork</strong> worked in red, matched to the rest of the line.</li>
<li><strong>Fifteen pieces</strong> in the run, sized S–2XL.</li>
</ul>

<img src="/images/above-as-below-thermal-back.png" alt="Coalition Above as Below Thermal — back" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE RUN</h2>

Fifteen pieces, one run. When they are gone, they do not come back.

<em>Trust the process. Trust yourself.</em>
`.trim(),
    },
  },
};

// ─── Registry helpers ────────────────────────────────────────────────────────

export function listDropSlugs(): string[] {
  return Object.keys(DROPS).sort();
}

/**
 * Resolve a release by slug. Throws with the list of known slugs rather than
 * silently rendering the wrong drop — a typo used to fail only when the
 * dynamic import could not find a file.
 */
export function getDrop(slug: string): DropRelease {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Invalid slug "${slug}". Expected kebab-case (a-z, 0-9, dashes).`);
  }
  const drop = DROPS[slug];
  if (!drop) {
    throw new Error(
      `Unknown drop slug: "${slug}". Known slugs: ${listDropSlugs().join(', ')}. ` +
        `Add an entry to scripts/story-reveal-specs/drops.ts.`,
    );
  }
  return drop;
}

/** Releases announced on the same day share a dropId and go out in one email. */
export function dropsInGroup(dropId: string): DropRelease[] {
  return Object.values(DROPS).filter((d) => d.dropId === dropId);
}

/** Distinct dropIds, most recent first. */
export function listDropGroups(): string[] {
  const ids = new Set(Object.values(DROPS).map((d) => d.dropId));
  return [...ids].sort((a, b) => b.localeCompare(a));
}

/**
 * Numeric price formatted the way `spec.price` must read. Keeps genesis of the
 * two price fields in one place so the guard test compares against real output
 * rather than a hand-written string.
 */
export function formatPrice(price: number): string {
  return `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
}
