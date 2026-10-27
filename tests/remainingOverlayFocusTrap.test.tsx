// tests/remainingOverlayFocusTrap.test.tsx
//
// The overlay components that adopted useFocusTrap after the first wave: the
// standalone dialogs that had neither Escape handling nor containment, the
// photo lightbox (which had a bare window Escape listener), and the two
// admin-side modals whose close handlers are local state setters.
//
// Each test opens the surface from a focused trigger, then proves the two
// behaviours the hook is responsible for: Escape reaches the close handler, and
// focus lands back on the trigger instead of the page behind the overlay.
// PhotoLightbox also keeps its own arrow navigation, so that is pinned too.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SecurityModal from '../components/tutorial/SecurityModal';
import PhotoLightbox from '../components/ui/PhotoLightbox';
import RequestSimilarModal from '../components/RequestSimilarModal';
import RefundExceptionModal from '../components/admin/RefundExceptionModal';
import ImageGenModal from '../components/ImageGenModal';
import { ToastProvider } from '../context/ToastContext';
import { accessibleName } from './_helpers/accessibleName';
import type { Product } from '../types';

// Same opt-in the other createRoot-based suites use, so React's act() warnings
// reflect real leakage rather than a missing flag.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The dialogs pull these in at module load; none of them is exercised here.
vi.mock('../services/aiChat', () => ({
    generateImage: vi.fn(async () => ({ success: false, error: 'not called' })),
    designShirtFromReference: vi.fn(),
}));
vi.mock('../services/customInquiry', () => ({
    submitCustomInquiry: vi.fn(async () => undefined),
}));
vi.mock('../services/refunds', () => ({
    processRefund: vi.fn(async () => undefined),
}));

const PRODUCT = {
    id: 'prod-test',
    name: 'Verification Tee',
    price: 25,
    category: 'apparel',
    images: ['/images/verification-tee.png'],
} as unknown as Product;

describe('remaining overlay focus traps', () => {
    let container: HTMLDivElement;
    let root: Root;
    let opener: HTMLButtonElement;

    const mount = async (element: ReactElement) => {
        await act(async () => {
            root.render(element);
        });
    };

    const dialog = () => container.querySelector('[role="dialog"]') as HTMLElement | null;

    const pressEscape = () => {
        act(() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
    };

    const pressTab = (shiftKey = false) => {
        act(() => {
            document.activeElement?.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
            );
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        opener = document.createElement('button');
        opener.textContent = 'Open overlay';
        document.body.appendChild(opener);
        opener.focus();

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        if (opener.parentNode === document.body) document.body.removeChild(opener);
    });

    it('SecurityModal: Escape closes and returns focus to the opener', async () => {
        const onClose = vi.fn();
        await mount(createElement(SecurityModal, { isOpen: true, onClose }));

        expect(dialog()?.getAttribute('aria-modal')).toBe('true');
        expect(dialog()?.contains(document.activeElement)).toBe(true);

        pressEscape();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
    });

    it('RequestSimilarModal: Escape closes and returns focus to the opener', async () => {
        const onClose = vi.fn();
        await mount(createElement(RequestSimilarModal, { product: PRODUCT, onClose }));

        expect(dialog()?.getAttribute('aria-label')).toContain('Verification Tee');
        expect(dialog()?.contains(document.activeElement)).toBe(true);

        pressEscape();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
    });

    it('RefundExceptionModal: Escape closes and returns focus to the opener', async () => {
        const onClose = vi.fn();
        await mount(createElement(RefundExceptionModal, {
            orderId: 'order-1',
            orderNumber: 'SG-1',
            orderTotal: 40,
            adminWalletAddress: '0x0000000000000000000000000000000000000000',
            onClose,
            onSuccess: vi.fn(),
        }));

        expect(dialog()?.getAttribute('aria-modal')).toBe('true');
        expect(dialog()?.contains(document.activeElement)).toBe(true);

        pressEscape();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
    });

    it('ImageGenModal: Escape closes and returns focus to the opener', async () => {
        const onClose = vi.fn();
        await mount(createElement(
            ToastProvider,
            null,
            createElement(ImageGenModal, {
                isOpen: true,
                onClose,
                onImageGenerated: vi.fn(),
            }),
        ));

        expect(dialog()?.getAttribute('aria-label')).toBe('Generate image');
        expect(dialog()?.contains(document.activeElement)).toBe(true);

        const close = dialog()?.querySelector('button[aria-label="Close modal"]');
        expect(close).toBeTruthy();
        expect(accessibleName(close!)).toBe('Close modal');

        pressEscape();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
    });

    it('PhotoLightbox: Escape closes, Tab wraps, and arrow keys still navigate', async () => {
        const onClose = vi.fn();
        await mount(createElement(PhotoLightbox, { photos: ['/one.png', '/two.png'], onClose }));

        expect(dialog()?.getAttribute('aria-modal')).toBe('true');

        // Focus starts on the close button; arrow navigation still works.
        const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
        expect(buttons.length).toBe(3); // close, previous, next

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        });
        expect(container.querySelector('img')?.getAttribute('alt')).toBe('Photo 2 of 2');

        // Tab from the last stop wraps to the first, inside the lightbox.
        buttons[buttons.length - 1].focus();
        pressTab();
        expect(document.activeElement).toBe(buttons[0]);

        pressEscape();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
    });
});
