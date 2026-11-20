// tests/adminMobileMenuKeyboard.test.tsx
//
// Locks the keyboard contract of the admin mobile menu:
//   1. The icon-only toggle has an accessible name and reports open state via
//      aria-expanded / aria-controls.
//   2. Escape closes the open menu.
//   3. Focus returns to the toggle the menu was opened from, including when
//      Escape is pressed from a link inside the menu — a keyboard user is never
//      left focused on an unmounted element.
//
// Mounting goes through tests/_helpers/adminSurface.tsx, which owns the
// AppContext/ToastContext stubs and the container lifecycle: AdminLayout reads
// both contexts, and this file no longer has to remember either. Only the
// default tab's lazy chunk resolves, so only it is mocked alongside.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';

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

const renderAdmin = () =>
    renderAdminSurface(() => import('../pages/Admin'), { initialEntries: ['/admin'] });

describe('admin mobile menu keyboard support', () => {
    let container: HTMLElement;

    // Selector is label-independent: the label flips between open and closed.
    const toggleEl = () =>
        container.querySelector('button[aria-controls="admin-mobile-menu"]') as HTMLButtonElement | null;

    const openMenu = async () => {
        const toggle = toggleEl();
        expect(toggle).not.toBeNull();
        await act(async () => { (toggle as HTMLButtonElement).click(); });
    };

    const pressEscape = async () => {
        await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
    };

    // jsdom implements no real Tab navigation, so the trap is exercised by
    // firing the keydown at the boundary element and checking both the focus
    // move and that the native default was suppressed.
    const pressTab = async (shiftKey = false) => {
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
        await act(async () => { document.dispatchEvent(event); });
        return event;
    };

    // The cycle the component enforces: the close toggle is the first stop,
    // then every link/button inside the panel, ending at Logout.
    const panel = () => container.querySelector('#admin-mobile-menu') as HTMLElement;
    const cycle = (): HTMLElement[] => [
        toggleEl() as HTMLButtonElement,
        ...(panel()?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []),
    ];

    beforeEach(() => {
        sessionStorage.clear();
    });

    it('labels the icon-only toggle and exposes menu state', async () => {
        ({ container } = await renderAdmin());

        const toggle = container.querySelector('button[aria-label="Open admin menu"]');
        expect(toggle).not.toBeNull();
        expect(toggle?.getAttribute('aria-expanded')).toBe('false');
        expect(toggle?.getAttribute('aria-controls')).toBe('admin-mobile-menu');

        await openMenu();

        const open = container.querySelector('button[aria-label="Close admin menu"]');
        expect(open).not.toBeNull();
        expect(open?.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('#admin-mobile-menu')).not.toBeNull();
    });

    it('Escape closes the menu and returns focus to the toggle', async () => {
        ({ container } = await renderAdmin());
        await openMenu();

        const toggle = toggleEl() as HTMLButtonElement;
        expect(container.querySelector('#admin-mobile-menu')).not.toBeNull();

        await pressEscape();

        expect(container.querySelector('#admin-mobile-menu')).toBeNull();
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(toggle);
    });

    it('moves focus into the menu when it opens', async () => {
        ({ container } = await renderAdmin());
        await openMenu();

        const firstInPanel = panel().querySelector('a[href], button') as HTMLElement;
        expect(firstInPanel).not.toBeNull();
        expect(document.activeElement).toBe(firstInPanel);
    });

    it('Tab at the end of the menu wraps to the first item and emits nothing past it', async () => {
        ({ container } = await renderAdmin());
        await openMenu();

        const items = cycle();
        const last = items[items.length - 1];
        const first = items[0];
        last.focus();

        const event = await pressTab();

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(first);
        expect(first).toBe(toggleEl());
    });

    it('Shift+Tab at the first item wraps back to the last', async () => {
        ({ container } = await renderAdmin());
        await openMenu();

        const items = cycle();
        const first = items[0];
        const last = items[items.length - 1];
        first.focus();

        const event = await pressTab(true);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(last);
    });

    it('pulls focus back in when it has escaped to the page behind the menu', async () => {
        ({ container } = await renderAdmin());
        await openMenu();

        // Stand-in for the page underneath the overlay: focusable, but not part
        // of the menu cycle.
        const outside = document.createElement('button');
        outside.textContent = 'underneath';
        document.body.appendChild(outside);
        try {
            outside.focus();
            expect(document.activeElement).toBe(outside);

            const event = await pressTab();

            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(cycle()[0]);
        } finally {
            document.body.removeChild(outside);
        }
    });

    it('returns focus to the toggle when Escape is pressed from inside the menu', async () => {
        ({ container } = await renderAdmin());
        await openMenu();

        const firstLink = container.querySelector('#admin-mobile-menu a') as HTMLAnchorElement;
        expect(firstLink).not.toBeNull();
        firstLink.focus();
        expect(document.activeElement).toBe(firstLink);

        await pressEscape();

        const toggle = toggleEl() as HTMLButtonElement;
        expect(container.querySelector('#admin-mobile-menu')).toBeNull();
        expect(document.activeElement).toBe(toggle);
    });
});
