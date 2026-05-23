import { Product, Section, Order, OrderStatus } from './types';

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'order_wholesale_wallets_2026_05_22',
    orderNumber: 'ORD-SG-WHOLESALE-1002',
    isGuest: true,
    customerName: 'Wholesale Customer',
    customerEmail: 'wholesale@example.com',
    items: [
      {
        productId: 'prod_wallet_skyy_2',
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
    paymentStatus: OrderStatus.PAID,
    orderType: 'manual',
    createdAt: '2026-05-22T18:33:38-04:00',
    paidAt: '2026-05-22T18:33:38-04:00'
  },
  {
    id: 'order_jeans_001',
    orderNumber: 'ORD-SG-1001',
    isGuest: true,
    customerName: 'Loyal Customer',
    customerEmail: 'customer@example.com',
    items: [
      {
        productId: 'prod_true_relig',
        productName: 'COALITION X TRUE RELIGION 1/1 JEANS S1',
        productImage: 'https://i.imgur.com/R38pS9T.png',
        selectedSize: '33',
        quantity: 1,
        price: 240,
        total: 240
      }
    ],
    subtotal: 240,
    tax: 0,
    discount: 0,
    total: 240,
    paymentMethod: 'credit_card',
    paymentStatus: OrderStatus.PAID,
    orderType: 'online',
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString()
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    "id": "prod_wallet_skyy_1",
    "name": "COALITION SKYY BLUE WALLET 1/2",
    "price": 35,
    "images": ["https://i.imgur.com/v5y7tPa.jpg"],
    "description": "Premium custom Coalition wallet in a stunning Skyy Blue finish. Piece 1 of 2.",
    "category": "wallet",
    "sizes": ["One Size"],
    "sizeInventory": { "One Size": 0 },
    "archived": true,
    "archivedAt": "2026-05-22T18:33:38-04:00",
    "soldAt": "2026-05-22T18:33:38-04:00"
  },
  {
    "id": "prod_wallet_skyy_2",
    "name": "COALITION SKYY BLUE WALLET 2/2",
    "price": 35,
    "images": ["https://i.imgur.com/v5y7tPa.jpg"],
    "description": "Premium custom Coalition wallet in a stunning Skyy Blue finish. Piece 2 of 2.",
    "category": "wallet",
    "sizes": ["One Size"],
    "sizeInventory": { "One Size": 0 },
    "archived": true,
    "archivedAt": "2026-05-22T18:33:38-04:00",
    "soldAt": "2026-05-22T18:33:38-04:00"
  },
  {
    "id": "prod_dist_tee",
    "name": "COALITION DISTORTION TEE",
    "price": 65,
    "images": ["https://i.imgur.com/pZ8v3tS.jpeg"],
    "description": "Exclusive distortion print tee. Only 1 left!",
    "category": "shirt",
    "sizes": ["L"],
    "sizeInventory": { "L": 1 },
    "isFeatured": true,
    "archived": false
  },
  {
    "id": "prod_wallet_002",
    "name": "COALITION GREEN CAMO WALLET",
    "price": 35,
    "images": ["https://i.imgur.com/aphcZ2t.jpg"],
    "description": "Exclusive 1/1 custom wallet featuring camo green aesthetic. Only 1 left!",
    "category": "wallet",
    "sizes": ["One Size"],
    "sizeInventory": { "One Size": 0 },
    "archived": true,
    "archivedAt": "2026-05-22T18:33:38-04:00",
    "soldAt": "2026-05-22T18:33:38-04:00"
  },
  {
    "id": "prod_nft_001",
    "name": "COALITION NF-TEE",
    "price": 50,
    "images": ["/images/coalition-nf-tee-front.png"],
    "description": "The future of streetwear. Limited edition phygital tee.",
    "category": "apparel",
    "sizes": ["S", "M", "L", "XL", "XXL"],
    "sizeInventory": { "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0 },
    "nft": {
      "chain": "polygon",
      "nfcTags": { "tag": "https://coalition.brand/verify/prod_nft_001" },
      "tokenId": "1",
      "openseaUrl": "https://opensea.io/...",
      "contractAddress": "0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201"
    },
    "archived": false
  },
  {
    "id": "prod_wallet_001",
    "name": "CUSTOM COALITION X CHROME HEARTS WALLET",
    "price": 450,
    "images": ["https://i.imgur.com/SS6KbOQ.jpeg"],
    "description": "Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet.",
    "category": "wallet",
    "sizes": ["One Size"],
    "sizeInventory": { "One Size": 0 },
    "archived": true,
    "archivedAt": "2026-05-22T18:33:38-04:00",
    "soldAt": "2026-05-22T18:33:38-04:00"
  },
  {
    "id": "prod_trucker",
    "name": "TRUST YOURSELF CUSTOM TRUCKER (1/1)",
    "price": 85,
    "images": ["https://i.imgur.com/B72Iael.jpg"],
    "description": "1/1 Custom Trucker Hat with signature branding.",
    "category": "headwear",
    "sizes": ["One Size"],
    "sizeInventory": { "One Size": 0 },
    "archived": false
  },
  {
    "id": "prod_jeans",
    "name": "Coalition x True Religion 1/1 Jeans S1",
    "price": 240,
    "images": ["https://i.imgur.com/NUXZizv.jpeg"],
    "description": "Rare 1/1 custom Coalition x True Religion jeans.",
    "category": "jeans",
    "sizes": ["32"],
    "sizeInventory": { "32": 0 },
    "archived": false
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