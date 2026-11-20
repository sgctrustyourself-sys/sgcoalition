// tests/liveMapUnavailable.test.tsx
//
// Pins the failure path of components/LiveMap.tsx.
//
// The map used to hand its geometry URL straight to <Geographies>, which fetched
// it internally and swallowed any failure into a console.log. A blocked or
// broken request therefore rendered as a country with no orders and said
// nothing — which is exactly how a CSP-blocked geometry fetch went unnoticed in
// production, and why "an empty map" had to become a state the UI reports.
//
// The contract these assertions hold: a failed load is visible, names a reason,
// and offers a way back.
//
// Follows the established createRoot + act + explicit-DOM-assertions pattern.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import LiveMap from '../components/LiveMap';

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

const render = async () => {
    await act(async () => {
        root.render(createElement(LiveMap, { data: [], timeRange: '24h' }));
    });
};

/** Let the loader's promise chain settle inside act(). */
const flush = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

const buttonNamed = (label: RegExp): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((b) => label.test(b.textContent || ''));

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('LiveMap geometry failure', () => {
    it('fetches the geometry itself, so the failure is ours to see', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        await render();
        await flush();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain('us-atlas');
    });

    it('shows a named unavailable state instead of an empty country', async () => {
        fetchMock.mockRejectedValue(new Error('network unreachable'));
        await render();
        await flush();

        expect(container.textContent).toContain('Map unavailable');
        expect(container.textContent).toContain('network unreachable');
        expect(buttonNamed(/try again/i)).toBeTruthy();
        // An empty map and a failed map must not look the same.
        expect(container.textContent).not.toContain('Low');
    });

    it('reports an HTTP failure with its status', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
        await render();
        await flush();

        expect(container.textContent).toContain('Map unavailable');
        expect(container.textContent).toContain('HTTP 503');
    });

    it('leaves a cancelled load alone rather than reporting an unmount', async () => {
        // AbortController.abort() rejects the pending fetch on unmount; that must
        // not surface as a failure the visitor never caused.
        fetchMock.mockImplementation(
            (_url: string, init?: { signal?: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () =>
                        reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
                    );
                }),
        );
        await render();
        act(() => {
            root.unmount();
        });
        await flush();

        expect(container.textContent).not.toContain('Map unavailable');
        // re-mount for the shared afterEach unmount
        root = createRoot(container);
    });

    it('retries the geometry when "Try again" is pressed', async () => {
        fetchMock.mockRejectedValueOnce(new Error('first attempt failed'));
        await render();
        await flush();
        expect(container.textContent).toContain('Map unavailable');

        // The retry never settles, so the panel stays in its loading state —
        // enough to prove a fresh request went out without needing a real
        // TopoJSON document in jsdom.
        fetchMock.mockImplementationOnce(() => new Promise(() => {}));
        const retry = buttonNamed(/try again/i)!;
        await act(async () => {
            retry.click();
        });
        await flush();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(container.textContent).toContain('Loading order map');
        expect(container.textContent).not.toContain('Map unavailable');
    });
});
