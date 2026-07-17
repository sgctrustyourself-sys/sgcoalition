// tests/orderManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/OrderManager.tsx.
//
// Replicates the established createRoot + act + explicit-DOM-assertions pattern.
//
// OrderManager's data flows from useApp() (AppContext) - not Supabase - so we
// mock ../context/AppContext with a vi.fn() that we re-shape per-test via
// vi.mocked(useApp).mockReturnValue({...}) instead of swapping fixtures through
// the supabase mock queue.
//
// The component imports two sibling components at module load:
//   - ManualOrderForm (../components/ManualOrderForm) - shown when showManualOrderForm=true
//   - Invoice (../components/Invoice) - shown when showInvoice is set
// We stub both with data-testid markers so any test that accidentally opens
// these modals gets a visible marker instead of a sub-render crash.
//
// STAT GRID REGRESSION CATCH: We pin the four stat values via DOM traversal of
// `p.text-2xl.font-bold` rather than regex over innerHTML. Regex anchors like
// `[^0-9]*` and `[^>]*>` stop at the first digit or `>` in the path - and CSS
// class names (text-2xl, text-[10px]) contain digits, and the value <p> sits
// BEHIND closing/opening <p> tags - so DOM traversal is more reliable.
//
// NEWEST-FIRST ORDERING: OrderManager.sort() orders by createdAt DESCENDING,
// so the FIRST eye-icon click opens SG-102 (Cara, refunded), NOT SG-100
// (Alice, paid). The MODAL_OPEN test pins SG-102/Cara/Tee/'Current: refunded'.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

// vitest auto-hoists vi.mock above the imports below.
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));
vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock('../components/ManualOrderForm', () => ({
    default: () => <div data-testid="manual-order-form-stub" />,
}));
vi.mock('../components/Invoice', () => ({
    default: () => <div data-testid="invoice-stub" />,
}));
// CustomerLinkModal mounts a real CustomerLinkModal (which talks to
// Supabase via buildCustomerProfile + buildCustomerProfileByEmail).
// Tests for the modal component are locked in tests/customerLinkModalRender.test.tsx.
// Here we stub it to a marker div so the OrderManager render-flow test
// stays free of Supabase state - CUST_LINK_MODAL_FOUND asserts the stub
// renders when the customer name is clicked.
vi.mock('../components/admin/CustomerLinkModal', () => ({
    default: () => <div data-testid="customer-link-modal" />,
}));

import { useApp } from '../context/AppContext';
import OrderManager from '../components/admin/OrderManager';

interface TestOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    paymentMethod: string;
    paymentStatus: 'paid' | 'pending' | 'refunded';
    orderType: 'online' | 'manual';
    total: number;
    subtotal: number;
    items: Array<{
        productName: string;
        productImage: string;
        selectedSize: string;
        quantity: number;
        total: number;
    }>;
    createdAt: string;
}

// 3 orders engineered so the stat grid sums land on round numbers:
//   - Total revenue: 150 + 80 + 200 = $430.00
//   - Pending count: 1 (o-101, Bob)
//   - Manual count: 1 (o-101, Bob)
// createdAt spans 07-10, 07-12, 07-14 - so DESC sort puts SG-102 first.
const TEST_ORDERS: TestOrder[] = [
    {
        id: 'o-100', orderNumber: 'SG-100',
        customerName: 'Alice', customerEmail: 'alice@x.com',
        paymentMethod: 'paypal', paymentStatus: 'paid',
        orderType: 'online', total: 150, subtotal: 150,
        items: [{
            productName: 'Wallet', productImage: '/w.png',
            selectedSize: 'M', quantity: 1, total: 150,
        }],
        createdAt: '2026-07-10T10:00:00Z',
    },
    {
        id: 'o-101', orderNumber: 'SG-101',
        customerName: 'Bob', customerEmail: 'bob@x.com',
        paymentMethod: 'stripe', paymentStatus: 'pending',
        orderType: 'manual', total: 80, subtotal: 80,
        items: [{
            productName: 'Hat', productImage: '/h.png',
            selectedSize: 'L', quantity: 2, total: 80,
        }],
        createdAt: '2026-07-12T09:00:00Z',
    },
    {
        id: 'o-102', orderNumber: 'SG-102',
        customerName: 'Cara', customerEmail: 'cara@x.com',
        paymentMethod: 'paypal', paymentStatus: 'refunded',
        orderType: 'online', total: 200, subtotal: 200,
        items: [{
            productName: 'Tee', productImage: '/t.png',
            selectedSize: 'S', quantity: 1, total: 200,
        }],
        createdAt: '2026-07-14T08:00:00Z',
    },
];

const EMPTY_ORDERS: TestOrder[] = [];

describe('OrderManager render flow', () => {
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

        // Baseline useApp - LOADED orders. EMPTY test overrides per-test.
        // Effect handlers (deleteOrder, updateOrderStatus) are kept neutral
        // so they neither await on a real Promise nor trigger addToast noise.
        vi.mocked(useApp).mockReturnValue({
            orders: TEST_ORDERS,
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
            deleteOrder: vi.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    // Stat grid: pin the four values via DOM traversal over `p.text-2xl.font-bold`.
    // Returns in document order. OrderManager has exactly 4 such cards:
    //   index 0 = Total Orders, 1 = Total Revenue, 2 = Pending, 3 = Manual.
    const pinStatValues = () =>
        Array.from(container.querySelectorAll('p.text-2xl.font-bold')).map(
            (p) => (p.textContent || '').trim(),
        );

    it('LOADED: header + stat grid (3/430/1/1) + 3 rows + green/paid badge + no detail modal', async () => {
        await act(async () => {
            root.render(createElement(OrderManager));
        });

        // Header + buttons.
        expect(container.innerHTML).toContain('Manage customer orders and invoices');
        expect(container.innerHTML).toContain('Export CSV');
        expect(container.innerHTML).toContain('Create Order');

        // Stat grid sums - pin via DOM traversal (not regex).
        const statValues = pinStatValues();
        expect(statValues[0]).toBe('3');
        expect(statValues[1]).toBe('$430.00');
        expect(statValues[2]).toBe('1');
        expect(statValues[3]).toBe('1');

        // Order rows - all 3 order numbers + Alice/Bob/Cara all visible.
        const html = container.innerHTML;
        expect(html).toContain('SG-100');
        expect(html).toContain('SG-101');
        expect(html).toContain('SG-102');
        expect(html).toContain('Alice');
        expect(html).toContain('Bob');
        expect(html).toContain('Cara');

        // Color-class badges for status.<span class="text-green-400...">paid</span>
        // and <span class="text-red-400...">refunded</span> appear. This regex is
        // stable because it anchors the className + content of the SAME <span>.
        expect(html).toMatch(/text-green-400[^"]*"[^>]*>\s*paid\b/);
        expect(html).toMatch(/text-red-400[^"]*"[^>]*>\s*refunded\b/);

        // No detail modal mounted yet.
        expect(html).not.toContain('Order Details');
        expect(html).not.toContain('Delete Order?');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('EMPTY: orders=[] -> stat grid 0/0.00/0/0, "No orders found" empty row, no SG-*', async () => {
        vi.mocked(useApp).mockReturnValue({
            orders: EMPTY_ORDERS,
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
            deleteOrder: vi.fn().mockResolvedValue(undefined),
        });

        await act(async () => {
            root.render(createElement(OrderManager));
        });
        const html = container.innerHTML;

        const statValues = pinStatValues();
        expect(statValues[0]).toBe('0');
        expect(statValues[1]).toBe('$0.00');
        expect(statValues[2]).toBe('0');
        expect(statValues[3]).toBe('0');

        // Empty-state row.
        expect(html).toContain('No orders found');

        // All three order numbers absent.
        expect(html).not.toContain('SG-100');
        expect(html).not.toContain('SG-101');
        expect(html).not.toContain('SG-102');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});


describe('OrderManager modal open + status filter interactions', () => {
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

        vi.mocked(useApp).mockReturnValue({
            orders: TEST_ORDERS,
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
            deleteOrder: vi.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    const pinStatValues = () =>
        Array.from(container.querySelectorAll('p.text-2xl.font-bold')).map(
            (p) => (p.textContent || '').trim(),
        );

    it(`MODAL_OPEN: clicking Eye[N°0] opens Order Details modal with SG-102 + Cara + 'Current: refunded' + red badge`, async () => {
        await act(async () => {
            root.render(createElement(OrderManager));
        });
        const html0 = container.innerHTML;
        // Sanity: modal not yet mounted.
        expect(html0).not.toContain('Order Details');

        // OrderManager.sort is by createdAt DESCENDING, so SG-102 (07-14) is the
        // first row. The first Eye-icon click therefore opens SG-102 (Cara),
        // NOT SG-100 (Alice). Modal contents reflect the clicked row.
        const eyeBtn = document.body.querySelector(
            'button[title="View Details"]',
        ) as HTMLButtonElement | null;
        expect(eyeBtn).toBeTruthy();

        await act(async => { eyeBtn!.click(); });

        const html = container.innerHTML;
        expect(html).toContain('Order Details');
        expect(html).toContain('SG-102');
        expect(html).toContain('Cara');
        expect(html).toContain('cara@x.com');
        expect(html).toContain('Tee'); // productName in SG-102 items
        // "Current: refunded" badge - RED color class on refunded status.
        expect(html).toMatch(/Current:\s*refunded/);
        expect(html).toMatch(/text-red-400[^"]*"[^>]*>\s*Current:\s*refunded/);
        // Status select inside modal lists the 7 statuses (pending/paid/etc).
        expect(html).toContain('Change order status');
        expect(html).toContain('Processing');
        expect(html).toContain('Shipped');
        expect(html).toContain('Delivered');
        // Inline item-row assertion: the SG-102 item has $200 price visible.
        expect(html).toContain('$200.00');

        // Opening the modal is read-only - OrderManager doesn't fire any
        // Supabase writes just by opening.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('CUST_LINK_RENDER: clicking customer name in the first row mounts the CustomerLinkModal stub', async () => {
        await act(async () => {
            root.render(createElement(OrderManager));
        });
        // Modal should NOT be in the DOM yet.
        expect(document.body.querySelector('[data-testid="customer-link-modal"]')).toBeNull();

        // Click the customer-name button on the FIRST row (newest sort, so SG-102/Cara).
        const trigger = document.body.querySelector(
            'button[data-testid="customer-link-trigger"]',
        ) as HTMLButtonElement | null;
        expect(trigger).toBeTruthy();

        await act(async => { trigger!.click(); });
        expect(document.body.querySelector('[data-testid="customer-link-modal"]')).toBeTruthy();
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('FILTER: setting status select to "paid" filters table to only SG-100 (newest stat grid unchanged)', async () => {
        await act(async => {
            root.render(createElement(OrderManager));
        });
        // Sanity: 3 orders visible BEFORE the filter change.
        let html0 = container.innerHTML;
        expect(html0).toContain('SG-100');
        expect(html0).toContain('SG-101');
        expect(html0).toContain('SG-102');

        // The two <select>s: aria-label "Filter by Status" + "Filter by Order Type".
        const statusSelect = Array.from(document.body.querySelectorAll('select')).find(
            (s) => s.getAttribute('aria-label') === 'Filter by Status',
        ) as HTMLSelectElement | null;
        expect(statusSelect).toBeTruthy();
        // Bypass React's value-tracking via the prototype setter.
        const selectSetter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype, 'value',
        )!.set!;
        selectSetter.call(statusSelect!, 'paid');
        statusSelect!.dispatchEvent(new Event('change', { bubbles: true }));

        await act(async => { /* flush the re-render */ });

        // Filter is local to the table - SG-100 (paid) survives, SG-101 (pending)
        // + SG-102 (refunded) drop.
        const html1 = container.innerHTML;
        expect(html1).toContain('SG-100');
        expect(html1).not.toContain('SG-101');
        expect(html1).not.toContain('SG-102');

        // Stat grid still reflects UNFILTERED totals. Pin via DOM traversal.
        const statValues = pinStatValues();
        expect(statValues[0]).toBe('3');        // Total Orders (unaffected)
        expect(statValues[1]).toBe('$430.00');  // Total Revenue (unaffected)
        expect(statValues[2]).toBe('1');        // Pending (unaffected)

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
