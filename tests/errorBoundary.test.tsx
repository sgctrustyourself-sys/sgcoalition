// tests/errorBoundary.test.tsx
//
// Pins the two halves of components/ErrorBoundary.tsx:
//
//   1. A render error shows the recoverable screen instead of leaving an empty
//      container (the blank-screen failure this was added to fix).
//   2. The error reaches the reporting path. The boundary does NOT import
//      Sentry — index.tsx installs React 19's root `onCaughtError`, which
//      forwards boundary-caught errors to services/sentryInit.ts. So this test
//      mounts with the same root option index.tsx uses and asserts the handler
//      fired. If a future refactor drops that root option, this fails here
//      rather than silently losing production error reports.
//
// Follows the established createRoot + act + explicit-DOM-assertions pattern.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ErrorBoundary from '../components/ErrorBoundary';

let container: HTMLDivElement;
let root: Root;
let onCaughtError: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;

const Boom = () => {
    throw new Error('kaboom: page render failed');
};

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // React logs a caught error to console.error in development; the assertions
    // below are the signal, not the noise.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    onCaughtError = vi.fn();
    root = createRoot(container, { onCaughtError });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    consoleError.mockRestore();
});

const render = async (element: ReactNode): Promise<void> => {
    await act(async () => {
        root.render(element);
    });
};

const buttonNamed = (label: RegExp): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((b) => label.test(b.textContent || ''));

describe('ErrorBoundary', () => {
    it('shows a recoverable screen instead of a blank container', async () => {
        await render(createElement(ErrorBoundary, null, createElement(Boom)));

        expect(container.textContent).toContain('This page hit an error');
        expect(container.textContent).toContain('kaboom: page render failed');
        expect(buttonNamed(/try again/i)).toBeTruthy();
        expect(buttonNamed(/reload page/i)).toBeTruthy();
    });

    it('reports the error through the React root onCaughtError path', async () => {
        await render(createElement(ErrorBoundary, null, createElement(Boom)));

        expect(onCaughtError).toHaveBeenCalled();
        const [error] = onCaughtError.mock.calls[0];
        expect((error as Error).message).toBe('kaboom: page render failed');
    });

    it('recovers when "Try again" is pressed and the cause is gone', async () => {
        let failing = true;
        const Flaky = () => {
            if (failing) throw new Error('first render fails');
            return <div>recovered content</div>;
        };

        await render(createElement(ErrorBoundary, null, createElement(Flaky)));
        expect(container.textContent).toContain('This page hit an error');

        failing = false;
        const retry = buttonNamed(/try again/i)!;
        await act(async () => {
            retry.click();
        });

        expect(container.textContent).toContain('recovered content');
        expect(container.textContent).not.toContain('This page hit an error');
    });

    it('clears a caught error when resetKey changes (navigating away)', async () => {
        let failing = true;
        const Flaky = () => {
            if (failing) throw new Error('route A is broken');
            return <div>route B content</div>;
        };

        await render(createElement(ErrorBoundary, { resetKey: 'route-a' }, createElement(Flaky)));
        expect(container.textContent).toContain('This page hit an error');

        failing = false;
        await render(createElement(ErrorBoundary, { resetKey: 'route-b' }, createElement(Flaky)));

        expect(container.textContent).toContain('route B content');
        expect(container.textContent).not.toContain('This page hit an error');
    });
});
