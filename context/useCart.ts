import { useState } from 'react';
import { Product, CartItem } from '../types';
import { getCartItemLineTotal } from '../utils/walletAddOns';
import { safeJsonParse } from '../utils/storage';

const CART_STORAGE_KEY = 'coalition_cart';

const persistCart = (cart: CartItem[]) => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
        console.warn('[cart] failed to persist cart:', e);
    }
};

export function useCart() {
    // Lazy-init from localStorage so a refresh restores the cart on any device.
    // Written SYNCHRONOUSLY on every mutation (not via useEffect) so the cart
    // survives even a hard page reload mid-flow — e.g. the PayPal Pay Later
    // redirect round-trip, which fully reloads the page. A useEffect-based
    // persist can lose data when the browser navigates away before React
    // flushes the effect.
    const [cart, setCart] = useState<CartItem[]>(() =>
        safeJsonParse(CART_STORAGE_KEY, [])
    );
    const [isCartOpen, setCartOpen] = useState(false);

    const updateCart = (updater: (prev: CartItem[]) => CartItem[]) => {
        setCart(prev => {
            const next = updater(prev);
            persistCart(next);
            return next;
        });
    };

    const addToCart = (product: Product, size: string, options?: { keychainClipOn?: boolean }) => {
        updateCart(prev => {
            const kco = Boolean(options?.keychainClipOn && product.category === 'wallet');
            const existing = prev.find(item => item.id === product.id && item.selectedSize === size && Boolean(item.keychainClipOn) === kco);
            if (existing) return prev.map(item => item.cartId === existing.cartId ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, { ...product, selectedSize: size, quantity: 1, cartId: Math.random().toString(36).substr(2, 9), keychainClipOn: kco }];
        });
        setCartOpen(true);
    };
    const removeFromCart = (cartId: string) => updateCart(prev => prev.filter(item => item.cartId !== cartId));
    const clearCart = () => {
        setCart([]);
        try { localStorage.removeItem(CART_STORAGE_KEY); } catch (e) { /* ignore */ }
    };
    const cartTotal = () => cart.reduce((sum, item) => sum + getCartItemLineTotal(item), 0);

    return { cart, isCartOpen, setCartOpen, addToCart, removeFromCart, clearCart, cartTotal };
}
