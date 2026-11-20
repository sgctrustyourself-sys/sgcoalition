// tests/paymentStatusCardRender.test.tsx
//
// REGRESSION CATCH for the admin Payment Processing card
// (components/admin/PaymentStatusCard.tsx). The card polls /api/health and
// renders the Stripe key status + enabled payment methods at a glance.
//
// Mounting goes through tests/_helpers/adminSurface.tsx, which owns the
// container/root pair and the teardown (the card reads no context itself, but
// every admin render test mounts the same way). Only the global fetch is mocked
// — the card is self-contained and has no AppContext/supabase dependencies.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
    appContextStub,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';

// The harness cannot register the contexts for us — vitest scopes module mocks
// to the file that calls them (see the harness header). Two lines, once per
// file, and the surface itself arrives as a loader so it resolves against them.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const loadPaymentStatusCard = () => import('../components/admin/PaymentStatusCard');

// Module-scoped because the helpers below read it by name; each render assigns
// the harness's own container.
let container: HTMLDivElement;

const renderSurface = async () => {
    const surface = await renderAdminSurface(loadPaymentStatusCard);
    container = surface.container;
    return surface;
};

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
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    async function renderCard() {
        await renderSurface();
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

    it('ORIGIN_MATCH: a matching origin shows the live host and no mismatch warning', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, {
            ...HEALTHY_BODY,
            origin: {
                configured: 'https://sgcoalition-five.vercel.app',
                configuredHost: 'sgcoalition-five.vercel.app',
                requestHost: 'sgcoalition-five.vercel.app',
                matches: true,
            },
        }));

        await renderCard();

        expect(container.querySelector('[data-testid="origin-mismatch"]')).toBeNull();
        expect(container.querySelector('[data-testid="origin-host"]')?.textContent).toContain('sgcoalition-five.vercel.app');
    });

    it('ORIGIN_MISMATCH: a different serving host raises the warning and names the webhook URLs', async () => {
        // The silent outage: the app is healthy, Stripe is happy, but the
        // host Stripe posts to is not this one, so paid orders reconcile
        // nowhere. The card must name the host to use.
        fetchMock.mockResolvedValue(jsonResponse(200, {
            ...HEALTHY_BODY,
            origin: {
                configured: 'https://sgcoalition-five.vercel.app',
                configuredHost: 'sgcoalition-five.vercel.app',
                requestHost: 'sgcoalition-five.vercel.app',
                matches: false,
            },
        }));

        await renderCard();

        const warning = container.querySelector('[data-testid="origin-mismatch"]');
        expect(warning).toBeTruthy();
        expect(warning!.textContent).toContain('sgcoalition-five.vercel.app');
        expect(warning!.textContent).toContain('sgcoalition-five.vercel.app');
        // The actionable part: the exact URLs the dashboards need.
        expect(warning!.textContent).toContain('https://sgcoalition-five.vercel.app/api/stripe-webhook');
        expect(warning!.textContent).toContain('https://sgcoalition-five.vercel.app/api/shippo-webhook');
    });

    it('ORIGIN_ABSENT: a response with no origin block renders normally', async () => {
        // An older server (or a mocked body) without the field must not
        // crash the card or invent a warning.
        fetchMock.mockResolvedValue(jsonResponse(200, HEALTHY_BODY));

        await renderCard();

        expect(container.querySelector('[data-testid="origin-mismatch"]')).toBeNull();
        expect(container.querySelector('[data-testid="origin-host"]')).toBeNull();
        expect(container.innerHTML).toContain('Healthy');
    });

    it('ORIGIN_UNSET: VITE_APP_URL missing still names the live host, and says the origin is a default', async () => {
        // Production currently has no VITE_APP_URL, so the origin every
        // generated link uses is a built-in fallback. The serving host is
        // still the answer to "where do webhooks point?", so it must be
        // shown — and the fallback must be flagged rather than looked up.
        fetchMock.mockResolvedValue(jsonResponse(200, {
            ...HEALTHY_BODY,
            origin: {
                configured: null,
                configuredHost: null,
                requestHost: 'sgcoalition-five.vercel.app',
                matches: null,
            },
        }));

        await renderCard();

        const host = container.querySelector('[data-testid="origin-host"]');
        expect(host).toBeTruthy();
        expect(host!.textContent).toContain('sgcoalition-five.vercel.app');
        expect(container.querySelector('[data-testid="origin-mismatch"]')).toBeNull();
        expect(container.querySelector('[data-testid="origin-env-unset"]')?.textContent).toContain('VITE_APP_URL is not set');
    });
});
