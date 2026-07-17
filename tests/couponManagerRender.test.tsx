// tests/couponManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/CouponManager.tsx.
//
// Replicates the established pattern from tests/customerProfileAdminRender.test.tsx:
// createRoot + act + explicit DOM assertions (no snapshots). Mock infra is
// tests/_helpers/supabaseClientMock.ts (singleton .client + setOutcomes queue).
//
// CouponManager only touches Supabase directly (no useApp), and `deleteCoupon`
// gates on window.confirm() which jsdom will block on unless we spy.
// `vi.restoreAllMocks()` in afterEach releases the spy cleanly between tests.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

// vitest auto-hoists vi.mock above the imports that follow.
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

import CouponManager from '../components/admin/CouponManager';

const COUPON_ACTIVE = {
    id: 'cp-001', code: 'SUMMER2025',
    discount_type: 'percent' as const, discount_value: 20,
    min_order_value: 50, max_uses: 100, used_count: 15,
    start_date: null, end_date: '2026-08-31', is_active: true,
};
const COUPON_INACTIVE = {
    id: 'cp-002', code: 'WINTER2025',
    discount_type: 'fixed' as const, discount_value: 10,
    min_order_value: 0, max_uses: null, used_count: 0,
    start_date: null, end_date: null, is_active: false,
};


describe('CouponManager render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // Stub confirm() with a sane default. Per-test can override if needed.
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('LOADED: renders Coupon Manager h2, Create toggle, 2 rows with ACTIVE/INACTIVE buttons', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [COUPON_ACTIVE, COUPON_INACTIVE], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(CouponManager));
        });

        const html = container.innerHTML;
        expect(html).toContain('Coupon Manager');
        expect(html).toContain('Create Coupon');
        expect(html).toContain('SUMMER2025');
        expect(html).toContain('WINTER2025');
        expect(html).toContain('20% OFF');
        expect(html).toContain('$10 OFF');
        expect(html).toContain('15 uses');
        expect(html).toContain('100</span>'); // max_uses appears inside the usage cell
        expect(html).toContain('ACTIVE');
        expect(html).toContain('INACTIVE');
        expect(html).not.toContain('No coupons created yet');
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('EMPTY: renders "No coupons created yet" empty row when supabase returns []', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(CouponManager));
        });

        const html = container.innerHTML;
        expect(html).toContain('No coupons created yet');
        expect(html).not.toContain('SUMMER2025');
        expect(html).not.toContain('WINTER2025');
        // ACTIVE/INACTIVE buttons only render when there are rows.
        expect(html).not.toMatch(/>\s*ACTIVE\s*</);
        expect(html).not.toMatch(/>\s*INACTIVE\s*</);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});


describe('CouponManager form submit + toggle interactions', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('CREATE_FORM_SUBMIT: clicking toggle opens form; fill + submit fires insert with correct payload', async () => {
        // 3 awaits consumed: initial-fetch, insert, post-insert-refresh.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(CouponManager));
        });

        // Toggle button is the OUTER "Create Coupon" (not the inner submit).
        // Both have textContent "Create Coupon"; distinguish by not being inside a <form>.
        const toggleBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Create Coupon') && !b.closest('form'),
        ) as HTMLButtonElement | undefined;
        expect(toggleBtn).toBeTruthy();

        await act(async () => { toggleBtn!.click(); });

        // Form mounts with the 5 inputs in expected order.
        expect(container.innerHTML).toContain('Coupon Code');
        expect(container.innerHTML).toContain('Expiry Date');
        const codeInput = document.body.querySelector(
            'input[placeholder="SUMMER2025"]',
        ) as HTMLInputElement | null;
        expect(codeInput).toBeTruthy();
        const valueInput = document.body.querySelector(
            'input[type="number"]',
        ) as HTMLInputElement | null;
        expect(valueInput).toBeTruthy();

        // React tracks input values via its internal value-tracking hook; setting
        // .value directly bypasses React's bookkeeping so we use the prototype setter.
        const protoSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, 'value',
        )!.set!;
        protoSetter.call(codeInput!, 'SUMMER2026');
        codeInput!.dispatchEvent(new Event('input', { bubbles: true }));
        protoSetter.call(valueInput!, '25');
        valueInput!.dispatchEvent(new Event('input', { bubbles: true }));

        const form = document.body.querySelector('form');
        expect(form).toBeTruthy();
        await act(async () => {
            form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });

        // insertSpy captures the row payload. discount_type defaults to 'percent'.
        // min_order_value defaults to '0', max_uses null, end_date null, is_active true.
        expect(mockSupabase.insertSpy).toHaveBeenCalledWith(expect.objectContaining({
            code: 'SUMMER2026',
            discount_type: 'percent',
            discount_value: 25,
            min_order_value: 0,
            is_active: true,
        }));
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('coupons');
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('TOGGLE_STATUS: clicking ACTIVE button fires update({is_active:false}) + post-update refresh', async () => {
        // 3 awaits consumed: initial-fetch, update, post-update-refresh.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [COUPON_ACTIVE], error: null } },
            { kind: 'resolve', value: { error: null } },
            { kind: 'resolve', value: { data: [COUPON_INACTIVE], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(CouponManager));
        });

        // The row renders one of these buttons with textContent trimmed to 'ACTIVE'.
        const activeBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === 'ACTIVE',
        ) as HTMLButtonElement | undefined;
        expect(activeBtn).toBeTruthy();

        await act(async () => { activeBtn!.click(); });

        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({ is_active: false });
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('id', 'cp-001');
        // Initial-fetch consumes outcome[0], update consumes outcome[1],
        // post-update-refresh consumes outcome[2]. No frames dropped.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
