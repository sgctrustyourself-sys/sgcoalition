// tests/interactiveDialogAccessibleName.test.tsx
//
// Runtime half of the accessible-name guard, for the dialogs that are not
// mounted open: CartDrawer (drawer flag), CookieConsentBanner's preferences
// panel (Manage preferences), FloatingHelpButton (help button) and
// WishlistShare (Share Wishlist).
//
// Each test first proves no dialog is in the tree, then opens the surface the
// way a user does and asks the rendered DOM for its name. That distinction
// matters: these components can be mounted without any dialog at all, so a
// source-only check of `role="dialog" aria-label=...` could stay green while
// the label never reaches the open state (a conditional render bug, a prop
// dropped on the way, a label built from an empty string).
//
// Name computation is shared with tests/adminDialogAccessibleName.test.tsx via
// tests/_helpers/accessibleName.ts: aria-labelledby references first, then
// aria-label. The tests also assert the referenced id is not itself the name.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { accessibleName, dialogNames, dialogsNamed } from './_helpers/accessibleName';

// CartDrawer reads the cart out of AppContext. The other three surfaces don't,
// but the mock is file-wide and harmless.
vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));

// Static imports below the mock block so vitest hoists the factory first.
import { useApp } from '../context/AppContext';
import CartDrawer from '../components/CartDrawer';
import FilterPanel, { type FilterState } from '../components/FilterPanel';
import CookieConsentBanner from '../components/CookieConsentBanner';
import FloatingHelpButton from '../components/FloatingHelpButton';
import WishlistShare from '../components/WishlistShare';

// React's act() reads this global; without it every render logs the
// "not configured to support act(...)" warning to stderr.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/** Mount (or re-render) inside a router, which FloatingHelpButton requires. */
const render = async (node: ReactNode): Promise<HTMLDivElement> => {
    if (!root || !container) {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    }

    await act(async () => {
        root!.render(createElement(MemoryRouter, null, node));
    });

    return container;
};

const click = async (element: Element): Promise<void> => {
    await act(async () => {
        (element as HTMLElement).click();
    });
};

/** Exact trimmed text, so "Share Wishlist" cannot match "Share Your Wishlist". */
const buttonByText = (host: ParentNode, text: string): HTMLButtonElement => {
    const match = [...host.querySelectorAll('button')].find(
        (button) => (button.textContent || '').replace(/\s+/g, ' ').trim() === text,
    );
    expect(match, `no button labelled "${text}"`).toBeTruthy();
    return match as HTMLButtonElement;
};

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    if (container?.parentNode === document.body) document.body.removeChild(container);
    container = null;
});

describe('CartDrawer accessible name', () => {
    const cartValue = (isCartOpen: boolean) => ({
        isCartOpen,
        setCartOpen: vi.fn(),
        cart: [],
        setQuantity: vi.fn(),
        removeFromCart: vi.fn(),
        cartTotal: () => 0,
        calculateReward: () => 0,
    } as unknown as ReturnType<typeof useApp>);

    it('names the drawer only while it is open', async () => {
        vi.mocked(useApp).mockReturnValue(cartValue(false));
        const closed = await render(createElement(CartDrawer));
        expect(dialogNames(closed)).toEqual([]);

        vi.mocked(useApp).mockReturnValue(cartValue(true));
        const open = await render(createElement(CartDrawer));

        expect(dialogsNamed(open, 'Your Cart')).toHaveLength(1);
        expect(dialogNames(open)).toEqual(['Your Cart']);
    });
});

describe('FilterPanel accessible name', () => {
    const FILTERS: FilterState = {
        categories: [],
        priceMin: 0,
        priceMax: 1000,
        sizes: [],
        sortBy: 'newest',
    };

    it('names the mobile filter drawer and its close control once opened', async () => {
        const host = await render(
            createElement(FilterPanel, {
                filters: FILTERS,
                onFilterChange: vi.fn(),
                availableSizes: ['S'],
            }),
        );

        // The panel only takes a dialog role while the mobile drawer is open.
        expect(dialogNames(host)).toEqual([]);

        await click(buttonByText(host, 'Filters'));

        expect(dialogsNamed(host, 'Product filters')).toHaveLength(1);
        const close = host.querySelector('button[aria-label="Close modal"]');
        expect(close).toBeTruthy();
        expect(accessibleName(close!)).toBe('Close modal');
    });
});

describe('CookieConsentBanner preferences accessible name', () => {
    it('resolves the referenced title once Manage preferences is used', async () => {
        const host = await render(createElement(CookieConsentBanner));

        // The banner itself is a region, not a dialog.
        expect(dialogNames(host)).toEqual([]);

        await click(buttonByText(host, 'Manage preferences'));

        expect(dialogsNamed(host, 'Cookie settings')).toHaveLength(1);
        expect(dialogNames(host)).toEqual(['Cookie settings']);
        expect(dialogsNamed(host, 'cookie-preferences-title')).toHaveLength(0);
    });
});

describe('FloatingHelpButton accessible name', () => {
    it('resolves the referenced help title after opening', async () => {
        const host = await render(createElement(FloatingHelpButton));

        expect(dialogNames(host)).toEqual([]);

        const opener = host.querySelector<HTMLButtonElement>('button[aria-label="Open SGCoin Help"]');
        expect(opener).toBeTruthy();
        await click(opener!);

        expect(dialogsNamed(host, 'SGCoin Help')).toHaveLength(1);
        expect(dialogNames(host)).toEqual(['SGCoin Help']);
        expect(dialogsNamed(host, 'sgcoin-help-title')).toHaveLength(0);
    });
});

describe('WishlistShare accessible name', () => {
    it('carries its label once Share Wishlist opens the panel', async () => {
        const host = await render(
            createElement(WishlistShare, { favoriteIds: ['p1', 'p2'] }),
        );

        expect(dialogNames(host)).toEqual([]);

        await click(buttonByText(host, 'Share Wishlist'));

        expect(dialogsNamed(host, 'Share your wishlist')).toHaveLength(1);
        expect(dialogNames(host)).toEqual(['Share your wishlist']);

        const close = host.querySelector('button[aria-label="Close modal"]');
        expect(close).toBeTruthy();
        expect(accessibleName(close!)).toBe('Close modal');
    });
});
