// tests/adminSurfaceHarness.test.tsx
//
// Self-test for tests/_helpers/adminSurface.tsx.
//
// The harness exists to make one class of failure impossible: an admin test
// that renders a surface without stubbing AppContext/ToastContext. A helper
// that merely *offers* the stubs does not achieve that, so these assertions
// pin the mechanism, not the convenience:
//
//   1. A surface that reads BOTH contexts mounts with no `vi.mock` for either
//      and no provider anywhere. AdminLayout reads `useApp().logoutAdmin` and
//      `useToast().addToast`; it is the component whose new useToast() call
//      broke two admin tests.
//   2. A test's `mockAppContext` override reaches the component (the Logout
//      control calls the stub the test installed), and a test that configures
//      nothing gets the baseline value with a no-op logout.
//   3. The toast sink a surface reports to IS the `addToast` this module
//      exports, so an assertion on it is an assertion on the component.
//   4. One surface per test: a second render unmounts the first, and the
//      automatic afterEach leaves `document.body` clean for the next test.
//   5. A surface that resolves the REAL context anyway (what a static import
//      produces) fails with a message that names the fix. The separate
//      "stubs missing" path has its own file, adminSurfaceMissingStubs.
//
// Nothing here imports the mocked contexts — the surface must arrive through
// the loader, and the two `vi.doMock` lines below are exactly what the harness
// header says a test file supplies. If the harness ever stopped needing them,
// this file would fail.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

import {
    addToast,
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    setAdminUser,
    toastContextStub,
    useAppMock,
} from './_helpers/adminSurface';

// The canonical registration pair: module scope, before any render.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const loadAdminLayout = () => import('../components/admin/AdminLayout');

const copyButton = (container: HTMLElement, label: string) =>
    container.querySelector(`button[aria-label="Copy link to ${label}"]`) as HTMLButtonElement | null;

const buttonByText = (container: HTMLElement, text: string) =>
    [...container.querySelectorAll('button')]
        .find((button) => (button.textContent ?? '').includes(text)) as HTMLButtonElement | undefined;

/** The value the last `useApp()` call handed back, as the component saw it. */
const lastAppValue = () =>
    useAppMock.mock.results.at(-1)?.value as
        | { user?: { uid?: string }; logoutAdmin?: () => void }
        | undefined;

describe('adminSurface harness', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mounts a surface that reads both contexts, with no provider and no vi.mock', async () => {
        const { container } = await renderAdminSurface(loadAdminLayout, {
            initialEntries: ['/admin?tab=orders'],
            props: { activeTab: 'orders', children: 'layout-body' },
        });

        // Both of AdminLayout's hook reads resolved: the sidebar rendered, the
        // child mounted, and the child string is the one this test passed.
        expect(container.querySelector('a[href="/admin?tab=orders"]')).not.toBeNull();
        expect(container.textContent).toContain('layout-body');
        expect(useAppMock).toHaveBeenCalled();
    });

    it('carries the baseline admin, so a test that configures nothing still gets one', async () => {
        await renderAdminSurface(loadAdminLayout, {
            initialEntries: ['/admin'],
            props: { activeTab: 'orders', children: null },
        });

        expect(lastAppValue()?.user?.uid).toBe('admin-test-user');
        // The baseline is a no-op, not a crash waiting for the first logout.
        expect(typeof lastAppValue()?.logoutAdmin).toBe('function');
    });

    it('hands a test\'s own stub to the component', async () => {
        const logoutAdmin = vi.fn();
        mockAppContext({ logoutAdmin });

        const { container } = await renderAdminSurface(loadAdminLayout, {
            initialEntries: ['/admin'],
            props: { activeTab: 'orders', children: null },
        });

        const logout = buttonByText(container, 'Logout');
        expect(logout).toBeDefined();
        await act(async () => { logout!.click(); });

        expect(logoutAdmin).toHaveBeenCalledTimes(1);
    });

    it('reinstalls the baseline after a test wipes every mock', async () => {
        // A test file whose own hooks call vi.resetAllMocks()/restoreAllMocks()
        // would otherwise leave useApp() returning undefined for the surface.
        setAdminUser({ uid: 'stale-override' });
        vi.resetAllMocks();

        await renderAdminSurface(loadAdminLayout, {
            initialEntries: ['/admin'],
            props: { activeTab: 'orders', children: null },
        });

        expect(lastAppValue()?.user?.uid).toBe('admin-test-user');
        expect(typeof lastAppValue()?.logoutAdmin).toBe('function');
    });

    it('starts the next test from the baseline again, not the previous override', async () => {
        await renderAdminSurface(loadAdminLayout, {
            initialEntries: ['/admin'],
            props: { activeTab: 'orders', children: null },
        });

        expect(lastAppValue()?.user?.uid).toBe('admin-test-user');
    });

    it('reports through the exported addToast spy', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn(async () => { throw new Error('NotAllowedError'); }) },
        });
        try {
            const { container } = await renderAdminSurface(loadAdminLayout, {
                initialEntries: ['/admin'],
                props: { activeTab: 'orders', children: null },
            });

            const button = copyButton(container, 'Products');
            expect(button).not.toBeNull();
            await act(async () => { button!.click(); });

            expect(addToast).toHaveBeenCalledWith(
                'Could not copy the link. Open it from the address bar instead.',
                'error',
            );
        } finally {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        }
    });

    it('keeps one live surface per test: a second render unmounts the first', async () => {
        const first = await renderAdminSurface(loadAdminLayout, {
            initialEntries: ['/admin'],
            props: { activeTab: 'orders', children: 'first-surface' },
        });
        expect(first.container.parentNode).toBe(document.body);

        const second = await renderAdminSurface(loadAdminLayout, {
            initialEntries: ['/admin'],
            props: { activeTab: 'orders', children: 'second-surface' },
        });

        expect(first.container.parentNode).toBeNull();
        expect(second.container.parentNode).toBe(document.body);
        expect(document.body.textContent).not.toContain('first-surface');
    });

    it('names the fix when a surface reaches the real context anyway', async () => {
        // Stands in for a test that imported the component statically, so its
        // own ToastContext binding is the real one.
        const real = await vi.importActual<typeof import('../context/ToastContext')>(
            '../context/ToastContext',
        );
        const UnstubbedSurface = () => {
            real.useToast();
            return null;
        };

        await expect(
            renderAdminSurface(async () => ({ default: UnstubbedSurface })),
        ).rejects.toThrow(/pass it as a loader/);

        // The failed mount is cleaned up too, not left in the document.
        expect(document.body.childElementCount).toBe(0);
    });

    it('leaves document.body clean for the next test (automatic afterEach)', () => {
        // Every test above mounted a surface; if the registered afterEach did
        // not unmount and remove it, its container would still be here.
        expect(document.body.childElementCount).toBe(0);
    });
});
