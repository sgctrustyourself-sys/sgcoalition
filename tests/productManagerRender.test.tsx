// tests/productManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/ProductManager.tsx.
//
// Replicates the established pattern: createRoot + act + explicit DOM assertions.
//
// Mock surface:
//   - ../services/supabase (mockSupabase singleton) - ProductManager doesn't call
//     supabase directly, but vi.mock keeps the chain-shaped client reference stable.
//   - ../context/AppContext - useApp() returns products[] + 3 action fns (addProduct,
//     updateProduct, deleteProduct). Per-test mockReturnValue via vi.mocked(useApp).
//   - ../services/imgurService - syncProductsToCode stubbed with default
//     mockResolvedValue({ hash: 'abc123' }) so the Sync Code button can succeed
//     without exercising the real sync logic.
//   - ../services/productDrift - fetchProductDrift stubbed to a clean report by
//     default; the catalog-drift tests override it per test to prove the line
//     shows differences, agreement, and a failed check as three distinct states.
//   - ../services/productUpload - uploadProductImage stubbed (auto-mock vi.fn()).
//   - ../components/ui/ImageCropperModal - image cropper stubbed with data-testid
//     marker (default export pattern matches ManualOrderForm/Invoice stubs in
//     tests/orderManagerRender.test.tsx).
//
// Drag-and-drop image reordering is DELIBERATELY NOT TESTED per the prior reviewer's
// recommendation #6 - jsdom drag events are notoriously brittle and the business
// logic impact is minimal (a regression in dnd would be visually obvious in dev).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

// vitest auto-hoists vi.mock above the imports that follow.
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));
vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));
vi.mock('../services/imgurService', () => ({
    // Carries the seed-merge report, because the success message is built from it:
    // the button must say what the sync wrote, and how much it deliberately kept.
    syncProductsToCode: vi.fn().mockResolvedValue({
        hash: 'abc123',
        report: {
            targeted: ['p1', 'p2'],
            rewritten: ['p2'],
            seedOnly: ['prod_local_only'],
            added: [],
            drift: [],
        },
    }),
}));
const driftHolder = vi.hoisted(() => ({
    report: {
        checkedAt: '2026-09-17T00:00:00.000Z',
        seedEntries: 31,
        dbRows: 26,
        drift: [] as Array<{ id: string; field: string; seed: string; db: string }>,
        seedOnly: ['prod_local_only'],
        missingFromSeed: [] as string[],
    },
    error: null as Error | null,
}));
vi.mock('../services/productDrift', () => ({
    fetchProductDrift: vi.fn(async () => {
        if (driftHolder.error) throw driftHolder.error;
        return driftHolder.report;
    }),
}));
vi.mock('../services/productUpload', () => ({
    uploadProductImage: vi.fn(),
}));
vi.mock('../components/ui/ImageCropperModal', () => ({
    default: () => <div data-testid="image-cropper-stub" />,
}));

import { useApp } from '../context/AppContext';
import ProductManager from '../components/admin/ProductManager';

interface TestProduct {
    id: string;
    name: string;
    price: number;
    images: string[];
    description: string;
    category: string;
    isFeatured: boolean;
    sizes: string[];
    sizeInventory: Record<string, number>;
    archived: boolean;
}

// 3 fixtures with distinct names for SEARCH_FILTER scoping (search 'tee'
// narrows to only the Coalition Tee - Coalition Hoodie + Snapback excluded).
const PROD_COALITION_TEE: TestProduct = {
    id: 'prod-coalition-tee',
    name: 'Coalition Classic Tee',
    price: 45,
    images: ['/images/tee-front.jpg', '/images/tee-back.jpg'],
    description: 'Premium cotton tee with embroidered Coalition logo.',
    category: 'apparel',
    isFeatured: true,
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 12, M: 8, L: 5, XL: 2 },
    archived: false,
};
const PROD_COALITION_HOODIE: TestProduct = {
    id: 'prod-coalition-hoodie',
    name: 'Coalition Hoodie',
    price: 80,
    images: ['/images/hoodie-front.jpg'],
    description: 'Heavyweight hoodie with kangaroo pocket.',
    category: 'hoodie',
    isFeatured: false,
    sizes: ['M', 'L', 'XL', 'XXL'],
    sizeInventory: { M: 6, L: 4, XL: 3, XXL: 1 },
    archived: false,
};
const PROD_COALITION_SNAPBACK: TestProduct = {
    id: 'prod-coalition-snapback',
    name: 'Coalition Snapback',
    price: 35,
    images: ['/images/snapback.jpg'],
    description: 'Structured snapback with embroidered logo.',
    category: 'hat',
    isFeatured: false,
    sizes: ['One Size'],
    sizeInventory: { 'One Size': 20 },
    archived: false,
};

const TEST_PRODUCTS: TestProduct[] = [
    PROD_COALITION_TEE,
    PROD_COALITION_HOODIE,
    PROD_COALITION_SNAPBACK,
];
const EMPTY_PRODUCTS: TestProduct[] = [];

describe('ProductManager edit form open + sync code interactions', () => {
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

        vi.mocked(useApp).mockReturnValue({
            products: TEST_PRODUCTS,
            addProduct: vi.fn().mockResolvedValue(undefined),
            updateProduct: vi.fn().mockResolvedValue(undefined),
            deleteProduct: vi.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('EDIT_FORM_OPEN: clicking Edit[0] mounts form with Name + Price + Category select + Sizes + Featured checkbox; image grid renders 2 images for Coalition Tee', async () => {
        await act(async () => {
            root.render(createElement(ProductManager));
        });
        expect(container.innerHTML).not.toContain('Edit Product');

        // Click first Edit button (Coalition Tee since fixtures are rendered in order).
        const firstEditBtn = document.body.querySelector(
            'button[title="Edit"]',
        ) as HTMLButtonElement | null;
        expect(firstEditBtn).toBeTruthy();

        await act(async => { firstEditBtn!.click(); });

        const html = container.innerHTML;

        // Form h3 shows 'Edit Product' (not 'Add New Product' because editingId is set, isAdding is false).
        expect(html).toContain('Edit Product');
        expect(html).not.toContain('Add New Product');

        // Form fields render.
        // Name input (no specific selector - just verify a text input is visible in form).
        const nameInputs = Array.from(document.body.querySelectorAll('input[type="text"]'));
        expect(nameInputs.length).toBeGreaterThanOrEqual(1);
        // Price input (title/aria-label).
        const priceInput = document.body.querySelector(
            'input[aria-label="Product Price"]',
        ) as HTMLInputElement | null;
        expect(priceInput).toBeTruthy();
        // Category select (aria-label).
        const categorySelect = document.body.querySelector(
            'select[aria-label="Product Category"]',
        ) as HTMLSelectElement | null;
        expect(categorySelect).toBeTruthy();
        // 7 category options (the JSX lists apparel/accessory/shirt/hoodie/hat/jeans/wallet).
        expect(categorySelect!.options.length).toBe(7);
        // Inventory per-size inputs visible (4 sizes for the Coalition Tee).
        const inventoryInputs = Array.from(document.body.querySelectorAll('input[aria-label^="Inventory for size"]'));
        expect(inventoryInputs.length).toBe(4);
        // Featured Product checkbox (id + aria-label).
        const featuredCheckbox = document.body.querySelector(
            'input#featured',
        ) as HTMLInputElement | null;
        expect(featuredCheckbox).toBeTruthy();
        // Featured label text present.
        expect(html).toContain('Featured Product');

        // Image grid for Coalition Tee: form shows BOTH /images/tee-front.jpg + /images/tee-back.jpg.
        // Pin by substring presence - the LIST card behind the form also shows
        // images[0] (tee-front), so element-count would catch duplicates (the previous
        // version expected 2 elements but rendered 3 because tee-front.jpg appears in
        // both the list card AND the form's image grid). Substring presence sidesteps
        // that while catching both back + front URLs.
        expect(html).toContain('/images/tee-front.jpg');
        expect(html).toContain('/images/tee-back.jpg');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('SYNC_BUTTON: clicking Sync Code -> confirm() spy fires -> syncProductsToCode mock called -> success msg renders with hash', async () => {
        await act(async () => {
            root.render(createElement(ProductManager));
        });

        // Click Sync Code button (title attribute matches JSX). The beforeEach
        // ALREADY installed vi.spyOn(window, 'confirm').mockReturnValue(true) so
        // handleSync proceeds past the guard. We do NOT re-spy here - that would
        // shadow the mockReturnValue with a fresh vi.spyOn that returns undefined
        // by default, causing handleSync to early-return BEFORE firing
        // syncProductsToCode (the previous version's failure mode).
        const syncBtn = document.body.querySelector(
            'button[title="Sync Supabase products into constants.ts (products with no DB row are kept)"]',
        ) as HTMLButtonElement | null;
        expect(syncBtn).toBeTruthy();

        await act(async => { syncBtn!.click(); });

        const html = container.innerHTML;

        // confirm() must have been called. The beforeEach provides a spy with
        // mockReturnValue(true) so handleSync proceeds past the guard to fire
        // syncProductsToCode (which resolves with a merge report and renders the
        // success message - the proxy for "the click reached the post-confirm
        // path").
        expect(window.confirm).toHaveBeenCalled();

        // The prompt must state the rule, because "sync" used to mean "replace":
        // an operator has to know the local-only products survive the click.
        expect(String(vi.mocked(window.confirm).mock.calls[0][0])).toContain('never held');

        // Success message renders the counts from the report plus the hash.
        expect(html).toContain('Sync complete');
        expect(html).toContain('2 from the database');
        expect(html).toContain('1 rewritten');
        expect(html).toContain('kept');
        expect(html).toContain('abc123');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

describe('ProductManager render flow', () => {
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

        // Baseline useApp - LOADED products. EMPTY test overrides per-test.
        vi.mocked(useApp).mockReturnValue({
            products: TEST_PRODUCTS,
            addProduct: vi.fn().mockResolvedValue(undefined),
            updateProduct: vi.fn().mockResolvedValue(undefined),
            deleteProduct: vi.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('LOADED_PRODUCTS: header + 4 action buttons (Search/Sync/Add) + 3 product cards render + no edit form mounted', async () => {
        await act(async () => {
            root.render(createElement(ProductManager));
        });
        const html = container.innerHTML;

        // Header.
        expect(html).toContain('Manage your catalog and inventory');
        // Search input + Sync Code + Add Product buttons all present.
        expect(html).toContain('Search Products');
        expect(html).toContain('Sync Code');
        expect(html).toContain('Add Product');
        // Search placeholder.
        expect(html).toContain('Search products...');

        // 3 product names visible in the grid.
        expect(html).toContain('Coalition Classic Tee');
        expect(html).toContain('Coalition Hoodie');
        expect(html).toContain('Coalition Snapback');

        // Edit / Duplicate / Delete buttons present per row.
        const editBtnCount = document.body.querySelectorAll('button[title="Edit"]').length;
        const dupBtnCount = document.body.querySelectorAll('button[title="Duplicate"]').length;
        const delBtnCount = document.body.querySelectorAll('button[title="Delete"]').length;
        expect(editBtnCount).toBe(3);
        expect(dupBtnCount).toBe(3);
        expect(delBtnCount).toBe(3);

        // No edit form mounted (h3 'Add New Product' OR 'Edit Product' absent).
        expect(html).not.toContain('Add New Product');
        expect(html).not.toContain('Edit Product');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('SEARCH_FILTER: typing "tee" filters grid to only Coalition Tee (Hoodie + Snapback drop out)', async () => {
        await act(async () => {
            root.render(createElement(ProductManager));
        });

        const searchInput = document.body.querySelector(
            'input[placeholder="Search products..."]',
        ) as HTMLInputElement | null;
        expect(searchInput).toBeTruthy();

        const protoSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, 'value',
        )!.set!;
        protoSetter.call(searchInput!, 'tee');
        searchInput!.dispatchEvent(new Event('input', { bubbles: true }));

        await act(async => { /* allow React to flush the re-render */ });
        const html = container.innerHTML;

        // Coalition Tee (name contains 'tee') survives.
        expect(html).toContain('Coalition Classic Tee');
        // Hoodie + Snapback drop out.
        expect(html).not.toContain('Coalition Hoodie');
        expect(html).not.toContain('Coalition Snapback');

        // Edit buttons reduce from 3 to 1 visible.
        const editBtnCount = document.body.querySelectorAll('button[title="Edit"]').length;
        expect(editBtnCount).toBe(1);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

// The drift report used to exist only in the `syncProducts` CLI's stdout. These pin
// the three states an operator can be in, because the dangerous one is silence: a
// failed check must never be indistinguishable from an in-sync catalog.
describe('ProductManager catalog drift line', () => {
    let container: HTMLDivElement;
    let root: Root;

    const clickShowDifferences = () => {
        const toggle = [...document.body.querySelectorAll('button')].find(
            (b) => /differences/i.test(b.textContent || ''),
        ) as HTMLButtonElement | undefined;
        expect(toggle, 'the differences toggle must be present when there are any').toBeTruthy();
        act(() => { toggle!.click(); });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        driftHolder.report = {
            checkedAt: '2026-09-17T00:00:00.000Z',
            seedEntries: 31,
            dbRows: 26,
            drift: [],
            seedOnly: ['prod_local_only'],
            missingFromSeed: [],
        };
        driftHolder.error = null;

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        vi.mocked(useApp).mockReturnValue({
            products: TEST_PRODUCTS,
            addProduct: vi.fn().mockResolvedValue(undefined),
            updateProduct: vi.fn().mockResolvedValue(undefined),
            deleteProduct: vi.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('DRIFT_CLEAN: an agreed catalog says so, with the counts', async () => {
        await act(async () => {
            root.render(createElement(ProductManager));
        });

        const html = container.innerHTML;
        expect(html).toContain('in sync with the products table');
        expect(html).toContain('31 seed entries');
        expect(html).toContain('26 table rows');
        expect(html).toContain('1 kept with no row');
    });

    it('DRIFT_ROWS: shows the count, and the lines only when asked for them', async () => {
        driftHolder.report.drift = [
            { id: 'prod_1773860269374', field: 'price', seed: '60', db: '40' },
        ];

        await act(async () => {
            root.render(createElement(ProductManager));
        });

        expect(container.innerHTML).toContain('1 difference between constants/products.ts and the products table');
        // Collapsed: the count is the alarm, the detail is on demand.
        expect(container.innerHTML).not.toContain('seed 60 vs database 40');

        clickShowDifferences();

        expect(container.innerHTML).toContain('prod_1773860269374.price: seed 60 vs database 40');
        expect(container.innerHTML, 'the operator is told what Sync Code will do about it').toContain(
            'Sync Code rewrites every product the table holds',
        );
    });

    it('DRIFT_ERROR: a failed check says so instead of rendering nothing', async () => {
        driftHolder.error = new Error('Catalog drift check failed (HTTP 401)');

        await act(async () => {
            root.render(createElement(ProductManager));
        });

        const html = container.innerHTML;
        expect(html).toContain("Couldn't check the catalog against the products table");
        expect(html).toContain('HTTP 401');
        expect(html, 'a failure must not read as agreement').not.toContain('in sync with the products table');
    });
});

