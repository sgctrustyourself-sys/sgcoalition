import { Product, Section } from './types';
import { PRODUCT_IMAGE_URLS } from './utils/localImageAssets';

// Vite's import.meta.env is undefined when constants.ts is loaded by
// tsx (seed scripts, future Node tests). The frontend (Vite) populates
// it at build time; the script path needs the values to default to
// safe fallbacks so the module evaluation doesn't throw.
// Guard the read so the same module can be imported from both.
const viteEnv: Record<string, string | undefined> =
  ((import.meta as any)?.env) ?? {};

const ABOVE_AS_BELOW_WALLET_MAKING_VIDEO_URL = 'https://www.instagram.com/p/DaQpKS9EXT8/';
const ABOVE_AS_BELOW_WALLET_MAKING_VIDEO_LINKS: NonNullable<Product['makingVideoLinks']> = [
  {
    platform: 'instagram',
    label: 'Instagram Reel',
    url: ABOVE_AS_BELOW_WALLET_MAKING_VIDEO_URL
  },
  {
    platform: 'youtube',
    label: 'YouTube Short',
    url: 'https://www.youtube.com/shorts/YN82FCNhNJ8'
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    url: 'https://www.tiktok.com/@sgcoalition/video/7657634047572593933'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'Coalition_NF_Tee',
    founderNote: `[PLACEHOLDER · Coalition_NF_Tee] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION NF-TEE',
    price: 40,
    images: [
      PRODUCT_IMAGE_URLS.nfTee.model1,
      PRODUCT_IMAGE_URLS.nfTee.model2,
      PRODUCT_IMAGE_URLS.nfTee.model3,
      PRODUCT_IMAGE_URLS.nfTee.model4
    ],
    description: 'The future of streetwear. This limited edition phy-gital tee serves as your access pass to the Coalition ecosystem. Features exclusive "Trust Yourself" puff print and embedded NFC technology linked to its digital twin on the Polygon blockchain.',
    category: 'shirt',
    isFeatured: true,
    isLimitedEdition: true,
    // Local safety net: mirrors the live Supabase row so the storefront
    // never renders Coalition_NF_Tee as "Sold Out" if AppContext falls
    // back to INITIAL_PRODUCTS (e.g. transient Supabase fetch failure
    // or RLS anon-key returning empty). Live DB still wins on success:
    // AppContext.fetchProducts uses {...local, ...sp} spread order so
    // sp.sizeInventory overrides these values on the merged product.
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 },
    nft: {
      contractAddress: '0x951806a2581c22C478aC613a675e6c898E2aBe21',
      tokenId: '1',
      chain: 'polygon',
      openseaUrl: 'https://opensea.io/collection/sg-coalition'
    }
  },
  {
    id: 'prod_tee_above_as_below',
    founderNote: `[PLACEHOLDER · prod_tee_above_as_below] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION ABOVE AS BELOW TEE',
    price: 75,
    createdAt: '2026-06-17T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.front,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.back,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.modelFront,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.modelBack
    ],
    description: 'The Above as Below tee features a heavyweight black body with red-and-white Coalition artwork across the front and a full back graphic built around the Above as Below concept.',
    category: 'shirt',
    isFeatured: true,
    freeShipping: true,
    isLimitedEdition: true,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    // Live Supabase row sums to 44. Local fallback kept honest so the storefront
    // never oversells when Supabase hasn't been hit yet.
    sizeInventory: { S: 9, M: 9, L: 9, XL: 9, '2XL': 8 },
    // Flat-lay product whose front/back shots already include a white frame —
    // the storefront card uses object-contain + bg-white so the print isn't
    // cropped. imageFit/imageBackground replaces the legacy hard-coded
    // product-id check in components/ProductCard.tsx (utils/productImage.ts
    // legacy-id fallback still covers it for any future Supabase row that
    // hasn't been migrated yet).
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.aboveAsBelowTee.front,
      hoverUrl: PRODUCT_IMAGE_URLS.aboveAsBelowTee.back,
      imageFit: 'contain',
      imageBackground: 'white',
    }
  },
  {
    id: 'GreenCamoWallet',
    founderNote: `[PLACEHOLDER · GreenCamoWallet] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION GREEN CAMO WALLET',
    price: 85,
    images: [PRODUCT_IMAGE_URLS.walletGreen.front, PRODUCT_IMAGE_URLS.walletGreen.back],
    description: 'Tactical accessory designed for the modern collector. Spec-camo pattern with multiple card slots and RFID protection.',
    category: 'wallet',
    freeShipping: true,
    archived: true,
    archivedAt: '2026-05-22T22:48:11-04:00',
    soldAt: '2026-05-22T22:48:11-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 }
  },
  {
    id: 'SKYYBLUEWALLET1_2',
    founderNote: `[PLACEHOLDER · SKYYBLUEWALLET1_2] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION SKYY BLUE WALLET 1/2',
    price: 85,
    images: [PRODUCT_IMAGE_URLS.walletSkyyBlue.front, PRODUCT_IMAGE_URLS.walletSkyyBlue.back],
    description: 'Electric blue variant of our signature tactical wallet. Sleek, durable, and ready for any mission.',
    category: 'wallet',
    freeShipping: true,
    archived: true,
    archivedAt: '2026-05-22T22:48:11-04:00',
    soldAt: '2026-05-22T22:48:11-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 }
  },
  {
    id: 'prod_wallet_004',
    founderNote: `[PLACEHOLDER · prod_wallet_004] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION SKYY BLUE WALLET 2/2',
    price: 85,
    images: [PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.front, PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.back],
    description: 'Second piece of the Skyy Blue collection. Hand-crafted tie-dye wallet with silver stitched border. Each piece unique — no two alike.',
    category: 'wallet',
    freeShipping: true,
    archived: true,
    archivedAt: '2026-05-22T22:48:11-04:00',
    soldAt: '2026-05-22T22:48:11-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 }
  },
  {
    id: 'Coalition_Racing_Team_Wallet_1_4',
    founderNote: `[PLACEHOLDER · Coalition_Racing_Team_Wallet_1_4] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: "Coalition 'Racing Team' Wallet 1/4",
    price: 85,
    createdAt: '2026-04-07T00:00:00Z',
    images: [
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_3UUmYQa.jpg',
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_vRqjRG4.jpg'
    ],
    description: "First release in the Coalition 'Racing Team' wallet run. Built as a limited 1/4 collectible with custom team graphics and everyday-carry function.",
    category: 'wallet',
    freeShipping: true,
    archived: true,
    archivedAt: '2026-05-22T22:48:11-04:00',
    soldAt: '2026-05-22T22:48:11-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 }
  },
  {
    id: 'Coalition_Racing_Team_Wallet_2_4',
    founderNote: `[PLACEHOLDER · Coalition_Racing_Team_Wallet_2_4] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: "Coalition 'Racing Team' Wallet 2/4",
    price: 85,
    createdAt: '2026-04-07T06:57:00Z',
    images: [
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IRhVbhN.jpg',
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_7ScdBnE.jpg'
    ],
    description: "Second release in the Coalition 'Racing Team' wallet run. Built as a limited 2/4 collectible with custom team graphics and everyday-carry function.",
    category: 'wallet',
    freeShipping: true,
    archived: true,
    archivedAt: '2026-05-22T22:48:11-04:00',
    soldAt: '2026-05-22T22:48:11-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 }
  },
  {
    id: 'Coalition_Racing_Team_Wallet_3_4',
    founderNote: `[PLACEHOLDER · Coalition_Racing_Team_Wallet_3_4] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: "Coalition 'Racing Team' Wallet 3/4",
    price: 85,
    createdAt: '2026-04-07T07:08:00Z',
    images: [
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_dcw5qLQ.jpg',
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_hmPBbY3.jpg'
    ],
    description: "Third release in the Coalition 'Racing Team' wallet run. Built as a limited 3/4 collectible with custom team graphics and everyday-carry function.",
    category: 'wallet',
    freeShipping: true,
    archived: true,
    archivedAt: '2026-05-22T22:48:11-04:00',
    soldAt: '2026-05-22T22:48:11-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 }
  },
  {
    id: 'Coalition_Racing_Team_Wallet_4_4',
    founderNote: `[PLACEHOLDER · Coalition_Racing_Team_Wallet_4_4] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: "Coalition 'Racing Team' Wallet 4/4",
    price: 85,
    createdAt: '2026-04-07T07:25:00Z',
    images: [
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EylCpDU.jpg',
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_w8dahYm.jpg'
    ],
    description: "Final release in the Coalition 'Racing Team' wallet run. Built as a limited 4/4 collectible with custom team graphics and everyday-carry function.",
    category: 'wallet',
    freeShipping: true,
    archived: true,
    archivedAt: '2026-05-22T22:48:11-04:00',
    soldAt: '2026-05-22T22:48:11-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 }
  },
  {
    id: 'prod_wallet_chrome_hearts',
    founderNote: `[PLACEHOLDER · prod_wallet_chrome_hearts] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'CUSTOM COALITION X CHROME HEARTS WALLET',
    price: 450,
    images: [PRODUCT_IMAGE_URLS.chromeHeartsWallet.front, PRODUCT_IMAGE_URLS.chromeHeartsWallet.back],
    description: 'Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet. Premium leather construction with signature Chrome Hearts detailing and Coalition branding. Rare collector item.',
    category: 'wallet',
    freeShipping: true,
    isFeatured: false,
    archived: true,
    soldAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'prod_trust_yourself_hat_01',
    founderNote: `[PLACEHOLDER · prod_trust_yourself_hat_01] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'TRUST YOURSELF CUSTOM TRUCKER (1/1)',
    price: 85,
    images: [
      PRODUCT_IMAGE_URLS.trustYourselfHat.cover,
      PRODUCT_IMAGE_URLS.trustYourselfHat.detail,
      PRODUCT_IMAGE_URLS.trustYourselfHat.side,
      PRODUCT_IMAGE_URLS.trustYourselfHat.back,
      PRODUCT_IMAGE_URLS.trustYourselfHat.full
    ],
    description: 'One-of-one custom Coalition trucker hat. Hand-crafted with signature Trust Yourself embroidery. Rare collector piece — this exact hat will never be made again.',
    category: 'hat',
    isFeatured: false,
    archived: true,
    soldAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'prod_tee_distortion',
    founderNote: `[PLACEHOLDER · prod_tee_distortion] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION DISTORTION TEE',
    price: 60,
    images: [
      PRODUCT_IMAGE_URLS.distortionTee.main,
      PRODUCT_IMAGE_URLS.distortionTee.frontFlat,
      PRODUCT_IMAGE_URLS.distortionTee.backModel,
      PRODUCT_IMAGE_URLS.distortionTee.backFlat,
    ],
    description: 'The Coalition Distortion Tee features a high-density graphic print that warps and bends the brand logo into a digital frequency. Heavyweight cotton construction with a classic streetwear fit. Trust Yourself.',
    category: 'shirt',
    isFeatured: true
  },
  {
    id: 'prod_1773860269374',
    founderNote: `[PLACEHOLDER · prod_1773860269374] Replace with founder's note: 1-2 paragraphs covering what this 1/1 build is, where it sits in the Coalition shark arc, and what's worth noticing in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'Coalition Shark Tee - 1/1 Exclusive',
    // 2026-07-04: base price lowered from $60 -> $40, and a 50% auto-discount
    // applied permanently to the row so the storefront surfaces strikethrough
    // "$40 -> $20" without a coupon code. The discountPercent field is read
    // by components/PriceDisplay.tsx on PDP/ProductCard, by pages/Checkout.tsx
    // for cart math, and round-trips through services/retryQueue.ts ->
    // mapProductToDb -> public.products.discount_percent (migration
    // 20260704_add_discount_percent_to_products.sql). Checkout applies the
    // no-stack rule vs cart-wide coupons (max() of the two wins) per the user's
    // "Replace them (no stack)" spec.
    price: 40,
    discountPercent: 50,
    createdAt: '2026-03-18T19:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.sharkTee.main,
      PRODUCT_IMAGE_URLS.sharkTee.back,
      PRODUCT_IMAGE_URLS.sharkTee.frontFlat,
      PRODUCT_IMAGE_URLS.sharkTee.backFlat,
    ],
    description: "Unique SGCoalition tie-dye 'Trust Yourself' tee with a striking blue spiral pattern and the iconic crowned-bird graphic. This one-of-a-kind piece features premium print details and a motivational streetwear vibe. Size Small, in excellent condition with no flaws - ideal for collectors or anyone looking to add a standout Coalition piece to their wardrobe.",
    category: 'shirt',
    isLimitedEdition: true,
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 0, L: 0, XL: 0 }
  },
  {
    id: 'Coalition_x_True_Religion_S1',
    founderNote: `[PLACEHOLDER · Coalition_x_True_Religion_S1] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'Coalition x True Religion 1/1 Jeans S1',
    price: 240,
    images: [
      PRODUCT_IMAGE_URLS.trueReligionJeans.front1,
      PRODUCT_IMAGE_URLS.trueReligionJeans.front2,
      PRODUCT_IMAGE_URLS.trueReligionJeans.front3,
      PRODUCT_IMAGE_URLS.trueReligionJeans.front4
    ],
    description: "One-of-one Coalition x True Religion collaboration jeans. Season 1 exclusive \u2014 custom distressed denim with premium detailing. Size 33. Once it's gone, it's gone.",
    category: 'jeans',
    isFeatured: false,
    archived: true,
    soldAt: '2026-03-06T00:00:00Z',
    sizes: ['33'],
    sizeInventory: { '33': 0 }
  },
  {
    id: 'Coalition_Denim_Patchwork_S1',
    founderNote: `[PLACEHOLDER · Coalition_Denim_Patchwork_S1] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'Coalition Denim Patchwork 1/1 Jeans S1',
    price: 140,
    // The Instagram post (https://www.instagram.com/p/DCIqPY4Msk_/?img_index=1)
    // is the canonical hero shot; the imgur album
    // (https://imgur.com/a/6iKV2Tu) hosts the additional detail crops.
    // If the storefront can't render the IG URL in an <img> tag, swap
    // in the direct CDN equivalents when the operator has them.
    images: [
      'https://www.instagram.com/p/DCIqPY4Msk_/?img_index=1',
      'https://imgur.com/a/6iKV2Tu',
    ],
    description: "One-of-one Coalition Denim Patchwork jeans. Hand-pieced from multiple denim panels, raw-hem finished, with the SG mark on the back pocket. Featuring X Meks. Size 30. Once it's gone, it's gone.",
    category: 'jeans',
    isFeatured: false,
    isLimitedEdition: true,
    archived: true,
    archivedAt: '2024-11-08T15:00:00-05:00',
    soldAt: '2024-11-08T15:00:00-05:00',
    sizes: ['30'],
    sizeInventory: { '30': 0 },
    archiveNote: "This exact Denim Patchwork has sold. Hand-pieced from multiple denim panels in a single build — no two alike, no restocks."
  },
  {
    id: 'Coalition_Grey_Wave_Wallet_1_2',
    founderNote: `[PLACEHOLDER · Coalition_Grey_Wave_Wallet_1_2] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: "Coalition 'Grey Wave' Wallet 1/2",
    price: 85,
    createdAt: '2026-06-20T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.greyWaveWallet.front,
      PRODUCT_IMAGE_URLS.greyWaveWallet.back
    ],
    description: "First piece in the Coalition 'Grey Wave' wallet run. Hand-finished with a custom charcoal-grey dye pattern inspired by Baltimore harbor at dawn. Built as a limited 1/2 collectible \u2014 once sold, it's gone forever.",
    makingVideoUrl: 'https://www.instagram.com/p/DZ3wBL_z0sd/',
    category: 'wallet',
    freeShipping: true,
    isLimitedEdition: true,
    archived: true,
    archivedAt: '2026-06-25T02:40:12.191+00:00',
    soldAt: '2026-06-25T02:40:12.191+00:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    archiveNote: "This exact Grey Wave wallet has sold. Request a similar custom if you want the same charcoal-grey direction rebuilt for a future drop."
  },
  {
    id: 'Coalition_Grey_Wave_Wallet_2_2',
    founderNote: `[PLACEHOLDER · Coalition_Grey_Wave_Wallet_2_2] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: "Coalition 'Grey Wave' Wallet 2/2",
    price: 85,
    createdAt: '2026-06-28T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.greyWaveWallet22.front,
      PRODUCT_IMAGE_URLS.greyWaveWallet22.back
    ],
    description: "Second and final piece in the Coalition 'Grey Wave' wallet run. Hand-finished with a storm-grey wave pattern, raw edge stitching, copper grommet, and Coalition mark. Built as a limited 2/2 collectible - once sold, it's gone forever.",
    makingVideoUrl: 'https://www.instagram.com/p/DZ8z0t0Tfws/',
    category: 'wallet',
    freeShipping: true,
    isLimitedEdition: true,
    archived: true,
    archivedAt: '2026-07-02T10:00:00-04:00',
    soldAt: '2026-07-02T10:00:00-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    archiveNote: "This exact Grey Wave wallet has sold. Request a similar custom if you want the same storm-grey direction rebuilt for a future drop."
  },
  {
    id: 'Coalition_Above_As_Below_Wallet_1_1',
    founderNote: `[PLACEHOLDER · Coalition_Above_As_Below_Wallet_1_1] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION ABOVE AS BELOW 1/1 WALLET',
    price: 85,
    createdAt: '2026-06-28T00:00:00-04:00',
    images: [
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_9NF3LzM.jpg',
      'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_UoY42bg.jpg'
    ],
    description: '1/1 Above as Below wallet. Hand-finished with the same storm-and-balance motif as the matching Above as Below tee — single piece, one red-and-white Coalition mark, scaled for everyday carry. Once sold, gone forever.',
    makingVideoUrl: ABOVE_AS_BELOW_WALLET_MAKING_VIDEO_URL,
    makingVideoLinks: ABOVE_AS_BELOW_WALLET_MAKING_VIDEO_LINKS,
    category: 'wallet',
    isLimitedEdition: true,
    isFeatured: false,
    freeShipping: true,
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 1 }
  },
  {
    id: 'prod_shorts_above_as_below',
    founderNote: `Built as the matching anchor to the Above as Below tee. The raw hem and heavyweight drape carry the exact same red-and-white Coalition lineage — same fabric run, same dye lot, same hand-finished pocket stitch.

$75 on its own. But we built these to be worn with the tee: grab both and the cart drops the total to $120 — $30 off, no code needed.

Hand-cut, raw-hem, deep-set pocket. Sized S through 2XL.`,
    name: 'COALITION ABOVE AS BELOW SHORTS',
    price: 75,
    createdAt: '2026-06-28T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.front,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.back,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setFront,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setBack
    ],
    description: "The matching Above as Below shorts. Same hand-crafted red-and-white Coalition lineage as the tee - heavyweight cotton, deep set pocket, raw-hem finished. Sold at $75 individually, or grab the set with the tee for $120 and save $30.",
    category: 'shorts',
    isFeatured: false,
    isLimitedEdition: true,
    freeShipping: true,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    sizeInventory: { S: 9, M: 9, L: 9, XL: 9, '2XL': 8 },
    // Matching Above-as-Below shorts — same flat-lay render profile as the
    // tee. See prod_tee_above_as_below for the reasoning behind
    // imageFit='contain' + imageBackground='white'.
    imageRoles: {
      imageFit: 'contain',
      imageBackground: 'white',
    }
  },
  {
    id: 'prod_set_above_as_below',
    founderNote: `The full Above as Below uniform: tee and shorts together, priced as the set instead of two separate pieces.

One size selection covers both pieces. Sized S through 2XL. Set price: $120.`,
    name: 'COALITION ABOVE AS BELOW SET',
    price: 120,
    createdAt: '2026-07-01T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setFront,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setBack,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.front,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.back,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.front,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.back
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setFront,
      hoverUrl: null
    },
    description: "Above as Below tee and shorts together in one set. Each piece is $75 on its own ($150 total); the set is $120, saving $30 off the combined price. Sized S-M-L-XL-2XL.",
    category: 'apparel',
    isFeatured: false,
    isLimitedEdition: true,
    freeShipping: true,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    sizeInventory: { S: 4, M: 4, L: 4, XL: 4, '2XL': 4 }
  },
  {
    id: 'prod_womens_above_as_below_contrast_shorts',
    founderNote: `Cut as the women's counterpart to the Above as Below drop. Black body, white contrast trim, and the red Coalition artwork placed low on the leg so it reads with the crop tank instead of fighting it.

$40 on its own. Sized S through XL. Built to pair with the crewneck crop tank as the $75 women's set.`,
    name: "WOMEN'S COALITION ABOVE AS BELOW CONTRAST SHORTS",
    price: 40,
    createdAt: '2026-07-01T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.back,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
      hoverUrl: null
    },
    description: "Women's Above as Below contrast shorts in black with white trim, red Coalition artwork, and a red waistband label. Available S-M-L-XL. $40 separately, or grab the matching crop tank and shorts set for $75.",
    category: 'shorts',
    isFeatured: false,
    isLimitedEdition: true,
    freeShipping: true,
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 }
  },
  {
    id: 'prod_womens_above_as_below_crop_tank',
    founderNote: `A crewneck crop tank built for the women's Above as Below set. Front SG mark, full back Above as Below figure, and the red Coalition label at the hem.

$40 on its own. Sized S through XL. Pair it with the contrast shorts for the $75 set.`,
    name: "WOMEN'S COALITION ABOVE AS BELOW CREWNECK CROP TANK",
    price: 40,
    createdAt: '2026-07-01T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.back,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
      hoverUrl: null
    },
    description: "Women's Above as Below crewneck crop tank in black with front SG artwork, back Above as Below graphic, and red Coalition hem label. $40 separately, or pair it with the contrast shorts as a $75 set.",
    category: 'shirt',
    isFeatured: false,
    isLimitedEdition: true,
    freeShipping: true,
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 }
  },
  {
    id: 'prod_womens_above_as_below_set',
    founderNote: `The full women's Above as Below uniform: crewneck crop tank and contrast shorts together, priced as the set instead of two separate pieces.

One size selection covers both pieces. Sized S through XL. Set price: $75.`,
    name: "WOMEN'S COALITION ABOVE AS BELOW SET",
    price: 75,
    createdAt: '2026-07-01T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.back,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.back
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      hoverUrl: null
    },
    description: "Women's Above as Below set with the crewneck crop tank and contrast shorts together. Black body, red-and-white Coalition artwork, and matching set styling. $75 as a set, sized S-M-L-XL.",
    category: 'apparel',
    isFeatured: false,
    isLimitedEdition: true,
    freeShipping: true,
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 }
  },
  {
    id: 'prod_womens_coalition_halo_contrast_tee',
    founderNote: `Women's bodycon raglan sleeve tee using the same gold Coalition halo chest logo as the Coalition Halo Mini Dress, with a TRUST YOURSELF hit on the back. The contrast stripes on the raglan sleeves are the defining visual feature of the blank, so the tee reads as a Coalition women's staple rather than a generic raglan.

Standard live catalog release, not a numbered or limited drop. Keep the price at $40 unless the live product row is intentionally updated. Sized S through XL.`,
    name: "WOMEN'S COALITION HALO CONTRAST TEE",
    price: 40,
    createdAt: '2026-07-03T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.front,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.back,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.modelFront,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.frontDetail,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.backDetail
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensHaloContrastTee.front,
      hoverUrl: PRODUCT_IMAGE_URLS.womensHaloContrastTee.back
    },
    description: "Women's Coalition Halo Contrast Tee in bodycon raglan sleeve cut with contrast sleeve stripes, the same gold Coalition halo chest logo as the Coalition Halo Mini Dress, and a TRUST YOURSELF hit on the back. $40, sized S-M-L-XL.",
    category: 'shirt',
    isFeatured: false,
    isLimitedEdition: false,
    freeShipping: true,
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 },
    specs: {
      attributes: [
        { label: 'Gender', value: 'Female' },
        { label: 'Fit', value: 'Bodycon' },
        { label: 'Style', value: 'Raglan Sleeve Tee' },
      ],
      care: [
        'Machine wash cold on gentle cycle',
        'Do not bleach',
        'Tumble dry low',
        'Iron inside-out on low heat, avoid ironing on print',
      ],
      material: {
        composition: 'Cotton / spandex blend (bodycon stretch)',
        fabricWeight: 'Mid-weight',
        thickness: 'Semi-sheer at seams',
        breathability: 'High',
      },
    },
  },
  {
    id: 'prod_halo_mini_dress',
    founderNote: `The Halo Mini Dress is a clean black bodycon silhouette with the Coalition halo mark placed high on the chest and the cross-backed Coalition hit sitting low on the back.

This is a standard live catalog release, not a numbered or limited drop. Keep the price at $50 unless the live product row is intentionally updated. Sized S through XL.`,
    name: 'COALITION HALO MINI DRESS',
    price: 50,
    createdAt: '2026-07-01T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.haloMiniDress.modelFaceFront,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelFront,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelAngledFront,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelSide,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelBackAngled,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelBack
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.haloMiniDress.modelFaceFront,
      hoverUrl: PRODUCT_IMAGE_URLS.haloMiniDress.modelBackAngled
    },
    description: 'Coalition Halo Mini Dress in black with a fitted cami mini silhouette, gold Coalition chest logo, low scoop back, and gold cross-backed Coalition graphic. Standard live catalog release priced at $50.',
    category: 'dress',
    isFeatured: false,
    isLimitedEdition: false,
    sizes: ['S', 'M', 'L', 'XL'],
    // Total 50 across all sizes.
    sizeInventory: { S: 12, M: 13, L: 13, XL: 12 },
    specs: {
      attributes: [
        { label: 'Gender', value: 'Female' },
        { label: 'Effects', value: 'Backless' },
        { label: 'Fit', value: 'Bodycon' },
        { label: 'Neckline', value: 'U-Neck' },
        { label: 'Sleeve Length', value: 'Sleeveless' },
        { label: 'Season', value: 'Spring / Summer' },
        { label: 'Style', value: 'Basics / Casual / Sexy' },
      ],
      care: [
        'Machine wash at 30°C (gentle cycle)',
        'Do not bleach',
        'Tumble dry low',
        'Iron at low temperature, avoid ironing on print',
        'Do not dry clean',
      ],
      material: {
        composition: '92% rayon, 8% spandex',
        fabricWeight: '260 gsm (7.7 oz)',
        thickness: 'Thin',
        breathability: 'Moderate',
      },
    },
  },
  {
    id: 'prod_hoodie_overwhelmingly_patient',
    founderNote: `This hoodie is the start of the Coalition chakra line. The body is heavyweight 400gsm cotton fleece, cut deliberately oversized so it drapes below the hips. The graphic is a hand-drawn Sacral Chakra mark - the six-petaled lotus in deep burnt orange - sitting centered over the lower abdomen, the location Svadhisthana governs.

We picked orange the way the body reads orange. Warm. Liquid. The lower belly responds to warmth, to creative pressure, to the willingness to move without explaining why.

Signs of imbalance this piece considers: low creative drive, emotional flatness that will not resolve in the chest, and the fashionable numbness people call focus. To rebalance it: hip-opening yoga, spontaneous creative work without deadline, daily repetition of "I move with the flow of life."

Pre-order reservations are intentionally capped at one per size. After the close date we cut, dye, screen, and ship in one batch - no restocks, no second run. If you reserve, the only way to wear it is to wait with us.`,
    name: 'COALITION OVERWHELMINGLY PATIENT HOODIE',
    price: 100,
    createdAt: '2026-06-28T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatFront,
      PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatBack,
      PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.modelFront,
      PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.modelBack
    ],
    description: "Pre-order release of the Coalition Overwhelmingly Patient Hoodie at $100. Inspired by the Sacral Chakra (Svadhisthana) - creativity, pleasure, flow. Hand-cut heavyweight fleece, burnt-orange mark centered over the lower abdomen. Free shipping when paired with any other item. Reservations capped at one per size; ships in 1-2 weeks from the close of the pre-order window.",
    category: 'sweatshirt',
    isFeatured: false,
    isLimitedEdition: true,
    freeShippingWhenPaired: true,
    // shippingFulfillment lives in PRODUCT_LOCAL_OVERRIDES below, NOT here.
    // The AppContext fetch spreads `{...local, ...sp}` so Supabase wins
    // for any field present in the row, which would clobber this value
    // back to `undefined`. applyLocalProductOverrides (which runs LAST)
    // is the only reliable surface for per-product shipping copy.
    saleEndDate: '2026-07-26T23:59:59.999Z',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1, '2XL': 1 },
    // Chakra-line hoodie boots the same flat-lay render profile (object-contain
    // + bg-white) so the burnt-orange svg mark isn't cropped against the
    // gray-900 default. See prod_tee_above_as_below for the full rationale.
    imageRoles: {
      imageFit: 'contain',
      imageBackground: 'white',
    }
  },
];

export const PRODUCT_LOCAL_OVERRIDES: Record<string, Partial<Product>> = {
  prod_tee_above_as_below: {
    images: [
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.front,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.back,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.modelFront,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.modelBack
    ],
    // Pin imageRoles so applyLocalProductOverrides wins the spread against
    // any future Supabase row that pre-dates the imageFit/imageBackground
    // migration. The whole blob is re-stated here (NOT a partial) because
    // applyLocalProductOverrides does a property-level spread: a partial
    // override would silently wipe the primaryUrl/hoverUrl/namedSlots the
    // Supabase row carries. Same defensive pattern used for halo mini
    // dress + halo contrast tee.
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.aboveAsBelowTee.front,
      hoverUrl: PRODUCT_IMAGE_URLS.aboveAsBelowTee.back,
      imageFit: 'contain',
      imageBackground: 'white',
    },
  },
  prod_set_above_as_below: {
    name: 'COALITION ABOVE AS BELOW SET',
    price: 120,
    createdAt: '2026-07-01T00:00:00-04:00',
    images: [
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setFront,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setBack,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.front,
      PRODUCT_IMAGE_URLS.aboveAsBelowTee.back,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.front,
      PRODUCT_IMAGE_URLS.aboveAsBelowShorts.back
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setFront,
      hoverUrl: null
    },
    description: "Above as Below tee and shorts together in one set. Each piece is $75 on its own ($150 total); the set is $120, saving $30 off the combined price. Sized S-M-L-XL-2XL.",
    category: 'apparel',
    isFeatured: false,
    isLimitedEdition: true,
    freeShipping: true,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    sizeInventory: { S: 4, M: 4, L: 4, XL: 4, '2XL': 4 }
  },
  prod_womens_above_as_below_contrast_shorts: {
    images: [
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.back,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
      hoverUrl: null
    }
  },
  prod_womens_above_as_below_crop_tank: {
    images: [
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.back,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
      hoverUrl: null
    }
  },
  prod_womens_above_as_below_set: {
    images: [
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.back,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
      PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.back
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
      hoverUrl: null
    }
  },
  // Halo Contrast Tee images + imageRoles + specs pinned here so
  // applyLocalProductOverrides wins the AppContext merge against any future
  // Supabase row that pre-dates these slots. Same defensive pattern the
  // womens above-as-below products use for images/imageRoles, and the halo
  // mini dress override uses for specs.
  prod_womens_coalition_halo_contrast_tee: {
    images: [
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.front,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.back,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.modelFront,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.frontDetail,
      PRODUCT_IMAGE_URLS.womensHaloContrastTee.backDetail
    ],
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.womensHaloContrastTee.front,
      hoverUrl: PRODUCT_IMAGE_URLS.womensHaloContrastTee.back
    },
    specs: {
      attributes: [
        { label: 'Gender', value: 'Female' },
        { label: 'Fit', value: 'Bodycon' },
        { label: 'Style', value: 'Raglan Sleeve Tee' },
      ],
      care: [
        'Machine wash cold on gentle cycle',
        'Do not bleach',
        'Tumble dry low',
        'Iron inside-out on low heat, avoid ironing on print',
      ],
      material: {
        composition: 'Cotton / spandex blend (bodycon stretch)',
        fabricWeight: 'Mid-weight',
        thickness: 'Semi-sheer at seams',
        breathability: 'High',
      },
    }
  },
  prod_halo_mini_dress: {
    images: [
      PRODUCT_IMAGE_URLS.haloMiniDress.modelFaceFront,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelFront,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelAngledFront,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelSide,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelBackAngled,
      PRODUCT_IMAGE_URLS.haloMiniDress.modelBack
    ],
    // Pinned here so applyLocalProductOverrides wins the merge — the live
    // Supabase row predates the specs column and would clobber it with
    // `undefined` via the `{...local, ...sp}` spread.
    specs: {
      attributes: [
        { label: 'Gender', value: 'Female' },
        { label: 'Effects', value: 'Backless' },
        { label: 'Fit', value: 'Bodycon' },
        { label: 'Neckline', value: 'U-Neck' },
        { label: 'Sleeve Length', value: 'Sleeveless' },
        { label: 'Season', value: 'Spring / Summer' },
        { label: 'Style', value: 'Basics / Casual / Sexy' },
      ],
      care: [
        'Machine wash at 30°C (gentle cycle)',
        'Do not bleach',
        'Tumble dry low',
        'Iron at low temperature, avoid ironing on print',
        'Do not dry clean',
      ],
      material: {
        composition: '92% rayon, 8% spandex',
        fabricWeight: '260 gsm (7.7 oz)',
        thickness: 'Thin',
        breathability: 'Moderate',
      },
    },
    // imageRoles is intentionally NOT in this override so the Supabase row's
    // imageRoles.{primaryUrl, hoverUrl, namedSlots} wins after the
    // AppContext fetchProducts merge. Halo image roles are operator-curated
    // at runtime via components/admin/ProductManager.tsx > Named Slot Targets
    // and mirrored through the upsert in scripts/addHaloMiniDress.ts. The
    // legacy shape (without namedSlots) gets a clean default from
    // INITIAL_PRODUCTS > imageRoles above. Do not pin limited-edition or
    // tier-pricing fields here; this dress is a standard live catalog item.
  },
  // Hoodie ships in 1-2 weeks (faster than the original 4-6 week pre-order
  // commitment). The `category: 'sweatshirt'` override is also pinned here so
  // the SWEATSHIRTS filter on /shop surfaces the hoodie even though the live
  // Supabase row was originally seeded with `category: 'apparel'` (see
  // scripts/addOverwhelminglyPatientHoodie.ts — drift source). Lives in
  // PRODUCT_LOCAL_OVERRIDES rather than only in INITIAL_PRODUCTS so
  // applyLocalProductOverrides wins the AppContext merge after the Supabase
  // fetch — the live Supabase row was added before these fields existed, so
  // a `{...local, ...sp}` spread would otherwise clobber the local values
  // with `undefined` or the stale DB category.
  prod_hoodie_overwhelmingly_patient: {
    shippingFulfillment: 'Ships in 1-2 weeks',
    category: 'sweatshirt',
    // Chakra-line hoodie pins imageRoles alongside the other safety-net
    // fields so the flat-lay render survives the
    // applyLocalProductOverrides spread. Whole-blob re-statement (NOT a
    // partial) for the same reason as prod_tee_above_as_below above: a
    // partial would silently wipe primaryUrl/hoverUrl the Supabase row
    // carries.
    imageRoles: {
      primaryUrl: PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatFront,
      hoverUrl: PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatBack,
      imageFit: 'contain',
      imageBackground: 'white',
    },
  },
  Coalition_Above_As_Below_Wallet_1_1: {
    makingVideoUrl: ABOVE_AS_BELOW_WALLET_MAKING_VIDEO_URL,
    makingVideoLinks: ABOVE_AS_BELOW_WALLET_MAKING_VIDEO_LINKS,
  },
  Coalition_Grey_Wave_Wallet_1_2: {
    archived: true,
    archivedAt: '2026-06-25T02:40:12.191+00:00',
    soldAt: '2026-06-25T02:40:12.191+00:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    makingVideoUrl: 'https://www.instagram.com/p/DZ3wBL_z0sd/',
    archiveNote: "This exact Grey Wave wallet has sold. Request a similar custom if you want the same charcoal-grey direction rebuilt for a future drop."
  },
  // Mirrors the 1/2 override above. The live Supabase row for 2/2 still
  // shows stock 1 because the sale was offline (York, PA). This override
  // ensures applyLocalProductOverrides wins the AppContext merge so the
  // storefront PDP renders "Sold Out" / archived regardless of the DB row.
  // The buyer's identity is NOT stored anywhere in the codebase — the
  // INITIAL_ORDERS row uses customerName: 'York Customer' and
  // customerEmail: 'customer@example.com' per the privacy contract.
  Coalition_Grey_Wave_Wallet_2_2: {
    archived: true,
    archivedAt: '2026-07-02T10:00:00-04:00',
    soldAt: '2026-07-02T10:00:00-04:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    makingVideoUrl: 'https://www.instagram.com/p/DZ8z0t0Tfws/',
    archiveNote: "This exact Grey Wave wallet has sold. Request a similar custom if you want the same storm-grey direction rebuilt for a future drop."
  },
  // Mirrors the True Religion S1 + Grey Wave archive pattern. The live
  // Supabase row may still show stock 1 because the sale was offline
  // (Abingdon, MD) and was never pushed as a Supabase decrement. This
  // override ensures applyLocalProductOverrides wins the AppContext
  // merge so the storefront PDP renders "Sold Out" / archived
  // regardless of the DB row. The buyer's identity is stamped on the
  // matching INITIAL_ORDERS row (instagramUsername: 'friiqy') so the
  // operator can join this sale to friiqy's customer profile without
  // storing any PII in the product row itself.
  Coalition_Denim_Patchwork_S1: {
    archived: true,
    archivedAt: '2024-11-08T15:00:00-05:00',
    soldAt: '2024-11-08T15:00:00-05:00',
    sizes: ['30'],
    sizeInventory: { '30': 0 },
    archiveNote: "This exact Denim Patchwork has sold. Hand-pieced from multiple denim panels in a single build \u2014 no two alike, no restocks."
  },
  SKYYBLUEWALLET1_2: {
    archived: true,
    archivedAt: '2026-03-26T00:00:00Z',
    soldAt: '2026-03-26T00:00:00Z',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    archiveNote: 'This exact wallet was given to an unhoused veteran after a chance encounter on a dirt bike ride. Seeing someone who served the country still left outside stayed with us. Coalition is built on action, dignity, and showing up for people when the moment calls for it, so this piece was given away instead of sold.'
  }
};

export const ABOUT_TEXT = `Coalition is more than a brand; it is a movement born on the streets of Baltimore. We believe in the power of unity and the strength of the collective. Every stitch represents our commitment to quality, community, and the hustle that defines our city. Join the Coalition.`;

export const INITIAL_SECTIONS: Section[] = [
  {
    id: 'sec_hero',
    type: 'hero',
    title: 'CRAFTED IN BALTIMORE',
    isVisible: true,
    order: 0,
    content: 'Premium streetwear designed for the city that built us.'
  },
  {
    id: 'sec_featured',
    type: 'featured',
    title: 'Spotlight',
    isVisible: true,
    order: 1
  },
  {
    id: 'sec_custom_inquiry',
    type: 'custom_inquiry_cta',
    title: 'Custom Designs',
    isVisible: true,
    order: 2
  },
  {
    id: 'sec_grid',
    type: 'grid',
    title: 'Latest Drops',
    isVisible: true,
    order: 3
  },
  {
    id: 'sec_about',
    type: 'about_teaser',
    title: 'The Coalition',
    isVisible: true,
    order: 4,
    content: ABOUT_TEXT.substring(0, 200) + '...'
  },
];

export const COIN_REWARD_RATE = 1; // V2: 1 SGC per $1 spent (~4.5% rewards at $0.045/SGC)
export const SG_COIN_RATE = COIN_REWARD_RATE; // Legacy alias for ProductPage compatibility
export const V2_REWARD_RATE = 0.25; // Legacy reference, can be deprecated or used for calculations

// =====================================
// NO REFUNDS POLICY CONFIGURATION
// =====================================

export const SALES_FINAL_ENABLED = viteEnv.VITE_SALES_FINAL === 'true';

export const CONSENT_TEXT = "All sales are final. No returns, exchanges, or refunds will be accepted.";

export const CONSENT_CHECKBOX_TEXT = "I confirm I have read and agree that all sales are final and I will not request a refund or return.";

export const REFUND_POLICY_FULL_TEXT = `
All sales are final. We do not accept returns, exchanges, or refunds on any products purchased through this website.

By completing your purchase, you acknowledge and agree to this policy.

If you have questions about a product before purchasing, please contact us at support@sgcoalition.xyz.
`.trim();

// =====================================
// SGCOIN DISCOUNT CONFIGURATION
// =====================================

export const SGCOIN_DISCOUNT_ENABLED = viteEnv.VITE_SGCOIN_DISCOUNT_ENABLED === 'true';
export const SGCOIN_DISCOUNT_PERCENTAGE = parseFloat(viteEnv.VITE_SGCOIN_DISCOUNT_PERCENTAGE || '10');

export const SGCOIN_PAYMENT_METHODS = ['sgcoin', 'gmoney'] as const;
export type SGCoinPaymentMethod = typeof SGCOIN_PAYMENT_METHODS[number];

// =====================================
// TUTORIAL CONFIGURATION
// =====================================

// =====================================
// SGCOIN V2 MIGRATION CONFIGURATION
// =====================================
// FAIR FLAT-RATIO MIGRATION SYSTEM
// Every holder receives the same migration ratio regardless of wallet size
// This ensures fairness, transparency, and rewards loyalty equally
// Ratio set to 1M:1 (matching the old "Whale" tier worst-case scenario)

export const V1_TOTAL_SUPPLY = 10_000_000_000_000; // 10 Trillion V1
export const V2_TOTAL_SUPPLY = 10_000_000; // 10 Million V2
export const MIGRATION_RATIO = 1_000_000; // 1M V1 = 1 V2 (flat for everyone)

// Migration ratio calculation helper
export const calculateV2Amount = (v1Amount: number): number => {
  return v1Amount / MIGRATION_RATIO;
};

// Migration ratio display helper
export const getMigrationRatioDisplay = (): string => {
  return `${MIGRATION_RATIO.toLocaleString()}:1`;
};

export const SGCOIN_V1_CONTRACT_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
export const SGCOIN_V2_CONTRACT_ADDRESS = '0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e'; // Official V2 Contract
export const SGCOIN_MIGRATOR_ADDRESS = '0xc6c1EB54E5Ed966C0B48154d6e22eaA8a4c4C536'; // SafeMigration Contract (Flat 1M:1 Logic)
export const SGCOIN_BURN_ADDRESS = '0x20756b2667D575Ddde2383f3841D2CD855D5fb6d'; // Migration Burn Wallet
export const SGCOIN_LIQUIDITY_PROVIDER = '0xd4d7691f062614ae6905d7bef62638b42c33df9f'; // SGCoin V2 Source Wallet

// Strategic Liquidity Tracking
export const QUICKSWAP_LP_ADDRESS = '0x43a974142b297D2f09a39ACd838a66452789ba32'; // SGC/WPOL Pair (V2)
export const QUICKSWAP_V3_LP_ADDRESS = '0x95194a754b6f768ed08ef5d695dabee349b7bf72'; // SGC/WPOL Pair (V3)
export const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // Wrapped POL
export const TREASURY_WALLET_ADDRESS = '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4'; // SGC Treasury / Founder Wallet
export const LIQUIDITY_TARGET_POL = 500;
export const FALLBACK_LIQUIDITY_POL = 27.6; // Last known good value

export const QUICKSWAP_SWAP_URL = `https://dapp.quickswap.exchange/swap/best/ETH/${SGCOIN_V2_CONTRACT_ADDRESS}?chainId=137`;
export const POLYGON_RPC_URLS = [
  'https://polygon-bor.publicnode.com',
  'https://polygon-rpc.com',
  'https://rpc-mainnet.maticvigil.com'
];
export const POLYGON_RPC_URL = POLYGON_RPC_URLS[0];
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_CURRENCY_SYMBOL = 'MATIC';
export const POLYGON_BLOCK_EXPLORER = 'https://polygonscan.com';

// Tutorial Progress
export const TUTORIAL_STORAGE_KEY = 'sgcoin_tutorial_progress';
export const TUTORIAL_STEPS = 6;

// Tutorial Step Names
export const TUTORIAL_STEP_NAMES = [
  'Welcome',
  'Install MetaMask',
  'Switch to Polygon',
  'Fund Wallet',
  'Swap on QuickSwap',
  'Use SGCoin'
];

export const MINI_WIZARDS_CONTRACT_ADDRESS = '0x653b07c58669bc335fc9cfe2f9afa68f7fe94fc2';

// =====================================
// ADMIN CONFIGURATION
// =====================================
// =====================================
// ADMIN CONFIGURATION
// =====================================
export const ADMIN_WALLETS = [
  '0x0f4a0466c2a1d3fa6ed55a20994617f0533fbf74', // Founder
  '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4', // Founder Secondary / Treasury
];


export const INITIAL_ORDERS: any[] = [
  {
    // MUST stay in lock-step with PUBLIC_RECENT_ORDER_SEEDS in
    // utils/liveOrdersFeed.ts. buildLiveOrdersFeed dedupes by `id`,
    // so any drift here causes duplicate rows in the live map feed.
    // Documented in the 'Recently Ordered Live Map' section of README.md.
    id: 'public-pa-grey-wave-wallet-2-2',
    orderNumber: 'ORD-SG-GREY-WAVE-2001',
    isGuest: true,
    customerName: 'York Customer',
    customerEmail: 'customer@example.com',
    items: [
      {
        productId: 'Coalition_Grey_Wave_Wallet_2_2',
        productName: "Coalition 'Grey Wave' Wallet 2/2",
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_FVMHZoq.jpg',
        selectedSize: 'One Size',
        quantity: 1,
        price: 75,
        total: 75
      }
    ],
    subtotal: 75,
    tax: 0,
    discount: 0,
    total: 75,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    shippingAddress: {
      address1: '',
      city: 'York',
      state: 'PA',
      zip: '',
      country: 'US',
      shippingMethod: 'standard',
      shippingCost: 0
    },
    createdAt: '2026-07-02T10:00:00-04:00',
    paidAt: '2026-07-02T10:00:00-04:00'
  },
  {
    // MUST stay in lock-step with PUBLIC_RECENT_ORDER_SEEDS in
    // utils/liveOrdersFeed.ts. See Grey Wave 2/2 note above for the
    // dedup-by-id contract.
    id: 'public-pa-grey-wave-wallet-1-2',
    orderNumber: 'ORD-SG-GREY-WAVE-2000',
    isGuest: true,
    customerName: 'York Customer',
    customerEmail: 'customer@example.com',
    items: [
      {
        productId: 'Coalition_Grey_Wave_Wallet_1_2',
        productName: "Coalition 'Grey Wave' Wallet 1/2",
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_7z2h8u6.jpg',
        selectedSize: 'One Size',
        quantity: 1,
        price: 75,
        total: 75
      }
    ],
    subtotal: 75,
    tax: 0,
    discount: 0,
    total: 75,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    shippingAddress: {
      address1: '',
      city: 'York',
      state: 'PA',
      zip: '',
      country: 'US',
      shippingMethod: 'standard',
      shippingCost: 0
    },
    createdAt: '2026-06-25T10:00:00-04:00',
    paidAt: '2026-06-25T10:00:00-04:00'
  },
  {
    // MUST stay in lock-step with PUBLIC_RECENT_ORDER_SEEDS in
    // utils/liveOrdersFeed.ts. See Grey Wave 2/2 note above for the
    // dedup-by-id contract. Coalition_x_True_Religion_S1 was sold in
    // New York, NY on 2024-02-14 (~121 weeks before a July 2026
    // viewer); PUBLIC_RECENT_ORDER_SEEDS uses minutesAgo = 121 * 7 * 24 * 60
    // to match. The public Instagram post
    // (https://www.instagram.com/p/C2v4MMxs9TX/) is dated 2024-01-30;
    // the "SOLD ❌" comment lands ~2 weeks later. The $140 sale price
    // reflects an offline-cash deal - the $240 catalog list is the
    // listed value, not the actual transaction. This seed is the
    // oldest public sale; it only surfaces when the viewer picks the
    // "All time" chip because 121w is past every other time range.
    // No shipped address is recorded - only city + state, matching
    // the live map privacy contract.
    id: 'public-ny-true-religion-s1',
    orderNumber: 'ORD-SG-TRUE-RELIGION-S1-9001',
    isGuest: true,
    customerName: 'New York Customer',
    customerEmail: 'customer@example.com',
    items: [
      {
        productId: 'Coalition_x_True_Religion_S1',
        productName: 'Coalition x True Religion 1/1 Jeans S1',
        // Mirrors PRODUCT_IMAGE_URLS.trueReligionJeans.front1 so the
        // Supabase merge for INITIAL_ORDERS keeps the same image the
        // live seed uses and the storefront PDP shows on this row.
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_2VU7MEr.jpg',
        selectedSize: '33',
        quantity: 1,
        price: 140,
        total: 140
      }
    ],
    subtotal: 140,
    tax: 0,
    discount: 0,
    total: 140,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    shippingAddress: {
      address1: '',
      city: 'New York',
      state: 'NY',
      zip: '',
      country: 'US',
      shippingMethod: 'standard',
      shippingCost: 0
    },
    createdAt: '2024-02-14T15:00:00-05:00',
    paidAt: '2024-02-14T15:00:00-05:00',
    // Friiqy is the buyer of this offline-cash deal. The same
    // @friiqy Instagram account also bought the wholesale wallets
    // row below (public-md-wholesale-wallets-2026_05_22). Stamped
    // here so the operator can join the two offline sales to the
    // same buyer when reconciling the marketing contacts list.
    instagramUsername: 'friiqy'
  },
  {
    // MUST stay in lock-step with PUBLIC_RECENT_ORDER_SEEDS in
    // utils/liveOrdersFeed.ts. See Grey Wave 2/2 note at the top of
    // INITIAL_ORDERS for the dedup-by-id contract. The 'Trust Yourself'
    // hat (`prod_trust_yourself_hat_01`) sold in Owings Mills, MD on
    // 2026-04-09; PUBLIC_RECENT_ORDER_SEEDS places this sale ~84 days
    // before "now", so it only surfaces when the viewer picks the 90d
    // window. Like the TrueReligion NY row above, no shipped address
    // is recorded - only city + state, matching the live map privacy
    // contract documented in pages/LiveOrdersMap.tsx.
    id: 'public-md-trust-yourself-hat-01',
    orderNumber: 'ORD-SG-TRUST-HAT-9002',
    isGuest: true,
    customerName: 'Owings Mills Customer',
    customerEmail: 'customer@example.com',
    items: [
      {
        productId: 'prod_trust_yourself_hat_01',
        productName: 'TRUST YOURSELF CUSTOM TRUCKER (1/1)',
        // Mirrors PRODUCT_IMAGE_URLS.trustYourselfHat.cover so the
        // storefront PDP + live map share the same canonical hat image.
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_iYBlwm8.png',
        selectedSize: 'One Size',
        quantity: 1,
        price: 50,
        total: 50
      }
    ],
    subtotal: 50,
    tax: 0,
    discount: 0,
    total: 50,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    shippingAddress: {
      address1: '',
      city: 'Owings Mills',
      state: 'MD',
      zip: '',
      country: 'US',
      shippingMethod: 'standard',
      shippingCost: 0
    },
    createdAt: '2026-04-09T15:00:00-04:00',
    paidAt: '2026-04-09T15:00:00-04:00'
  },
  {
    // MUST stay in lock-step with PUBLIC_RECENT_ORDER_SEEDS in
    // utils/liveOrdersFeed.ts. See Grey Wave 2/2 note at the top
    // of INITIAL_ORDERS for the dedup-by-id contract. The friiqy
    // wholesale: 7 archived wallets (GreenCamoWallet,
    // SKYYBLUEWALLET1_2, prod_wallet_004, Coalition Racing Team
    // 1/4 through 4/4) sold to @friiqy on Instagram in a single
    // offline cash deal at $25/wallet = $175 total, shipped to
    // Abingdon, MD. The buyer is the same @friiqy who bought the
    // True Religion S1 jeans (see public-ny-true-religion-s1
    // above); instagramUsername on both rows lets the operator
    // join the two offline sales to the same person when
    // reconciling the marketing contacts list.
    //
    // The full street address lives in shipping_internal.json at the
    // repo root (gitignored, admin-only) and is loaded at runtime by
    // scripts/upsertFriiqyWholesale.ts when this row is mirrored to
    // Supabase. This INITIAL_ORDERS row keeps address1 + zip as
    // empty strings to match the privacy contract default — the live
    // map only ever sees city + state via PUBLIC_RECENT_ORDER_SEED,
    // which also strips address1 + zip. PUBLIC_RECENT_ORDER_SEEDS
    // uses minutesAgo = 58,284 (~40d 11h) to mirror the createdAt
    // timestamp below; the sale surfaces in the 90d and all-time
    // windows only (it's past the 30d cutoff).
    //
    // The wholesale is split into 7 separate OrderItems (one per
    // wallet) rather than a single quantity-7 line so the order
    // detail page shows every wallet in the bundle, the storefront
    // PDP / Order History pages keep their per-product rendering,
    // and the live map ticker can show the first wallet + "6 more
    // items" copy via the existing buildLiveOrdersFeed "+ N more"
    // helper.
    //      // OPEN FOLLOW-UPS (as of the 2026-07-04 schema recovery
      // round — three prod migrations that were silently missing,
      // orders.id migrated to TEXT, and the seed-script
      // paypal_capture_id mismatch all resolved):
      // 1. Supabase sync — SCRIPT TOOLING DONE 2026-07-04.
      //    scripts/upsertFriiqyDenimPatchwork.ts and
      //    scripts/upsertFriiqyWholesale.ts no longer emit the
      //    non-existent `paypal_capture_id` column; they write
      //    `payment_reference` + `paypal_order_id`, matching
      //    supabase/migrations/20260617_add_paypal_order_fields.sql
      //    (which was a fresh prod apply this round — three
      //    migrations had silently drifted from disk). production
      //    orders.id is now TEXT (supabase/migrations/
      //    20260705_change_orders_id_to_text.sql applied
      //    2026-07-04), so the offline-sale rows keyed on
      //    `public-...` upsert directly without inventing UUIDs.
      //    Open: operator runs `npm run seed:friiqy-denim-patchwork`
      //    and `npm run seed:friiqy-wholesale` to land both rows.
      //    The denim-patchwork script mirrors this row's id
      //    `public-md-denim-patchwork-2024_11_08`; the wholesale
      //    script mirrors `public-md-wholesale-wallets-2026_05_22`.
      //    Both scripts read shipping_internal.json at runtime
      //    for the full address (see item 3 below).
      // 2. Verified-customer filter — SCRIPT TOOLING DONE 2026-07-04.
      //    scripts/seedVerifiedCustomers.ts registers friiqy in
      //    marketing_contacts with source='past_customer'. The
      //    test-campaign guard in api/_handlers/marketing-send.ts
      //    keys on marketing_contacts.source ∈ {manual_seed,
      //    past_customer}, so friiqy is automatically excluded
      //    from any campaign whose name contains "test"
      //    (case-insensitive). Open: the script still needs the
      //    marketing_contacts_has_channel CHECK constraint shape
      //    captured (paste `SELECT pg_get_constraintdef(oid) FROM
      //    pg_constraint WHERE conname='marketing_contacts_has_channel'`
      //    in the Supabase SQL editor and apply whatever payload
      //    adjustment the constraint requires) before the
      //    operator runs `npm run seed:verified-customers`. The
      //    production schema recovery this round confirmed
      //    customer_reward_credits + the 6 profile columns + the
      //    social_accounts_platform_check constraint are all in
      //    place on production.
      // 3. Address privacy — DONE 2026-07-04. Full street address
      //    lives in shipping_internal.json at the repo root
      //    (gitignored, admin-only). Both seed scripts read that
      //    file at runtime and fall back to empty strings if the
      //    file is missing or has no entry for the order id. The
      //    template at shipping_internal.example.json is committed
      //    so the schema is documented. The Vercel deploy never has
      //    shipping_internal.json in its build output, so
      //    production has no access to the full address. This
      //    INITIAL_ORDERS row keeps address1 + zip as empty
      //    strings so the git-tracked codebase never carries the
      //    full street address — city + state are what the live
      //    map surfaces.
    id: 'public-md-wholesale-wallets-2026_05_22',
    orderNumber: 'ORD-SG-WHOLESALE-1002',
    isGuest: true,
    customerName: 'Abingdon Customer',
    customerEmail: 'customer@example.com',
    items: [
      {
        productId: 'GreenCamoWallet',
        productName: 'COALITION GREEN CAMO WALLET',
        // Mirrors PRODUCT_IMAGE_URLS.walletGreen.front from
        // utils/localImageAssets.ts so the storefront PDP + live
        // map share one canonical GreenCamoWallet cover.
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_kzIWQzA.png',
        selectedSize: 'One Size',
        quantity: 1,
        price: 25,
        total: 25
      },
      {
        productId: 'SKYYBLUEWALLET1_2',
        productName: 'COALITION SKYY BLUE WALLET 1/2',
        // Mirrors PRODUCT_IMAGE_URLS.walletSkyyBlue.front so the
        // storefront PDP + live map share one canonical Skyy Blue
        // 1/2 cover.
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_rJSCmHu.png',
        selectedSize: 'One Size',
        quantity: 1,
        price: 25,
        total: 25
      },
      {
        productId: 'prod_wallet_004',
        productName: 'COALITION SKYY BLUE WALLET 2/2',
        // Mirrors PRODUCT_IMAGE_URLS.walletSkyyBlueArchive.front
        // (the archived Skyy Blue 2/2 cover) so the storefront
        // PDP + live map share one canonical Skyy Blue 2/2 cover.
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_Z5K3JZ0.png',
        selectedSize: 'One Size',
        quantity: 1,
        price: 25,
        total: 25
      },
      {
        productId: 'Coalition_Racing_Team_Wallet_1_4',
        productName: "Coalition 'Racing Team' Wallet 1/4",
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_3UUmYQa.jpg',
        selectedSize: 'One Size',
        quantity: 1,
        price: 25,
        total: 25
      },
      {
        productId: 'Coalition_Racing_Team_Wallet_2_4',
        productName: "Coalition 'Racing Team' Wallet 2/4",
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_IRhVbhN.jpg',
        selectedSize: 'One Size',
        quantity: 1,
        price: 25,
        total: 25
      },
      {
        productId: 'Coalition_Racing_Team_Wallet_3_4',
        productName: "Coalition 'Racing Team' Wallet 3/4",
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_dcw5qLQ.jpg',
        selectedSize: 'One Size',
        quantity: 1,
        price: 25,
        total: 25
      },
      {
        productId: 'Coalition_Racing_Team_Wallet_4_4',
        productName: "Coalition 'Racing Team' Wallet 4/4",
        productImage: 'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_EylCpDU.jpg',
        selectedSize: 'One Size',
        quantity: 1,
        price: 25,
        total: 25
      }
    ],
    subtotal: 175,
    tax: 0,
    discount: 0,
    total: 175,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    shippingAddress: {
      // address1 + zip live in shipping_internal.json at the repo
      // root (gitignored, admin-only). The seed script
      // scripts/upsertFriiqyWholesale.ts reads that file at runtime
      // and populates these fields when mirroring this row to
      // Supabase. Kept as empty strings here so the codebase never
      // carries the full street address. City + state are safe to
      // commit — they're what the live map surfaces.
      address1: '',
      city: 'Abingdon',
      state: 'MD',
      zip: '',
      country: 'US',
      shippingMethod: 'standard',
      shippingCost: 0
    },
    createdAt: '2026-05-22T22:48:11-04:00',
    paidAt: '2026-05-22T22:48:11-04:00',
    // Same buyer as the public-ny-true-religion-s1 row above.
    // Stamped here so the operator can reconcile both friiqy
    // sales (True Religion S1 + wholesale wallets) to the same
    // Instagram account when building the marketing contacts
    // list.
    instagramUsername: 'friiqy'
  },
  {
    // MUST stay in lock-step with PUBLIC_RECENT_ORDER_SEEDS in
    // utils/liveOrdersFeed.ts. See Grey Wave 2/2 note at the top
    // of INITIAL_ORDERS for the dedup-by-id contract. The friiqy
    // denim patchwork sale: 1/1 Coalition Denim Patchwork jeans
    // (Coalition_Denim_Patchwork_S1) sold to @friiqy on Instagram
    // on 2024-11-08 (the date of the canonical Instagram post
    // https://www.instagram.com/p/DCIqPY4Msk_/?img_index=1) for
    // $140, shipped to Abingdon, MD. This is friiqy's third known
    // offline-cash sale to Coalition (alongside the True Religion
    // S1 jeans on 2024-02-14 and the 7-wallet wholesale on
    // 2026-05-22). instagramUsername is stamped so the operator
    // can join all three sales to the same Instagram account when
    // reconciling the marketing contacts list.
    //
    // The full street address lives in shipping_internal.json at
    // the repo root (gitignored, admin-only) and is loaded at
    // runtime by scripts/upsertFriiqyDenimPatchwork.ts when
    // mirroring this row to the production Supabase orders table.
    // This INITIAL_ORDERS row keeps address1 + zip as empty
    // strings to match the privacy contract default; the live map
    // only ever sees city + state via PUBLIC_RECENT_ORDER_SEED,
    // which also strips address1 + zip. PUBLIC_RECENT_ORDER_SEEDS
    // uses minutesAgo = 601 * 24 * 60 to mirror the createdAt
    // timestamp below; the sale surfaces in the "all" window only
    // (~601 days back is well past every other time range).
    id: 'public-md-denim-patchwork-2024_11_08',
    orderNumber: 'ORD-SG-DENIM-PATCH-S1-9003',
    isGuest: true,
    customerName: 'Abingdon Customer',
    customerEmail: 'customer@example.com',
    items: [
      {
        productId: 'Coalition_Denim_Patchwork_S1',
        productName: 'Coalition Denim Patchwork 1/1 Jeans S1',
        // Mirrors the product row's primary image
        // (constants.ts > INITIAL_PRODUCTS > Coalition_Denim_Patchwork_S1)
        // so the storefront PDP + live map share one canonical
        // denim-patchwork cover.
        productImage: 'https://www.instagram.com/p/DCIqPY4Msk_/?img_index=1',
        selectedSize: '30',
        quantity: 1,
        price: 140,
        total: 140
      }
    ],
    subtotal: 140,
    tax: 0,
    discount: 0,
    total: 140,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    shippingAddress: {
      // address1 + zip live in shipping_internal.json at the repo
      // root (gitignored, admin-only). The seed script
      // scripts/upsertFriiqyDenimPatchwork.ts reads that file at
      // runtime and populates these fields when mirroring this row
      // to Supabase. Kept as empty strings here so the codebase
      // never carries the full street address. City + state are
      // safe to commit - they're what the live map surfaces.
      address1: '',
      city: 'Abingdon',
      state: 'MD',
      zip: '',
      country: 'US',
      shippingMethod: 'standard',
      shippingCost: 0
    },
    createdAt: '2024-11-08T15:00:00-05:00',
    paidAt: '2024-11-08T15:00:00-05:00',
    // Same buyer as the public-ny-true-religion-s1 row AND the
    // public-md-wholesale-wallets-2026_05_22 row above. Stamped
    // here so the operator can reconcile all three friiqy sales
    // (True Religion S1 + wholesale wallets + denim patchwork) to
    // the same Instagram account when building the marketing
    // contacts list.
    instagramUsername: 'friiqy'
  }
];

export const ADMIN_USER = {
  uid: 'admin',
  displayName: 'Admin',
  email: 'admin@sgcoalition.xyz',
  walletAddress: null,
  sgCoinBalance: 0,
  isAdmin: true,
  favorites: []
};
