// tests/paymentStatusCardRender.test.tsx
//
// REGRESSION CATCH for the admin Payment Processing card
// (components/admin/PaymentStatusCard.tsx). The card polls /api/health and
// renders the Stripe key status + enabled payment methods at a glance.
//
// Replicates the established admin render-test pattern (createRoot + act +
// explicit DOM assertions). Only the global fetch is mocked — the card is
// self-contained and has no AppContext/supabase dependencies.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PaymentStatusCard from '../components/admin/PaymentStatusCard';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const HEALTHY_BODY = {
    status: 'ok',
    checkoutWorking: true,
    stripe: {
        configured: true,
        keyValid: true,
        error: null,
        // Dashboard has more enabled than checkout offers — the hidden note
        // must reflect the difference.
        paymentMethods: ['card', 'klarna', 'link', 'cashapp', 'amazon_pay'],
        checkoutMethods: ['card', 'klarna'],
        checkoutMethodsMissing: [],
    },
};

const DEGRADED_BODY = {
    status: 'degraded',
    checkoutWorking: false,
    stripe: {
        configured: true,
        keyValid: false,
        error: 'api_key_expired: Expired API Key provided: [REDACTED]',
        paymentMethods: [],
        checkoutMethods: ['card', 'klarna'],
        checkoutMethodsMissing: [],
    },
};

describe('PaymentStatusCard render flow', () => {
    let container: HTMLDivElement;
    let root: Root;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    async function renderCard() {
        await act(async () => {
            root.render(createElement(PaymentStatusCard));
        });
        // Flush the mocked-fetch microtask so the state update lands.
        await act(async () => { await Promise.resolve(); });
    }

    it('HEALTHY: fetch 200 ok -> "Healthy" badge, Stripe key valid, one chip per enabled method, no alert', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, HEALTHY_BODY));

        await renderCard();

        const html = container.innerHTML;
        expect(fetchMock).toHaveBeenCalledWith('/api/health', { method: 'GET' });
        expect(html).toContain('Payment Processing');
        expect(html).toContain('Healthy');
        expect(html).toContain('Stripe key valid');
        expect(html).not.toContain('Degraded');
        expect(html).not.toContain('Checkout at risk');

        // One chip per CHECKOUT method (card + klarna only), with labels.
        expect(container.querySelector('[data-testid="method-chip-card"]')?.textContent).toContain('Card');
        expect(container.querySelector('[data-testid="method-chip-klarna"]')?.textContent).toContain('Klarna');
        // Link / Cash App / Amazon Pay are enabled in the dashboard but hidden
        // from checkout — no chips, and a note explains the difference.
        expect(container.querySelector('[data-testid="method-chip-link"]')).toBeNull();
        expect(container.querySelector('[data-testid="method-chip-cashapp"]')).toBeNull();
        expect(container.querySelector('[data-testid="method-chip-amazon_pay"]')).toBeNull();
        expect(html).toContain('Hidden from checkout:');
        expect(html).toContain('Cash App');
        expect(html).toContain('Amazon Pay');
    });

    it('MISSING_METHOD: allow-list method disabled on the account -> outage-risk warning renders', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, {
            status: 'ok',
            checkoutWorking: true,
            stripe: {
                configured: true,
                keyValid: true,
                error: null,
                paymentMethods: ['card'],
                checkoutMethods: ['card', 'klarna'],
                checkoutMethodsMissing: ['klarna'],
            },
        }));

        await renderCard();

        const html = container.innerHTML;
        expect(html).toContain('Checkout outage risk');
        expect(html).toContain('Klarna');
        expect(html).toContain('configured but disabled in Stripe');
    });

    it('DEGRADED: fetch 503 -> "Degraded" badge + actionable alert surfaces the sanitized error', async () => {
        fetchMock.mockResolvedValue(jsonResponse(503, DEGRADED_BODY));

        await renderCard();

        const html = container.innerHTML;
        expect(html).toContain('Degraded');
        expect(html).toContain('Checkout at risk — action required');
        expect(html).toContain('api_key_expired');
        expect(html).not.toContain('Healthy');
        expect(html).not.toContain('Stripe key valid');
    });

    it('SERVER_ERROR: fetch 500 -> "Degraded" badge surfaces the probe failure, not "Unreachable"', async () => {
        fetchMock.mockResolvedValue(jsonResponse(500, { error: 'boom' }));

        await renderCard();

        const html = container.innerHTML;
        expect(html).toContain('Degraded');
        expect(html).toContain('Health probe failed (HTTP 500)');
        expect(html).not.toContain('Unreachable');
    });

    it('UNREACHABLE: fetch rejects -> "Unreachable" badge + network hint, no method chips', async () => {
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await renderCard();

        const html = container.innerHTML;
        expect(html).toContain('Unreachable');
        expect(html).toContain('The health probe could not be reached');
        expect(container.querySelector('[data-testid^="method-chip-"]')).toBeNull();
    });

    it('REFRESH: clicking the refresh button triggers a second /api/health fetch and updates the badge', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, HEALTHY_BODY))
            .mockResolvedValueOnce(jsonResponse(503, DEGRADED_BODY));

        await renderCard();
        expect(htmlContains('Healthy')).toBe(true);

        const refreshBtn = document.body.querySelector(
            '[data-testid="payment-status-refresh"]',
        ) as HTMLButtonElement | null;
        expect(refreshBtn).toBeTruthy();

        await act(async () => { refreshBtn!.click(); });
        await act(async () => { await Promise.resolve(); });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(container.innerHTML).toContain('Degraded');
        expect(container.innerHTML).toContain('Checkout at risk — action required');

        function htmlContains(s: string): boolean {
            return container.innerHTML.includes(s);
        }
    });
});
