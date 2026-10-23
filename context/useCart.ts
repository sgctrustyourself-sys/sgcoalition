import { useState } from 'react';
import { Product, CartItem } from '../types';
import { getCartItemLineTotal } from '../utils/walletAddOns';
import { safeJsonParse } from '../utils/storage';

const CART_STORAGE_KEY = 'coalition_cart';

/**
 * Upper bound for a single line. Below stock ceilings on purpose: it exists to
 * stop a fat-fingered or scripted quantity from reaching Stripe, not to model
 * inventory (the product page and cart cap by size stock on top of this).
 */
export const MAX_CART_QUANTITY = 99;

const clampQuantity = (value: number): number => {
    if (!Number.isFinite(value)) return 1;
    return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(value)));
};

const persistCart = (cart: CartItem[]) => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
        console.warn('[cart] failed to persist cart:', e);
    }
};

/**
 * Ceiling for one cart line: the stock left in that line's size, or the hard
 * cart maximum when the product carries no inventory numbers (upstream may not
 * track stock at all). Shared by /cart and the drawer so the two surfaces can't
 * disagree about the limit.
 */
export const getLineMaxQuantity = (item: Pick<CartItem, 'sizeInventory' | 'selectedSize'>): number => {
    const stock = Number(item.sizeInventory?.[item.selectedSize]);
    return Number.isFinite(stock) && stock > 0 ? Math.min(stock, MAX_CART_QUANTITY) : MAX_CART_QUANTITY;
};

export function useCart() {
    // Lazy-init from localStorage so a refresh restores the cart on any device.
    // Written SYNCHRONOUSLY on every mutation (not via useEffect) so the cart
    // survives even a hard page reload mid-flow — e.g. the Stripe 3DS/Klarna
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

    /**
     * Add a line, or fold into the matching one (same product, size and clip-on
     * choice). `quantity` lets the product page add several at once; omitting it
     * keeps the original one-at-a-time behavior every existing caller relies on.
     */
    const addToCart = (product: Product, size: string, options?: { keychainClipOn?: boolean }, quantity = 1) => {
        const qty = clampQuantity(quantity);
        updateCart(prev => {
            const kco = Boolean(options?.keychainClipOn && product.category === 'wallet');
            const existing = prev.find(item => item.id === product.id && item.selectedSize === size && Boolean(item.keychainClipOn) === kco);
            if (existing) return prev.map(item => item.cartId === existing.cartId ? { ...item, quantity: clampQuantity(item.quantity + qty) } : item);
            return [...prev, { ...product, selectedSize: size, quantity: qty, cartId: Math.random().toString(36).substr(2, 9), keychainClipOn: kco }];
        });
        setCartOpen(true);
    };

    /**
     * Set one line's quantity — the write path behind the steppers on the
     * product page, /cart and the drawer. Clamped to [1, MAX_CART_QUANTITY];
     * dropping to 0 deliberately does NOT remove the line, so a shopper can't
     * delete an item by holding the minus button (Remove stays explicit).
     */
    const setQuantity = (cartId: string, quantity: number) => {
        const qty = clampQuantity(quantity);
        updateCart(prev => prev.map(item => (item.cartId === cartId ? { ...item, quantity: qty } : item)));
    };
    const removeFromCart = (cartId: string) => updateCart(prev => prev.filter(item => item.cartId !== cartId));
    const clearCart = () => {
        setCart([]);
        try { localStorage.removeItem(CART_STORAGE_KEY); } catch (e) { /* ignore */ }
    };
    const cartTotal = () => cart.reduce((sum, item) => sum + getCartItemLineTotal(item), 0);

    return { cart, isCartOpen, setCartOpen, addToCart, setQuantity, removeFromCart, clearCart, cartTotal };
}
