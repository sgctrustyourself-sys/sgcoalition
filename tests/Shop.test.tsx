import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Closes the last-mile integration loop for the per-product skeleton variant
// shipped in commit 3d4070a. The 12 ProductCardSkeleton tests verify what the
// skeleton does *given* a product, but they cannot catch a Shop.tsx refactor
// that accidentally passes products[i] (raw list) instead of filteredProducts[i]
// (user-visible list). This spec mounts the real Shop.tsx with a mocked
// useApp hook and asserts the per-slot bg resolution matches the user-visible
// list under two scenarios.

// --- Mocks: keep them shallow. The integration concern is products +
// isLoading; side effects in the real useApp (Supabase auth, realtime
// channels, toast context, crypto balance sync) would all interfere with
// jsdom. utils/categoryFilter.matchesCategoryFilter is intentionally NOT
// mocked -- it's a pure-data filter (verified by file inspection: no React
// hooks, no localStorage, no data/ imports) so the test exercises the real
// category-filter math in the bug-detector case.

const mockUseApp = vi.fn();

vi.mock('../context/AppContext', () => ({
    useApp: () => mockUseApp(),
}));

// Lucide-react icons are decorative SVG wrappers; they don't affect the
// skeleton-grid render path. Stub them as no-ops.
vi.mock('lucide-react', () => ({
    Filter: () => null,
    Check: () => null,
    Zap: () => null,
    TrendingUp: () => null,
}));

// Stub ProductCard: we're testing the isLoading branch exclusively, so the
// non-skeleton product render path doesn't need the real component.
vi.mock('../components/ProductCard', () => ({
    default: ({ product }: { product: any }) => (
        <div data-testid="product-card" data-product-id={product?.id || 'unknown'}>
            {product?.name || 'unknown'}
        </div>
    ),
}));

// Stub Seo + Newsletter + SearchBar: decorative wrappers around <Shop />
// that don't intersect the grid render path. SEO/marketing context is
// covered by other tests.
vi.mock('../components/Seo', () => ({ default: () => null }));
vi.mock('../components/SearchBar', () => ({ default: () => null }));
vi.mock('../components/Newsletter', () => ({ default: () => null }));

// Stub utils seo: buildItemListJsonLd is invoked via useMemo on every render
// and assumes a wider Product shape than the smoke-test buildProduct below.
// Mock keeps Shop's render path clean.
vi.mock('../utils/seo', () => ({
    buildItemListJsonLd: () => ({}),
}));

// Import Shop AFTER the mocks have been registered so its module-level
// dependency resolution hits our stubs.
import Shop from '../pages/Shop';

// Minimal product shape: imageRoles is the only field read by both the
// skeleton resolution logic AND the Shop filter chain. Category is the
// filter dimension the second test exercises.
const buildProduct = (
    id: string,
    opts: { imageRoles?: any; category?: string } = {},
): any => ({
    id,
    name: `Product ${id}`,
    price: 40,
    images: ['https://example.com/a.jpg'],
    imageRoles: opts.imageRoles,
    description: '',
    category: opts.category ?? 'shirt',
    sizes: ['S', 'M', 'L'],
    sizeInventory: { S: 1, M: 1, L: 1 },
});

// Shop's initial useState reads window.location.search synchronously to
// derive the category. Reset it before each test so a prior test's history
// push doesn't leak across describe boundaries.
const resetWindowLocation = () => {
    if (typeof window === 'undefined') return;
    try {
        window.history.pushState({}, '', '/shop');
    } catch {
        // jsdom is strict about full URL pushes; the test fallback would
        // be Object.defineProperty(window, 'location', {...}).
    }
};

describe('Shop.tsx skeleton-map integration', () => {
    beforeEach(() => {
        resetWindowLocation();
        mockUseApp.mockReset();
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        resetWindowLocation();
    });

    it('during isLoading, renders 6 skeletons and resolves bg per-slot from filteredProducts[i]', () => {
        // isLoading=true; default category='all'; products=3 items; no
        // active filter so filteredProducts === products (3 items).
        const products = [
            buildProduct('prod_a', { imageRoles: { imageBackground: 'white' }, category: 'shirt' }),
            buildProduct('prod_b', { imageRoles: { imageBackground: 'gray-900' }, category: 'jeans' }),
            buildProduct('prod_c', { imageRoles: { imageBackground: 'transparent' }, category: 'hat' }),
        ];
        mockUseApp.mockReturnValue({
            products,
            isLoading: true,
            isConfigError: false,
        });

        render(
            <MemoryRouter initialEntries={['/shop']}>
                <Shop />
            </MemoryRouter>
        );

        // Assert exactly 6 skeletons render. Locking the count catches any
        // future off-by-one or skeleton-count refactor (e.g. an attempt to
        // scope the array to filteredProducts.length without updating the
        // assertion).
        const skeletons = screen.getAllByTestId('image-frame');
        expect(skeletons).toHaveLength(6);

        // First 3 slots resolve bg from the matching product (filteredProducts[i]).
        // Slots 3-5 fall through to bg-gray-900 default (no product at that index).
        expect(skeletons[0].className).toContain('bg-white'); // filteredProducts[0]=prod_a (bg-white)
        expect(skeletons[1].className).toContain('bg-gray-900'); // filteredProducts[1]=prod_b (bg-gray-900)
        expect(skeletons[2].className).toContain('bg-transparent'); // filteredProducts[2]=prod_c (bg-transparent)
        expect(skeletons[3].className).toContain('bg-gray-900'); // undefined slot
        expect(skeletons[4].className).toContain('bg-gray-900'); // undefined slot
        expect(skeletons[5].className).toContain('bg-gray-900'); // undefined slot
    });

    it('skeleton map reads filteredProducts[i] (not raw products[i]) when active filter narrows the list', () => {
        // The bug-detector test. Construct products where filteredProducts
        // would differ materially from products:
        //   products = [shirt(bg-white), jeans(bg-gray-900)]
        //   active filter: category=jeans
        //   filteredProducts = [jeans only] (1 item)
        // If the loop accidentally reads products[i] (raw list) instead of
        // filteredProducts[i] (user-visible list), skeletons[0] would
        // resolve against the shirt product (bg-white), NOT the jeans
        // product (bg-gray-900). The .not.toContain assertion below is the
        // load-bearing lock that catches this refactor regression.
        const products = [
            buildProduct('prod_shirt', {
                imageRoles: { imageBackground: 'white' },
                category: 'shirt',
            }),
            buildProduct('prod_jeans', {
                imageRoles: { imageBackground: 'gray-900' },
                category: 'jeans',
            }),
        ];
        mockUseApp.mockReturnValue({
            products,
            isLoading: true,
            isConfigError: false,
        });

        // Drive Shop's initial category state via window.location.search.
        // Shop reads the URL once in its tier-1 useState; we set it before
        // render so the initial category matches the test's filter intent.
        window.history.pushState({}, '', '/shop?category=jeans');

        render(
            <MemoryRouter initialEntries={['/shop?category=jeans']}>
                <Shop />
            </MemoryRouter>
        );

        // Lock the skeleton count too: would catch a future refactor that
        // scopes the array to filteredProducts.length mid-stream.
        const skeletons = screen.getAllByTestId('image-frame');
        expect(skeletons).toHaveLength(6);

        // Slot 0 must resolve filteredProducts[0] = jeans product (bg-gray-900).
        // Loop accidentally reading products[0] would yield bg-white, and
        // the next assertion would fail -- this is the load-bearing lock.
        expect(skeletons[0].className).toContain('bg-gray-900');
        expect(skeletons[0].className).not.toContain('bg-white');

        // Slots 1-5 are undefined (filteredProducts.length === 1) so they
        // fall through to the bg-gray-900 default.
        expect(skeletons[1].className).toContain('bg-gray-900');
        expect(skeletons[2].className).toContain('bg-gray-900');
        expect(skeletons[3].className).toContain('bg-gray-900');
        expect(skeletons[4].className).toContain('bg-gray-900');
        expect(skeletons[5].className).toContain('bg-gray-900');
    });
});
