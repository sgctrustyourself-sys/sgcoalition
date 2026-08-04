import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Product, CartItem, UserProfile, Section, AuthProvider, Order, OrderStatus, OrderItem, Giveaway, GiveawayEntry, GiveawayStatus, Review, SocialAccount, CustomInquiry, SGCoinPurchaseRequest } from '../types';
import { INITIAL_SECTIONS, COIN_REWARD_RATE, ADMIN_WALLETS } from '../constants';
import { supabase } from '../services/supabase';
// signOut is now owned by useAuth hook.
import { useToast } from './ToastContext';
import { useGiveaways } from './useGiveaways';
import { useSignals } from './useSignals';
import { useCart } from './useCart';
import { useCatalog } from './useCatalog';
import { useOrders } from './useOrders';
import { useAuth } from './useAuth';
import { useWallets, applyWalletMintsUpdate, applyProductionStateUpdate, type ProductionState } from './useWallets';
// getStoredReferralCode, trackSignupReferral are now owned by useAuth hook.

interface AppState {
    products: Product[];
    cart: CartItem[];
    user: UserProfile | null;
    sections: Section[];
    orders: Order[];
    isCartOpen: boolean;
    isAdminMode: boolean;
    isSupabaseConfigured: boolean;
    isConfigError: boolean;
    isLoading: boolean;
    addProduct: (p: Product) => Promise<void>;
    updateProduct: (p: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    addToCart: (p: Product, size: string, options?: { keychainClipOn?: boolean }) => void;
    removeFromCart: (cartId: string) => void;
    clearCart: () => void;
    toggleFavorite: (pid: string) => void;
    login: (provider: AuthProvider, userId?: string) => Promise<void>;
    loginUser: (provider: AuthProvider, userId?: string) => Promise<void>;
    logout: () => void;
    updateUser: (data: Partial<UserProfile>) => void;
    setCartOpen: (open: boolean) => void;
    loginAdmin: (emailOrPassword: string, password?: string) => Promise<boolean>;
    logoutAdmin: () => void;
    updateSections: (sections: Section[]) => void;
    updateSection: (id: string, data: Partial<Section>) => void;
    cartTotal: () => number;
    calculateReward: (total: number) => number;
    addOrder: (order: Order, verification?: { paypalOrderId?: string; paypalCaptureId?: string }) => Promise<void>;
    updateOrderStatus: (orderId: string, newStatus: string) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    getOrderById: (orderId: string) => Order | undefined;
    deductInventory: (items: OrderItem[]) => Promise<void>;
    generateOrderNumber: () => string;
    giveaways: Giveaway[];
    addGiveaway: (g: Giveaway) => Promise<void>;
    updateGiveaway: (g: Giveaway) => Promise<void>;
    deleteGiveaway: (id: string) => Promise<void>;
    addGiveawayEntry: (entry: GiveawayEntry) => Promise<void>;
    pickGiveawayWinner: (giveawayId: string, count: number) => Promise<void>;
    connectMetaMaskWallet: (address?: string) => Promise<void>;
    connectManualWallet: (address?: string) => Promise<void>;
    disconnectWallet: () => Promise<void>;
    chainId: number | null;
    switchToPolygon: () => Promise<boolean>;
    // Server-aggregated 7-day wallet-mint count. Subscribed via Supabase
    // realtime on `wallet_mints_7d` (single-row scalar view). null = loading
    // (initial paint before first GET). Replaces the previous client-side
    // aggregation in pages/Home.tsx and pages/Wallets.tsx.
    walletMints7d: number | null;
    // Live shop-floor production state (workshop name, ISO 8601 last-drop
    // timestamp, current on-deck SKU + cylinder progress). Subscribed via
    // Supabase realtime on `production_state` (singleton table). null =
    // loading on first paint. Drives the two-paced proof-texture lines on
    // Home + Wallets (replaces the previous wallet_mints_7d counter).
    productionState: ProductionState | null;
    addReview: (productId: string, review: Review) => Promise<void>;
    linkSocialAccount: (platform: SocialAccount['platform'], username: string) => Promise<void>;
    submitCustomInquiry: (data: Omit<CustomInquiry, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
    submitPurchaseRequest: (data: Omit<SGCoinPurchaseRequest, 'id' | 'createdAt' | 'status'>) => Promise<void>;
    unlinkSocialAccount: (platform: SocialAccount['platform']) => Promise<{ success: boolean; error?: string }>;
    refreshBalances: () => Promise<void>;
    signals: Signal[];
    fetchSignals: () => Promise<Signal[]>;
}

// Signal type is now exported from context/useSignals.ts
import type { Signal } from './useSignals';
export type { Signal };

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};

import { safeJsonParse } from '../utils/storage';

// applyWalletMintsUpdate, applyProductionStateUpdate, and ProductionState
// are now owned by context/useWallets.ts (re-exported below for test compatibility).

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    const [sections, setSections] = useState<Section[]>(() => safeJsonParse('coalition_sections', INITIAL_SECTIONS));
    // walletMints7d, productionState are now owned by useWallets hook.
    const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
    const [isConfigError, setIsConfigError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    // Helper: get admin token for server-side API calls that bypass RLS
    const getAdminToken = () => {
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage.getItem('coalition_admin_token');
        }
        return null;
    };

    // ---- Domain hooks (composed into the single provider below) ----
    const authHook = useAuth(isSupabaseConfigured, addToast);
    const walletsHook = useWallets(isSupabaseConfigured);
    const giveawaysHook = useGiveaways(isSupabaseConfigured, authHook.user);
    const signalsHook = useSignals(isSupabaseConfigured);
    const cartHook = useCart();
    const catalogHook = useCatalog(isSupabaseConfigured, getAdminToken, addToast, setIsConfigError);
    const ordersHook = useOrders(isSupabaseConfigured, authHook.isAdminMode, addToast);

    // chainId tracking and switchToPolygon are now owned by useAuth hook.

    // syncCryptoBalances, refreshBalances, and the 60s balance-refresh interval
    // are now owned by useAuth hook.

    // Initial App Setup
    useEffect(() => {
        let mounted = true;
        // Signals, Products, and Auth realtime now owned by useSignals / useCatalog / useAuth hooks.

        const initApp = async () => {
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
                const hasKeys = supabaseUrl && supabaseAnonKey &&
                    supabaseUrl !== 'VITE_SUPABASE_URL' &&
                    !supabaseUrl.includes('placeholder');

                if (mounted) setIsSupabaseConfigured(!!hasKeys);

                if (!hasKeys) {
                    console.log('⚠️ Supabase keys not found, using initial products');
                    // catalogHook.fetchProducts() handles the no-keys fallback internally (INITIAL_PRODUCTS).
                    catalogHook.fetchProducts();
                    if (mounted) setIsLoading(false);
                    return;
                }

                // --- CLEANUP LEGACY STORAGE ---
                // Remove potential ghost products that cause duplicates on live site
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('coalition_products_local');
                    localStorage.removeItem('coalition_products');
                }

                // Await initial data fetch before hiding loader to prevent race conditions
                console.log('🔄 Fetching initial data from Supabase...');
                await Promise.all([
                    catalogHook.fetchProducts(),
                    ordersHook.fetchOrders(),
                    signalsHook.fetchSignals(),
                    giveawaysHook.fetchGiveaways(),
                    walletsHook.fetchWalletMints7d(),
                    walletsHook.fetchProductionState()
                ]);

                // Signals, Giveaways, Products, and Auth realtime channels are now owned by
                // useSignals / useGiveaways / useCatalog / useAuth domain hooks respectively.


            } catch (err) { console.error("Critical error in AppContext initialization:", err); }
            finally { if (mounted) setIsLoading(false); }
        };
        initApp();
        return () => {
            mounted = false;
            // Signals + Products unsubscription now owned by useSignals / useCatalog hooks.
        };
    }, []);

    // fetchProducts, fetchOrders, mapAndSetOrders, and their realtime channels
    // fetchProducts, fetchOrders, fetchWalletMints7d, fetchProductionState,
    // and their realtime channels are now owned by useCatalog / useOrders / useWallets hooks.

    // Refresh products + orders when admin mode is toggled. The skip ref
    // prevents the first run of this effect (which fires on initial
    // mount) from duplicating the work initApp just did. After that,
    // every admin toggle causes a fresh fetch.
    const skipInitialAdminRefresh = useRef(true);
    useEffect(() => {
        // Consume the skip flag on the very first run regardless of
        // isSupabaseConfigured — otherwise if Supabase hasn't flipped yet
        // we return at the guard below and the next admin toggle silently
        // skips the fetch.
        if (skipInitialAdminRefresh.current) {
            skipInitialAdminRefresh.current = false;
            return;
        }
        if (!isSupabaseConfigured) return;
        catalogHook.fetchProducts();
        ordersHook.fetchOrders();
    }, [authHook.isAdminMode]);

    useEffect(() => { if (sections && sections.length > 0) localStorage.setItem('coalition_sections', JSON.stringify(sections)); }, [sections]);
    // Giveaway localStorage + subscriber effects are now owned by useGiveaways hook.

    // Helper: get admin token for server-side API calls that bypass RLS
    // addProduct, updateProduct, deleteProduct are now owned by useCatalog hook.

    // addToCart, removeFromCart, clearCart, cartTotal, setCartOpen
    // toggleFavorite, login, logout, updateUser, loginAdmin, logoutAdmin,
    // connectMetaMaskWallet, connectManualWallet, disconnectWallet,
    // linkSocialAccount, unlinkSocialAccount, submitCustomInquiry,
    // submitPurchaseRequest are now owned by useAuth hook.
    const updateSections = (s: Section[]) => setSections(s);
    const updateSection = (id: string, data: Partial<Section>) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    };

    // cartTotal is now owned by useCart hook.
    const calculateReward = (total: number) => Math.floor(total * COIN_REWARD_RATE);

    // addOrder, updateOrderStatus, deleteOrder, getOrderById, generateOrderNumber
    // are now owned by useOrders hook.

    // Giveaway CRUD, wallet connections, social linking are now owned by useGiveaways / useAuth hooks.

    return (
        <AppContext.Provider value={{
            products: catalogHook.products, cart: cartHook.cart, user: authHook.user, sections, orders: ordersHook.orders, isCartOpen: cartHook.isCartOpen, isAdminMode: authHook.isAdminMode, isSupabaseConfigured,
            isConfigError, isLoading, addProduct: catalogHook.addProduct, updateProduct: catalogHook.updateProduct, deleteProduct: catalogHook.deleteProduct, addToCart: cartHook.addToCart,
            removeFromCart: cartHook.removeFromCart, clearCart: cartHook.clearCart, toggleFavorite: authHook.toggleFavorite, login: authHook.login, loginUser: authHook.loginUser, logout: authHook.logout, updateUser: authHook.updateUser,
            setCartOpen: cartHook.setCartOpen, loginAdmin: authHook.loginAdmin, logoutAdmin: authHook.logoutAdmin, updateSections, updateSection, cartTotal: cartHook.cartTotal,
            calculateReward, addOrder: ordersHook.addOrder, updateOrderStatus: ordersHook.updateOrderStatus, deleteOrder: ordersHook.deleteOrder, getOrderById: ordersHook.getOrderById, deductInventory: catalogHook.deductInventory,
            generateOrderNumber: ordersHook.generateOrderNumber, giveaways: giveawaysHook.giveaways, addGiveaway: giveawaysHook.addGiveaway, updateGiveaway: giveawaysHook.updateGiveaway, deleteGiveaway: giveawaysHook.deleteGiveaway,
            addGiveawayEntry: giveawaysHook.addGiveawayEntry, pickGiveawayWinner: giveawaysHook.pickGiveawayWinner, connectMetaMaskWallet: authHook.connectMetaMaskWallet, connectManualWallet: authHook.connectManualWallet,
            disconnectWallet: authHook.disconnectWallet, chainId: authHook.chainId, switchToPolygon: authHook.switchToPolygon,
        walletMints7d: walletsHook.walletMints7d,
        productionState: walletsHook.productionState,
        addReview: catalogHook.addReview,
            linkSocialAccount: authHook.linkSocialAccount, unlinkSocialAccount: authHook.unlinkSocialAccount, submitCustomInquiry: authHook.submitCustomInquiry, submitPurchaseRequest: authHook.submitPurchaseRequest,
            refreshBalances: authHook.refreshBalances, signals: signalsHook.signals, fetchSignals: signalsHook.fetchSignals
        }}>
            {children}
        </AppContext.Provider>
    );
};
