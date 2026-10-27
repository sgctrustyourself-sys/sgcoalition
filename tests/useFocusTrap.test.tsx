// tests/useFocusTrap.test.tsx
//
// Direct tests for hooks/useFocusTrap, exercised through a small harness so the
// behaviour is pinned independently of the admin menu that first needed it.
// Covers what the admin menu does NOT use: the default initial-focus target,
// an explicit initialFocusRef, a trap with no external anchor, and toggling off.
//
// jsdom implements no real Tab navigation, so the trap is driven by dispatching
// the keydown at the boundary element and asserting both the focus move and
// that the native default was suppressed.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface HarnessProps {
    initialOpen?: boolean;
    useAnchor?: boolean;
    useReturnRef?: boolean;
    initialFocus?: 'default' | 'second';
    onEscape?: () => void;
}

const Harness = ({ initialOpen = true, useAnchor = false, useReturnRef = true, initialFocus = 'default', onEscape }: HarnessProps) => {
    const [open, setOpen] = useState(initialOpen);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const secondRef = useRef<HTMLButtonElement>(null);

    useFocusTrap({
        active: open,
        containerRef: panelRef,
        anchorRef: useAnchor ? triggerRef : undefined,
        returnFocusRef: useReturnRef ? triggerRef : undefined,
        initialFocusRef: initialFocus === 'second' ? secondRef : undefined,
        onEscape: () => {
            onEscape?.();
            setOpen(false);
        },
    });

    return createElement(
        'div',
        null,
        createElement('button', { ref: triggerRef, 'data-testid': 'trigger' }, 'trigger'),
        createElement('button', { 'data-testid': 'outside' }, 'outside'),
        open
            ? createElement(
                'div',
                { ref: panelRef, role: 'dialog' },
                createElement('button', { 'data-testid': 'first' }, 'first'),
                createElement('button', { ref: secondRef, 'data-testid': 'second' }, 'second'),
                createElement('button', { 'data-testid': 'disabled', disabled: true }, 'disabled'),
                createElement('a', { href: '/somewhere', 'data-testid': 'link' }, 'link'),
                createElement('button', { 'data-testid': 'last' }, 'last'),
            )
            : null,
    );
};

describe('useFocusTrap', () => {
    let container: HTMLDivElement;
    let root: Root;

    const q = (testId: string) => container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;

    const render = async (props: HarnessProps = {}) => {
        await act(async () => {
            root.render(createElement(Harness, props));
        });
    };

    const press = async (key: string, shiftKey = false) => {
        const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
        await act(async () => { document.dispatchEvent(event); });
        return event;
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('focuses the first tab stop on open when no initial target is given', async () => {
        await render();
        expect(document.activeElement).toBe(q('first'));
    });

    it('honours an explicit initialFocusRef', async () => {
        await render({ initialFocus: 'second' });
        expect(document.activeElement).toBe(q('second'));
    });

    it('skips disabled controls and wraps Tab from the last stop to the first', async () => {
        await render();
        const last = q('last') as HTMLElement;
        last.focus();

        const event = await press('Tab');

        expect(event.defaultPrevented).toBe(true);
        // The trapped set is first, second, link, last — the disabled button is
        // not a stop, so wrapping lands on `first`, never on it.
        expect(document.activeElement).toBe(q('first'));
    });

    it('wraps Shift+Tab from the first stop to the last', async () => {
        await render();
        (q('first') as HTMLElement).focus();

        const event = await press('Tab', true);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(q('last'));
    });

    it('leaves Tab alone in the middle of the cycle', async () => {
        await render();
        (q('second') as HTMLElement).focus();

        const event = await press('Tab');

        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(q('second'));
    });

    it('pulls focus that escaped behind the overlay back to the first stop', async () => {
        await render();
        const outside = q('outside') as HTMLElement;
        outside.focus();
        expect(document.activeElement).toBe(outside);

        const event = await press('Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(q('first'));
    });

    it('puts an external anchor at the front of the cycle', async () => {
        await render({ useAnchor: true });

        // The anchor is the front stop, so Tab off the panel's tail wraps all the
        // way out to it.
        (q('last') as HTMLElement).focus();
        const forward = await press('Tab');
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(q('trigger'));

        // And Shift+Tab off the anchor wraps to the panel's tail.
        const back = await press('Tab', true);
        expect(back.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(q('last'));

        // Shift+Tab from the panel's own first item is left alone: the anchor
        // precedes it in the DOM, so the browser moves there natively.
        (q('first') as HTMLElement).focus();
        const mid = await press('Tab', true);
        expect(mid.defaultPrevented).toBe(false);
    });

    it('restores focus to the element that was focused when the overlay opened', async () => {
        // The global-overlay case: no ref to the trigger is available, so the
        // open-time element is the only return target.
        const pageButton = document.createElement('button');
        pageButton.textContent = 'page';
        document.body.appendChild(pageButton);
        try {
            pageButton.focus();
            await render({ useReturnRef: false, initialOpen: false });

            await act(async () => {
                root.render(createElement(Harness, { useReturnRef: false, initialOpen: true }));
            });

            await press('Escape');

            expect(document.activeElement).toBe(pageButton);
        } finally {
            document.body.removeChild(pageButton);
        }
    });

    it('Escape calls the handler, closes, and restores focus to the return target', async () => {
        const onEscape = vi.fn();
        await render({ onEscape });

        const event = await press('Escape');

        expect(event.defaultPrevented).toBe(true);
        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(document.activeElement).toBe(q('trigger'));
    });

    it('does nothing while inactive', async () => {
        await render({ initialOpen: false });

        const event = await press('Tab');
        expect(event.defaultPrevented).toBe(false);

        await press('Escape');
        expect(document.activeElement).toBe(document.body);
    });

    it('stops intercepting after the overlay closes', async () => {
        await render();
        await press('Escape');
        expect(container.querySelector('[role="dialog"]')).toBeNull();

        const event = await press('Tab');
        expect(event.defaultPrevented).toBe(false);
    });
});
