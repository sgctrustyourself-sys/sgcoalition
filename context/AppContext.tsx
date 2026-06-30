import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Product, CartItem, UserProfile, Section, AuthProvider, Order, OrderStatus, OrderItem, Giveaway, GiveawayEntry, GiveawayStatus, Review, SocialAccount, CustomInquiry, SGCoinPurchaseRequest, ImageRoles } from '../types';
import { INITIAL_SECTIONS, COIN_REWARD_RATE, INITIAL_PRODUCTS, ADMIN_WALLETS, INITIAL_ORDERS, PRODUCT_LOCAL_OVERRIDES } from '../constants';
import { supabase } from '../services/supabase';
import { signOut } from '../services/auth';
import { useToast } from './ToastContext';
import { ensureSubscriberGiveawayEntries, pickWeightedGiveawayWinners } from '../utils/giveawayUtils';
import { resolveLocalImageUrls } from '../utils/localImageAssets';
import { normalizeProductSizeData } from '../utils/productSizes';
import { getCartItemLineTotal, WALLET_KEYCHAIN_CLIP_LABEL, WALLET_KEYCHAIN_CLIP_PRICE } from '../utils/walletAddOns';
import { fetchPaidCountsByProduct } from '../services/numberedPieces';

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
    addReview: (productId: string, review: Review) => Promise<void>;
    linkSocialAccount: (platform: SocialAccount['platform'], username: string) => Promise<void>;
    submitCustomInquiry: (data: Omit<CustomInquiry, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
    submitPurchaseRequest: (data: Omit<SGCoinPurchaseRequest, 'id' | 'createdAt' | 'status'>) => Promise<void>;
    unlinkSocialAccount: (platform: SocialAccount['platform']) => Promise<{ success: boolean; error?: string }>;
    refreshBalances: () => Promise<void>;
    signals: Signal[];
    fetchSignals: () => Promise<Signal[]>;
}

export interface Signal {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'alert' | 'success' | 'process' | 'urgent';
    is_active: boolean;
    action_url?: string;
    action_label?: string;
    created_at: string;
    metadata?: any;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};

const safeJsonParse = (key: string, defaultValue: any) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.warn(`Failed to parse ${key} from localStorage:`, e);
        return defaultValue;
    }
};

const loadWalletActions = () => import('../services/walletActions');
const loadWalletBalances = () => import('../services/walletBalances');

const applyLocalProductOverrides = (items: Product[]) =>
    items.map(product => ({
        ...product,
        ...(PRODUCT_LOCAL_OVERRIDES[product.id] || {}),
    }));

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    const [products, setProducts] = useState<Product[]>(() => applyLocalProductOverrides(INITIAL_PRODUCTS));
    const [sections, setSections] = useState<Section[]>(() => safeJsonParse('coalition_sections', INITIAL_SECTIONS));
    const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
    const [isCartOpen, setCartOpen] = useState(false);
    const [isAdminMode, setIsAdminMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('coalition_admin_mode') === 'true';
        }
        return false;
    });

    const updateAdminMode = (val: boolean) => {
        setIsAdminMode(val);
        if (typeof window !== 'undefined') {
            if (val) sessionStorage.setItem('coalition_admin_mode', 'true');
            else sessionStorage.removeItem('coalition_admin_mode');
        }
    };
    const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
    const [isConfigError, setIsConfigError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [signals, setSignals] = useState<Signal[]>([]);
    const [chainId, setChainId] = useState<number | null>(null);

    // Realtime self-write guard. Supabase RT echoes our own INSERT/UPDATE/DELETE
    // back to every client (including ours); the optimistic setProducts(...) we
    // did BEFORE awaiting the DB write has the new state, so a re-fetch at
    // that moment can race the SELECT cache replication and briefly blank the
    // row. We track the product ids we just touched locally and skip
    // fetchProducts for any realtime event whose affected id intersects this
    // set within the TTL window. Other users / other tabs land normally.
    //
    // Tradeoff: if a SECOND admin edits the same product id within 3s of our
    // own write, our client silently drops their event. Acceptable for a
    // low-collision admin panel; the client falls back to the next
    // SELECT cycle or the next user-initiated refresh.
    const ignoredProductIds = useRef<Set<string>>(new Set());
    const SELF_WRITE_TTL_MS = 3000;
    const flagSelfWrite = (id: string) => {
        const set = ignoredProductIds.current;
        set.add(id);
        window.setTimeout(() => {
            set.delete(id);
        }, SELF_WRITE_TTL_MS);
    };
    const shouldIgnoreRealtimeEvent = (recordId: string | null | undefined): boolean => {
        if (!recordId) return false;
        return ignoredProductIds.current.has(recordId);
    };
    const getExclusiveFeaturedProducts = (featuredProductId: string, baseProducts: Product[]) =>
        baseProducts.map(product => ({
            ...product,
            isFeatured: product.id === featuredProductId,
        }));

    const clearOtherFeaturedProductsInDb = async (featuredProductId: string) => {
        if (!isSupabaseConfigured) return;

        const { error } = await supabase
            .from('products')
            .update({ is_featured: false })
            .eq('is_featured', true)
            .neq('id', featuredProductId);

        if (error) throw error;
    };

    // Track network changes
    useEffect(() => {
        if (typeof window !== 'undefined' && window.ethereum) {
            const handleChainChanged = (hexChainId: string) => setChainId(parseInt(hexChainId, 16));
            window.ethereum.request({ method: 'eth_chainId' }).then((hexId: string) => setChainId(parseInt(hexId, 16))).catch(() => { });
            window.ethereum.on('chainChanged', handleChainChanged);
            return () => { window.ethereum.removeListener('chainChanged', handleChainChanged); };
        }
    }, []);

    const handleSwitchToPolygon = async () => {
        try {
            const { switchToPolygon: switchFn } = await loadWalletActions();
            const success = await switchFn();
            if (success && typeof window !== 'undefined' && window.ethereum) {
                const hexId = await window.ethereum.request({ method: 'eth_chainId' });
                setChainId(parseInt(hexId, 16));
            }
            return success;
        } catch (e) {
            console.error('Switch to Polygon failed:', e);
            return false;
        }
    };

    const syncCryptoBalances = async (walletAddress: string) => {
        try {
            console.log('🔗 Syncing crypto balances in background...');
            const { fetchWalletBalanceSnapshot } = await loadWalletBalances();
            const snapshot = await fetchWalletBalanceSnapshot(walletAddress);

            setUser(prev => prev ? {
                ...prev,
                sgCoinBalance: prev.sgCoinBalance || snapshot.sgCoinBalance,
                v2Balance: snapshot.v2Balance,
                totalMigrated: snapshot.totalMigrated
            } : null);
            console.log('✅ Crypto balances synced');
        } catch (err) { console.warn('Background balance sync failed:', err); }
    };

    const refreshBalances = async () => {
        if (user?.walletAddress) await syncCryptoBalances(user.walletAddress);
    };

    useEffect(() => {
        if (!user || (!user.walletAddress && !user.connectedWalletAddress)) return;
        const interval = setInterval(refreshBalances, 60000);
        return () => clearInterval(interval);
    }, [user?.walletAddress, user?.connectedWalletAddress]);

    // Initial App Setup
    useEffect(() => {
        let mounted = true;
        let signalsSubscription: { unsubscribe: () => void } | null = null;
        let productSync: { unsubscribe: () => void } | null = null;
        let authSubscription: { unsubscribe: () => void } | null = null;

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
                    setProducts(applyLocalProductOverrides(INITIAL_PRODUCTS));
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
                    fetchProducts(true),
                    fetchOrders(),
                    fetchSignals(),
                    fetchGiveaways()
                ]);

                // Subscribe to Realtime Signals
                signalsSubscription = supabase
                    .channel('coalition-signals-channel')
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'coalition_signals' },
                        () => {
                            console.log('🔔 Signal change detected, refreshing...');
                            fetchSignals();
                        }
                    )
                    .subscribe();

                // Subscribe to Realtime Giveaways
                supabase
                    .channel('coalition-giveaways-channel')
                    .on(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'giveaways' },
                        () => {
                            console.log('🎁 Giveaway change detected, refreshing...');
                            fetchGiveaways();
                        }
                    )
                    .subscribe();

                // IMPORTANT: onAuthStateChange callback must NOT be async to avoid infinite loops.
                // Async work is moved into a separate fire-and-forget function.
                const handleAuthChange = async (event: string, session: any) => {
                    if (!mounted) return;
                    console.log('🔔 Auth Event:', event);

                    if (session?.user) {
                        try {
                            const userId = session.user.id;
                            const savedFavorites = safeJsonParse(`coalition_favorites_${userId}`, []);

                            // Initialize with defaults to show UI immediately
                            if (mounted) {
                                setUser(prev => ({
                                    uid: userId,
                                    displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                                    email: session.user.email || null,
                                    walletAddress: prev?.walletAddress || null,
                                    connectedWalletAddress: prev?.connectedWalletAddress || undefined,
                                    sgCoinBalance: prev?.sgCoinBalance || 0,
                                    favorites: savedFavorites,
                                    isAdmin: prev?.isAdmin || false,
                                    socialAccounts: prev?.socialAccounts || []
                                } as any));
                            }

                            // Parallel fetch for database-only items (fast)
                            const [linkedWalletRes, profileRes, adminRes, socialsRes] = await Promise.all([
                                supabase.from('wallet_accounts').select('wallet_address').eq('user_id', userId).maybeSingle(),
                                supabase.from('profiles').select('is_vip, store_credit, sg_coin_balance').eq('id', userId).maybeSingle(),
                                supabase.from('admin_users').select('role').eq('user_id', userId).maybeSingle(),
                                supabase.from('social_accounts').select('*').eq('user_id', userId)
                            ]);

                            const walletAddress = linkedWalletRes.data?.wallet_address || null;
                            const profile = profileRes.data;
                            let isAdmin = !!adminRes.data;

                            // Support secondary admin checks (wallet based)
                            const activeWallet = walletAddress || (typeof window !== 'undefined' && window.ethereum?.selectedAddress);
                            if (!isAdmin && activeWallet && ADMIN_WALLETS.some(w => w.toLowerCase() === activeWallet.toLowerCase())) {
                                isAdmin = true;
                            }

                            if (mounted) {
                                setUser({
                                    uid: userId,
                                    displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                                    email: session.user.email || null,
                                    walletAddress,
                                    connectedWalletAddress: walletAddress || undefined,
                                    walletConnectionMethod: walletAddress ? 'metamask' : undefined,
                                    walletConnectedAt: walletAddress ? Date.now() : undefined,
                                    sgCoinBalance: profile?.sg_coin_balance || 0,
                                    isAdmin,
                                    isVIP: profile?.is_vip || false,
                                    storeCredit: profile?.store_credit || 0,
                                    favorites: savedFavorites,
                                    socialAccounts: socialsRes.data || []
                                });

                                if (isAdmin) updateAdminMode(true);

                                // Background Sync for heavy crypto data (non-blocking)
                                if (walletAddress) {
                                    syncCryptoBalances(walletAddress);
                                }
                            }
                        } catch (err) { console.error('Error in auth session handling:', err); }
                    } else {
                        const metamaskAddress = typeof window !== 'undefined' && window.ethereum?.selectedAddress;
                        if (metamaskAddress) {
                            const { formatAddress: formatEthAddress } = await loadWalletActions();
                            const isAdmin = ADMIN_WALLETS.some(w => w.toLowerCase() === metamaskAddress.toLowerCase());
                            if (mounted) {
                                setUser({
                                    uid: 'user_eth_' + metamaskAddress,
                                    displayName: formatEthAddress(metamaskAddress),
                                    email: null, walletAddress: metamaskAddress, connectedWalletAddress: metamaskAddress,
                                    isAdmin, sgCoinBalance: 0, favorites: [], isVIP: isAdmin
                                });
                                syncCryptoBalances(metamaskAddress);
                            }
                        } else if (mounted) setUser(null);
                    }
                };

                // Sync callback — fires async handler without awaiting (prevents infinite loop)
                const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
                    void handleAuthChange(event, session);
                });

                authSubscription = authListener.subscription;

                productSync = supabase
                    .channel('products_channel')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload: any) => {
                        const recordId: string | null | undefined = payload?.new?.id ?? payload?.old?.id;
                        if (shouldIgnoreRealtimeEvent(recordId)) {
                            // Skip: this is the realtime echo of our own just-touched id.
                            // See ignoredProductIds ref + flagSelfWrite on each write path.
                            return;
                        }
                        fetchProducts();
                    })
                    .subscribe();
            } catch (err) { console.error("Critical error in AppContext initialization:", err); }
            finally { if (mounted) setIsLoading(false); }
        };
        initApp();
        return () => {
            mounted = false;
            signalsSubscription?.unsubscribe();
            productSync?.unsubscribe();
            authSubscription?.unsubscribe();
        };
    }, []);

    const fetchProducts = async (supabaseConfigured = isSupabaseConfigured) => {
        if (!supabaseConfigured) {
            const localProducts = applyLocalProductOverrides(INITIAL_PRODUCTS);
            setProducts(localProducts);
            return localProducts;
        }
        try {
            const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) {
                const mapped = data.map(item => {
                    const savedReviews = safeJsonParse(`coalition_reviews_${item.id}`, []);
                    return {
                        id: item.id, name: item.name, price: Number(item.price), stock: item.stock, category: item.category,
                        createdAt: item.created_at || item.createdAt,
                        images: resolveLocalImageUrls(item.images || []), description: item.description,
                        makingVideoUrl: item.making_video_url || item.makingVideoUrl,
                        isFeatured: item.is_featured,
                        // Mirrors services/retryQueue.ts mapProductToDb write path.
                        // Column added in supabase/migrations/20260620_add_is_limited_edition_to_products.sql
                        isLimitedEdition: item.is_limited_edition ?? false,
                        // Image-role mapping (column added in supabase/migrations/20260630_add_image_roles_to_products.sql).
                        // Older rows won't have the column — Supabase returns null and
                        // getProductRoles falls back to the position-based default.
                        imageRoles: (item.image_roles as ImageRoles | null) ?? undefined,
                        // Numbered-edition tier-pricing fields (migration 20261101).
                        pricingTiers: item.pricing_tiers ?? null,
                        editionSize: item.edition_size ?? null,
                        editionSoldCount: null,
                        sizes: item.sizes || [], sizeInventory: item.size_inventory || {}, nft: item.nft_metadata,
                        reviews: savedReviews, archived: item.archived || false,
                        archivedAt: item.archived_at, releasedAt: item.released_at, soldAt: item.sold_at,
                        // archive_note column added in supabase/migrations/20260701_add_archive_note_to_products.sql.
                        // PRODUCT_LOCAL_OVERRIDES still wins when set, so legacy overrides
                        // (pre-migration constants.ts entries) keep rendering until the
                        // operator explicitly clears them from constants.ts.
                        archiveNote: item.archive_note ?? PRODUCT_LOCAL_OVERRIDES[item.id]?.archiveNote
                    };
                });
                // Deduplicate by ID only. The previous (name + images[1]) collision
                // check silently swallowed legitimate distinct products (e.g. the
                // Coalition Shark Tee), so the rule is now id-only: any row with
                // the same id as an already-kept row is dropped. Legitimate
                // duplicate-name duplicates (rare in practice) are now the
                // operator's responsibility via admin ProductManager, which lets
                // them rename / merge / archive the offending row directly.
                // First occurrence wins so realtime appends don't clobber edits.
                const uniqueProducts = mapped.reduce((acc: any[], current) => {
                    const x = acc.find(item => item.id === current.id);
                    if (!x) {
                        return acc.concat([current]);
                    } else {
                        if (typeof console !== 'undefined' && console.warn) {
                            console.warn('[products] dropping duplicate id row:', current.id, current.name);
                        }
                        return acc;
                    }
                }, []);

                // Supabase rows win for ids that exist in the DB, but some drops
                // still live only in constants.ts while the catalog is being
                // reconciled. Append those local-only rows so a successful
                // Supabase fetch does not accidentally hide live storefront items.
                const supabaseIds = new Set(uniqueProducts.map((product: Product) => product.id));
                const localOnlyProducts = INITIAL_PRODUCTS.filter(product => !supabaseIds.has(product.id));
                const mergedProducts = [...uniqueProducts, ...localOnlyProducts];

                // Apply PRODUCT_LOCAL_OVERRIDES last so pinned local fields, like
                // preview-only image arrays or archive notes, still win.
                const withOverrides = applyLocalProductOverrides(mergedProducts);

                // Numbered-edition enrichment: batch-fetch paid-quantity counts via
                // the get_product_paid_count RPC so PDP can render
                // "X/44 minted at $75" without re-querying on every render.
                // Best-effort: a single RPC failure degrades to 0 for that
                // product (other products still load).
                const numberedIds = withOverrides
                    .filter(p => p.editionSize && p.pricingTiers && p.pricingTiers.length > 0)
                    .map(p => p.id);
                const countsByProduct = numberedIds.length > 0
                    ? await fetchPaidCountsByProduct(numberedIds)
                    : {};
                const enrichedProducts = withOverrides.map(p => (
                    countsByProduct[p.id] !== undefined
                        ? { ...p, editionSoldCount: countsByProduct[p.id] }
                        : p
                ));

                setProducts(enrichedProducts);
                // Successful fetch — clear the offline-mode banner so synthesized
                // SignalAlert hides once Supabase recovers.
                setIsConfigError(false);
                return enrichedProducts;
            }
            return [];
        } catch (err) {
            console.error('Error fetching products:', err);
            // Flag the AppContext as in a config error so SignalAlert can
            // surface a "Supabase unreachable, showing local catalog"
            // banner instead of failing silently.
            setIsConfigError(true);
            // Fall back to local defaults so a transient Supabase failure never
            // strands the UI on an empty products array. Returning the stale
            // closure value kept `products` at [] forever, which made
            // ProductDetails bail to null on every product detail route.
            const fallback = applyLocalProductOverrides(INITIAL_PRODUCTS);
            setProducts(fallback);
            return fallback;
        }
    };

    const fetchSignals = async () => {
        if (!isSupabaseConfigured) return [];
        try {
            const { data, error } = await supabase
                .from('coalition_signals')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setSignals(data);
                return data;
            }
            return [];
        } catch (err) {
            console.error('Error fetching signals:', err);
            return [];
        }
    };

    const fetchGiveaways = async () => {
        try {
            const { data, error } = await supabase
                .from('giveaways')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                const mapped: Giveaway[] = data.map((row: any) => ({
                    id: row.id,
                    title: row.title,
                    prize: row.prize,
                    description: row.description || '',
                    prizeImage: row.prize_image || '',
                    startDate: row.start_date,
                    endDate: row.end_date,
                    status: row.status as GiveawayStatus,
                    requirements: row.requirements || [],
                    maxEntriesPerUser: row.max_entries_per_user || 1,
                    entries: [],
                    createdAt: new Date(row.created_at).getTime()
                }));
                setGiveaways(mapped);
                return mapped;
            }
            return [];
        } catch (err) {
            console.error('Error fetching giveaways:', err);
            return [];
        }
    };

    const fetchOrders = async () => {
        if (!isSupabaseConfigured) return INITIAL_ORDERS;

        // Always prioritize API bypass in admin mode to circumvent RLS entirely
        if (isAdminMode) {
            return await fetchOrdersViaApi();
        }

        try {
            console.log('🔄 Fetching orders from Supabase...');
            const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase orders fetch error:', error);
                throw error;
            }

            if (data) {
                return mapAndSetOrders(data);
            }
            return [];
        } catch (err) {
            console.error('Error fetching orders:', err);
            return orders;
        }
    };

    const fetchOrdersViaApi = async () => {
        try {
            console.log('🚀 Calling admin API bypass for orders...');
            const token = sessionStorage.getItem('coalition_admin_token');
            const response = await fetch('/api/complete-order', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`API bypass failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ API bypass fetched ${data?.length || 0} orders`);

            if (data && Array.isArray(data)) {
                return mapAndSetOrders(data);
            }
            return orders;
        } catch (err) {
            console.error('❌ API bypass error:', err);
            return orders;
        }
    };

    const mapAndSetOrders = (data: any[]) => {
        if (!data || !Array.isArray(data)) return orders;

        const mapped = data.map((o: any) => {
            const items = Array.isArray(o.items) ? o.items : Array.isArray(o.line_items) ? o.line_items : [];
            const normalizedItems = items.map((item: any, index: number) => {
                const quantity = Math.max(1, Number(item.quantity || item.qty || 1));
                const keychainClipOn = Boolean(item.keychainClipOn ?? item.keychain_clip_on);
                const basePrice = Number(item.basePrice || item.base_price || item.unit_price || item.price || 0);
                const addOnPrice = Number(item.addOnPrice || item.add_on_price || 0) || (keychainClipOn ? WALLET_KEYCHAIN_CLIP_PRICE : 0);
                const price = Number(item.price || item.unit_price || (basePrice + addOnPrice) || 0);
                const total = Number(item.total || item.line_total || price * quantity || 0);

                return {
                    productId: item.productId || item.product_id || item.id || `item_${index}`,
                    productName: item.productName || item.name || item.title || 'Product',
                    productImage: item.productImage || item.image || item.thumbnail || item.productImageUrl || '',
                    selectedSize: item.selectedSize || item.size || 'One Size',
                    quantity,
                    price,
                    total,
                    basePrice,
                    addOnPrice,
                    keychainClipOn,
                    addOnLabel: item.addOnLabel || item.add_on_label || (keychainClipOn ? WALLET_KEYCHAIN_CLIP_LABEL : undefined),
                    name: item.name || item.productName || 'Product',
                    image: item.image || item.productImage || item.thumbnail || '',
                    size: item.size || item.selectedSize || 'One Size'
                };
            });

            return {
                id: o.id || Math.random().toString(36).substr(2, 9),
                orderNumber: o.order_number || o.orderNumber || 'ORD-UNKNOWN',
                userId: o.user_id || o.userId || null,
                isGuest: o.is_guest ?? o.isGuest ?? true,
                customerName: o.customer_name || o.customerName || 'Anonymous',
                customerEmail: o.customer_email || o.customerEmail || '',
                customerPhone: o.customer_phone || o.customerPhone || '',
                items: normalizedItems,
                subtotal: Number(o.subtotal || o.sub_total || 0),
                tax: Number(o.tax || 0),
                discount: Number(o.discount || 0),
                total: Number(o.total || o.total_amount || 0),
                paymentMethod: o.payment_method || o.paymentMethod || 'unknown',
                paymentStatus: o.payment_status || o.paymentStatus || o.status || 'pending',
                orderType: o.order_type || o.orderType || 'online',
                shippingAddress: o.shipping_address || o.shipping_info || o.shippingInfo || o.shippingAddress || null,
                notes: o.notes || '',
                createdAt: o.created_at || o.createdAt || new Date().toISOString(),
                paidAt: o.paid_at || o.paidAt || null,
                sgCoinReward: Number(o.sg_coin_reward || o.sgCoinReward || 0)
            };
        });

        setOrders(mapped);
        return mapped;
    };

    // Realtime orders channel — set up once when Supabase is configured
    // and torn down when it isn't. initApp already covers the initial
    // fetchProducts/fetchOrders via Promise.all, so this hook only owns
    // the channel subscription.
    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const channel = supabase.channel('orders_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            console.log('🔂 Order change detected, refreshing...');
            fetchOrders();
        }).subscribe();
        return () => { channel.unsubscribe(); };
    }, [isSupabaseConfigured]);

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
        fetchProducts();
        fetchOrders();
    }, [isAdminMode]);

    useEffect(() => { if (sections && sections.length > 0) localStorage.setItem('coalition_sections', JSON.stringify(sections)); }, [sections]);
    useEffect(() => { if (giveaways) localStorage.setItem('coalition_giveaways_v1', JSON.stringify(giveaways)); }, [giveaways]);
    useEffect(() => {
        setGiveaways(prev => ensureSubscriberGiveawayEntries(prev, user));
    }, [user, giveaways]);

    const addProduct = async (p: Product) => {
        if (!isSupabaseConfigured) return;
        const originalProducts = products;
        const normalizedSizes = normalizeProductSizeData(p.sizes, p.sizeInventory);
        const normalizedProduct = {
            ...p,
            createdAt: p.createdAt || new Date().toISOString(),
            isFeatured: !!p.isFeatured,
            sizes: normalizedSizes.sizes,
            sizeInventory: normalizedSizes.sizeInventory,
        };
        const nextProducts = normalizedProduct.isFeatured
            ? getExclusiveFeaturedProducts(normalizedProduct.id, [...originalProducts, normalizedProduct])
            : [...originalProducts, normalizedProduct];

        setProducts(nextProducts);
        // Flag our own write so the realtime echo doesn't race the SELECT
        // cache replication and overwrite our optimistic state.
        flagSelfWrite(normalizedProduct.id);
        try {
            const { error } = await supabase.from('products').insert([{
                id: normalizedProduct.id, name: normalizedProduct.name, price: normalizedProduct.price, category: normalizedProduct.category, images: normalizedProduct.images,
                description: normalizedProduct.description, is_featured: normalizedProduct.isFeatured,
                is_limited_edition: normalizedProduct.isLimitedEdition ?? false,
                // Numbered-edition tier-pricing columns (migration 20261101).
                pricing_tiers: normalizedProduct.pricingTiers ?? null,
                edition_size: normalizedProduct.editionSize ?? null,
                sizes: normalizedProduct.sizes,
                size_inventory: normalizedProduct.sizeInventory, nft_metadata: normalizedProduct.nft,
                // Image-role mapping column (migration 20260630). Null is fine —
                // getProductRoles fallback handles missing roles. Skipped if the
                // column doesn't exist yet on the live schema (PGRST204 retry below).
                image_roles: normalizedProduct.imageRoles ?? null,
                // Archive note column (migration 20260701). Operator-authored copy shown
                // beneath the buy button on sold/archived PDPs.
                archive_note: normalizedProduct.archiveNote ?? null
            }]);
            if (error) throw error;
            if (normalizedProduct.isFeatured) {
                await clearOtherFeaturedProductsInDb(normalizedProduct.id);
            }
        } catch (err) {
            try {
                if (normalizedProduct.isFeatured) {
                    await supabase.from('products').delete().eq('id', normalizedProduct.id);
                }
            } catch (rollbackErr) {
                console.warn('Failed to rollback featured product insert:', rollbackErr);
            }
            setProducts(originalProducts);
            addToast('Failed to add product.', 'error');
        }
    };

    const updateProduct = async (updated: Product) => {
        if (!isSupabaseConfigured) return;
        const original = products.find(p => p.id === updated.id);
        const normalizedSizes = normalizeProductSizeData(updated.sizes, updated.sizeInventory);
        const normalizedUpdated = {
            ...updated,
            isFeatured: !!updated.isFeatured,
            sizes: normalizedSizes.sizes,
            sizeInventory: normalizedSizes.sizeInventory,
        };
        const nextProducts = normalizedUpdated.isFeatured
            ? getExclusiveFeaturedProducts(normalizedUpdated.id, products.map(p => p.id === normalizedUpdated.id ? normalizedUpdated : p))
            : products.map(p => p.id === normalizedUpdated.id ? normalizedUpdated : p);

        setProducts(nextProducts);
        flagSelfWrite(normalizedUpdated.id);
        try {
            const { error } = await supabase.from('products').update({
                name: normalizedUpdated.name, price: normalizedUpdated.price, category: normalizedUpdated.category, images: normalizedUpdated.images,
                description: normalizedUpdated.description,
                is_featured: normalizedUpdated.isFeatured,
                is_limited_edition: normalizedUpdated.isLimitedEdition ?? false,
                pricing_tiers: normalizedUpdated.pricingTiers ?? null,
                edition_size: normalizedUpdated.editionSize ?? null,
                sizes: normalizedUpdated.sizes,
                size_inventory: normalizedUpdated.sizeInventory, nft_metadata: normalizedUpdated.nft, archived: normalizedUpdated.archived,
                image_roles: normalizedUpdated.imageRoles ?? null,
                archive_note: updated.archiveNote ?? null
            }).eq('id', normalizedUpdated.id);
            if (error) throw error;
            if (normalizedUpdated.isFeatured) {
                await clearOtherFeaturedProductsInDb(normalizedUpdated.id);
            }
        } catch (err) {
            if (original) {
                try {                    await supabase.from('products').update({
                    name: original.name, price: original.price, category: original.category, images: original.images,
                    description: original.description,
                    is_featured: original.isFeatured,
                    is_limited_edition: original.isLimitedEdition ?? false,
                    pricing_tiers: original.pricingTiers ?? null,
                    edition_size: original.editionSize ?? null,
                    sizes: original.sizes,
                    size_inventory: original.sizeInventory, nft_metadata: original.nft, archived: original.archived,
                    image_roles: original.imageRoles ?? null,
                    archive_note: original.archiveNote ?? null
                }).eq('id', original.id);
                } catch (rollbackErr) {
                    console.warn('Failed to rollback featured product update:', rollbackErr);
                }
            }
            setProducts(prev => prev.map(p => p.id === updated.id && original ? original : p));
            addToast('Update failed.', 'error');
        }
    };

    const deleteProduct = async (id: string) => {
        if (!isSupabaseConfigured) {
            // No Supabase: locally remove is the only path available.
            setProducts(prev => prev.filter(p => p.id !== id));
            return;
        }

        flagSelfWrite(id);
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
            // Backend failed — surface the error to the operator so they
            // don't think the delete succeeded while the row still lives
            // in the DB. Keep the row in local state until it's actually
            // gone server-side.
            console.error('Supabase delete failed:', error);
            addToast('Delete failed — row still in DB. Try again.', 'error');
            return;
        }
        addToast('Product deleted.', 'success');
        setProducts(prev => prev.filter(p => p.id !== id));
    };

    const addToCart = (product: Product, size: string, options?: { keychainClipOn?: boolean }) => {
        setCart(prev => {
            const keychainClipOn = Boolean(options?.keychainClipOn && product.category === 'wallet');
            const existing = prev.find(item =>
                item.id === product.id &&
                item.selectedSize === size &&
                Boolean(item.keychainClipOn) === keychainClipOn
            );
            if (existing) return prev.map(item => item.cartId === existing.cartId ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, {
                ...product,
                selectedSize: size,
                quantity: 1,
                cartId: Math.random().toString(36).substr(2, 9),
                keychainClipOn
            }];
        });
        setCartOpen(true);
    };

    const removeFromCart = (cartId: string) => setCart(prev => prev.filter(item => item.cartId !== cartId));
    const clearCart = () => setCart([]);
    const toggleFavorite = (pid: string) => {
        if (!user) return;
        const isFav = user.favorites.includes(pid);
        const newFavs = isFav ? user.favorites.filter(id => id !== pid) : [pid, ...user.favorites];
        setUser({ ...user, favorites: newFavs });
        localStorage.setItem(`coalition_favorites_${user.uid}`, JSON.stringify(newFavs));
    };

    const login = async (provider: AuthProvider) => {
        if (provider === AuthProvider.METAMASK) {
            try {
                const { connectWallet, formatAddress: formatEthAddress } = await loadWalletActions();
                const data = await connectWallet();
                if (data) {
                    const isAdmin = ADMIN_WALLETS.map(w => w.toLowerCase()).includes(data.address.toLowerCase());
                    setUser({
                        uid: 'user_eth_' + data.address, displayName: formatEthAddress(data.address), email: null,
                        walletAddress: data.address, sgCoinBalance: parseFloat(data.sgCoinBalance || '0'),
                        v2Balance: parseFloat(data.v2Balance || '0'), totalMigrated: parseFloat(data.totalMigratedV1?.replace(/,/g, '') || '0'),
                        isAdmin, favorites: [], isVIP: isAdmin
                    });
                }
            } catch (err) { console.error('MetaMask login error:', err); addToast('Failed to connect wallet.', 'error'); }
        }
    };
    const loginUser = login;
    const logout = async () => { try { await signOut(); setUser(null); } catch (e) { setUser(null); } };

    const updateUser = async (data: Partial<UserProfile>) => {
        if (!user) return;
        setUser({ ...user, ...data });
        if (isSupabaseConfigured && !user.uid.startsWith('user_eth_')) {
            try {
                const updates: any = {};
                if (data.sgCoinBalance !== undefined) updates.sg_coin_balance = data.sgCoinBalance;
                if (data.isVIP !== undefined) updates.is_vip = data.isVIP;
                if (data.storeCredit !== undefined) updates.store_credit = data.storeCredit;
                if (Object.keys(updates).length > 0) await supabase.from('profiles').update(updates).eq('id', user.uid);
            } catch (err) { console.error('Failed to sync user updates:', err); }
        }
    };

    const loginAdmin = async (emailOrPassword: string, password?: string) => {
        const pwd = password || emailOrPassword;

        try {
            console.log('🔐 Attempting secure admin login...');
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                sessionStorage.setItem('coalition_admin_token', data.token);
                updateAdminMode(true);
                return true;
            } else {
                console.warn('❌ Admin verification failed:', data.error);
            }
        } catch (err) {
            console.error('❌ Admin login error:', err);
        }

        // Keep Supabase Auth fallback for DB-linked admins if needed
        if (password) {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email: emailOrPassword, password });
                if (error) throw error;
                if (data.user) {
                    const { data: adminData } = await supabase.from('admin_users').select('role').eq('user_id', data.user.id).maybeSingle();
                    if (adminData) {
                        updateAdminMode(true);
                        return true;
                    }
                    await supabase.auth.signOut();
                }
            } catch (err) {
                console.error('❌ Supabase admin login error:', err);
            }
        }

        return false;
    };
    const logoutAdmin = () => { updateAdminMode(false); };
    const updateSections = (s: Section[]) => setSections(s);
    const updateSection = (id: string, data: Partial<Section>) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    };

    const cartTotal = () => cart.reduce((sum, item) => sum + getCartItemLineTotal(item), 0);
    const calculateReward = (total: number) => Math.floor(total * COIN_REWARD_RATE);

    const addOrder = async (order: Order, verification?: { paypalOrderId?: string; paypalCaptureId?: string }) => {
        const mustUseOrderApi = order.paymentMethod === 'paypal';
        if (isSupabaseConfigured || mustUseOrderApi) {
            try {
                const response = await fetch('/api/complete-order', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order, verification })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'Order completion failed');
                }
                setOrders(prev => [order, ...prev.filter(existing => existing.id !== order.id)]);
                fetchOrders(); // Refresh orders after successful placement
            } catch (err) { console.error('Order failed:', err); throw err; }
            return;
        }

        setOrders(prev => [order, ...prev]);
    };

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        const originalStatus = orders.find(o => o.id === orderId)?.paymentStatus;

        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: newStatus as OrderStatus } : o));

        if (isSupabaseConfigured) {
            try {
                const token = sessionStorage.getItem('coalition_admin_token');
                const response = await fetch('/api/complete-order', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        id: orderId,
                        updates: {
                            payment_status: newStatus,
                            paid_at: newStatus === 'paid' ? new Date().toISOString() : null
                        }
                    })
                });

                if (!response.ok) throw new Error('Status update failed');
                addToast('Order status updated!', 'success');
            } catch (err) {
                console.error('Update status failed:', err);
                // Rollback on error
                if (originalStatus) {
                    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: originalStatus } : o));
                }
                addToast('Failed to update status.', 'error');
            }
        }
    };

    const deleteOrder = async (id: string) => {
        try {
            setOrders(prev => prev.filter(o => o.id !== id));
            if (isSupabaseConfigured) {
                await supabase.from('orders').delete().eq('id', id);
            }
        } catch (e) { console.error('Delete order failed:', e); }
    };
    const getOrderById = (id: string) => orders.find(o => o.id === id);
    const deductInventory = async (items: OrderItem[]) => {
        setProducts(prev => prev.map(p => {
            const item = items.find(i => i.productId === p.id);
            if (item && p.sizeInventory) {
                const inv = { ...p.sizeInventory };
                inv[item.selectedSize] = Math.max(0, (inv[item.selectedSize] || 0) - item.quantity);
                return { ...p, sizeInventory: inv };
            }
            return p;
        }));
    };
    const generateOrderNumber = () => 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const addGiveaway = async (g: Giveaway) => setGiveaways(prev => [...prev, g]);
    const updateGiveaway = async (g: Giveaway) => setGiveaways(prev => prev.map(item => item.id === g.id ? g : item));
    const deleteGiveaway = async (id: string) => setGiveaways(prev => prev.filter(g => g.id !== id));
    const addGiveawayEntry = async (e: GiveawayEntry) => setGiveaways(prev => prev.map(g => g.id === e.giveawayId ? { ...g, entries: [...g.entries, e] } : g));
    const pickGiveawayWinner = async (id: string, count: number) => {
        setGiveaways(prev => prev.map(g => {
            if (g.id === id) {
                const winners = pickWeightedGiveawayWinners(g.entries, count);
                return { ...g, winners, status: GiveawayStatus.ENDED };
            }
            return g;
        }));
    };

    const connectMetaMaskWallet = async (address?: string) => {
        if (!user) return;
        try {
            let addr = address;
            if (!addr) {
                const { connectWallet } = await loadWalletActions();
                const data = await connectWallet();
                if (!data) return;
                addr = data.address;
            }
            const isAdmin = addr && ADMIN_WALLETS.map(w => w.toLowerCase()).includes(addr.toLowerCase());
            setUser({ ...user, walletAddress: addr, connectedWalletAddress: addr, walletConnectionMethod: 'metamask', walletConnectedAt: Date.now(), isAdmin: user.isAdmin || isAdmin });
            if (isSupabaseConfigured && !user.uid.startsWith('user_eth_')) {
                await supabase.from('wallet_accounts').upsert({ user_id: user.uid, wallet_address: addr, method: 'metamask' }, { onConflict: 'user_id' });
            }
        } catch (e) { console.error('Connect wallet error:', e); }
    };

    const connectManualWallet = async (address: string) => { if (user) setUser({ ...user, connectedWalletAddress: address, walletConnectionMethod: 'manual', walletConnectedAt: Date.now() }); };
    const disconnectWallet = async () => { if (user) setUser({ ...user, connectedWalletAddress: undefined, walletConnectionMethod: undefined, walletConnectedAt: undefined }); };

    const addReview = async (pid: string, r: Review) => {
        setProducts(prev => prev.map(p => p.id === pid ? { ...p, reviews: [r, ...(p.reviews || [])] } : p));
        const saved = safeJsonParse(`coalition_reviews_${pid}`, []);
        localStorage.setItem(`coalition_reviews_${pid}`, JSON.stringify([r, ...saved]));
    };

    const linkSocialAccount = async (platform: SocialAccount['platform'], username: string) => {
        if (!user) return;
        try {
            await supabase.from('social_accounts').insert([{ user_id: user.uid, platform, username, verified: false }]);
            addToast('Linked!', 'success');
        } catch (err) { addToast('Link failed.', 'error'); }
    };

    const unlinkSocialAccount = async (p: SocialAccount['platform']) => {
        if (!user) return { success: false };
        try {
            await supabase.from('social_accounts').delete().eq('user_id', user.uid).eq('platform', p);
            setUser(prev => prev ? { ...prev, socialAccounts: prev.socialAccounts?.filter(a => a.platform !== p) } : null);
            return { success: true };
        } catch (err) { return { success: false }; }
    };

    const submitCustomInquiry = async (data: any) => {
        try {
            const insertData: any = { ...data, status: 'new' };
            if (user?.uid && !user.uid.startsWith('user_eth_')) insertData.user_id = user.uid;
            await supabase.from('custom_inquiries').insert([insertData]);
            addToast('Submitted!', 'success');
        } catch (err) { addToast('Failed.', 'error'); }
    };

    const submitPurchaseRequest = async (data: any) => {
        try { await supabase.from('sgcoin_purchase_requests').insert([{ ...data, user_id: user?.uid, status: 'pending' }]); addToast('Submitted!', 'success'); }
        catch (err) { addToast('Failed.', 'error'); }
    };

    return (
        <AppContext.Provider value={{
            products, cart, user, sections, orders, isCartOpen, isAdminMode, isSupabaseConfigured,
            isConfigError, isLoading, addProduct, updateProduct, deleteProduct, addToCart,
            removeFromCart, clearCart, toggleFavorite, login, loginUser, logout, updateUser,
            setCartOpen, loginAdmin, logoutAdmin, updateSections, updateSection, cartTotal,
            calculateReward, addOrder, updateOrderStatus, deleteOrder, getOrderById, deductInventory,
            generateOrderNumber, giveaways, addGiveaway, updateGiveaway, deleteGiveaway,
            addGiveawayEntry, pickGiveawayWinner, connectMetaMaskWallet, connectManualWallet,
            disconnectWallet, chainId, switchToPolygon: handleSwitchToPolygon, addReview,
            linkSocialAccount, unlinkSocialAccount, submitCustomInquiry, submitPurchaseRequest,
            refreshBalances, signals, fetchSignals
        }}>
            {children}
        </AppContext.Provider>
    );
};
