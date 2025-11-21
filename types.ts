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
  sgCoinBalance: number;
  isAdmin: boolean;
  favorites: string[]; // Product IDs
}

export interface Section {
  id: string;
  type: 'hero' | 'featured' | 'grid' | 'about_teaser';
  title: string;
  isVisible: boolean;
  order: number;
  content?: string;
}

export enum AuthProvider {
  GOOGLE = 'GOOGLE',
  METAMASK = 'METAMASK'
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
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'stripe' | 'cash' | 'venmo' | 'zelle' | 'other';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  orderType: 'online' | 'manual';
  status: OrderStatus;
  stripeSessionId?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  notes?: string;
  shippingAddress?: ShippingAddress;
}