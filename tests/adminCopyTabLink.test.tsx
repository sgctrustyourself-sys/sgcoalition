// tests/adminCopyTabLink.test.tsx
//
// Locks the copy-link affordance beside each admin sidebar item:
//   1. Every sidebar row has a copy button, rendered as a sibling of the link
//      (never nested inside the anchor, which would be invalid HTML).
//   2. Clicking it copies that row's absolute /admin?tab=<id> URL — not the URL
//      already in the address bar — without navigating.
//   3. The button confirms with a check state, announces it via role="status",
//      and reverts after its timer.
//   4. The mobile menu rows carry the same action.
//   5. Availability follows the async Clipboard API: no buttons without a
//      writeText function, and no false confirmation when it is rejected.
//
// Mounting goes through tests/_helpers/adminSurface.tsx, which owns the
// AppContext/ToastContext stubs (AdminLayout reads both), the MemoryRouter and
// the teardown. The toast sink is the harness's `addToast`, so the failure
// assertion below is an assertion on the component.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { ADMIN_TABS } from '../components/admin/adminTabs';

import {
    addToast,
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
vi.mock('../components/admin/OrderManager', () => ({
    default: () => <div>orders-body</div>,
}));

const writeText = vi.fn(async () => undefined);

describe('admin sidebar copy-link buttons', () => {
    const renderAdmin = (entry = '/admin?tab=orders') =>
        renderAdminSurface(() => import('../pages/Admin'), { initialEntries: [entry] });

    const copyButton = (container: HTMLElement, label: string) =>
        container.querySelector(`button[aria-label="Copy link to ${label}"]`) as HTMLButtonElement | null;

    beforeEach(() => {
        writeText.mockClear();
        sessionStorage.clear();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        vi.useRealTimers();
    });

    it('renders a copy button beside every sidebar link, outside the anchor', async () => {
        const { container } = await renderAdmin();

        const buttons = [...container.querySelectorAll('button[aria-label^="Copy link to "]')];
        expect(buttons).toHaveLength(ADMIN_TABS.length);
        for (const button of buttons) expect(button.closest('a')).toBeNull();
    });

    it('copies that tab\'s URL without navigating, then reverts the confirmation', async () => {
        const { container } = await renderAdmin('/admin?tab=orders');

        vi.useFakeTimers();
        // A successful copy must not raise an error toast.
        expect(addToast).not.toHaveBeenCalled();
        const button = copyButton(container, 'Products');
        expect(button).not.toBeNull();

        await act(async () => { (button as HTMLButtonElement).click(); });

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/admin?tab=products`);
        // Clicking copy must not switch tabs.
        expect(container.innerHTML).toContain('orders-body');
        expect(container.querySelector('button[aria-label="Copied link to Products"]')).not.toBeNull();
        expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied link to Products');

        await act(async () => { vi.advanceTimersByTime(1700); });

        expect(container.querySelector('button[aria-label="Copy link to Products"]')).not.toBeNull();
        expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    });

    it('shows no copy buttons when the Clipboard API is unavailable', async () => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        const { container } = await renderAdmin();

        expect(container.querySelectorAll('button[aria-label^="Copy link to "]')).toHaveLength(0);
    });

    it('does not confirm a copy that the browser rejected', async () => {
        writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
        const { container } = await renderAdmin();

        const button = copyButton(container, 'Products') as HTMLButtonElement;
        await act(async () => { button.click(); });

        expect(writeText).toHaveBeenCalledTimes(1);
        // Still the resting label: no check, no live-region announcement.
        expect(container.querySelector('button[aria-label="Copy link to Products"]')).not.toBeNull();
        expect(container.querySelector('[role="status"]')?.textContent).toBe('');
        // And the failure is reported rather than swallowed.
        expect(addToast).toHaveBeenCalledTimes(1);
        expect(addToast).toHaveBeenCalledWith(
            'Could not copy the link. Open it from the address bar instead.',
            'error',
        );
    });

    it('offers the same copy action inside the mobile menu', async () => {
        const { container } = await renderAdmin('/admin?tab=orders');

        const toggle = container.querySelector('button[aria-controls="admin-mobile-menu"]') as HTMLButtonElement;
        await act(async () => { toggle.click(); });

        const menuButtons = [
            ...container.querySelectorAll('#admin-mobile-menu button[aria-label^="Copy link to "]'),
        ];
        expect(menuButtons).toHaveLength(ADMIN_TABS.length);

        const mobileOrders = container.querySelector(
            '#admin-mobile-menu button[aria-label="Copy link to Orders"]',
        ) as HTMLButtonElement;
        await act(async () => { mobileOrders.click(); });

        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/admin?tab=orders`);
    });
});
