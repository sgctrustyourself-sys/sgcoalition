// tests/adminTabLinks.test.tsx
//
// Locks the link-to-tab contract for the admin sidebar:
//   1. Every sidebar entry renders as a real <a href="/admin?tab=...">, so it
//      can be bookmarked, copied, or opened in a new tab.
//   2. ?tab=<id> on load opens that tab — the URL is the source of truth, not a
//      one-shot mount seed.
//   3. Clicking a sidebar link changes both the rendered tab and the URL.
//   4. The legacy ?q= order-search seed is still consumed without dropping the
//      tab from the URL.
//
// Mounting goes through tests/_helpers/adminSurface.tsx — it owns the
// AppContext/ToastContext stubs, the MemoryRouter and the teardown, so this
// file carries no context mocks to forget. The three modules the test lands on
// are still mocked here, and the rest never load.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { useLocation } from 'react-router-dom';
import { ADMIN_TABS } from '../components/admin/adminTabs';

import {
    appContextStub,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';

// The harness cannot register these for us — vitest scopes module mocks to the
// file that calls them (see the harness header). Two lines, once per file.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

vi.mock('../components/admin/EcosystemCommandCenter', () => ({
    default: () => <div>command-center-body</div>,
}));
vi.mock('../components/admin/ProductManager', () => ({
    default: () => <div>products-body</div>,
}));
vi.mock('../components/admin/OrderManager', () => ({
    default: () => <div>orders-body</div>,
}));

let lastSearch = '';
const LocationProbe = () => {
    lastSearch = useLocation().search;
    return null;
};

describe('admin sidebar link-to-tab', () => {
    const renderAt = async (entry: string) => {
        const surface = await renderAdminSurface(() => import('../pages/Admin'), {
            initialEntries: [entry],
            prepend: createElement(LocationProbe),
            // Lazy chunks resolve inside the harness, which flushes Suspense
            // before returning.
        });
        return surface;
    };

    beforeEach(() => {
        sessionStorage.clear();
        lastSearch = '';
    });

    it('renders every sidebar item as a /admin?tab= link', async () => {
        const { container } = await renderAt('/admin');

        const hrefs = [...container.querySelectorAll('a[href^="/admin?tab="]')]
            .map((a) => a.getAttribute('href'))
            .sort();

        expect(hrefs).toEqual(ADMIN_TABS.map((tab) => `/admin?tab=${tab}`).sort());
    });

    it('opens the tab named in the URL, so a bookmark reopens the same tab', async () => {
        const { container } = await renderAt('/admin?tab=orders');

        expect(container.innerHTML).toContain('orders-body');
        expect(lastSearch).toBe('?tab=orders');
        expect(container.querySelector('a[aria-current="page"]')?.getAttribute('href'))
            .toBe('/admin?tab=orders');
    });

    it('clicking a sidebar link switches the tab and updates the URL', async () => {
        const { container } = await renderAt('/admin?tab=orders');

        const productsLink = container.querySelector('a[href="/admin?tab=products"]');
        expect(productsLink).not.toBeNull();

        await act(async () => {
            (productsLink as HTMLAnchorElement).click();
        });
        await act(async () => {});

        expect(lastSearch).toBe('?tab=products');
        expect(container.innerHTML).toContain('products-body');
        expect(container.innerHTML).not.toContain('orders-body');
        expect(container.querySelector('a[aria-current="page"]')?.getAttribute('href'))
            .toBe('/admin?tab=products');
    });

    it('consumes the ?q= order seed but keeps ?tab= in the URL', async () => {
        const { container } = await renderAt('/admin?tab=orders&q=order_123');

        expect(sessionStorage.getItem('admin_order_search')).toBe('order_123');
        expect(lastSearch).toBe('?tab=orders');
        expect(container.innerHTML).toContain('orders-body');
    });

    it('falls back to the Command Center for an unknown tab id', async () => {
        const { container } = await renderAt('/admin?tab=not-a-tab');

        expect(container.innerHTML).toContain('command-center-body');
    });
});
