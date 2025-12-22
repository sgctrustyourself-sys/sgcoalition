import { Product, Section } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    "id": "prod_wallet_skyy",
    "name": "Coalition Skyy Blue Wallet",
    "price": 45,
    "images": [
      "https://i.imgur.com/v5y7tPa.jpg",
      "https://i.imgur.com/B72Iael.jpg"
    ],
    "description": "Premium custom Coalition wallet in a stunning Skyy Blue finish. Hand-crafted with high-quality materials and signature branding. A perfect blend of style and utility.",
    "category": "accessory",
    "isFeatured": true,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_003",
    "name": "Custom Coalition x Chrome Hearts Wallet",
    "price": 45,
    "images": [
      "https://i.imgur.com/SS6KbOQ.jpeg",
      "https://i.imgur.com/NUXZizv.jpeg"
    ],
    "description": "Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet. This unique piece features premium leather construction with signature Chrome Hearts detailing and Coalition branding. A rare collector's item that combines luxury craftsmanship with streetwear culture. One of a kind - once it's gone, it's gone forever.",
    "category": "accessory",
    "isFeatured": false,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 0
    },
    "nft": null,
    "archived": true,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_002",
    "name": "Custom Wallet (1/1)",
    "price": 35,
    "images": [
      "https://i.imgur.com/aphcZ2t.jpg",
      "https://i.imgur.com/e7M0POe.jpg"
    ],
    "description": "Exclusive 1/1 custom wallet featuring camo green aesthetic and signature Coalition branding. Hand-crafted and unique.",
    "category": "accessory",
    "isFeatured": false,
    "sizes": [
      "One Size"
    ],
    "sizeInventory": {
      "One Size": 1
    },
    "nft": null,
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  },
  {
    "id": "prod_nft_001",
    "name": "Coalition NF-Tee",
    "price": 50,
    "images": [
      "/images/coalition-nf-tee-front.png",
      "/images/coalition-nf-tee-back.png",
      "/images/coalition-nf-tee-lifestyle.jpg"
    ],
    "description": "The future of streetwear. This limited edition phygital tee serves as your access pass to the Coalition ecosystem. Features exclusive \"Trust Yourself\" puff print and embedded NFC technology linked to its digital twin on the Polygon blockchain.",
    "category": "apparel",
    "isFeatured": true,
    "sizes": [
      "S",
      "M",
      "L",
      "XL",
      "XXL"
    ],
    "sizeInventory": {
      "L": 5,
      "M": 3,
      "S": 5,
      "XL": 5,
      "XXL": 5
    },
    "nft": {
      "chain": "polygon",
      "nfcTags": {
        "tag": "https://coalition.brand/verify/prod_nft_001",
        "neck": "https://linktr.ee/sgcoalition"
      },
      "tokenId": "1",
      "openseaUrl": "https://opensea.io/item/polygon/0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201/6915469788939700255662107688630493008422408564534094781606241966635645665283",
      "contractAddress": "0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201"
    },
    "archived": false,
    "archivedAt": null,
    "releasedAt": null,
    "soldAt": null
  }
];

export const ABOUT_TEXT = `Coalition is more than a brand; it is a movement born on the streets of Baltimore. We believe in the power of unity and the strength of the collective. Every stitch represents our commitment to quality, community, and the hustle that defines our city. Join the Coalition.`;

export const INITIAL_SECTIONS: Section[] = [
  {
    id: 'sec_hero',
    type: 'hero',
    title: 'Crafted in Baltimore',
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

export const COIN_REWARD_RATE = 1500; // 30,000 coins per $20 = 1500 per $1

// ============================================
// NO REFUNDS POLICY CONFIGURATION
// ============================================

export const SALES_FINAL_ENABLED = import.meta.env.VITE_SALES_FINAL === 'true';

export const CONSENT_TEXT = "All sales are final. No returns, exchanges, or refunds will be accepted.";

export const CONSENT_CHECKBOX_TEXT = "I confirm I have read and agree that all sales are final and I will not request a refund or return.";

export const REFUND_POLICY_FULL_TEXT = `
All sales are final. We do not accept returns, exchanges, or refunds on any products purchased through this website.

By completing your purchase, you acknowledge and agree to this policy.

If you have questions about a product before purchasing, please contact us at support@sgcoalition.xyz.
`.trim();

// ============================================
// SGCOIN DISCOUNT CONFIGURATION
// ============================================

export const SGCOIN_DISCOUNT_ENABLED = import.meta.env.VITE_SGCOIN_DISCOUNT_ENABLED === 'true';
export const SGCOIN_DISCOUNT_PERCENTAGE = parseFloat(import.meta.env.VITE_SGCOIN_DISCOUNT_PERCENTAGE || '10');

export const SGCOIN_PAYMENT_METHODS = ['sgcoin', 'gmoney'] as const;
export type SGCoinPaymentMethod = typeof SGCOIN_PAYMENT_METHODS[number];

// ============================================
// TUTORIAL CONFIGURATION
// ============================================

export const SGCOIN_CONTRACT_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
export const QUICKSWAP_SWAP_URL = 'https://dapp.quickswap.exchange/swap/best/ETH/0x951806a2581c22C478aC613a675e6c898E2aBe21?chainId=137';
export const POLYGON_RPC_URL = 'https://polygon-rpc.com';
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