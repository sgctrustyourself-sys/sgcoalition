// tests/modalFocusTrap.test.tsx
//
// Escape + focus containment for the three dialogs that adopt useFocusTrap in
// this change: ConfirmationModal (admin money gates), CustomerLinkModal (the
// customer preview stacked above the order detail modal) and ImageCropperModal
// (the cropper behind every upload path).
//
// Each one is a dialog that covers the page, so "the keyboard belongs to it" is
// a claim worth locking per component rather than trusting the hook's own test:
//
//   1. Focus moves INTO the dialog on open — otherwise the first Tab starts from
//      somewhere behind the overlay, and a keyboard user is typing into a page
//      they cannot see.
//   2. Escape calls the component's own close handler and returns focus to the
//      element that had it (the button that opened the dialog), which is what
//      makes the overlay keyboard-reversible.
//   3. Tab wraps instead of walking into the page underneath.
//   4. ConfirmationModal additionally refuses to dismiss while `isLoading`: the
//      confirmed action is in flight and its close controls are disabled, so
//      Escape must neither close the dialog nor move focus out of it. That is
//      why its trap is mounted with `active: isOpen && !isLoading` — a trap left
//      running with a no-op handler would still restore focus on Escape.
//
// The hook is the real one (not mocked): the point of these tests is that each
// component wired it correctly, and the selector the components cycle is
// imported from the hook rather than re-typed, so a stop added here is a stop
// the hook counts too.
//
// Mounting goes through tests/_helpers/adminSurface.tsx, which owns the
// AppContext/ToastContext stub registration, the container/root pair and the
// teardown.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { FOCUSABLE_SELECTOR } from '../hooks/useFocusTrap';
import {
    appContextStub,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';

// CustomerLinkModal resolves its data through these two builders; the trap does
// not depend on the answer, so the mocks only have to settle (a pending promise
// would leave the modal in its loading state, which has its own stops).
const mockedProfileBuilder = vi.fn();
const mockedGuestBuilder = vi.fn();

vi.mock('../utils/customerProfile', () => ({
    buildCustomerProfile: (...a: unknown[]) => mockedProfileBuilder(...a),
    buildCustomerProfileByEmail: (...a: unknown[]) => mockedGuestBuilder(...a),
}));

// Type-only: each dialog is reached through a loader below, so nothing here
// resolves a module before the harness has checked the context stubs.
import type ConfirmationModal from '../components/admin/ConfirmationModal';
import type CustomerLinkModal from '../components/admin/CustomerLinkModal';
import type ImageCropperModal from '../components/ui/ImageCropperModal';

const GUEST_PROFILE = {
    email: 'guest@buyer.com',
    orderCount: 2,
    totalSpend: 175,
    firstOrderDate: '2026-02-01T00:00:00Z',
    lastOrderDate: '2026-07-09T00:00:00Z',
    isVerifiedBuyer: true,
};

const press = async (key: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(event); });
    return event;
};

/** The tab stops the hook itself would cycle, in document order. */
const stopsWithin = (scope: HTMLElement): HTMLElement[] =>
    [...scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];

// The harness cannot register the contexts for us — vitest scopes module mocks
// to the file that calls them (see the harness header). Two lines, once per
// file, and every dialog arrives as a loader so it resolves against them. The
// cropper is a general UI component, but it is mounted the same way so the file
// keeps one root, one teardown and one stub contract.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const loadConfirmationModal = () => import('../components/admin/ConfirmationModal');
const loadCustomerLinkModal = () => import('../components/admin/CustomerLinkModal');
const loadImageCropperModal = () => import('../components/ui/ImageCropperModal');

describe('dialog focus traps', () => {
    // Module-scoped: the harness owns the container and the teardown, this file
    // keeps the handle its assertions read by name.
    let container: HTMLDivElement;
    // Stands in for the button that opens a dialog: created, focused, and never
    // passed to the component — so focus return can only work the way the hook
    // does it (whatever had focus when the dialog opened).
    let opener: HTMLButtonElement;

    const mount = async <P extends object>(
        load: () => Promise<{ default: React.ComponentType<P> }>,
        props: P,
    ) => {
        const surface = await renderAdminSurface(load, { props });
        container = surface.container;
        return surface;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedProfileBuilder.mockResolvedValue(null);
        mockedGuestBuilder.mockResolvedValue(GUEST_PROFILE);

        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:cropper-test') });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

        opener = document.createElement('button');
        opener.textContent = 'Open dialog';
        document.body.appendChild(opener);
        opener.focus();

        // jsdom has no image decoder; the cropper's <img> load failure is a
        // rendered error state, not something these tests are asserting on.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    // Unmount + container removal are the harness's own afterEach.
    afterEach(() => {
        if (opener.parentNode === document.body) document.body.removeChild(opener);
        vi.restoreAllMocks();
    });

    describe('ConfirmationModal', () => {
        const renderConfirm = (props: Partial<React.ComponentProps<typeof ConfirmationModal>> = {}) =>
            mount(loadConfirmationModal, {
                isOpen: true,
                onClose: () => {},
                onConfirm: () => {},
                title: 'Approve 5,000 SGCOIN payout?',
                message: 'This deducts 5,000 SGCOIN from the customer balance.',
                ...props,
            });

        const dialog = () => container.querySelector('[role="dialog"]') as HTMLElement;

        it('moves focus into the dialog and Escape closes it, returning focus to the opener', async () => {
            const onClose = vi.fn();
            await renderConfirm({ onClose });

            const stops = stopsWithin(dialog());
            expect(stops.length).toBeGreaterThan(1);
            expect(document.activeElement).toBe(stops[0]);

            const event = await press('Escape');

            expect(event.defaultPrevented).toBe(true);
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(opener);
        });

        it('wraps Tab at both ends instead of reaching the page behind it', async () => {
            await renderConfirm();

            const stops = stopsWithin(dialog());
            const first = stops[0];
            const last = stops[stops.length - 1];

            last.focus();
            const forward = await press('Tab');
            expect(forward.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(first);

            first.focus();
            const backward = await press('Tab', true);
            expect(backward.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(last);
        });

        it('pulls focus back in when it has escaped to the page behind the dialog', async () => {
            await renderConfirm();

            opener.focus();
            const event = await press('Tab');

            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(stopsWithin(dialog())[0]);
        });

        it('does not dismiss while the confirmed action is in flight', async () => {
            const onClose = vi.fn();
            const onConfirm = vi.fn();
            await renderConfirm({ onClose, onConfirm, isLoading: true });

            // Every control in the dialog is disabled for this window, so there is
            // nothing to cycle; what matters is that Escape neither closes it nor
            // moves focus out from under the operation that is running. The key is
            // consumed (`escapeLocked`) rather than passed through to the page.
            expect(stopsWithin(dialog())).toHaveLength(0);

            const event = await press('Escape');

            expect(onClose).not.toHaveBeenCalled();
            expect(document.activeElement).toBe(opener);
            expect(event.defaultPrevented).toBe(true);
        });

        it('traps again once the action settles', async () => {
            const onClose = vi.fn();
            await renderConfirm({ onClose, isLoading: true });
            await renderConfirm({ onClose, isLoading: false });

            expect(document.activeElement).toBe(stopsWithin(dialog())[0]);

            await press('Escape');

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(opener);
        });
    });

    describe('CustomerLinkModal', () => {
        const renderLink = (props: Partial<React.ComponentProps<typeof CustomerLinkModal>> = {}) =>
            mount(loadCustomerLinkModal, {
                userId: undefined,
                customerEmail: 'guest@buyer.com',
                customerName: 'Guest Buyer',
                orderId: 'order_1750000000000_abc123',
                onClose: () => {},
                ...props,
            });

        const dialog = () => container.querySelector('[data-testid="customer-link-modal"]') as HTMLElement;

        it('is announced as the modal layer it is', async () => {
            await renderLink();

            expect(dialog().getAttribute('role')).toBe('dialog');
            expect(dialog().getAttribute('aria-modal')).toBe('true');
            expect(dialog().getAttribute('aria-label')).toBe('Customer details for Guest Buyer');
        });

        it('moves focus in and Escape closes it, returning focus to the name the admin clicked', async () => {
            const onClose = vi.fn();
            await renderLink({ onClose });

            const stops = stopsWithin(dialog());
            expect(stops.length).toBeGreaterThan(0);
            expect(document.activeElement).toBe(stops[0]);

            const event = await press('Escape');

            expect(event.defaultPrevented).toBe(true);
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(opener);
        });

        it('keeps Tab inside the layer rather than on the order detail modal behind it', async () => {
            await renderLink();

            const stops = stopsWithin(dialog());
            expect(document.activeElement).toBe(stops[0]);

            const event = await press('Tab');

            // One stop (the close control) while the profile is still resolving:
            // Tab is consumed and focus stays on it, instead of walking out to the
            // order modal underneath, which is still on screen.
            expect(event.defaultPrevented).toBe(true);
            expect(dialog().contains(document.activeElement)).toBe(true);
        });
    });

    describe('ImageCropperModal', () => {
        const renderCropper = (props: Partial<React.ComponentProps<typeof ImageCropperModal>> = {}) =>
            mount(loadImageCropperModal, {
                file: new File(['x'], 'crop-me.png', { type: 'image/png' }),
                open: true,
                onCancel: () => {},
                onConfirm: () => {},
                ...props,
            });

        const dialog = () => container.querySelector('[role="dialog"]') as HTMLElement;

        it('moves focus into the cropper and Escape cancels, returning focus to the upload button', async () => {
            const onCancel = vi.fn();
            await renderCropper({ onCancel });

            const stops = stopsWithin(dialog());
            expect(stops.length).toBeGreaterThan(1);
            expect(document.activeElement).toBe(stops[0]);

            const event = await press('Escape');

            expect(event.defaultPrevented).toBe(true);
            expect(onCancel).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(opener);
        });

        it('wraps Tab between the first and last crop control', async () => {
            await renderCropper();

            const stops = stopsWithin(dialog());
            const first = stops[0];
            const last = stops[stops.length - 1];
            expect(first).not.toBe(last);

            last.focus();
            await press('Tab');
            expect(document.activeElement).toBe(first);

            first.focus();
            await press('Tab', true);
            expect(document.activeElement).toBe(last);
        });

        it('stays shut while there is no file to crop', async () => {
            await renderCropper({ file: null });

            expect(container.querySelector('[role="dialog"]')).toBeNull();

            // Nothing is trapping: a keypress on the page is left alone.
            const event = await press('Tab');
            expect(event.defaultPrevented).toBe(false);
        });
    });
});
