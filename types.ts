// Per-product image-role mapping. Stored as URL strings (not indices) so
// admin reorders / deletes don't silently corrupt the assignment. Older
// products without an imageRoles field fall through to position-based
// defaults (images[0] = primary, images[1] = hover, rest = gallery) via
// utils/productImage.getProductRoles.
export interface ImageRoles {
  /** URL of the cover image shown on cards and as the PDP hero. */
  primaryUrl?: string;
  /** URL of the alt-view shown on ProductCard hover. Explicit `null` = no hover. */
  hoverUrl?: string | null;
  /** PDP thumbnail URLs. Optional; derived from images[2..n] when omitted. */
  galleryUrls?: string[];
  /**
   * Per-product image-role "named slots" for products whose slot taxonomy
   * doesn't fit the default primary/hover/gallery shape (e.g. the Halo
   * Mini Dress has modelFaceFront / modelFront / modelAngledFront /
   * modelSide / modelBackAngled / modelBack).
   *
   * Map: slot identifier → public URL. Synced positionally with the
   * product's `images[]` array — slot `i` corresponds to `images[i]` —
   * so the admin upload-replace flow in components/admin/ProductManager.tsx
   * writes to a deterministic index in both arrays at once.
   * forwarded by reconcileImageRoles (utils/productImage.ts).
   */
  namedSlots?: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  // Explicit image-role mapping. See ImageRoles above.
  imageRoles?: ImageRoles;
  description: string;
  makingVideoUrl?: string;
  createdAt?: string; // ISO timestamp for when the product was added
  category: 'apparel' | 'accessory' | 'shirt' | 'shorts' | 'sweatshirt' | 'wallet' | 'jeans' | 'hat' | 'dress';
  isFeatured?: boolean;
  // Free shipping when this product is in the cart AND a distinct other
  // product is also in the cart. Used for the Coalition 'Overwhelmingly
  // Patient' Hoodie (pre-order release) — shipping is paid for the hoodie
  // alone, $0 once a second line item is added.
  freeShippingWhenPaired?: boolean;
  freeShipping?: boolean;
  sizes?: string[];
  sizeInventory?: Record<string, number>; // Size-based inventory: { 'S': 10, 'M': 25, 'L': 30 }
  reviews?: Review[];
  nft?: {
    contractAddress: string;
    tokenId: string;
    chain: 'polygon' | 'ethereum';
    openseaUrl: string;
    nfcTags?: {
      neck?: string; // Linktree URL
      tag?: string;  // NFT claim/OpenSea URL
    };
  };
  // Archive System Fields
  archived?: boolean;
  archivedAt?: string; // ISO timestamp
  releasedAt?: string; // ISO timestamp
  soldAt?: string;     // ISO timestamp
  archiveNote?: string; // Context shown when a sold/archive piece has a story behind it
  founderNote?: string; // Personal note from the founder shown below the buy button on the PDP
  // Urgency & Scarcity Fields
  // Numbered Edition Tie-down Pricing & Mint Tracker
  // When editionSize is set, the first editionSize units ship as a numbered
  // edition (1/editionSize, 2/editionSize, ...). pricingTiers describes the
  // step-up: each tier says "until this sold-count, use this price". A tier
  // with untilCount=null is the catch-all (every unit beyond the previous tier
  // uses its price).
  pricingTiers?: PricingTier[];
  editionSize?: number | null;
  // Live count of PAID units (across sizes), used by ProductCard / PDP to
  // render "X/44 minted at $75".
  editionSoldCount?: number | null;

  isLimitedEdition?: boolean; // Limited edition badge
  stock?: number; // Current available stock as mirrored from the products DB row (set by AppContext.fetchProducts from public.products.stock)
  saleEndDate?: string; // ISO timestamp for flash sales
  // Per-product shipping-fulfillment override. When set, takes precedence
  // over the generic PDP "Fulfillment" stat (which otherwise falls through
  // to free-shipping / $200 / "Ships in 1-2 business days" copy). Used by
  // the Overwhelmingly Patient Hoodie pre-order, whose real ship window
  // ("Ships in 1-2 weeks") is tighter than the storefront default. Keep the
  // string in the same brand voice as the other shipping copy lines.
  shippingFulfillment?: string;
}

export interface CartItem extends Product {
  cartId: string;
  selectedSize: string;
  quantity: number;
  keychainClipOn?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  walletAddress: string | null;
  connectedWalletAddress?: string; // Permanently linked wallet address
  walletConnectionMethod?: 'metamask' | 'manual'; // How wallet was connected
  walletConnectedAt?: number; // Timestamp of connection
  sgCoinBalance: number;
  v2Balance?: number; // V2 SGCoin balance (new token)
  totalMigrated?: number; // Total amount migrated from V1 to V2
  isAdmin: boolean;
  favorites: string[]; // Product IDs
  addresses?: Address[];
  defaultAddressId?: string;
  wishlistSettings?: WishlistSettings; // Wishlist sharing configuration
  // Membership / Subscription
  isVIP?: boolean;
  storeCredit?: number; // Accumulated store credit from subscription
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due';
  socialAccounts?: SocialAccount[];
}

export interface Address {
  id: string;
  label: string; // "Home", "Work", etc.
  fullName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface Section {
  id: string;
  type: 'hero' | 'featured' | 'custom_inquiry_cta' | 'grid' | 'about_teaser' | 'vip';
  title: string;
  isVisible: boolean;
  order: number;
  content?: string;
}

export enum AuthProvider {
  GOOGLE = 'GOOGLE',
  METAMASK = 'METAMASK',
  DISCORD = 'DISCORD'
}

export interface SGCoinData {
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
}

export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  timestamp: number;
  hash: string;
}


export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  selectedSize: string;
  quantity: number;
  price: number;
  total: number;
  basePrice?: number;
  addOnPrice?: number;
  keychainClipOn?: boolean;
  addOnLabel?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // Human-readable order number (e.g., "ORD-001")
  userId?: string; // Optional now for guest orders
  isGuest: boolean; // New: indicates if this is a guest order
  guestEmail?: string; // New: email for guest orders
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: OrderStatus;
  paymentReference?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  orderType: 'online' | 'manual';
  shippingAddress?: {
    address1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    shippingMethod?: string;
    shippingCost?: number;
  };
  notes?: string;
  createdAt: string;
  paidAt?: string;
  sgCoinReward?: number;
}

export enum GiveawayStatus {
  ACTIVE = 'active',
  UPCOMING = 'upcoming',
  ENDED = 'ended'
}

export interface GiveawayEntry {
  id: string;
  giveawayId: string;
  userId?: string;
  name: string;
  email: string;
  entryCount: number;
  timestamp: number;
  source: 'manual' | 'purchase' | 'form' | 'social' | 'subscriber';
}

export interface Giveaway {
  id: string;
  title: string;
  prize: string;
  prizeImage?: string;
  description: string;
  startDate: string;
  endDate: string;
  status: GiveawayStatus;
  requirements: string[]; // e.g., "Follow on Twitter", "Join Discord"
  maxEntriesPerUser: number;
  entries: GiveawayEntry[];
  winners?: GiveawayEntry[];
  createdAt: number;
}

export interface InstagramGiveawayEntry {
  id: string;
  giveawayId: string;
  name: string;
  email: string;
  instagramUsername: string;
  screenshotFollowUrl: string;
  screenshotLikeUrl: string;
  screenshotStoryUrl: string;
  verified: boolean;
  createdAt: number;
  ipAddress?: string;
}

export interface YoutubeGiveawayEntry {
  id: string;
  giveawayId: string;
  name: string;
  email: string;
  instagramUsername?: string;
  youtubeHandle: string;
  shirtSize: string;
  screenshotSubUrl: string;
  screenshotCommentUrl: string;
  screenshotStoryUrl?: string;
  screenshotBonusUrls?: string[];
  claimedPoints: number;
  verified: boolean;
  emailSent?: boolean;
  createdAt: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: number;
  verified: boolean; // Admin approved
  purchaseVerified?: boolean; // User has matching order
  // Enhanced features
  photos?: string[]; // Base64 encoded images or URLs
  helpfulCount?: number; // Number of helpful votes
  helpfulVotes?: string[]; // User IDs who voted helpful
  sgCoinRewarded?: boolean; // Prevent duplicate rewards
  brandResponse?: {
    message: string;
    respondedAt: number;
    respondedBy: string;
  };
}

// Type alias for storeService compatibility
export type PageSection = Section;

export enum UserType {
  USER = 'user',
  ADMIN = 'admin'
}

export interface WishlistSettings {
  isPublic: boolean;
  name: string;
  description?: string;
  shareId: string;
  shareCount: number;
  createdAt: number;
  updatedAt: number;
}

// ==========================================
// SUPABASE INTEGRATION TYPES
// ==========================================

export interface SocialAccount {
  id: string;
  userId: string;
  platform: 'instagram' | 'twitter' | 'tiktok';
  username: string;
  verified: boolean;
  linkedAt: string;
  rewardSent: boolean;
  rewardSentAt?: string;
  notes?: string;
}

export interface CustomInquiry {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  productType: 'apparel-pants' | 'apparel-shirt' | '3d-printed' | 'other';
  title: string;
  description: string;
  referenceImages: string[];
  budgetRange: 'under-100' | '100-250' | '250-500' | '500+' | 'flexible';
  timeline: 'no-rush' | '1-2-weeks' | '2-4-weeks' | 'asap';
  status: 'new' | 'reviewing' | 'quoted' | 'accepted' | 'declined' | 'completed';
  adminNotes?: string;
  quoteAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SGCoinPurchaseRequest {
  id: string;
  userId?: string;
  email: string;
  walletAddress: string;
  amount: number;
  paymentMethod: string;
  proofUrl?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  processedAt?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string; // Markdown or HTML
  excerpt?: string;
  author: string;
  authorId?: string;
  category: 'update' | 'community' | 'announcement' | 'drop' | 'idea';
  coverImage?: string;
  tags?: string[];
  isPublished: boolean;
  upvotePower: number; // Sum of SGCoin weight
  downvotePower: number; // Sum of SGCoin weight
  score: number; // upvotePower - downvotePower
  publishedAt?: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface BlogComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

// ==========================================
// NUMBERED-EDITION (TIER-PRICING + 1/N MARKER)
// Mirrors supabase/migrations/20261101_add_tier_pricing_and_numbered_pieces.sql.
// Server-side tier price re-verified at order-paid time using
// public.get_product_paid_count(product_id). Pieces auto-bind to orders on
// a lowest-available-first policy; refunds do NOT release a piece.
// ==========================================

// One row of products.pricing_tiers JSONB. untilCount null means
// "open-ended remainder" (the catch-all price). Stored as dollars.
export interface PricingTier {
  untilCount: number | null;
  price: number;
}

// One row of public.numbered_pieces. pieceIndex is 1..editionSize of the
// parent product; orderId is bound by the server on order-paid
// (lowest-available-first) and stays bound on refund. nftTokenId / nfcTagUrl
// are operator-edited via the admin OrderDetails panel.
export interface NumberedPiece {
  id: string;
  productId: string;
  pieceIndex: number;
  orderId: string | null;
  nftTokenId: string | null;
  nfcTagUrl: string | null;
  assignedAt: string | null;
  createdAt: string;
}

// Resolves the active tier price for a product given how many units have
// already sold (across PAID orders). Walks pricingTiers in JSONB-saved order.
export function getActiveTierPrice(product: Product, currentSold: number): number {
  if (!product.pricingTiers || product.pricingTiers.length === 0) {
    return product.price;
  }
  for (const tier of product.pricingTiers) {
    if (tier.untilCount === null || currentSold < tier.untilCount) {
      return tier.price;
    }
  }
  // Past every defined + open-ended tier shouldn't happen if the last tier
  // uses untilCount=null, but be safe against bad operator input.
  const last = product.pricingTiers[product.pricingTiers.length - 1];
  return last.price;
}

// True iff this product opts into the numbered-edition UI (X/N badge, tier
// pricing). editionSize must be a positive int AND pricingTiers must have
// at least one row.
export function isNumberedEdition(product: Product): boolean {
  return !!product.editionSize && (product.pricingTiers?.length ?? 0) > 0;
}
