// tests/cartDrawerFocusTrap.test.tsx
//
// The cart drawer is a global overlay with no ref to the navbar button that
// opens it, so this file locks the two things that makes useFocusTrap's
// fallback responsible for:
//   1. While open, Tab cycles the drawer's own controls and cannot reach the
//      page behind it.
//   2. Escape closes the drawer (setCartOpen(false)) and returns focus to the
//      element that had focus when it opened.
//   3. While closed, nothing is trapped and the drawer renders nothing.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { CartItem } from '../types';

vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));

// Static imports BELOW the mock block so vitest hoists the factory first.
import { useApp } from '../context/AppContext';
import CartDrawer from '../components/CartDrawer';

const ITEM = {
    cartId: 'c1',
    id: 'p1',
    name: 'Pink Silver Crop Top',
    price: 45,
    quantity: 1,
    images: ['/images/pink-silver-crop-top-front.png'],
    selectedSize: 'M',
    sizeInventory: { M: 4 },
    keychainClipOn: false,
} as unknown as CartItem;

const setCartOpen = vi.fn();

interface HarnessProps {
    isCartOpen: boolean;
    cart?: CartItem[];
}

// The drawer taps many context helpers; only the ones it renders with matter
// here, and an empty cart still exercises the trap (close button as the sole
// stop) which is why the item-carrying case is the interesting one.
const Harness = ({ isCartOpen, cart = [ITEM] }: HarnessProps) => {
    vi.mocked(useApp).mockReturnValue({
        isCartOpen,
        setCartOpen,
        cart,
        setQuantity: vi.fn(),
        removeFromCart: vi.fn(),
        cartTotal: () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
        calculateReward: () => 12,
    } as unknown as ReturnType<typeof useApp>);

    return createElement(CartDrawer);
};

describe('CartDrawer focus trap', () => {
    let container: HTMLDivElement;
    let root: Root;
    let opener: HTMLButtonElement;

    const render = async (props: HarnessProps) => {
        await act(async () => {
            root.render(createElement(MemoryRouter, null, createElement(Harness, props)));
        });
    };

    const panel = () => container.querySelector('[role="dialog"]') as HTMLElement | null;
    const panelStops = () => [
        ...(panel()?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []),
    ];

    const press = async (key: string, shiftKey = false) => {
        const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
        await act(async () => { document.dispatchEvent(event); });
        return event;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Stand-in for the navbar cart button: the drawer never sees this node,
        // so focus return can only work via the hook's open-time fallback.
        opener = document.createElement('button');
        opener.textContent = 'Cart';
        document.body.appendChild(opener);
        opener.focus();

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        if (opener.parentNode === document.body) document.body.removeChild(opener);
        vi.restoreAllMocks();
    });

    it('renders only while open and moves focus into the drawer', async () => {
        await render({ isCartOpen: false });
        expect(panel()).toBeNull();

        await render({ isCartOpen: true });
        expect(panel()).not.toBeNull();
        expect(document.activeElement).toBe(panelStops()[0]);
    });

    it('reveals the drawer as a labelled modal dialog', async () => {
        await render({ isCartOpen: true });

        expect(panel()?.getAttribute('aria-modal')).toBe('true');
        expect(panel()?.getAttribute('aria-label')).toBe('Your Cart');
    });

    it('wraps Tab at the last stop instead of reaching the page behind it', async () => {
        await render({ isCartOpen: true });

        const stops = panelStops();
        expect(stops.length).toBeGreaterThan(1);
        const last = stops[stops.length - 1];
        last.focus();

        const event = await press('Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(stops[0]);
    });

    it('wraps Shift+Tab from the first stop to the last', async () => {
        await render({ isCartOpen: true });

        const stops = panelStops();
        stops[0].focus();

        const event = await press('Tab', true);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(stops[stops.length - 1]);
    });

    it('pulls focus back in when it has escaped to the page behind the drawer', async () => {
        await render({ isCartOpen: true });

        opener.focus();
        expect(document.activeElement).toBe(opener);

        const event = await press('Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(panelStops()[0]);
    });

    it('Escape closes the drawer and returns focus to whatever opened it', async () => {
        await render({ isCartOpen: true });

        const event = await press('Escape');

        expect(event.defaultPrevented).toBe(true);
        expect(setCartOpen).toHaveBeenCalledWith(false);
        expect(document.activeElement).toBe(opener);
    });

    it('leaves the keyboard alone once the drawer is closed', async () => {
        await render({ isCartOpen: false });

        const event = await press('Tab');

        expect(event.defaultPrevented).toBe(false);
        expect(setCartOpen).not.toHaveBeenCalled();
    });
});
