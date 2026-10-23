// tests/marketingManagerRender.test.tsx
//
// REGRESSION CATCH for components/admin/MarketingManager.tsx — the admin
// campaign composer that commit 8b1a6f7 deleted and this pass restored.
//
// Three behaviours are pinned, because each was a real defect in the recovered
// code rather than a detail of the port:
//
//   1. The audience is read from GET /api/marketing-stats with the admin bearer,
//      NOT queried from Supabase in the browser. Those tables are RLS-gated to
//      Supabase-authenticated admin_users while the admin session is a bare
//      shared secret, so the direct read came back empty next to a send that
//      reached everyone. If someone "simplifies" this back to a browser query,
//      fetch is never called and this fails.
//   2. A 401 clears the admin session and says so, instead of rendering an empty
//      audience that looks like "no subscribers".
//   3. The test-campaign advisory still renders the moment a campaign name
//      contains "test" — the last thing between a mistyped name and a real send.
//
// Pattern matches the repo's other render tests: createRoot + act + explicit DOM
// assertions (no snapshots).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { pinStatValues } from './_helpers/statCardPinner';
import { setReactValue } from './_helpers/nativeValueSetter';

const addToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast }),
}));

import MarketingManager from '../components/admin/MarketingManager';

const STATS_PAYLOAD = {
    audience: { total: 3, email: 2, sms: 1, by_source: { marketing_contacts: 1, drop_list: 1, sms_signup: 1 } },
    contacts: [
        { id: 'c1', email: 'buyer@example.com', phone: null, source: 'marketing_contacts' },
        { id: 'c2', email: 'lead@example.com', phone: null, source: 'drop_list' },
        { id: 'c3', email: null, phone: '+14105550000', source: 'sms_signup' },
    ],
    campaigns: [
        {
            id: 'camp-1',
            name: 'September Drop',
            subject: 'Three new pieces',
            channel: 'email',
            status: 'sent',
            sent_at: '2026-09-17T16:05:00.000Z',
            stats: { total_sent: 3, total_failed: 0, audience_count: 3 },
            audience_filter: {},
            created_at: '2026-09-17T16:00:00.000Z',
        },
    ],
};

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const findButton = (container: HTMLElement, label: string): HTMLButtonElement => {
    const match = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label);
    if (!match) throw new Error(`No button labelled "${label}" — found: ${[...container.querySelectorAll('button')].map((b) => b.textContent?.trim()).join(' | ')}`);
    return match as HTMLButtonElement;
};

describe('MarketingManager render flow', () => {
    let container: HTMLDivElement;
    let root: Root;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        fetchMock = vi.fn().mockResolvedValue(jsonResponse(STATS_PAYLOAD));
        vi.stubGlobal('fetch', fetchMock);

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('AUDIENCE_FROM_ENDPOINT: reads the audience from /api/marketing-stats with the admin bearer and renders the union', async () => {
        sessionStorage.setItem('coalition_admin_token', 'test-admin-token');

        await act(async () => { root.render(createElement(MarketingManager)); });

        // The endpoint is the ONLY source of audience data.
        expect(fetchMock).toHaveBeenCalled();
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('/api/marketing-stats');
        expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-admin-token' });

        // Stat grid: Total / Email / SMS / Sources.
        const stats = pinStatValues(container, 'div.text-2xl.font-bold');
        expect(stats.slice(0, 4)).toEqual(['3', '2', '1', '3']);

        const html = container.innerHTML;
        expect(html).toContain('buyer@example.com');
        expect(html).toContain('lead@example.com');
        expect(html).toContain('+14105550000');
        // Source labels come from the union's source field, not a browser join.
        expect(html).toContain('Drop List');
        expect(html).toContain('SMS Signup');
        expect(html).toContain('Marketing List');
    });

    it('HISTORY_FROM_ENDPOINT: the history view renders campaigns the endpoint returned', async () => {
        await act(async () => { root.render(createElement(MarketingManager)); });
        await act(async () => { findButton(container, 'History').click(); });

        const html = container.innerHTML;
        expect(html).toContain('September Drop');
        expect(html).toContain('Three new pieces');
        expect(html).toContain('3 sent / 0 failed / 3 audience');
        // Both views read the same endpoint and no view reads the tables: one
        // fetch on the audience mount, one on the history mount. The second is
        // deliberate — the composer switches to History right after a send, and a
        // cached payload would not show the campaign that just went out.
        expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
            '/api/marketing-stats',
            '/api/marketing-stats',
        ]);
    });

    it('EXPIRED_SESSION: a 401 clears the admin session and reports it instead of showing an empty audience', async () => {
        sessionStorage.setItem('coalition_admin_token', 'stale-token');
        sessionStorage.setItem('coalition_admin_mode', 'true');
        fetchMock.mockResolvedValue(jsonResponse({ error: 'Admin authorization required.' }, 401));

        await act(async () => { root.render(createElement(MarketingManager)); });

        expect(sessionStorage.getItem('coalition_admin_token')).toBeNull();
        expect(sessionStorage.getItem('coalition_admin_mode')).toBeNull();
        expect(addToast).toHaveBeenCalledWith(
            'Admin session expired — sign in again.',
            'error',
        );
        // And it must not claim there are simply no contacts.
        expect(container.innerHTML).toContain('No matching contacts');
    });

    it('TEST_CAMPAIGN_ADVISORY: typing "test" into the campaign name warns before the send button is reachable', async () => {
        await act(async () => { root.render(createElement(MarketingManager)); });
        await act(async () => { findButton(container, 'Composer').click(); });

        expect(container.querySelector('[data-testid="test-campaign-advisory"]')).toBeNull();

        const nameInput = container.querySelector('input[placeholder="Spring drop reminder"]') as HTMLInputElement;
        expect(nameInput).toBeTruthy();

        await act(async () => { setReactValue(nameInput, 'Test Drop'); });

        const advisory = container.querySelector('[data-testid="test-campaign-advisory"]');
        expect(advisory).toBeTruthy();
        expect(advisory!.textContent).toContain('verified customers');
        expect(advisory!.textContent).toContain('excluded automatically');
    });
});
