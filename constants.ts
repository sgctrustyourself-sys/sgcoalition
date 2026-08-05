import { Order, OrderStatus, Product, Section } from "./types";

// Use explicit /index path — './constants' resolves to root constants.ts, not the directory barrel
export * from './constants/index';
import { PRODUCT_IMAGE_URLS } from "./utils/localImageAssets";
import { SITE_NAME } from "./utils/seo";

export const PRODUCT_LOCAL_OVERRIDES: Record<string, Partial<Product>> = {
  Coalition_Grey_Wave_Wallet_1_2: {
    archived: true,
    archivedAt: "2026-06-25T02:40:12.191+00:00",
    soldAt: "2026-06-25T02:40:12.191+00:00",
    sizes: ["One Size"],
    sizeInventory: { "One Size": 0 },
    archiveNote:
      "This exact Grey Wave wallet has sold. Request a similar custom if you want the same charcoal-grey direction rebuilt for a future drop.",
  },
  Coalition_Grey_Wave_Wallet_2_2: {
    archived: true,
    archivedAt: "2026-06-25T02:40:12.191+00:00",
    soldAt: "2026-06-25T02:40:12.191+00:00",
    sizes: ["One Size"],
    sizeInventory: { "One Size": 0 },
    archiveNote: "Second and final piece in the Coalition 'Grey Wave' wallet run. Sold on the same day as 1/2.",
  },
  SKYYBLUEWALLET1_2: {
    archived: true,
    archivedAt: "2026-03-26T00:00:00Z",
    soldAt: "2026-03-26T00:00:00Z",
    sizes: ["One Size"],
    sizeInventory: { "One Size": 0 },
    archiveNote:
      "This exact wallet was given to an unhoused veteran after a chance encounter on a dirt bike ride. Seeing someone who served the country still left outside stayed with us. Coalition is built on action, dignity, and showing up for people when the moment calls for it, so this piece was given away instead of sold.",
  },
  // Wholesale bundle sold to @friiqy in May 2026 (see INITIAL_ORDERS
  // public-md-wholesale-wallets-2026_05_22 — the id is mirrored
  // byte-for-byte in utils/liveOrdersFeed.ts > PUBLIC_RECENT_ORDER_SEEDS
  // per the live-map dedup contract). The Chrome Hearts 1/1 and Denim
  // Patchwork 1/1 were separate offline sales; exact dates unknown for some.
  Coalition_Racing_Team_Wallet_1_4: {
    archiveNote: "Part of the 7-wallet wholesale bundle sold to @friiqy in May 2026.",
  },
  Coalition_Racing_Team_Wallet_2_4: {
    archiveNote: "Part of the 7-wallet wholesale bundle sold to @friiqy in May 2026.",
  },
  Coalition_Racing_Team_Wallet_3_4: {
    archiveNote: "Part of the 7-wallet wholesale bundle sold to @friiqy in May 2026.",
  },
  Coalition_Racing_Team_Wallet_4_4: {
    archiveNote: "Part of the 7-wallet wholesale bundle sold to @friiqy in May 2026.",
  },
  prod_wallet_004: {
    archiveNote: "Part of the 7-wallet wholesale bundle sold to @friiqy in May 2026.",
  },
  prod_wallet_chrome_hearts: {
    archiveNote: "1/1 Coalition x Chrome Hearts collaboration wallet. Premium leather with signature Chrome Hearts sterling silver detailing. A rare collector's piece.",
  },
  Coalition_Kustom_Co_Wallet_1_1: {
    archiveNote: "1/1 Coalition x Kustom Co Japan Auto Club collaboration. Hand-finished with the Kustom Co script logo and Japan Auto Club wordmark. Sold to a private collector; exact sale date is not on record.",
  },
  Coalition_Denim_Patchwork_S1: {
    archiveNote: "1/1 denim patchwork jeans. Sold via the @friiqy relationship in November 2024.",
  },
  Coalition_Denim_Patchwork_X_Meks: {
    archiveNote: "1/1 denim patchwork jeans X Meks. Sold via the @friiqy relationship in May 2026.",
  },
  // Unity No. 4 Polo: founder note surfaces on the PDP below the buy button.
  // Keep this buyer-facing — sourcing + markup math is operator-only and
  // lives in a code comment, not in the public copy.
  prod_unity_polo: {
    founderNote: "Built on an authentic Ralph Lauren polo and hand-finished with the Unity No. 4 mark. Heritage prep meets Coalition attitude — one of one, in the Unity series, gone the moment it sells.",
  },
};

export const ABOUT_TEXT = `Coalition is more than a brand; it is a movement born on the streets of Baltimore. We believe in the power of unity and the strength of the collective. Every stitch represents our commitment to quality, community, and the hustle that defines our city. Join the Coalition.`;

// ----------------------------------------------------------------------------
// About-page SEO + brand sameAs — SINGLE SOURCE OF TRUTH.
// Both surfaces consume these constants:
//   - pages/About.tsx (the React /about route — <Seo> props + ABOUT_PAGE_LD)
//   - public/about.html (the static no-JS /about mirror — REFRESHED BY HAND)
// The static mirror has no build hook back to this module, so when any of
// these three constants change you MUST also edit the matching literals in
// public/about.html (title + meta-description + JSON-LD sameAs array).
// ----------------------------------------------------------------------------
// ABOUT_PAGE_TITLE derives the brand name from SITE_NAME (utils/seo.ts)
// so a brand rename touches one place. The static mirror in
// public/about.html still has the literal version — see the regen note
// in README.md (## Brand voice) for why the manual sync is required.
export const ABOUT_PAGE_TITLE = `About | ${SITE_NAME} | Crafted in Baltimore`;

export const ABOUT_PAGE_DESCRIPTION =
    "Coalition was born from loss. Gmoneyworld — more than a brand, it's a movement. Quality, community, and the hustle, built by hand in Baltimore.";

export const BRAND_SAME_AS_LINKS: readonly string[] = [
    'https://www.instagram.com/sgcoalition',
    'https://twitter.com/sgcoalition',
    'https://www.youtube.com/@sgctrustyourself',
    'https://www.reddit.com/r/SGCoalition/',
    'https://discord.gg/bByqsC5f5V',
];

export const INITIAL_SECTIONS: Section[] = [
  {
    id: "sec_hero",
    type: "hero",
    title: "CRAFTED IN BALTIMORE",
    isVisible: true,
    order: 0,
    content: "Premium streetwear designed for the city that built us.",
  },
  {
    id: "sec_featured",
    type: "featured",
    title: "Spotlight",
    isVisible: true,
    order: 1,
  },
  {
    id: "sec_custom_inquiry",
    type: "custom_inquiry_cta",
    title: "Custom Designs",
    isVisible: true,
    order: 2,
  },
  {
    id: "sec_grid",
    type: "grid",
    title: "Latest Drops",
    isVisible: true,
    order: 3,
  },
  {
    id: "sec_about",
    type: "about_teaser",
    title: "The Coalition",
    isVisible: true,
    order: 4,
    content: ABOUT_TEXT.substring(0, 200) + "...",
  },
];

export const COIN_REWARD_RATE = 1; // V2: 1 SGC per $1 spent (~4.5% rewards at $0.045/SGC)
export const SG_COIN_RATE = COIN_REWARD_RATE; // Legacy alias for ProductPage compatibility
export const V2_REWARD_RATE = 0.25; // Legacy reference, can be deprecated or used for calculations

// =====================================
// NO REFUNDS POLICY CONFIGURATION
// =====================================

export const SALES_FINAL_ENABLED = import.meta.env.VITE_SALES_FINAL === "true";

export const CONSENT_TEXT = "All sales are final. No returns, exchanges, or refunds will be accepted.";

export const CONSENT_CHECKBOX_TEXT =
  "I confirm I have read and agree that all sales are final and I will not request a refund or return.";

export const REFUND_POLICY_FULL_TEXT = `
All sales are final. We do not accept returns, exchanges, or refunds on any products purchased through this website.

By completing your purchase, you acknowledge and agree to this policy.

If you have questions about a product before purchasing, please contact us at sgctrustyourself@gmail.com.
`.trim();

// =====================================
// SGCOIN DISCOUNT CONFIGURATION
// =====================================

export const SGCOIN_DISCOUNT_ENABLED = import.meta.env.VITE_SGCOIN_DISCOUNT_ENABLED === "true";
export const SGCOIN_DISCOUNT_PERCENTAGE = parseFloat(import.meta.env.VITE_SGCOIN_DISCOUNT_PERCENTAGE || "10");

export const SGCOIN_PAYMENT_METHODS = ["sgcoin", "gmoney"] as const;
export type SGCoinPaymentMethod = (typeof SGCOIN_PAYMENT_METHODS)[number];

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

export const SGCOIN_V1_CONTRACT_ADDRESS = "0x951806a2581c22C478aC613a675e6c898E2aBe21";
export const SGCOIN_V2_CONTRACT_ADDRESS = "0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e"; // Official V2 Contract
export const SGCOIN_MIGRATOR_ADDRESS = "0xc6c1EB54E5Ed966C0B48154d6e22eaA8a4c4C536"; // SafeMigration Contract (Flat 1M:1 Logic)
export const SGCOIN_BURN_ADDRESS = "0x20756b2667D575Ddde2383f3841D2CD855D5fb6d"; // Migration Burn Wallet
export const SGCOIN_LIQUIDITY_PROVIDER = "0xd4d7691f062614ae6905d7bef62638b42c33df9f"; // SGCoin V2 Source Wallet

// Strategic Liquidity Tracking
export const QUICKSWAP_LP_ADDRESS = "0x43a974142b297D2f09a39ACd838a66452789ba32"; // SGC/WPOL Pair (V2)
export const QUICKSWAP_V3_LP_ADDRESS = "0x95194a754b6f768ed08ef5d695dabee349b7bf72"; // SGC/WPOL Pair (V3)
export const WPOL_ADDRESS = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"; // Wrapped POL
export const TREASURY_WALLET_ADDRESS = "0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4"; // SGC Treasury / Founder Wallet
export const FOUNDER_WALLET_ADDRESS = "0x0F4A0466C2a1d3FA6Ed55a20994617F0533fbf74"; // Founder / Direct Send Wallet
export const LIQUIDITY_TARGET_POL = 500;
export const FALLBACK_LIQUIDITY_POL = 27.6; // Last known good value

export const QUICKSWAP_SWAP_URL = `https://dapp.quickswap.exchange/swap/best/ETH/${SGCOIN_V2_CONTRACT_ADDRESS}?chainId=137`;
export const POLYGON_RPC_URLS = [
  "https://polygon-bor.publicnode.com",
  "https://polygon-rpc.com",
  "https://rpc-mainnet.maticvigil.com",
];
export const POLYGON_RPC_URL = POLYGON_RPC_URLS[0];
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_CURRENCY_SYMBOL = "MATIC";
export const POLYGON_BLOCK_EXPLORER = "https://polygonscan.com";

// Tutorial Progress
export const TUTORIAL_STORAGE_KEY = "sgcoin_tutorial_progress";
export const TUTORIAL_STEPS = 6;

// Tutorial Step Names
export const TUTORIAL_STEP_NAMES = [
  "Welcome",
  "Install MetaMask",
  "Switch to Polygon",
  "Fund Wallet",
  "Swap on QuickSwap",
  "Use SGCoin",
];

export const MINI_WIZARDS_CONTRACT_ADDRESS = "0x653b07c58669bc335fc9cfe2f9afa68f7fe94fc2";

// =====================================
// ADMIN CONFIGURATION
// =====================================
// =====================================
// ADMIN CONFIGURATION
// =====================================
export const ADMIN_WALLETS = [
  "0x0f4a0466c2a1d3fa6ed55a20994617f0533fbf74", // Founder
  "0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4", // Founder Secondary / Treasury
];

export const INITIAL_ORDERS: Order[] = [
  {
    // ── Layer 2 dedup contract ──────────────────────────────────────
    // This id is mirrored byte-for-byte in
    //   utils/liveOrdersFeed.ts > PUBLIC_RECENT_ORDER_SEEDS
    // When a Layer 1 order (Supabase or this fallback) with the same id
    // survives the live-orders window filter, it REPLACES the seed —
    // the seed is dropped, not appended, so the sale is never counted
    // twice. Do NOT change this id without updating the seed too.
    // ────────────────────────────────────────────────────────────────
    id: "public-md-wholesale-wallets-2026_05_22",
    orderNumber: "ORD-SG-WHOLESALE-1002",
    isGuest: true,
    customerName: "Wholesale Customer",
    customerEmail: "wholesale@example.com",
    instagramUsername: "friiqy",
    // Privacy contract: INITIAL_ORDERS carries state + city only.
    // The full street address lives in the gitignored
    // shipping_internal.json (keys are INITIAL_ORDERS id values).
    shippingAddress: {
      address1: "",
      city: "Abingdon",
      state: "MD",
      zip: "",
      country: "US",
    },
    // 7-wallet bundle split into 7 OrderItem rows (one per wallet) at
    // $25 each = $175 total. The ticker links to /product/GreenCamoWallet
    // (first wallet in catalog order); the other 6 surface via
    // "+ 6 more items" copy on the live-orders map.
    items: [
      {
        productId: "GreenCamoWallet",
        productName: "Coalition Green Camo Wallet",
        productImage: "https://i.imgur.com/kzIWQzA.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 25,
        total: 25,
      },
      {
        productId: "SKYYBLUEWALLET1_2",
        productName: "COALITION SKYY BLUE WALLET 1/2",
        productImage: "https://i.imgur.com/rJSCmHu.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 25,
        total: 25,
      },
      {
        productId: "prod_wallet_004",
        productName: "COALITION SKYY BLUE WALLET 2/2",
        productImage: "https://i.imgur.com/rJSCmHu.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 25,
        total: 25,
      },
      {
        productId: "Coalition_Racing_Team_Wallet_1_4",
        productName: "Coalition 'Racing Team' Wallet 1/4",
        productImage: "https://i.imgur.com/3UUmYQa.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 25,
        total: 25,
      },
      {
        productId: "Coalition_Racing_Team_Wallet_2_4",
        productName: "Coalition 'Racing Team' Wallet 2/4",
        productImage: "https://i.imgur.com/IRhVbhN.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 25,
        total: 25,
      },
      {
        productId: "Coalition_Racing_Team_Wallet_3_4",
        productName: "Coalition 'Racing Team' Wallet 3/4",
        productImage: "https://i.imgur.com/dcw5qLQ.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 25,
        total: 25,
      },
      {
        productId: "Coalition_Racing_Team_Wallet_4_4",
        productName: "Coalition 'Racing Team' Wallet 4/4",
        productImage: "https://i.imgur.com/EylCpDU.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 25,
        total: 25,
      },
    ],
    subtotal: 175,
    tax: 0,
    discount: 0,
    total: 175,
    paymentMethod: "cash",
    paymentStatus: "paid" as OrderStatus,
    orderType: "manual",
    createdAt: "2026-05-22T22:48:11-04:00",
    paidAt: "2026-05-22T22:48:11-04:00",
  },
  {
    // Coalition 'Grey Wave' Wallet 2/2 — sold in York, PA.
    // id mirrored in PUBLIC_RECENT_ORDER_SEEDS (dedup contract).
    id: "public-pa-grey-wave-wallet-2-2",
    orderNumber: "ORD-SG-GREYWAVE-22",
    isGuest: true,
    customerName: "Calieb Customer",
    customerEmail: "calieb@example.com",
    shippingAddress: { address1: "", city: "York", state: "PA", zip: "", country: "US" },
    items: [
      {
        productId: "Coalition_Grey_Wave_Wallet_2_2",
        productName: "Coalition 'Grey Wave' Wallet 2/2",
        productImage: "https://i.imgur.com/FVMHZoq.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 75,
        total: 75,
      },
    ],
    subtotal: 75,
    tax: 0,
    discount: 0,
    total: 75,
    paymentMethod: "cash",
    paymentStatus: "paid" as OrderStatus,
    orderType: "manual",
    createdAt: "2026-06-25T02:40:12.191+00:00",
    paidAt: "2026-06-25T02:40:12.191+00:00",
  },
  {
    // Coalition 'Grey Wave' Wallet 1/2 — sold in York, PA (same day as 2/2).
    // id mirrored in PUBLIC_RECENT_ORDER_SEEDS (dedup contract).
    id: "public-pa-grey-wave-wallet-1-2",
    orderNumber: "ORD-SG-GREYWAVE-12",
    isGuest: true,
    customerName: "Starrboii Customer",
    customerEmail: "starrboii@example.com",
    shippingAddress: { address1: "", city: "York", state: "PA", zip: "", country: "US" },
    items: [
      {
        productId: "Coalition_Grey_Wave_Wallet_1_2",
        productName: "Coalition 'Grey Wave' Wallet 1/2",
        productImage: "https://i.imgur.com/7z2h8u6.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 75,
        total: 75,
      },
    ],
    subtotal: 75,
    tax: 0,
    discount: 0,
    total: 75,
    paymentMethod: "cash",
    paymentStatus: "paid" as OrderStatus,
    orderType: "manual",
    createdAt: "2026-06-25T02:40:12.191+00:00",
    paidAt: "2026-06-25T02:40:12.191+00:00",
  },
  {
    // TRUST YOURSELF CUSTOM TRUCKER (1/1) — sold in Owings Mills, MD.
    // id mirrored in PUBLIC_RECENT_ORDER_SEEDS (dedup contract).
    id: "public-md-trust-yourself-hat-01",
    orderNumber: "ORD-SG-HAT-01",
    isGuest: true,
    customerName: "Wahab Customer",
    customerEmail: "wahab@example.com",
    shippingAddress: { address1: "", city: "Owings Mills", state: "MD", zip: "", country: "US" },
    items: [
      {
        productId: "prod_trust_yourself_hat_01",
        productName: "Trust Yourself Custom Trucker (1/1)",
        productImage: "https://i.imgur.com/iYBlwm8.png",
        selectedSize: "One Size",
        quantity: 1,
        price: 50,
        total: 50,
      },
    ],
    subtotal: 50,
    tax: 0,
    discount: 0,
    total: 50,
    paymentMethod: "cash",
    paymentStatus: "paid" as OrderStatus,
    orderType: "manual",
    createdAt: "2025-01-01T00:00:00+00:00",
    paidAt: "2025-01-01T00:00:00+00:00",
  },
  {
    // Coalition Denim Patchwork 1/1 Jeans S1 — sold via @friiqy
    // relationship in November 2024 in Abingdon, MD.
    // id mirrored in PUBLIC_RECENT_ORDER_SEEDS (dedup contract).
    id: "public-md-denim-patchwork-2024_11_08",
    orderNumber: "ORD-SG-DENIM-S1",
    isGuest: true,
    customerName: "Wholesale Customer",
    customerEmail: "wholesale@example.com",
    instagramUsername: "friiqy",
    shippingAddress: { address1: "", city: "Abingdon", state: "MD", zip: "", country: "US" },
    items: [
      {
        productId: "Coalition_Denim_Patchwork_S1",
        productName: "Coalition Denim Patchwork 1/1 Jeans S1",
        productImage: "https://i.imgur.com/2VU7MEr.jpg",
        selectedSize: "30",
        quantity: 1,
        price: 140,
        total: 140,
      },
    ],
    subtotal: 140,
    tax: 0,
    discount: 0,
    total: 140,
    paymentMethod: "cash",
    paymentStatus: "paid" as OrderStatus,
    orderType: "manual",
    createdAt: "2024-11-08T00:00:00Z",
    paidAt: "2024-11-08T00:00:00Z",
  },
  {
    // Coalition Denim Patchwork 1/1 Jeans X Meks — sold via @friiqy
    // in May 2026 in Abingdon, MD (same day as wholesale bundle).
    id: "public-md-denim-patchwork-x-meks-2026_05_22",
    orderNumber: "ORD-SG-DENIM-XMEKS",
    isGuest: true,
    customerName: "Wholesale Customer",
    customerEmail: "wholesale@example.com",
    instagramUsername: "friiqy",
    shippingAddress: { address1: "", city: "Abingdon", state: "MD", zip: "", country: "US" },
    items: [
      {
        productId: "Coalition_Denim_Patchwork_X_Meks",
        productName: "1/1 Coalition Denim Patchwork Jeans X Meks",
        productImage: "https://i.imgur.com/tgAIclv.jpg",
        selectedSize: "One Size",
        quantity: 1,
        price: 140,
        total: 140,
      },
    ],
    subtotal: 140,
    tax: 0,
    discount: 0,
    total: 140,
    paymentMethod: "cash",
    paymentStatus: "paid" as OrderStatus,
    orderType: "manual",
    createdAt: "2026-05-22T22:48:11-04:00",
    paidAt: "2026-05-22T22:48:11-04:00",
  },
  {
    // Coalition x True Religion 1/1 Jeans S1 — sold in New York, NY.
    // id mirrored in PUBLIC_RECENT_ORDER_SEEDS (dedup contract).
    id: "public-ny-true-religion-s1",
    orderNumber: "ORD-SG-TR-S1",
    isGuest: true,
    customerName: "eBay Buyer (coha-5629)",
    customerEmail: "ebay@example.com",
    shippingAddress: { address1: "", city: "Gasport", state: "NY", zip: "14067", country: "US" },
    items: [
      {
        productId: "Coalition_x_True_Religion_S1",
        productName: "Coalition x True Religion 1/1 Jeans S1",
        productImage: "https://i.imgur.com/2VU7MEr.jpg",
        selectedSize: "33",
        quantity: 1,
        price: 227.99,
        total: 227.99,
      },
    ],
    subtotal: 227.99,
    tax: 0,
    discount: 0,
    total: 227.99,
    paymentMethod: "cash",
    paymentStatus: "paid" as OrderStatus,
    orderType: "manual",
    createdAt: "2026-03-06T00:00:00+00:00",
    paidAt: "2026-03-06T00:00:00+00:00",
  },
];

export const ADMIN_USER: {
  uid: string;
  displayName: string;
  email: string;
  walletAddress: string | null;
  sgCoinBalance: number;
  isAdmin: boolean;
  favorites: string[];
} = {
  uid: "admin",
  displayName: "Admin",
  email: "admin@sgcoalition.xyz",
  walletAddress: null,
  sgCoinBalance: 0,
  isAdmin: true,
  favorites: [],
};
