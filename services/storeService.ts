import { Product, PageSection, UserProfile, CartItem, UserType } from '../types';
import { INITIAL_PRODUCTS, INITIAL_SECTIONS, ADMIN_USER } from '../constants';

const STORAGE_KEYS = {
  PRODUCTS: 'coalition_products',
  SECTIONS: 'coalition_sections',
  USER: 'coalition_user',
  CART: 'coalition_cart',
  FAVORITES: 'coalition_favorites' // Stored separately for simplicity in this demo
};

// Helpers to simulate DB delays
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const StoreService = {
  // --- Products ---
  getProducts: async (): Promise<Product[]> => {
    const stored = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (stored) return JSON.parse(stored);
    // Seed initial
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  },

  saveProducts: async (products: Product[]) => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  // --- Sections (CMS) ---
  getSections: async (): Promise<PageSection[]> => {
    const stored = localStorage.getItem(STORAGE_KEYS.SECTIONS);
    let sections = stored ? JSON.parse(stored) : INITIAL_SECTIONS;
    return sections.sort((a: PageSection, b: PageSection) => a.order - b.order);
  },

  saveSections: async (sections: PageSection[]) => {
    localStorage.setItem(STORAGE_KEYS.SECTIONS, JSON.stringify(sections));
  },

  // --- User / Auth (Mock) ---
  loginMock: async (method: 'google' | 'metamask', identifier: string): Promise<UserProfile> => {
    await delay(800); // Simulate network
    
    // If identifying as admin for demo purposes
    if (identifier === 'admin') {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(ADMIN_USER));
      return ADMIN_USER;
    }

    // Basic User Construction
    const storedUserStr = localStorage.getItem(STORAGE_KEYS.USER);
    let user: UserProfile = storedUserStr ? JSON.parse(storedUserStr) : null;

    if (!user || (method === 'google' && user.email !== identifier) || (method === 'metamask' && user.walletAddress !== identifier)) {
        // Create new session user if mismatch or doesn't exist
        user = {
            id: `user_${Math.random().toString(36).substring(7)}`,
            role: UserType.USER,
            sgCoinBalance: 0,
            favorites: [],
            email: method === 'google' ? identifier : undefined,
            walletAddress: method === 'metamask' ? identifier : undefined
        };
    }
    
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },

  logout: async () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  getCurrentUser: (): UserProfile | null => {
    const u = localStorage.getItem(STORAGE_KEYS.USER);
    return u ? JSON.parse(u) : null;
  },

  updateUser: (user: UserProfile) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
};