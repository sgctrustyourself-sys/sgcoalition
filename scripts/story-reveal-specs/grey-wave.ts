/**
 * Coalition Drop Spec — typed per-drop data for scripts/render-story.ts.
 *
 * Every coalition limited-release product gets one of these files mirroring
 * the per-slide breakdown in `docs/drop-kit-{slug}.md`. The renderer reads
 * it, the template renders it. The next drop is `cp grey-wave.ts new-slug.ts`
 * + global find/replace on the tokens below.
 */
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
  /** Variant denominator. 2 for a 1/2 run, 5 for 1/5, etc. */
  y: number;

  /** "$35" with the dollar sign already prefixed. */
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
   * (`headline`, `eyebrow`, `url`, etc.) directly. If `x`/`y` change
   * for a new drop, update the per-slide strings accordingly —
   * the template does NOT auto-derive `{{x}} OF {{y}}` from these numbers.
   */
  slides: SlideSpec[];
}

// ----------------------------------------------------------------------------
// Worked example: Coalition Grey Wave Wallet 1/2 — drop date 2026-06-20.
// Mirror of `docs/drop-kit-grey-wave.md` "IG Story variants" section.
// ----------------------------------------------------------------------------

export const greyWaveSpec: DropSpec = {
  slug: 'grey-wave',

  releaseName: 'GREY WAVE',
  productName: "Coalition 'Grey Wave' Wallet 1/2",

  x: 1,
  y: 2,

  price: '$35',
  shopUrl: 'sgcoalition.xyz/shop',

  images: {
    // docs/story-reveal/grey-wave-slide-N.html -> ../../public/images/...
    front: '../../public/images/grey-wave-wallet-1-2-front.png',
    back: '../../public/images/grey-wave-wallet-1-2-back.png',
  },

  slides: [
    // ─── Slide 1 · HERO ────────────────────────────────────────────────────
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

    // ─── Slide 2 · DETAIL ──────────────────────────────────────────────────
    {
      layout: 'detail',
      headline: 'Hand-finished charcoal dye.',
      body: ['Inspired by Baltimore harbor at dawn — the moment before anything moves.'],
      stickers: [
        { type: 'poll', anchor: 'center-right', label: '"Harbor at dawn?" Yes / No' },
      ],
    },

    // ─── Slide 3 · SCARCITY ────────────────────────────────────────────────
    {
      layout: 'scarcity',
      eyebrow: 'LIMITED EDITION',
      headline: '1 OF 2',
      price: '$35',
      stickers: [
        { type: 'countdown', anchor: 'top-right', label: '⏱ Drop time (primary urgency driver)' },
        { type: 'poll', anchor: 'bottom-left', label: '"Should we run 2/2?" Yes / Wait' },
      ],
    },

    // ─── Slide 4 · MANIFESTO ───────────────────────────────────────────────
    {
      layout: 'manifesto',
      headline: 'TRUST YOURSELF.',
      body: ['Coalition is action. Show up.'],
      stickers: [
        { type: 'mention', anchor: 'bottom-right', label: '@sgcoalition mention' },
        { type: 'emoji', anchor: 'center-left', label: '🔥 Trust Yourself (emoji slider, optional)' },
      ],
    },

    // ─── Slide 5 · CTA ─────────────────────────────────────────────────────
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
};
