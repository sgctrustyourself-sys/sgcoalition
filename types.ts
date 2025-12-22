export interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  description: string;
  category: 'apparel' | 'accessory';
  isFeatured?: boolean;
  sizes?: string[];
  sizeInventory?: Record<string, number>; // Size-based inventory: { 'S': 10, 'M': 25, 'L': 30 }
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
  // Urgency & Scarcity Fields
  isLimitedEdition?: boolean; // Limited edition badge
  saleEndDate?: string; // ISO timestamp for flash sales
  updatedAt?: string;   // ISO timestamp for dominance tracking
}

export interface CartItem extends Product {
  cartId: string;
  selectedSize: string;
  quantity: number;
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
  type: 'hero' | 'featured' | 'custom_inquiry_cta' | 'grid' | 'about_teaser';
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
  orderType: 'online' | 'manual';
  shippingAddress?: {
    address1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  notes?: string;
  createdAt: string;
  paidAt?: string;
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
  source: 'manual' | 'purchase' | 'form' | 'social';
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

export interface WishlistSettings {
  isPublic: boolean;
  name: string;
  description?: string;
  shareId: string;
  shareCount: number;
  createdAt: number;
  updatedAt: number;
}
declare module 'ethers';
