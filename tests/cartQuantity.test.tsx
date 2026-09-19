// tests/cartQuantity.test.tsx
//
// Locks the quantity rules that context/useCart.ts owns, now that a shopper can
// set them directly from the product page, /cart and the drawer:
//
//   - addToCart(product, size, options, quantity) adds that many as ONE line
//   - omitting the quantity keeps the old one-at-a-time behaviour, so the five
//     pre-existing callers (ProductCard, upsells, frequently-bought, both
//     product pages) are unchanged
//   - setQuantity clamps to [1, MAX_CART_QUANTITY]: stepping below 1 must NOT
//     delete a line by surprise (Remove stays the explicit path)
//   - writes land in localStorage synchronously, because checkout reloads the
//     page for the Stripe 3DS/Klarna round-trip
//   - the same product in a different size stays its own line
//
// Renders the hook directly (no AppContext) via the established
// createRoot + act pattern, so a failure points at the cart rules themselves.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCart, getLineMaxQuantity, MAX_CART_QUANTITY } from '../context/useCart';
import { Product } from '../types';

const tee = (over: Partial<Product> = {}): Product => ({
    id: 'prod_tee',
    name: 'COALITION TEE',
    price: 75,
    images: ['tee.jpg'],
    description: '',
    category: 'shirt',
    sizes: ['M', 'L'],
    sizeInventory: { M: 5, L: 1 },
    ...over,
});

let api: ReturnType<typeof useCart>;
const Probe = () => {
    api = useCart();
    return null;
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
        root.render(createElement(Probe));
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    localStorage.clear();
});

const run = async (fn: () => void): Promise<void> => {
    await act(async () => {
        fn();
    });
};

const storedCart = (): Array<{ quantity: number; selectedSize: string }> =>
    JSON.parse(localStorage.getItem('coalition_cart') || '[]');

describe('cart quantity', () => {
    it('adds the requested quantity as a single line', async () => {
        await run(() => api.addToCart(tee(), 'M', undefined, 2));

        expect(api.cart).toHaveLength(1);
        expect(api.cart[0].quantity).toBe(2);
    });

    it('still adds one at a time when no quantity is passed', async () => {
        await run(() => api.addToCart(tee(), 'M'));
        await run(() => api.addToCart(tee(), 'M'));

        expect(api.cart).toHaveLength(1);
        expect(api.cart[0].quantity).toBe(2);
    });

    it('folds a quantity add into the matching line instead of duplicating it', async () => {
        await run(() => api.addToCart(tee(), 'M'));
        await run(() => api.addToCart(tee(), 'M', undefined, 3));

        expect(api.cart).toHaveLength(1);
        expect(api.cart[0].quantity).toBe(4);
    });

    it('keeps the same product in another size as its own line', async () => {
        await run(() => api.addToCart(tee(), 'M', undefined, 2));
        await run(() => api.addToCart(tee(), 'L', undefined, 1));

        expect(api.cart).toHaveLength(2);
        expect(api.cart.map((i) => i.selectedSize).sort()).toEqual(['L', 'M']);
    });

    it('clamps setQuantity to at least 1 so stepping down cannot delete a line', async () => {
        await run(() => api.addToCart(tee(), 'M', undefined, 2));
        const cartId = api.cart[0].cartId;

        await run(() => api.setQuantity(cartId, 0));
        expect(api.cart).toHaveLength(1);
        expect(api.cart[0].quantity).toBe(1);

        await run(() => api.setQuantity(cartId, -4));
        expect(api.cart[0].quantity).toBe(1);
    });

    it('clamps setQuantity to the hard ceiling', async () => {
        await run(() => api.addToCart(tee(), 'M'));
        await run(() => api.setQuantity(api.cart[0].cartId, 10_000));

        expect(api.cart[0].quantity).toBe(MAX_CART_QUANTITY);
    });

    it('persists the new quantity synchronously for the checkout reload', async () => {
        await run(() => api.addToCart(tee(), 'M', undefined, 2));
        await run(() => api.setQuantity(api.cart[0].cartId, 3));

        expect(storedCart()).toHaveLength(1);
        expect(storedCart()[0].quantity).toBe(3);
    });

    it('caps a line at the stock left in its size, and falls back when unknown', () => {
        expect(getLineMaxQuantity({ selectedSize: 'L', sizeInventory: { M: 5, L: 1 } })).toBe(1);
        expect(getLineMaxQuantity({ selectedSize: 'M', sizeInventory: { M: 5, L: 1 } })).toBe(5);
        // No inventory numbers at all: bounded by the cart ceiling only.
        expect(getLineMaxQuantity({ selectedSize: 'M' })).toBe(MAX_CART_QUANTITY);
        // A size missing from the map must not read as zero.
        expect(getLineMaxQuantity({ selectedSize: 'XL', sizeInventory: { M: 5 } })).toBe(MAX_CART_QUANTITY);
    });
});
