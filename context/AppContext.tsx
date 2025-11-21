import React, { useState, useEffect, createContext, useContext } from 'react';
import { Product, CartItem, UserProfile, Section, AuthProvider, Order, OrderItem } from '../types';
import { INITIAL_PRODUCTS, INITIAL_SECTIONS, COIN_REWARD_RATE } from '../constants';
import { connectWallet, formatAddress } from '../services/web3Service';
import { supabase } from '../services/supabase';
import { autoCommit, generateProductAddedMessage, generateProductUpdatedMessage, generateProductDeletedMessage } from '../services/autoCommitService';

// Mock user profiles for testing
export const MOCK_USERS: UserProfile[] = [
    {
        uid: 'user_001',
        displayName: 'John Doe',
        email: 'john@example.com',
        walletAddress: null,
        sgCoinBalance: 1200,
        isAdmin: false,
        favorites: []
    },
    {
        uid: 'user_002',
        displayName: 'Jane Smith',
        email: 'jane@example.com',
        walletAddress: null,
        sgCoinBalance: 3500,
        isAdmin: false,
        favorites: []
    },
    {
        uid: 'user_003',
        displayName: 'Alex Johnson',
        email: 'alex@example.com',
        walletAddress: null,
        sgCoinBalance: 10000,
        isAdmin: false,
        favorites: []
    },
    {
        uid: 'user_004',
        displayName: 'Sarah Williams',
        email: 'sarah@example.com',
        walletAddress: null,
        sgCoinBalance: 0,
        isAdmin: false,
        favorites: []
    }
];

interface AppState {
    products: Product[];
    cart: CartItem[];
    user: UserProfile | null;
    sections: Section[];
    orders: Order[];
    isCartOpen: boolean;
    isAdminMode: boolean;
    isSupabaseConfigured: boolean;
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
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // State
    const [products, setProducts] = useState<Product[]>([]);
    const [sections, setSections] = useState<Section[]>(() => {
        const saved = localStorage.getItem('coalition_sections');
        return saved ? JSON.parse(saved) : INITIAL_SECTIONS;
    });
    const [orders, setOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('coalition_orders_v1');
        return saved ? JSON.parse(saved) : [];
    });
    const [cart, setCart] = useState<CartItem[]>([]);
    const [user, setUser] = useState<UserProfile | null>(() => {
        const saved = localStorage.getItem('coalition_current_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [isCartOpen, setCartOpen] = useState(false);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);

    // Check Supabase Config
    useEffect(() => {
        try {
            const hasKeys = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
            setIsSupabaseConfigured(!!hasKeys);

            if (!hasKeys) {
                console.warn("Supabase keys missing. Falling back to localStorage.");
                const saved = localStorage.getItem('coalition_products_v3');
                const parsedProducts = saved ? JSON.parse(saved) : [];
                // Load INITIAL_PRODUCTS if localStorage is empty or has empty array
                setProducts(parsedProducts.length > 0 ? parsedProducts : INITIAL_PRODUCTS);
            } else {
                fetchProducts().catch(err => {
                    console.error("Failed to fetch products from Supabase:", err);
                    // Fallback to localStorage on error
                    const saved = localStorage.getItem('coalition_products_v3');
                    setProducts(saved ? JSON.parse(saved) : INITIAL_PRODUCTS);
                });

                // Real-time subscription
                try {
                    const subscription = supabase
                        .channel('products_channel')
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                            console.log('Real-time update:', payload);
                            fetchProducts(); // Refresh full list to be safe
                        })
                        .subscribe();

                    return () => {
                        subscription.unsubscribe();
                    };
                } catch (subError) {
                    console.error("Failed to setup Supabase subscription:", subError);
                }
            }
        } catch (error) {
            console.error("Critical error in AppContext initialization:", error);
            // Fallback to localStorage
            const saved = localStorage.getItem('coalition_products_v3');
            setProducts(saved ? JSON.parse(saved) : INITIAL_PRODUCTS);
        }
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase.from('products').select('*');
            if (error) throw error;

            if (data) {
                // Map DB columns to Product type
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
                    nft: item.nft_metadata
                }));
                setProducts(mappedProducts);
            }
        } catch (err) {
            console.error('Error fetching products:', err);
            // Fallback if fetch fails (e.g. table doesn't exist yet)
            const saved = localStorage.getItem('coalition_products_v3');
            setProducts(saved ? JSON.parse(saved) : INITIAL_PRODUCTS);
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
        if (user) {
            localStorage.setItem('coalition_current_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('coalition_current_user');
        }
    }, [user]);

    // If using localStorage fallback, persist products
    useEffect(() => {
        if (!isSupabaseConfigured) {
            localStorage.setItem('coalition_products_v3', JSON.stringify(products));
        }
    }, [products, isSupabaseConfigured]);

    const addProduct = async (p: Product) => {
        if (isSupabaseConfigured) {
            const dbProduct = {
                id: p.id,
                name: p.name,
                price: p.price,
                stock: p.stock,
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
                // Optimistic update or wait for subscription
                setProducts(prev => [...prev, p]);
                // Auto-commit the change
                await autoCommit({ message: generateProductAddedMessage(p.name) });
            }
        } else {
            setProducts(prev => [...prev, p]);
            // Auto-commit the change
            await autoCommit({ message: generateProductAddedMessage(p.name) });
        }
    };

    const updateProduct = async (updated: Product) => {
        if (isSupabaseConfigured) {
            const dbProduct = {
                name: updated.name,
                price: updated.price,
                stock: updated.stock,
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
                // Auto-commit the change
                await autoCommit({ message: generateProductUpdatedMessage(updated.name) });
            }
        } else {
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            // Auto-commit the change
            await autoCommit({ message: generateProductUpdatedMessage(updated.name) });
        }
    };

    const deleteProduct = async (id: string) => {
        // Get product name before deleting for commit message
        const product = products.find(p => p.id === id);
        const productName = product?.name || id;

        if (isSupabaseConfigured) {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) {
                console.error('Error deleting product:', error);
                alert('Failed to delete product from database');
            } else {
                setProducts(prev => prev.filter(p => p.id !== id));
                // Auto-commit the change
                await autoCommit({ message: generateProductDeletedMessage(productName) });
            }
        } else {
            setProducts(prev => prev.filter(p => p.id !== id));
            // Auto-commit the change
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
            // Use first image for cart item
            return [...prev, { ...product, selectedSize: size, quantity: 1, cartId: Math.random().toString(36).substr(2, 9) }];
        });
        setCartOpen(true);
    };

    const removeFromCart = (cartId: string) => {
        setCart(prev => prev.filter(item => item.cartId !== cartId));
    };

    const toggleFavorite = (pid: string) => {
        if (!user) return;
        const isFav = user.favorites.includes(pid);
        const newFavs = isFav ? user.favorites.filter(id => id !== pid) : [pid, ...user.favorites];
        const updatedUser = { ...user, favorites: newFavs };
        setUser(updatedUser);
        // Persist favorites per user
        localStorage.setItem(`coalition_favorites_${user.uid}`, JSON.stringify(newFavs));
    };

    const login = async (provider: AuthProvider, userId?: string) => {
        // Mock Login Logic
        if (provider === AuthProvider.GOOGLE) {
            // If userId provided, find that specific user
            if (userId) {
                const selectedUser = MOCK_USERS.find(u => u.uid === userId);
                if (selectedUser) {
                    // Load user's saved favorites from localStorage
                    const savedFavorites = localStorage.getItem(`coalition_favorites_${userId}`);
                    setUser({
                        ...selectedUser,
                        favorites: savedFavorites ? JSON.parse(savedFavorites) : []
                    });
                }
            } else {
                // Default to first user if no selection (shouldn't happen with new UI)
                const savedFavorites = localStorage.getItem(`coalition_favorites_${MOCK_USERS[0].uid}`);
                setUser({
                    ...MOCK_USERS[0],
                    favorites: savedFavorites ? JSON.parse(savedFavorites) : []
                });
            }
        } else if (provider === AuthProvider.METAMASK) {
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

    const loginUser = login; // Alias for consistency

    const logout = () => {
        setUser(null);
        setIsAdminMode(false);
    };

    const updateUser = (data: Partial<UserProfile>) => {
        if (user) {
            setUser({ ...user, ...data });
        }
    };

    const clearCart = () => {
        setCart([]);
    };

    const loginAdmin = (password: string) => {
        if (password === 'admin123') {
            setIsAdminMode(true);
            return true;
        }
        return false;
    };

    const logoutAdmin = () => {
        setIsAdminMode(false);
    };

    const cartTotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const calculateReward = (total: number) => {
        return Math.floor(total * COIN_REWARD_RATE);
    };

    // Order Management Functions
    const generateOrderNumber = (): string => {
        const orderCount = orders.length + 1;
        return `ORD-${String(orderCount).padStart(4, '0')}`;
    };

    const addOrder = async (order: Order) => {
        try {
            setOrders(prev => [...prev, order]);

            // Deduct inventory for the order
            await deductInventory(order.items);

            console.log('Order added successfully:', order.orderNumber);
        } catch (error) {
            console.error('Error adding order:', error);
            throw error;
        }
    };

    const updateOrder = async (order: Order) => {
        try {
            setOrders(prev => prev.map(o => o.id === order.id ? order : o));
            console.log('Order updated successfully:', order.orderNumber);
        } catch (error) {
            console.error('Error updating order:', error);
            throw error;
        }
    };

    const deleteOrder = async (orderId: string) => {
        try {
            setOrders(prev => prev.filter(o => o.id !== orderId));
            console.log('Order deleted successfully');
        } catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    };

    const getOrderById = (orderId: string): Order | undefined => {
        return orders.find(o => o.id === orderId);
    };

    const deductInventory = async (items: OrderItem[]) => {
        try {
            const updatedProducts = products.map(product => {
                // Find if this product has items in the order
                const orderItems = items.filter(item => item.productId === product.id);

                if (orderItems.length === 0) return product;

                // Create a copy of sizeInventory
                const newSizeInventory = { ...(product.sizeInventory || {}) };

                // Deduct quantities for each size
                orderItems.forEach(item => {
                    const currentStock = newSizeInventory[item.selectedSize] || 0;
                    newSizeInventory[item.selectedSize] = Math.max(0, currentStock - item.quantity);
                });

                return {
                    ...product,
                    sizeInventory: newSizeInventory
                };
            });

            setProducts(updatedProducts);

            // If using Supabase, update there too
            if (isSupabaseConfigured) {
                for (const product of updatedProducts) {
                    const matchingProduct = products.find(p => p.id === product.id);
                    if (matchingProduct && JSON.stringify(matchingProduct.sizeInventory) !== JSON.stringify(product.sizeInventory)) {
                        await updateProduct(product);
                    }
                }
            }

            console.log('Inventory deducted successfully');
        } catch (error) {
            console.error('Error deducting inventory:', error);
            throw error;
        }
    };


    return (
        <AppContext.Provider value={{
            products, cart, user, sections, orders, isCartOpen, isAdminMode, isSupabaseConfigured,
            addProduct, updateProduct, deleteProduct, addToCart, removeFromCart, clearCart,
            toggleFavorite, login, loginUser, logout, updateUser, setCartOpen, loginAdmin, logoutAdmin, updateSections, updateSection,
            cartTotal, calculateReward,
            addOrder, updateOrder, deleteOrder, getOrderById, deductInventory, generateOrderNumber
        }}>
            {children}
        </AppContext.Provider>
    );
};
