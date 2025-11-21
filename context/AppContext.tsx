import React, { useState, useEffect, createContext, useContext } from 'react';
import { Product, CartItem, UserProfile, Section, AuthProvider, Order, OrderItem, Giveaway, GiveawayEntry } from '../types';
import { INITIAL_PRODUCTS, INITIAL_SECTIONS, COIN_REWARD_RATE } from '../constants';
import { connectWallet, formatAddress } from '../services/web3Service';
import { supabase } from '../services/supabase';
import { autoCommit, generateProductAddedMessage, generateProductUpdatedMessage, generateProductDeletedMessage } from '../services/autoCommitService';
import { signOut } from '../services/auth';

interface AppState {
    products: Product[];
    cart: CartItem[];
    user: UserProfile | null;
    sections: Section[];
    orders: Order[];
    isCartOpen: boolean;
    isAdminMode: boolean;
    isSupabaseConfigured: boolean;
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
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // State
    const [products, setProducts] = useState<Product[]>(() => {
        try {
            const saved = localStorage.getItem('coalition_products_v3');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to parse cached products:", e);
            return [];
        }
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
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check Supabase Config & Auth State
    useEffect(() => {
        let mounted = true;

        const initApp = async () => {
            try {
                const hasKeys = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (mounted) setIsSupabaseConfigured(!!hasKeys);

                if (!hasKeys) {
                    console.warn("Supabase keys missing. Falling back to localStorage.");
                    setProducts(prev => {
                        const prevIds = new Set(prev.map(p => p.id));
                        const newItems = INITIAL_PRODUCTS.filter(p => !prevIds.has(p.id));
                        if (newItems.length > 0) {
                            return [...prev, ...newItems];
                        }
                        return prev.length === 0 ? INITIAL_PRODUCTS : prev;
                    });
                    if (mounted) setIsLoading(false);
                } else {
                    // Always fetch fresh data from Supabase
                    const fetchedProducts = await fetchProducts();

                    // SAFEGUARD: Ensure Coalition NF-Tee is always in the list locally
                    const nftProduct = INITIAL_PRODUCTS.find(p => p.id === 'prod_nft_001');
                    if (nftProduct) {
                        setProducts(prev => {
                            const index = prev.findIndex(p => p.id === 'prod_nft_001');
                            if (index === -1) {
                                console.log("Force adding Coalition NF-Tee to local state");
                                return [...prev, nftProduct];
                            } else {
                                // Force update metadata (e.g. OpenSea URL)
                                const newProducts = [...prev];
                                newProducts[index] = { ...newProducts[index], ...nftProduct };
                                return newProducts;
                            }
                        });

                        // Background Seeding: Only if we successfully fetched from DB and it wasn't there
                        if (fetchedProducts && !fetchedProducts.some(p => p.id === 'prod_nft_001')) {
                            console.log("Seeding Coalition NF-Tee to Supabase...");
                            const dbProduct = {
                                id: nftProduct.id,
                                name: nftProduct.name,
                                price: nftProduct.price,
                                category: nftProduct.category,
                                images: nftProduct.images,
                                description: nftProduct.description,
                                is_featured: nftProduct.isFeatured,
                                sizes: nftProduct.sizes,
                                nft_metadata: nftProduct.nft,
                                size_inventory: nftProduct.sizeInventory
                            };

                            // Fire and forget seeding to avoid blocking UI
                            supabase.from('products').insert([dbProduct]).then(({ error }) => {
                                if (error) console.error("Failed to seed product:", error);
                                else console.log("Product seeded successfully");
                            });
                        }
                    }

                    // Real-time subscription for products
                    const subscription = supabase
                        .channel('products_channel')
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                            console.log('Real-time update:', payload);
                            fetchProducts();
                        })
                        .subscribe();

                    // Auth State Listener
                    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
                        if (!mounted) return;

                        if (session?.user) {
                            // Load favorites from localStorage for now, or DB later
                            const savedFavorites = localStorage.getItem(`coalition_favorites_${session.user.id}`);

                            setUser({
                                uid: session.user.id,
                                displayName: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
                                email: session.user.email || null,
                                walletAddress: null,
                                sgCoinBalance: 0, // TODO: Fetch from DB
                                isAdmin: false, // TODO: Check role
                                favorites: savedFavorites ? JSON.parse(savedFavorites) : []
                            });
                        } else {
                            setUser(null);
                        }
                    });

                    return () => {
                        subscription.unsubscribe();
                        authListener.subscription.unsubscribe();
                    };
                }
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
        if (!import.meta.env.VITE_SUPABASE_URL) return null;

        try {
            setIsLoading(true);
            const { data, error } = await supabase.from('products').select('*');

            if (error) throw error;

            if (data) {
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
                    nft: item.nft_metadata
                }));

                setProducts(mappedProducts);
                // Always cache successful fetches
                localStorage.setItem('coalition_products_v3', JSON.stringify(mappedProducts));
                return mappedProducts;
            }
            return null;
        } catch (err) {
            console.error('Error fetching products:', err);
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

    // Redundant useEffect for products removed - we now save immediately after fetch
    // or if we modify locally (for optimistic updates)
    useEffect(() => {
        if (products.length > 0) {
            localStorage.setItem('coalition_products_v3', JSON.stringify(products));
        }
    }, [products]);

    const addProduct = async (p: Product) => {
        if (isSupabaseConfigured) {
            const dbProduct = {
                id: p.id,
                name: p.name,
                price: p.price,
                category: p.category,
                images: p.images,
                description: p.description,
                is_featured: p.isFeatured,
                sizes: p.sizes,
                nft_metadata: p.nft
            };
            const { error } = await supabase.from('products').insert([dbProduct]);
            if (error) {
                console.error('Error adding product:', error);
                alert('Failed to add product to database');
            } else {
                setProducts(prev => [...prev, p]);
                await autoCommit({ message: generateProductAddedMessage(p.name) });
            }
        } else {
            setProducts(prev => [...prev, p]);
            await autoCommit({ message: generateProductAddedMessage(p.name) });
        }
    };

    const updateProduct = async (updated: Product) => {
        if (isSupabaseConfigured) {
            const dbProduct = {
                name: updated.name,
                price: updated.price,
                category: updated.category,
                images: updated.images,
                description: updated.description,
                is_featured: updated.isFeatured,
                sizes: updated.sizes,
                nft_metadata: updated.nft
            };
            const { error } = await supabase.from('products').update(dbProduct).eq('id', updated.id);
            if (error) {
                console.error('Error updating product:', error);
                alert('Failed to update product in database');
            } else {
                setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
                await autoCommit({ message: generateProductUpdatedMessage(updated.name) });
            }
        } else {
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            await autoCommit({ message: generateProductUpdatedMessage(updated.name) });
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
                setProducts(prev => prev.filter(p => p.id !== id));
                await autoCommit({ message: generateProductDeletedMessage(productName) });
            }
        } else {
            setProducts(prev => prev.filter(p => p.id !== id));
            await autoCommit({ message: generateProductDeletedMessage(productName) });
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
            return true;
        }
        return false;
    };

    const logoutAdmin = () => setIsAdminMode(false);

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
                    await supabase.from('products').update({ size_inventory: newInventory }).eq('id', item.productId);
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
                const winners: string[] = [];
                for (let i = 0; i < count; i++) {
                    if (eligibleEntries.length > 0) {
                        const randomIndex = Math.floor(Math.random() * eligibleEntries.length);
                        winners.push(eligibleEntries[randomIndex].userId);
                        eligibleEntries.splice(randomIndex, 1);
                    }
                }
                return { ...g, winners, status: 'completed' };
            }
            return g;
        }));
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
            pickGiveawayWinner
        }}>
            {children}
        </AppContext.Provider>
    );
};
