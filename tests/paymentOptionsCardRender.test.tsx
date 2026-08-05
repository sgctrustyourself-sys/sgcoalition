// tests/paymentOptionsCardRender.test.tsx
//
// Render tests for the admin PaymentOptionsCard — the live on/off toggles for
// which payment options customers see at checkout.
//
// Replicates the established harness: createRoot + act + DOM assertions with
// global fetch stubbed at the boundary (GET /api/payment-settings on mount,
// PATCH on toggle). The admin token comes from sessionStorage
// ('coalition_admin_token').

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useToast } from '../context/ToastContext';
import PaymentOptionsCard from '../components/admin/PaymentOptionsCard';

vi.mock('../context/ToastContext', () => ({
    useToast: vi.fn(),
}));

const ALL_ON = {
    card_enabled: true,
    paypal_enabled: true,
    klarna_enabled: true,
    crypto_enabled: true,
};

const ALL_OFF = {
    card_enabled: false,
    paypal_enabled: false,
    klarna_enabled: false,
    crypto_enabled: false,
};

/** Stub global fetch: GET returns `settings`; a successful PATCH applies the
 *  patch body over the base settings (mirrors the server's merged row). */
function mockFetch(settings: Record<string, boolean> = ALL_ON, patchStatus = 200) {
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const method = (init?.method || 'GET').toUpperCase();
        if (method === 'GET') {
            return { ok: true, json: async () => settings };
        }
        if (patchStatus >= 400) {
            return {
                ok: false,
                status: patchStatus,
                json: async () => ({ error: 'Admin authorization required.' }),
            };
        }
        const patchBody = JSON.parse(String(init?.body || '{}')) as Record<string, boolean>;
        return { ok: true, status: 200, json: async () => ({ ...settings, ...patchBody }) };
    });
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
}

describe('PaymentOptionsCard', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        sessionStorage.setItem('coalition_admin_token', 'admin-test-token');
        vi.mocked(useToast).mockReturnValue({ addToast: vi.fn() } as any);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        sessionStorage.clear();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    async function renderCard() {
        await act(async () => { root.render(createElement(PaymentOptionsCard)); });
        await act(async () => { await Promise.resolve(); });
    }

    function toggleFor(key: string): HTMLButtonElement {
        const el = container.querySelector(`[data-testid="payment-option-toggle-${key}"]`);
        if (!el) throw new Error(`toggle ${key} not found`);
        return el as HTMLButtonElement;
    }

    it('renders four switches reflecting the GET response', async () => {
        mockFetch(ALL_ON);
        await renderCard();

        expect(container.querySelector('[data-testid="payment-options-card"]')).toBeTruthy();
        for (const key of ['card', 'paypal', 'klarna', 'crypto']) {
            expect(toggleFor(key).getAttribute('aria-checked')).toBe('true');
        }
    });

    it('renders disabled options as off when the owner turned them off', async () => {
        mockFetch({ ...ALL_ON, klarna_enabled: false, crypto_enabled: false });
        await renderCard();

        expect(toggleFor('card').getAttribute('aria-checked')).toBe('true');
        expect(toggleFor('klarna').getAttribute('aria-checked')).toBe('false');
        expect(toggleFor('crypto').getAttribute('aria-checked')).toBe('false');
    });

    it('clicking a toggle PATCHes with the admin Bearer token and flips optimistically', async () => {
        const fetchFn = mockFetch(ALL_ON);
        await renderCard();

        await act(async () => { toggleFor('klarna').click(); });

        // Optimistic state applied immediately.
        expect(toggleFor('klarna').getAttribute('aria-checked')).toBe('false');

        const patchCall = fetchFn.mock.calls.find(([, init]) =>
            String(init?.method || '').toUpperCase() === 'PATCH');
        expect(patchCall).toBeTruthy();
        const [, init] = patchCall as [string, RequestInit];
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer admin-test-token');
        expect(JSON.parse(String(init.body))).toEqual({ klarna_enabled: false });
    });

    it('reverts the toggle when the PATCH fails', async () => {
        mockFetch(ALL_ON, 401);
        await renderCard();

        await act(async () => { toggleFor('paypal').click(); });

        // Reverted to the server truth after the failed write.
        expect(toggleFor('paypal').getAttribute('aria-checked')).toBe('true');
        // The card surfaces the real server error (not the fallback string).
        expect(vi.mocked(useToast).mock.results[0].value.addToast).toHaveBeenCalledWith(
            expect.stringContaining('Admin authorization required.'),
            'error',
        );
    });

    it('does not PATCH without an admin token (shows a session-expired toast)', async () => {
        const fetchFn = mockFetch(ALL_ON);
        sessionStorage.removeItem('coalition_admin_token');
        await renderCard();

        await act(async () => { toggleFor('card').click(); });

        const patchCalls = fetchFn.mock.calls.filter(([, init]) =>
            String(init?.method || '').toUpperCase() === 'PATCH');
        expect(patchCalls).toHaveLength(0);
        expect(toggleFor('card').getAttribute('aria-checked')).toBe('true');
        expect(vi.mocked(useToast).mock.results[0].value.addToast).toHaveBeenCalledWith(
            expect.stringContaining('Admin session expired'),
            'error',
        );
    });
});
