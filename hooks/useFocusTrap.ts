import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

// What counts as a tab stop inside an overlay. Kept in one place so every
// consumer cycles the same set instead of re-deriving it.
export const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface UseFocusTrapOptions {
    /** Mount the trap only while the overlay is open. */
    active: boolean;
    /** The overlay panel whose descendants form the cycle. */
    containerRef: RefObject<HTMLElement | null>;
    /** Called on Escape, before focus is restored. */
    onEscape?: () => void;
    /** Where focus goes when Escape closes the overlay. */
    returnFocusRef?: RefObject<HTMLElement | null>;
    /** Focus this on open; defaults to the first stop inside the container. */
    initialFocusRef?: RefObject<HTMLElement | null>;
    /**
     * A control that lives outside the panel but belongs to the cycle — e.g. the
     * close toggle above a full-screen menu. It becomes the first stop, so
     * Shift+Tab from the front of the panel lands on it rather than on the page
     * hidden behind the overlay.
     */
    anchorRef?: RefObject<HTMLElement | null>;
    /**
     * Freeze Escape while the overlay's own write is in flight.
     *
     * The overlay must outlive its request: every control in it is disabled at
     * that point, so a dismissal would strand the operator with no result to
     * read. Gate this on the surface's saving flag (`isSaving`, `isSubmitting`,
     * `sending`, `isProcessing`) rather than on `active`: the trap stays mounted,
     * so Tab containment continues and — because the effect does not re-run when
     * this toggles — the element that opened the overlay is still what Escape
     * returns focus to once the write settles.
     *
     * With `active` gating instead, the effect restarts on every write and
     * re-captures the focus-return target from inside the overlay.
     */
    escapeLocked?: boolean;
}

/**
 * Keep keyboard focus inside an open overlay.
 *
 * Wrap `active` in the overlay's open flag. While it is true: focus moves into
 * the overlay on open, Tab and Shift+Tab wrap between the first and last stop
 * instead of walking into the page underneath, focus that has escaped is pulled
 * back to the first stop, and Escape calls `onEscape` then restores focus to
 * `returnFocusRef`. While `escapeLocked` is true Escape is swallowed instead:
 * no handler, no focus move, and the open overlay stays exactly where it is.
 *
 * Only the open state is trapped; closing by click does not move focus, so a
 * consumer that closes on navigation does not yank focus back afterwards.
 */
export function useFocusTrap({
    active,
    containerRef,
    onEscape,
    returnFocusRef,
    initialFocusRef,
    anchorRef,
    escapeLocked = false,
}: UseFocusTrapOptions): void {
    // Hold the latest handler so an inline arrow from the caller does not rebind
    // the document listener on every render.
    const escapeRef = useRef(onEscape);
    escapeRef.current = onEscape;

    // The lock is read inside the listener for the same reason, and deliberately
    // kept out of the effect deps: toggling it must not restart the effect, which
    // would re-capture the focus-return target from the point the write finished
    // rather than from the control that opened the overlay.
    const escapeLockedRef = useRef(escapeLocked);
    escapeLockedRef.current = escapeLocked;

    useEffect(() => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;

        // What had focus when the overlay opened. A global overlay (cart drawer,
        // a modal opened from anywhere) has no ref to its trigger, so this is
        // the only honest focus-return target it can offer.
        const previouslyFocused = document.activeElement as HTMLElement | null;

        const stops = (): HTMLElement[] => {
            const anchor = anchorRef?.current;
            return [
                ...(anchor ? [anchor] : []),
                ...Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)),
            ];
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                // Mid-write: consume the key and change nothing. The overlay is
                // still open and every one of its controls is disabled.
                if (escapeLockedRef.current) return;
                escapeRef.current?.();
                // Prefer the caller's ref; fall back to the element that opened
                // the overlay. Skip a target that has since left the document.
                const target = returnFocusRef?.current ?? previouslyFocused;
                if (target?.isConnected) target.focus();
                return;
            }
            if (event.key !== 'Tab') return;

            const items = stops();
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            const current = document.activeElement as HTMLElement | null;
            const inside = current !== null && items.includes(current);

            if (event.shiftKey) {
                if (!inside || current === first) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (!inside || current === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        const initial = initialFocusRef?.current
            ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        initial?.focus();

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [active, containerRef, initialFocusRef, anchorRef, returnFocusRef]);
}
