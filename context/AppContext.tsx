import React, { useState, useEffect, createContext, useContext } from 'react';
import { Product, CartItem, UserProfile, Section, AuthProvider, Order, OrderItem, Giveaway, GiveawayEntry, GiveawayStatus } from '../types';
import { INITIAL_SECTIONS, INITIAL_PRODUCTS, COIN_REWARD_RATE } from '../constants';
import { connectWallet, formatAddress, getSGCoinBalance } from '../services/web3Service';
import { ethers } from 'ethers';
import { supabase } from '../services/supabase';
import { autoCommit, generateProductAddedMessage, generateProductUpdatedMessage, generateProductDeletedMessage } from '../services/autoCommitService';
import { signOut } from '../services/auth';
import { verifyProductWrite, debugProductState } from '../services/productVerification';
import { retryQueue } from '../services/retryQueue';
import { useToast } from './ToastContext';

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
    addToCart: (p: Product, size: string) => void;
    removeFromCart: (cartId: string) => void;
    clearCart: () => void;
    toggleFavorite: (pid: string) => void;
    login: (provider: AuthProvider, userId?: string) => Promise<void>;
    loginUser: (provider: AuthProvider, userId?: string) => Promise<void>;
    logout: () => void;
    updateUser: (data: Partial<UserProfile>) => void;
    setCartOpen: (open: boolean) => void;
    loginAdmin: (password: string) => boolean;
    logoutAdmin: () => void;
    updateSections: (sections: Section[]) => void;
    updateSection: (id: string, data: Partial<Section>) => void;
    cartTotal: () => number;
    calculateReward: (total: number) => number;
    addOrder: (order: Order) => Promise<void>;
    updateOrder: (order: Order) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    getOrderById: (orderId: string) => Order | undefined;
    deductInventory: (items: OrderItem[]) => Promise<void>;
    generateOrderNumber: () => string;
    // Giveaway Functions
    giveaways: Giveaway[];
    addGiveaway: (g: Giveaway) => Promise<void>;
    updateGiveaway: (g: Giveaway) => Promise<void>;
    deleteGiveaway: (id: string) => Promise<void>;
    addGiveawayEntry: (entry: GiveawayEntry) => Promise<void>;
    pickGiveawayWinner: (giveawayId: string, count: number) => Promise<void>;
    // Wallet Connection Functions
    connectMetaMaskWallet: (address: string) => Promise<void>;
    connectManualWallet: (address: string) => Promise<void>;
    disconnectWallet: () => Promise<void>;
    fetchProducts: () => Promise<Product[] | null>;
    autoCommit: (options: any) => Promise<string | null>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { addToast } = useToast();
    const [products, setProducts] = useState<Product[]>(() => {
        const saved = localStorage.getItem('coalition_products_local');
        return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    });

    const [sections, setSections] = useState<Section[]>(() => {
        const saved = localStorage.getItem('coalition_sections');
        return saved ? JSON.parse(saved) : INITIAL_SECTIONS;
    });
    const [orders, setOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('coalition_orders_v1');
        return saved ? JSON.parse(saved) : [];
    });
    const [cart, setCart] = useState<CartItem[]>([]);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [giveaways, setGiveaways] = useState<Giveaway[]>(() => {
        const saved = localStorage.getItem('coalition_giveaways_v1');
        return saved ? JSON.parse(saved) : [];
    });

    const [isCartOpen, setCartOpen] = useState(false);
    const [isAdminMode, setIsAdminMode] = useState(() => {
        return localStorage.getItem('coalition_admin_session') === 'true';
    });
    const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
    const [isConfigError, setIsConfigError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check Supabase Config & Auth State
    useEffect(() => {
        let mounted = true;

        const initApp = async () => {
            try {
                const hasKeys = import.meta.env.VITE_SUPABASE_URL &&
                    import.meta.env.VITE_SUPABASE_ANON_KEY &&
                    import.meta.env.VITE_SUPABASE_URL !== 'VITE_SUPABASE_URL' &&
                    import.meta.env.VITE_SUPABASE_ANON_KEY !== 'VITE_SUPABASE_ANON_KEY' &&
                    import.meta.env.VITE_SUPABASE_ANON_KEY !== 'VITE_SUPABASE_URL';

                if (mounted) setIsSupabaseConfigured(!!hasKeys);

                if (!hasKeys) {
                    console.error("Supabase keys missing. Falling back to local/initial products.");
                    // Don't setProducts([]) here, as it will overwrite the initial products state.
                    // Instead, let it fall through to fetchProducts() which handles the fallback properly.
                }

                // Auth State Listener - Initialize BEFORE fetching data
                let authListener: any = { subscription: { unsubscribe: () => { } } };
                if (hasKeys) {
                    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
                        if (!mounted) return;

                        console.log('🔐 Auth state changed:', event, session?.user?.email);

                        if (session?.user) {
                            // Load favorites from localStorage for now, or DB later
                            const savedFavorites = localStorage.getItem(`coalition_favorites_${session.user.id}`);

                            // Fetch linked wallet
                            let walletAddress = null;
                            let sgCoinBalance = 0;
                            let walletConnectionMethod = undefined;
                            let walletConnectedAt = undefined;

                            try {
                                const { data: linkedWallet } = await supabase
                                    .from('wallet_accounts')
                                    .select('wallet_address')
                                    .eq('user_id', session.user.id)
                                    .single();

                                if (linkedWallet?.wallet_address) {
                                    walletAddress = linkedWallet.wallet_address;
                                    walletConnectionMethod = 'metamask'; // Default to metamask for now
                                    walletConnectedAt = Date.now();

                                    // Try to fetch balance using public provider
                                    try {
                                        const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
                                        sgCoinBalance = await getSGCoinBalance(walletAddress, provider);
                                    } catch (err) {
                                        console.warn('Failed to fetch SGCoin balance:', err);
                                    }
                                }
                            } catch (err) {
                                console.error('Error fetching linked wallet:', err);
                            }

                            // Fetch VIP Profile Data
                            let isVIP = false;
                            let storeCredit = 0.0;
                            try {
                                const { data: profile } = await supabase
                                    .from('profiles')
                                    .select('is_vip, store_credit')
                                    .eq('id', session.user.id)
                                    .single();

                                if (profile) {
                                    isVIP = profile.is_vip || false;
                                    storeCredit = profile.store_credit || 0.0;
                                }
                            } catch (err) {
                                console.warn('Failed to fetch profile data:', err);
                            }

                            setUser({
                                uid: session.user.id,
                                displayName: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
                                email: session.user.email || null,
                                walletAddress: walletAddress,
                                connectedWalletAddress: walletAddress || undefined,
                                walletConnectionMethod: walletConnectionMethod as any,
                                walletConnectedAt: walletConnectedAt,
                                sgCoinBalance: sgCoinBalance,
                                isAdmin: false, // TODO: Check role
                                favorites: savedFavorites ? JSON.parse(savedFavorites) : [],
                                isVIP: isVIP,
                                storeCredit: storeCredit
                            });
                        } else {
                            setUser(null);
                        }
                    });
                    authListener = data;
                }

                // Always fetch fresh data (handles fallback internally)
                fetchProducts();

                // Real-time subscription for products with debouncing
                let subscription: any = null;
                if (hasKeys) {
                    let refreshTimeout: NodeJS.Timeout;
                    const debouncedRefresh = () => {
                        clearTimeout(refreshTimeout);
                        refreshTimeout = setTimeout(() => {
                            console.log('🔄 Debounced refresh triggered by real-time update');
                            fetchProducts();
                        }, 1000);
                    };

                    subscription = supabase
                        .channel('products_channel')
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                            console.log('📡 Real-time update received:', payload.eventType, (payload.new as any)?.name || (payload.old as any)?.name);
                            debouncedRefresh();
                        })
                        .subscribe();
                }

                return () => {
                    if (subscription) subscription.unsubscribe();
                    if (authListener?.subscription) authListener.subscription.unsubscribe();
                };
            } catch (error) {
                console.error("Critical error in AppContext initialization:", error);
                if (mounted) setIsLoading(false);
            }
        };

        initApp();

        return () => {
            mounted = false;
        };
    }, []);

    const fetchProducts = async (): Promise<Product[] | null> => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Detect literal string placeholders from failed builds/deployments
        const isUrlInvalid = !url || url === 'VITE_SUPABASE_URL';
        const isKeyInvalid = !key || key === 'VITE_SUPABASE_ANON_KEY' || key === 'VITE_SUPABASE_URL';

        if (isUrlInvalid || isKeyInvalid) {
            console.warn('⚠️ Supabase configuration missing or invalid. Falling back to local products.');
            setIsConfigError(true);
            const saved = localStorage.getItem('coalition_products_local');
            const productsToLoad = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
            setProducts(productsToLoad);
            return productsToLoad;
        }

        try {
            console.log('🔄 Fetching products from Supabase...');
            setIsLoading(true);
            const { data, error } = await supabase.from('products').select('*');

            if (error) {
                if (error.message.includes('Invalid API key') || error.code === 'PGRST301') {
                    console.error('❌ Supabase Auth Error: Invalid API Key. Please check your environment variables.');
                    setIsConfigError(true);
                    const saved = localStorage.getItem('coalition_products_local');
                    const productsToLoad = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
                    setProducts(productsToLoad);
                    return productsToLoad;
                }
                throw error;
            }

            if (error) throw error;

            if (data) {
                console.log(`✅ Fetched ${data.length} products from Supabase`);
                const mappedProducts: Product[] = data.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    stock: item.stock,
                    category: item.category,
                    images: item.images || [],
                    description: item.description,
                    isFeatured: item.is_featured,
                    sizes: item.sizes || [],
                    sizeInventory: item.size_inventory || {},
                    nft: item.nft_metadata,
                    archived: item.archived || false,
                    archivedAt: item.archived_at,
                    releasedAt: item.released_at,
                    soldAt: item.sold_at,
                    updatedAt: item.updated_at
                }));

                // DOMINANT PERSISTENCE: Merge with local storage
                const saved = localStorage.getItem('coalition_products_local');
                let mergedProducts = mappedProducts;

                if (saved) {
                    const localProducts: Product[] = JSON.parse(saved);
                    mergedProducts = mappedProducts.map(dbProduct => {
                        const localProduct = localProducts.find(p => p.id === dbProduct.id);
                        if (localProduct && localProduct.updatedAt && dbProduct.updatedAt) {
                            // If local is newer, keep local
                            if (new Date(localProduct.updatedAt) > new Date(dbProduct.updatedAt)) {
                                console.log(`💎 Using dominant local version for ${dbProduct.name}`);
                                return localProduct;
                            }
                        }
                        return dbProduct;
                    });

                    // Also add any local products that don't exist in DB yet (pending sync)
                    const pendingProducts = localProducts.filter(lp => !mappedProducts.find(db => db.id === lp.id));
                    if (pendingProducts.length > 0) {
                        console.log(`💎 Adding ${pendingProducts.length} pending local products`);
                        mergedProducts = [...mergedProducts, ...pendingProducts];
                    }
                }

                setProducts(mergedProducts);
                localStorage.setItem('coalition_products_local', JSON.stringify(mergedProducts));
                console.log('✅ Products state updated:', mappedProducts.map(p => ({ id: p.id, name: p.name })));
                return mappedProducts;
            }
            console.warn('⚠️ No products returned from Supabase');
            return [];
        } catch (err) {
            console.error('❌ Error fetching products:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Persistence for non-Supabase items
    useEffect(() => {
        localStorage.setItem('coalition_sections', JSON.stringify(sections));
    }, [sections]);

    useEffect(() => {
        localStorage.setItem('coalition_orders_v1', JSON.stringify(orders));
    }, [orders]);

    useEffect(() => {
        localStorage.setItem('coalition_giveaways_v1', JSON.stringify(giveaways));
    }, [giveaways]);

    // Products are now managed exclusively by Supabase - no localStorage caching

    const addProduct = async (p: Product) => {
        if (!isSupabaseConfigured) {
            console.error('Supabase not configured - cannot add product');
            addToast('Database not configured. Cannot add product.', 'error');
            return;
        }

        console.log('➕ Adding product:', p.name);

        // OPTIMISTIC UPDATE: Add to local state immediately
        const newProducts = [...products, p];
        setProducts(newProducts);
        localStorage.setItem('coalition_products_local', JSON.stringify(newProducts));

        try {
            const now = new Date().toISOString();
            const productWithTime = { ...p, updatedAt: now };

            const dbProduct = {
                id: p.id,
                name: p.name,
                price: p.price,
                category: p.category,
                images: p.images,
                description: p.description,
                is_featured: p.isFeatured,
                sizes: p.sizes,
                size_inventory: p.sizeInventory || {},
                nft_metadata: p.nft,
                archived: p.archived || false,
                archived_at: p.archivedAt,
                released_at: p.releasedAt,
                sold_at: p.soldAt,
                updated_at: now
            };

            const { error } = await supabase.from('products').insert([dbProduct]);

            if (error) {
                console.error('❌ Error adding product:', error);
                // ROLLBACK: Remove from local state
                const filtered = products.filter(prod => prod.id !== p.id);
                setProducts(filtered);
                localStorage.setItem('coalition_products_local', JSON.stringify(filtered));
                // Add to retry queue
                retryQueue.add('add', p);
                addToast(`Failed to save product "${p.name}". It will be retried automatically.`, 'error');
                return;
            }

            // VERIFY: Confirm product was written to database
            const verified = await verifyProductWrite(p.id);

            if (!verified) {
                console.warn('⚠️ Product write verification failed, adding to retry queue');
                retryQueue.add('add', p);
                addToast(`Product "${p.name}" may not have saved correctly. It will be retried automatically.`, 'warning');
            } else {
                console.log('✅ Product added and verified:', p.name);
                // Remove from retry queue if it was there
                retryQueue.remove(p.id);
                await autoCommit({ message: generateProductAddedMessage(p.name) });
            }

        } catch (err) {
            console.error('❌ Unexpected error adding product:', err);
            // ROLLBACK: Remove from local state
            const filtered = products.filter(prod => prod.id !== p.id);
            setProducts(filtered);
            localStorage.setItem('coalition_products_local', JSON.stringify(filtered));
            retryQueue.add('add', p);
            addToast(`Unexpected error saving product "${p.name}". It will be retried automatically.`, 'error');
        }
    };

    const updateProduct = async (updated: Product) => {
        console.log('🔄 UPDATE STARTED:', { id: updated.id, name: updated.name });

        if (!isSupabaseConfigured) {
            console.error('❌ Supabase not configured - cannot update product');
            addToast('Database not configured. Cannot update product.', 'error');
            return;
        }

        // Store original state for rollback
        const originalProduct = products.find(p => p.id === updated.id);

        const now = new Date().toISOString();
        const updatedWithTime = { ...updated, updatedAt: now };

        // OPTIMISTIC UPDATE: Update local state immediately
        const updatedList = products.map(p => p.id === updated.id ? updatedWithTime : p);
        setProducts(updatedList);
        localStorage.setItem('coalition_products_local', JSON.stringify(updatedList));

        const dbProduct = {
            name: updated.name,
            price: updated.price,
            category: updated.category,
            images: updated.images,
            description: updated.description,
            is_featured: updated.isFeatured,
            sizes: updated.sizes,
            size_inventory: updated.sizeInventory || {},
            nft_metadata: updated.nft,
            archived: updated.archived,
            archived_at: updated.archivedAt,
            released_at: updated.releasedAt,
            sold_at: updated.soldAt,
            updated_at: now
        };

        console.log('📤 Sending update to Supabase:', dbProduct);

        try {
            const { data, error } = await supabase
                .from('products')
                .update(dbProduct)
                .eq('id', updated.id)
                .select();

            if (error) {
                console.error('❌ Supabase update error:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });

                // ROLLBACK: Restore original state
                if (originalProduct) {
                    const restoredList = products.map(p => p.id === updated.id ? originalProduct : p);
                    setProducts(restoredList);
                    localStorage.setItem('coalition_products_local', JSON.stringify(restoredList));
                }

                // Add to retry queue
                retryQueue.add('update', updated);
                alert(`Failed to update product "${updated.name}". It will be retried automatically.\n\nError: ${error.message}`);
                return;
            }

            console.log('✅ Supabase update successful:', data);

            // VERIFY: Confirm update was written
            const verified = await verifyProductWrite(updated.id);

            if (!verified) {
                console.warn('⚠️ Product update verification failed');
                retryQueue.add('update', updated);
                alert(`Product "${updated.name}" may not have updated correctly. It will be retried automatically.`);
            } else {
                console.log('✅ Product update verified:', updated.name);
                retryQueue.remove(updated.id);
                await autoCommit({ message: generateProductUpdatedMessage(updated.name) });
            }

            console.log('✅ UPDATE COMPLETE');

        } catch (err) {
            console.error('❌ Unexpected error during update:', err);

            // ROLLBACK: Restore original state
            if (originalProduct) {
                const restoredList = products.map(p => p.id === updated.id ? originalProduct : p);
                setProducts(restoredList);
                localStorage.setItem('coalition_products_local', JSON.stringify(restoredList));
            }

            retryQueue.add('update', updated);
            alert(`Unexpected error updating product "${updated.name}". It will be retried automatically.`);
        }
    };

    const deleteProduct = async (id: string) => {
        const product = products.find(p => p.id === id);
        const productName = product?.name || id;

        if (isSupabaseConfigured) {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) {
                console.error('Error deleting product:', error);
                alert('Failed to delete product from database');
            } else {
                const filtered = products.filter(p => p.id !== id);
                setProducts(filtered);
                localStorage.setItem('coalition_products_local', JSON.stringify(filtered));
                await autoCommit({ message: generateProductDeletedMessage(productName) });
            }
        } else {
            // Fallback for local persistence when Supabase is down
            const filtered = products.filter(p => p.id !== id);
            setProducts(filtered);
            localStorage.setItem('coalition_products_local', JSON.stringify(filtered));
            addToast(`Product "${productName}" removed locally. Sync to database failed.`, 'warning');
        }
    };

    const updateSections = (newSections: Section[]) => setSections(newSections);

    const updateSection = (id: string, data: Partial<Section>) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    };

    const addToCart = (product: Product, size: string) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id && item.selectedSize === size);
            if (existing) {
                return prev.map(item => item.cartId === existing.cartId ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, selectedSize: size, quantity: 1, cartId: Math.random().toString(36).substr(2, 9) }];
        });
        setCartOpen(true);
    };

    const removeFromCart = (cartId: string) => {
        setCart(prev => prev.filter(item => item.cartId !== cartId));
    };

    const clearCart = () => setCart([]);

    const toggleFavorite = (pid: string) => {
        if (!user) return;
        const isFav = user.favorites.includes(pid);
        const newFavs = isFav ? user.favorites.filter(id => id !== pid) : [pid, ...user.favorites];
        const updatedUser = { ...user, favorites: newFavs };
        setUser(updatedUser);
        localStorage.setItem(`coalition_favorites_${user.uid}`, JSON.stringify(newFavs));
    };

    const login = async (provider: AuthProvider, userId?: string) => {
        if (provider === AuthProvider.METAMASK) {
            const walletData = await connectWallet();
            if (walletData) {
                setUser({
                    uid: 'user_eth_' + walletData.address,
                    displayName: formatAddress(walletData.address),
                    email: null,
                    walletAddress: walletData.address,
                    sgCoinBalance: walletData.sgCoinBalance || 0,
                    isAdmin: false,
                    favorites: []
                });
            }
        }
    };

    const loginUser = login;

    const logout = async () => {
        await signOut();
        setUser(null);
    };

    const updateUser = (data: Partial<UserProfile>) => {
        if (user) setUser({ ...user, ...data });
    };

    const loginAdmin = (password: string) => {
        if (password === 'admin123') {
            setIsAdminMode(true);
            localStorage.setItem('coalition_admin_session', 'true');
            return true;
        }
        return false;
    };

    const logoutAdmin = () => {
        setIsAdminMode(false);
        localStorage.removeItem('coalition_admin_session');
    };

    const cartTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const calculateReward = (total: number) => Math.floor(total * COIN_REWARD_RATE);

    const addOrder = async (order: Order) => {
        setOrders(prev => [order, ...prev]);
        await deductInventory(order.items);
    };

    const updateOrder = async (updatedOrder: Order) => {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    };

    const deleteOrder = async (orderId: string) => {
        setOrders(prev => prev.filter(o => o.id !== orderId));
    };

    const getOrderById = (orderId: string) => orders.find(o => o.id === orderId);

    const deductInventory = async (items: OrderItem[]) => {
        // Optimistic update
        setProducts(prev => prev.map(p => {
            const orderItem = items.find(i => i.productId === p.id);
            if (orderItem && p.sizeInventory) {
                const newInventory = { ...p.sizeInventory };
                if (newInventory[orderItem.selectedSize] > 0) {
                    newInventory[orderItem.selectedSize] -= orderItem.quantity;
                }
                return { ...p, sizeInventory: newInventory };
            }
            return p;
        }));

        // Supabase update
        if (isSupabaseConfigured) {
            for (const item of items) {
                const product = products.find(p => p.id === item.productId);
                if (product && product.sizeInventory) {
                    const newInventory = { ...product.sizeInventory };
                    if (newInventory[item.selectedSize] > 0) {
                        newInventory[item.selectedSize] -= item.quantity;
                    }

                    // Auto-Archive Logic
                    const totalStock = Object.values(newInventory).reduce((a, b) => (a as number) + (b as number), 0);
                    const updates: any = { size_inventory: newInventory };

                    if (totalStock === 0) {
                        const now = new Date().toISOString();
                        updates.archived = true;
                        updates.archived_at = now;
                        updates.sold_at = now;
                        console.log(`📦 Product ${product.name} sold out! Auto-archiving...`);
                    }

                    await supabase.from('products').update(updates).eq('id', item.productId);
                }
            }
        }
    };

    const generateOrderNumber = () => {
        return 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    };

    // Giveaway Functions
    const addGiveaway = async (g: Giveaway) => {
        setGiveaways(prev => [...prev, g]);
    };

    const updateGiveaway = async (updated: Giveaway) => {
        setGiveaways(prev => prev.map(g => g.id === updated.id ? updated : g));
    };

    const deleteGiveaway = async (id: string) => {
        setGiveaways(prev => prev.filter(g => g.id !== id));
    };

    const addGiveawayEntry = async (entry: GiveawayEntry) => {
        setGiveaways(prev => prev.map(g => {
            if (g.id === entry.giveawayId) {
                return { ...g, entries: [...g.entries, entry] };
            }
            return g;
        }));
    };

    const pickGiveawayWinner = async (giveawayId: string, count: number) => {
        setGiveaways(prev => prev.map(g => {
            if (g.id === giveawayId) {
                const eligibleEntries = g.entries;
                const winnersList: GiveawayEntry[] = [];
                for (let i = 0; i < count; i++) {
                    if (eligibleEntries.length > 0) {
                        const randomIndex = Math.floor(Math.random() * eligibleEntries.length);
                        winnersList.push(eligibleEntries[randomIndex]);
                        eligibleEntries.splice(randomIndex, 1);
                    }
                }
                return { ...g, winners: winnersList, status: GiveawayStatus.ENDED };
            }
            return g;
        }));
    };

    // Wallet Connection Functions
    const connectMetaMaskWallet = async (address: string) => {
        if (user) {
            const updatedUser = {
                ...user,
                connectedWalletAddress: address,
                walletConnectionMethod: 'metamask' as const,
                walletConnectedAt: Date.now()
            };
            setUser(updatedUser);
            localStorage.setItem('coalition_user', JSON.stringify(updatedUser));
        }
    };

    const connectManualWallet = async (address: string) => {
        if (user) {
            const updatedUser = {
                ...user,
                connectedWalletAddress: address,
                walletConnectionMethod: 'manual' as const,
                walletConnectedAt: Date.now()
            };
            setUser(updatedUser);
            localStorage.setItem('coalition_user', JSON.stringify(updatedUser));
        }
    };

    const disconnectWallet = async () => {
        if (user) {
            const updatedUser = {
                ...user,
                connectedWalletAddress: undefined,
                walletConnectionMethod: undefined,
                walletConnectedAt: undefined
            };
            setUser(updatedUser);
            localStorage.setItem('coalition_user', JSON.stringify(updatedUser));
        }
    };

    return (
        <AppContext.Provider value={{
            products,
            cart,
            user,
            sections,
            orders,
            isCartOpen,
            isAdminMode,
            isSupabaseConfigured,
            isConfigError,
            isLoading,
            addProduct,
            updateProduct,
            deleteProduct,
            addToCart,
            removeFromCart,
            clearCart,
            toggleFavorite,
            login,
            loginUser,
            logout,
            updateUser,
            setCartOpen,
            loginAdmin,
            logoutAdmin,
            updateSections,
            updateSection,
            cartTotal,
            calculateReward,
            addOrder,
            updateOrder,
            deleteOrder,
            getOrderById,
            deductInventory,
            generateOrderNumber,
            giveaways,
            addGiveaway,
            updateGiveaway,
            deleteGiveaway,
            addGiveawayEntry,
            pickGiveawayWinner,
            connectMetaMaskWallet,
            connectManualWallet,
            disconnectWallet,
            fetchProducts,
            autoCommit
        }}>
            {children}
        </AppContext.Provider>
    );
};
