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
  /**
   * True while the release is a mid-shoot draft with no source photos yet.
   * tests/dropRegistry.test.ts exempts these from the "source images on disk"
   * rule (the same courtesy the newest drop group gets) until real photos land
   * in public/images/<name>-{front,back}.png — then delete the flag.
   */
  awaitingPhotos?: boolean;
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
    // Mid-shoot draft — no source photos exist yet (repo or storage).
    awaitingPhotos: true,
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
          headline: 'Washed black. Orange metal.',
          body: ['Washed black with orange metal lettering across the chest, built to look better worn in.'],
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
        'Coalition Fleece Hoodie. Washed black with orange metal lettering across the chest, built to look better worn in. 15 pieces in the run, sized S–2XL.',
      storeImages: [],
    },
    copy: {
      igCaptionLong:
        'COALITION FLEECE.\n\nCoalition Fleece Hoodie — $100.\n\nWashed black. Orange metal across the chest. Built to look better worn in. Finished in-house. 1 of 15 in this run, sized S–2XL.\n\nWhen it\'s gone, it\'s gone. Trust Yourself.\n\n🔗 Link in bio → sgcoalition.xyz/shop\n\n#Coalition #CoalitionFleece #BaltimoreStreetwear #TrustYourself #LimitedEdition',
      igCaptionShort:
        'COALITION FLEECE.\n\nCoalition Fleece Hoodie — $100. 1 of 15. Washed black, orange metal. Sized S–2XL.\n\nWhen it\'s gone, it\'s gone.\n\n🔗 Link in bio.\n\n#Coalition #CoalitionFleece #TrustYourself #LimitedEdition #BaltimoreStreetwear',
      xSingle:
        'COALITION FLEECE. Coalition Fleece Hoodie — $100. Washed black, orange metal lettering across the chest. 15-piece run, S–2XL. Once it\'s gone, it\'s gone. sgcoalition.xyz/shop',
      xThread: [
        'COALITION FLEECE.\n\nCoalition Fleece Hoodie — $100. Washed black with orange metal across the chest. Sized S–2XL. Once it\'s gone, it\'s gone.\n\nsgcoalition.xyz/shop',
        '1 of 15. No reprints.\n\nWashed black, orange lettering, and a build that looks better the more you wear it. Finished in-house.',
        'Coalition is action. Trust Yourself. 🖤',
      ],
      hashtagsCanonical: ['#Coalition', '#CoalitionFleece', '#BaltimoreStreetwear', '#TrustYourself', '#LimitedEdition'],
      hashtagsTier2: ['#Streetwear', '#Baltimore', '#1of15', '#CoalitionFleeceEdition', '#HandFinished', '#Drops'],
      slackOneLiner:
        'COALITION FLEECE. Coalition Fleece Hoodie — $100. 1 of 15. Sized S–2XL. sgcoalition.xyz/shop',
      postTitle: 'Coalition Fleece Hoodie',
      postSlug: 'coalition-fleece-hoodie',
      postExcerpt:
        'Washed black with orange metal lettering across the chest — a 15-piece run finished in-house, sized S–2XL.',
      postTags: ['drop', 'apparel', 'limited', 'fleece'],
      postBody: `
<img src="/images/coalition-fleece-hoodie-front.png" alt="Coalition Fleece Hoodie — front" style="width:100%;border-radius:16px;margin-bottom:24px;" />

The hoodie we wanted to wear through a Baltimore winter: washed black, heavy through the body, and better looking the more it gets lived in.

<h2>THE BUILD</h2>

<ul>
<li><strong>Washed black</strong> — the wash is the point, not a defect.</li>
<li><strong>Orange metal lettering</strong> across the chest.</li>
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
    // Mid-shoot draft — no source photos exist yet (repo or storage).
    awaitingPhotos: true,
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

  // ───────────────────────────────────────────────────────────────────────────
  // GHOST RIDERS: AFTER DARK — 1/1 hand-stitched patchwork wallet, $80.
  // Drop date 2026-10-02. One piece only: sizeInventory holds one One Size
  // unit. Store images are the two real product photos plus the drop artwork.
  // ───────────────────────────────────────────────────────────────────────────
  'ghost-riders-after-dark': {
    dropId: 'drop-2026-10-02',
    dropDate: '2026-10-02',
    spec: {
      slug: 'ghost-riders-after-dark',

      releaseName: 'GHOST RIDERS: AFTER DARK',
      productName: "Coalition 'Ghost Riders: After Dark' Wallet 1/1",

      x: 1,
      y: 1,

      price: '$80',
      shopUrl: 'sgcoalition.xyz/shop',

      images: {
        front: '../../public/images/ghost-riders-wallet-front.png',
        back: '../../public/images/ghost-riders-wallet-back.png',
      },

      slides: [
        {
          layout: 'hero',
          wordmark: 'COALITION',
          headline: 'GHOST RIDERS',
          body: ["Coalition 'Ghost Riders: After Dark' Wallet 1/1"],
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Countdown → drop time' },
            { type: 'mention', anchor: 'bottom-left', label: '@sgcoalition mention' },
          ],
        },
        {
          layout: 'detail',
          headline: 'Stitched after dark.',
          body: [
            'Camo and rust corduroy patchwork under green blanket stitching — the Coalition banner on one face, the skull gang riding out on the other.',
          ],
          stickers: [
            { type: 'poll', anchor: 'center-right', label: '"Banner face or skull face?" Banner / Skulls' },
          ],
        },
        {
          layout: 'scarcity',
          eyebrow: 'ONE OF ONE',
          headline: '1 OF 1',
          price: '$80',
          stickers: [
            { type: 'countdown', anchor: 'top-right', label: '⏱ Drop time (primary urgency driver)' },
            { type: 'poll', anchor: 'bottom-left', label: '"Run it again?" Yes / Never' },
          ],
        },
        {
          layout: 'manifesto',
          headline: 'TRUST YOURSELF.',
          body: ['Coalition is action. Show up.'],
          stickers: [
            { type: 'mention', anchor: 'bottom-right', label: '@sgcoalition mention' },
            { type: 'emoji', anchor: 'center-left', label: '👻 Trust Yourself (emoji slider, optional)' },
          ],
        },
        {
          layout: 'cta',
          eyebrow: 'GHOST RIDERS / WALLET 1/1',
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
      id: 'Coalition_Ghost_Riders_After_Dark_Wallet_1_1',
      price: 80,
      category: 'wallet',
      sizes: ['One Size'],
      sizeInventory: { 'One Size': 1 },
      isLimitedEdition: true,
      isFeatured: false,
      description:
        "GHOST RIDERS: AFTER DARK. Hand-stitched patchwork wallet — camo and rust corduroy under green blanket stitching, the Coalition banner across one face and the skull gang riding out on the other. 1 of 1: once it's sold, it's gone forever.",
      storeImages: [
        'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/ghost-riders-wallet-front.png',
        'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/ghost-riders-wallet-back.png',
        // ?v=N — the art was revised (real Coalition logo, corner fix, and the
        // banner lettering un-mirrored to read left-to-right like the wallet);
        // the storage URL is the same object path, so the query busts CDN/browser
        // caches holding earlier rasters under the old cacheControl.
        'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/ghost-riders-wallet-art.png?v=3',
      ],
    },
    copy: {
      igCaptionLong:
        '👻 GHOST RIDERS: AFTER DARK.\n\nCoalition \'Ghost Riders: After Dark\' Wallet 1/1 — $80.\n\nHand-stitched patchwork: camo and rust corduroy under green blanket stitching. The Coalition banner across one face, the skull gang riding out on the other.\n\nOne of one. When it\'s gone, it\'s gone. Trust Yourself.\n\n🔗 Link in bio → sgcoalition.xyz/shop\n\n#Coalition #GhostRiders #BaltimoreStreetwear #TrustYourself #OneOfOne',
      igCaptionShort:
        '👻 GHOST RIDERS: AFTER DARK.\n\nCoalition \'Ghost Riders: After Dark\' Wallet 1/1 — $80. Hand-stitched patchwork, one of one.\n\nWhen it\'s gone, it\'s gone.\n\n🔗 Link in bio.\n\n#Coalition #GhostRiders #TrustYourself #OneOfOne #BaltimoreStreetwear',
      xSingle:
        "👻 GHOST RIDERS: AFTER DARK. Coalition 'Ghost Riders: After Dark' Wallet 1/1 — $80. Hand-stitched patchwork: banner on one face, skull gang on the other. One of one. Once it's gone, it's gone. sgcoalition.xyz/shop",
      xThread: [
        "👻 GHOST RIDERS: AFTER DARK.\n\nCoalition 'Ghost Riders: After Dark' Wallet 1/1 — $80. Hand-stitched patchwork: the Coalition banner on one face, the skull gang riding out on the other.\n\nsgcoalition.xyz/shop",
        '1 of 1. No reprints.\n\nCamo and rust corduroy under green blanket stitching, finished by hand. The only one like it — literally.',
        'Coalition is action. Trust Yourself. 🖤',
      ],
      hashtagsCanonical: ['#Coalition', '#GhostRiders', '#BaltimoreStreetwear', '#TrustYourself', '#OneOfOne'],
      hashtagsTier2: ['#Streetwear', '#Baltimore', '#1of1', '#HandStitched', '#Patchwork', '#Drops'],
      slackOneLiner:
        '👻 GHOST RIDERS: AFTER DARK. Coalition wallet 1/1 — $80. Hand-stitched patchwork, one of one. sgcoalition.xyz/shop',
      postTitle: "Coalition 'Ghost Riders: After Dark' Wallet 1/1",
      postSlug: 'coalition-ghost-riders-after-dark-wallet-1-1',
      postExcerpt:
        'One wallet, made once: hand-stitched camo and rust corduroy patchwork, the Coalition banner on one face and the skull gang on the other.',
      postTags: ['drop', 'wallet', 'limited', 'ghost-riders'],
      postBody: `
<img src="/images/ghost-riders-wallet-front.png" alt="Coalition Ghost Riders: After Dark Wallet 1/1 — front" style="width:100%;border-radius:16px;margin-bottom:24px;" />

Ghost Riders: After Dark is one wallet, made once. The front face carries the Coalition banner over rust hills; turn it over and the skull gang rides out after dark.

<h2>THE BUILD</h2>

<ul>
<li><strong>Hand-stitched patchwork</strong> — camo and rust corduroy strips under green blanket stitching.</li>
<li><strong>Two faces</strong> — the Coalition banner on one, the skull gang riding out on the other.</li>
<li><strong>One of one</strong> — one piece, made once, no reprint.</li>
</ul>

<img src="/images/ghost-riders-wallet-back.png" alt="Coalition Ghost Riders: After Dark Wallet 1/1 — back" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE ART</h2>

The Ghost Riders: After Dark artwork — the same scene, drawn in the wallet's own colors.

<img src="/images/ghost-riders-wallet-art.png" alt="Ghost Riders: After Dark artwork" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE RUN</h2>

One piece. When it is gone, it does not come back.

<em>Trust the process. Trust yourself.</em>

<div style="text-align:center; margin:40px 0 8px;">
<img src="/images/ghost-riders-buy-qr.png" alt="Scan to shop the Ghost Riders: After Dark wallet" style="width:244px; height:244px; background:#ffffff; padding:12px; border-radius:16px; display:inline-block;" />
<p style="margin-top:14px; font-weight:700; letter-spacing:.08em;">SCAN TO SHOP — ONE OF ONE, $80</p>
</div>
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
