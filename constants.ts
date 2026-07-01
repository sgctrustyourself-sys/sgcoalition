import { Product, Section } from './types';
import { PRODUCT_IMAGE_URLS } from './utils/localImageAssets';

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
    sizeInventory: { S: 9, M: 9, L: 9, XL: 9, '2XL': 8 }
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
      'https://i.imgur.com/3UUmYQa.jpg',
      'https://i.imgur.com/vRqjRG4.jpg'
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
      'https://i.imgur.com/IRhVbhN.jpg',
      'https://i.imgur.com/7ScdBnE.jpg'
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
      'https://i.imgur.com/dcw5qLQ.jpg',
      'https://i.imgur.com/hmPBbY3.jpg'
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
      'https://i.imgur.com/EylCpDU.jpg',
      'https://i.imgur.com/w8dahYm.jpg'
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
  },  {
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
    price: 60,
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
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 1 }
  },
  {
    id: 'Coalition_Above_As_Below_Wallet_1_1',
    founderNote: `[PLACEHOLDER · Coalition_Above_As_Below_Wallet_1_1] Replace with founder's note: 1-2 paragraphs covering what this build is, why this one was made, and what to look for in the seams. Anti-tricky-brand voice, ~120 words.`,
    name: 'COALITION ABOVE AS BELOW 1/1 WALLET',
    price: 85,
    createdAt: '2026-06-28T00:00:00-04:00',
    images: [
      'https://i.imgur.com/9NF3LzM.jpg',
      'https://i.imgur.com/UoY42bg.jpg'
    ],
    description: '1/1 Above as Below wallet. Hand-finished with the same storm-and-balance motif as the matching Above as Below tee — single piece, one red-and-white Coalition mark, scaled for everyday carry. Once sold, gone forever.',
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
    sizeInventory: { S: 9, M: 9, L: 9, XL: 9, '2XL': 8 }
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
    id: 'prod_halo_mini_dress',
    founderNote: `The Halo Mini Dress is a clean black bodycon silhouette with the Coalition halo mark placed high on the chest and the cross-backed Coalition hit sitting low on the back.

Numbered cohort of 50 — first ten buyers lock in $50, the next fifteen get $60, every piece after that $75. Same fabric run, same hand-finished back graphic — late buyers pay a small premium for landing later in the cohort. Sized S through XL.`,
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
      hoverUrl: PRODUCT_IMAGE_URLS.haloMiniDress.modelFront
    },
    description: 'Coalition Halo Mini Dress in black with a fitted cami mini silhouette, gold Coalition chest logo, low scoop back, and gold cross-backed Coalition graphic. Numbered edition of 50: tier-priced $50 / $60 / $75 as the cohort fills.',
    category: 'dress',
    isFeatured: false,
    isLimitedEdition: true,
    editionSize: 50,
    pricingTiers: [
      { untilCount: 10, price: 50 },
      { untilCount: 25, price: 60 },
      { untilCount: null, price: 75 }
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    // Total 50 across all sizes; matches the numbered cohort.
    sizeInventory: { S: 12, M: 13, L: 13, XL: 12 },
    editionSoldCount: 0
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
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1, '2XL': 1 }
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
  prod_halo_mini_dress: {
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
      hoverUrl: PRODUCT_IMAGE_URLS.haloMiniDress.modelFront
    },
    isLimitedEdition: true,
    editionSize: 50,
    pricingTiers: [
      { untilCount: 10, price: 50 },
      { untilCount: 25, price: 60 },
      { untilCount: null, price: 75 }
    ]
  },
  // Hoodie ships in 1-2 weeks (faster than the original 4-6 week pre-order
  // commitment). Lives in PRODUCT_LOCAL_OVERRIDES rather than only in
  // INITIAL_PRODUCTS so applyLocalProductOverrides wins the AppContext merge
  // after the Supabase fetch — the live Supabase row was added before
  // `shippingFulfillment` existed, so a `{...local, ...sp}` spread would
  // otherwise clobber the local value with `undefined`.
  prod_hoodie_overwhelmingly_patient: {
    shippingFulfillment: 'Ships in 1-2 weeks',
  },
  Coalition_Grey_Wave_Wallet_1_2: {
    archived: true,
    archivedAt: '2026-06-25T02:40:12.191+00:00',
    soldAt: '2026-06-25T02:40:12.191+00:00',
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 0 },
    archiveNote: "This exact Grey Wave wallet has sold. Request a similar custom if you want the same charcoal-grey direction rebuilt for a future drop."
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

export const SALES_FINAL_ENABLED = import.meta.env.VITE_SALES_FINAL === 'true';

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

export const SGCOIN_DISCOUNT_ENABLED = import.meta.env.VITE_SGCOIN_DISCOUNT_ENABLED === 'true';
export const SGCOIN_DISCOUNT_PERCENTAGE = parseFloat(import.meta.env.VITE_SGCOIN_DISCOUNT_PERCENTAGE || '10');

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
    id: 'order_wholesale_wallets_2026_05_22',
    orderNumber: 'ORD-SG-WHOLESALE-1002',
    isGuest: true,
    customerName: 'Wholesale Customer',
    customerEmail: 'wholesale@example.com',
    items: [
      {
        productId: 'prod_wallet_004',
        productName: 'COALITION WALLETS WHOLESALE (7x)',
        productImage: 'https://i.imgur.com/v5y7tPa.jpg',
        selectedSize: 'One Size',
        quantity: 7,
        price: 25,
        total: 175
      }
    ],
    subtotal: 175,
    tax: 0,
    discount: 0,
    total: 175,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    orderType: 'manual',
    createdAt: '2026-05-22T22:48:11-04:00',
    paidAt: '2026-05-22T22:48:11-04:00'
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
