// tests/userManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/UserManager.tsx.
//
// Replicates the established pattern: createRoot + act + explicit DOM assertions
// (no snapshots). UserManager only touches Supabase directly (no useApp) and
// uses window.URL.createObjectURL for export (jsdom provides a stub - we DO NOT
// trigger the export in tests, we only assert on the button presence).
//
// 13-user fixture is engineered so the sums land on round numbers:
//   - 3 VIP users (alice, bob, carol)
//   - sg_coin_balance sums to exactly 12500 (matches Global Liquidity stat)
//   - store_credit sums to exactly $45.00 (matches Total Credit stat)
// Page 1 shows U01..U10 (all 3 VIPs visible on first page); "Showing 1-10 of 13".
//
// STAT GRID REGRESSION CATCH: We pin the four stat values via DOM traversal
// over `p.text-2xl.font-black` rather than regex over innerHTML.
// CSS classes like text-2xl and text-[10px] contain digits, so a regex anchor
// like `[^0-9]*` stops at the first digit and never reaches the value <p>.
// DOM traversal is more reliable than brittle regex here.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

// vitest auto-hoists vi.mock above the imports that follow.
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

import UserManager from '../components/admin/UserManager';

const DATES = [
    '2026-07-13T10:00:00Z', '2026-07-12T10:00:00Z', '2026-07-11T10:00:00Z',
    '2026-07-10T10:00:00Z', '2026-07-09T10:00:00Z', '2026-07-08T10:00:00Z',
    '2026-07-07T10:00:00Z', '2026-07-06T10:00:00Z', '2026-07-05T10:00:00Z',
    '2026-07-04T10:00:00Z', '2026-07-03T10:00:00Z', '2026-07-02T10:00:00Z',
    '2026-07-01T10:00:00Z',
];
const VIP_COUNT = 3;

interface FixtureRow {
    id: string; full_name: string; email: string; is_vip: boolean;
    sg_coin_balance: number; store_credit: number; created_at: string;
    ip_address: string; signup_source: string; country: string;
}

const mkUser = (
    i: number, name: string, vip: boolean, sg: number, cr: number,
): FixtureRow => ({
    id: `u-${i.toString().padStart(3, '0')}`,
    full_name: name,
    email: `${name.toLowerCase()}@x.com`,
    is_vip: vip,
    sg_coin_balance: sg,
    store_credit: cr,
    created_at: DATES[i - 1],
    ip_address: `10.0.${Math.floor(i / 10)}.${i % 10}`,
    signup_source: vip ? 'referral' : 'organic',
    country: 'US',
});

// 13 users: 3 VIP, sg_coin sums to 12500, store_credit sums to $45.00.
const USERS_13: FixtureRow[] = [
    mkUser( 1, 'Alice', true,  5000, 20),
    mkUser( 2, 'Bob',   true,  3000, 10),
    mkUser( 3, 'Carol', true,  2000,  5),
    mkUser( 4, 'Dave',  false, 1200,  5),
    mkUser( 5, 'Eve',   false,  500,  5),
    mkUser( 6, 'Frank', false,  100,  0),
    mkUser( 7, 'Grace', false,  100,  0),
    mkUser( 8, 'Hank',  false,  100,  0),
    mkUser( 9, 'Ivy',   false,  100,  0),
    mkUser(10, 'Jorge', false,  100,  0),
    mkUser(11, 'Kim',   false,  100,  0),
    mkUser(12, 'Liam',  false,  100,  0),
    mkUser(13, 'Mei',   false,  100,  0),
];

describe('UserManager render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    // Stat grid: pin the four values via DOM traversal over `p.text-2xl.font-black`.
    // Returns in document order. UserManager has exactly 4 such cards:
    //   index 0 = Total Registered, 1 = VIP Members,
    //   2 = Global Liquidity (textContent includes the inner <span>SGC</span>),
    //   3 = Total Credit.
    // CSS classes like text-2xl + text-[10px] contain digits, so a regex anchor
    // like [^0-9] * would stop at the first digit and never reach the value.
    const pinStatValues = () =>
        Array.from(container.querySelectorAll('p.text-2xl.font-black')).map(
            (p) => (p.textContent || '').trim(),
        );

    it('LOADED_13_USERS: 4 stat cards correct (13/3/12,500 SGC/$45.00), pagination prev=disabled + next=enabled', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: USERS_13, error: null } },
        ]);

        await act(async () => {
            root.render(createElement(UserManager));
        });
        const html = container.innerHTML;

        // Stat-card labels render.
        expect(html).toContain('User Management');
        expect(html).toContain('Total Registered');
        expect(html).toContain('VIP Members');
        expect(html).toContain('Global Liquidity');
        expect(html).toContain('Total Credit');

        // Stat values - pin via DOM traversal.
        const statValues = pinStatValues();
        expect(statValues[0]).toBe('13');
        expect(statValues[1]).toBe('3');
        // Global Liquidity textContent concatenates "12,500 " + "SGC" via the inner <span>.
        // The check has to anchor both ends: the locale-tolerant number at the start
        // AND the 'SGC' suffix at the end (don't match a bare number OR a bare 'SGC').
        expect(statValues[2]).toMatch(/^12[,\s.]?500\s+SGC$/);
        expect(html).toContain('SGC'); // SGC span present (defensive)
        expect(statValues[3]).toBe('$45.00');

        // VIP badge appears for every VIP user on page 1 (3 rows).
        // The avatar label is `<span ...>VIP</span>` exactly with that text.
        const vipBadgeCount = (html.match(/>\s*VIP\s*</g) || []).length;
        expect(vipBadgeCount).toBeGreaterThanOrEqual(VIP_COUNT);

        // Pagination footer text + Previous disabled, Next enabled.
        expect(html).toContain('Showing 1-10 of 13 users');
        const prevBtn = document.body.querySelector(
            'button[aria-label="Previous page"]',
        ) as HTMLButtonElement | null;
        const nextBtn = document.body.querySelector(
            'button[aria-label="Next page"]',
        ) as HTMLButtonElement | null;
        expect(prevBtn).toBeTruthy();
        expect(nextBtn).toBeTruthy();
        expect(prevBtn!.disabled).toBe(true);
        expect(nextBtn!.disabled).toBe(false);

        // No outstanding await frames from the mount-time fetch.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it(`EMPTY: stat grid 0/0/0/$0.00 + 'No users found' empty row + '1-0 of 0 users' footer`, async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(UserManager));
        });
        const html = container.innerHTML;

        // Stat counts go to zero (NaN-leak guard).
        const statValues = pinStatValues();
        expect(statValues[0]).toBe('0');
        expect(statValues[1]).toBe('0');
        // Global Liquidity textContent is "0 SGC" in EMPTY (number + space + SGC suffix).
        expect(statValues[2]).toMatch(/^0\s+SGC$/); // '0 SGC' literal format
        expect(statValues[3]).toBe('$0.00');

        // Empty-state row.
        expect(html).toContain('No users found');

        // Pagination footer renders unconditionally, totalPages=0 (less than
        // currentPage=1) so the component's `disabled={currentPage === totalPages}`
        // leaves the Next button ENABLED even though there are 0 users to navigate
        // to. Prev is disabled because currentPage=1 (initial). Pin actual
        // behavior - this surfaces the misleading Next-but-enabled edge case if
        // a future contributor fixes it to also disable Next on empty pages.
        expect(html).toContain('1-0 of 0 users');
        const prevBtn = document.body.querySelector(
            'button[aria-label="Previous page"]',
        ) as HTMLButtonElement | null;
        const nextBtn = document.body.querySelector(
            'button[aria-label="Next page"]',
        ) as HTMLButtonElement | null;
        expect(prevBtn).toBeTruthy();
        expect(nextBtn).toBeTruthy();
        expect(prevBtn!.disabled).toBe(true);     // currentPage=1 disables Prev.
        expect(nextBtn!.disabled).toBe(false);    // Captures the known edge case: 0 pages.

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

describe('UserManager search filter + export button presence', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('SEARCH_FILTER: typing "alice" filters table to 1 row + "Showing 1-1 of 1 users"', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: USERS_13, error: null } },
        ]);

        await act(async () => {
            root.render(createElement(UserManager));
        });

        const searchInput = document.body.querySelector(
            'input[placeholder*="Search by"]',
        ) as HTMLInputElement | null;
        expect(searchInput).toBeTruthy();

        const protoSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, 'value',
        )!.set!;
        protoSetter.call(searchInput!, 'alice');
        searchInput!.dispatchEvent(new Event('input', { bubbles: true }));

        await act(async => { /* allow React to flush the re-render */ });

        const html = container.innerHTML;

        // Pagination footer reflects 1-row filtered result.
        expect(html).toContain('Showing 1-1 of 1 users');

        // The OTHER user names that were on page 1 drop out of the table.
        expect(html).not.toContain('Bob');
        expect(html).not.toContain('Carol');
        expect(html).not.toContain('Dave');
        expect(html).not.toContain('Eve');
        expect(html).not.toContain('Frank');
        expect(html).not.toContain('Grace');
        // Matching row(s) are still rendered.
        expect(html).toContain('Alice');
        expect(html).toContain('alice@x.com');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('EXPORT_BUTTON_PRESENT: Export CRM List + Refresh buttons render, exportBtn not disabled', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: USERS_13, error: null } },
        ]);

        await act(async () => {
            root.render(createElement(UserManager));
        });

        const html = container.innerHTML;
        expect(html).toContain('Export CRM List');
        expect(html).toContain('Refresh');

        // Don't trigger the export - jsdom's URL.createObjectURL is a stub and
        // the click would throw a NotImplementedError. The presence + not-disabled
        // assertion is the regression guard (someone accidentally wrapping the
        // export button in a disabled state catches it here).
        const exportBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Export CRM List'),
        ) as HTMLButtonElement | null;
        expect(exportBtn).toBeTruthy();
        expect(exportBtn!.disabled).toBe(false);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
