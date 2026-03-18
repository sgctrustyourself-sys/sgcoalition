import { Product, Section, Order, OrderStatus } from './types';

export const INITIAL_ORDERS: Order[] = [
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
    id: 'prod_001',
    name: 'Coalition Classic Tee',
    price: 45,
    images: ['/images/tee-front.png', '/images/tee-back.png'],
    description: 'The staple piece. Heavyweight cotton, boxy fit. Crafted in Baltimore, Maryland. Each tee includes dual NFC tags for digital verification.',
    category: 'apparel',
    isFeatured: true,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    sizeInventory: {
      'S': 15,
      'M': 25,
      'L': 30,
      'XL': 20,
      'XXL': 10
    },
    nft: {
      contractAddress: '0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201',
      tokenId: '6915469788939700255662107688630493008422408564534094781606241966635645665283',
      chain: 'polygon',
      openseaUrl: 'https://opensea.io/assets/polygon/0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201/6915469788939700255662107688630493008422408564534094781606241966635645665283',
      nfcTags: {
        neck: 'https://linktr.ee/sgcoalition',
        tag: 'https://opensea.io/assets/polygon/0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201/6915469788939700255662107688630493008422408564534094781606241966635645665283'
      }
    }
  },
  {
    id: 'prod_nft_001',
    name: 'Coalition NF-Tee',
    price: 65,
    images: ['/images/coalition-nf-tee-front.png', '/images/coalition-nf-tee-back.png'],
    description: 'The future of streetwear. This limited edition phygital tee serves as your access pass to the Coalition ecosystem. Features exclusive "Trust Yourself" puff print and embedded NFC technology linked to its digital twin on the Polygon blockchain.',
    category: 'apparel',
    isFeatured: true,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    sizeInventory: {
      'S': 50,
      'M': 100,
      'L': 100,
      'XL': 75,
      'XXL': 25
    },
    nft: {
      contractAddress: '0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201',
      tokenId: '6915469788939700255662107688630493008422408564534094781606241966635645665283',
      chain: 'polygon',
      openseaUrl: 'https://opensea.io/item/polygon/0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201/6915469788939700255662107688630493008422408564534094781606241966635645665283',
      nfcTags: {
        neck: 'https://linktr.ee/sgcoalition',
        tag: 'https://coalition.brand/verify/prod_nft_001'
      }
    }
  },
  {
    id: 'prod_002',
    name: 'Baltimore Hoodie',
    price: 85,
    images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
    description: 'Ultra-soft french terry. Perfect for city nights.',
    category: 'apparel',
    isFeatured: false,
    sizes: ['M', 'L', 'XL'],
    sizeInventory: {
      'M': 15,
      'L': 20,
      'XL': 15
    }
  },
  {
    id: 'prod_003',
    name: 'Logo Cap',
    price: 30,
    images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
    description: '6-panel structured cap with embroidered Coalition logo.',
    category: 'accessory',
    isFeatured: false,
    sizes: ['One Size'],
    sizeInventory: {
      'One Size': 200
    }
  },
  {
    id: 'prod_wallet_001',
    name: 'Custom Coalition x Chrome Hearts Wallet',
    description: 'Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet. This unique piece features premium leather construction with signature Chrome Hearts detailing and Coalition branding. A rare collector\'s item that combines luxury craftsmanship with streetwear culture. One of a kind - once it\'s gone, it\'s gone forever.',
    price: 45.00,
    images: [
      'https://i.imgur.com/SS6KbOQ.jpeg',
      'https://i.imgur.com/NUXZizv.jpeg'
    ],
    category: 'accessory',
    isFeatured: true,
    sizes: ['One Size'],
    sizeInventory: {
      'One Size': 0
    },
    archived: true,
    archivedAt: new Date().toISOString(),
    soldAt: new Date().toISOString()
  },
  {
    id: 'prod_dist_tee',
    name: 'COALITION 1/1 DISTORTION TEE',
    price: 65,
    images: ['https://i.imgur.com/e7UfX6s.png'],
    description: 'Exclusive 1/1 Distortion Tee featuring custom graphics and premium fabrics.',
    category: 'shirt',
    isFeatured: true,
    sizes: ['L'],
    sizeInventory: { 'L': 1 },
    archived: false,
    archivedAt: null,
    soldAt: null
  },
  {
    id: 'prod_true_relig',
    name: 'COALITION X TRUE RELIGION 1/1 JEANS S1',
    price: 240,
    images: ['https://i.imgur.com/R38pS9T.png'],
    description: 'Exclusive custom Coalition x True Religion collaboration jeans. Featuring custom patches and distressing.',
    category: 'jeans',
    isFeatured: true,
    sizes: ['33'],
    sizeInventory: { '33': 0 },
    archived: true,
    archivedAt: new Date().toISOString(),
    soldAt: new Date().toISOString()
  },
  {
    id: 'prod_shark_tee',
    name: '“TRUST YOURSELF” SHARK TEE – 1/1 EXCLUSIVE',
    price: 65,
    images: [
      'https://i.imgur.com/cYmL6GQ.jpeg',
      'https://i.imgur.com/evsuOt6.jpeg',
      'https://i.imgur.com/IVmfRGx.jpeg',
      'https://i.imgur.com/gaA93ug.jpeg'
    ],
    description: 'Unique SGCoalition tie-dye "Trust Yourself" tee with a striking blue spiral pattern and the iconic crowned-bird graphic. This one-of-a-kind piece features premium print details and the ferocious "Shark" design, delivering a motivational streetwear vibe. Size Small, in excellent condition with no flaws—ideal for collectors or anyone looking to add a standout Coalition piece to their wardrobe.',
    category: 'shirt',
    isFeatured: true,
    sizes: ['S'],
    sizeInventory: { 'S': 1 },
    archived: false,
    archivedAt: null,
    soldAt: null
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