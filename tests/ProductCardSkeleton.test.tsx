import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import { PRODUCT_IMAGE_ASPECTS } from '../utils/productImage';
import type { Product, ImageRoles } from '../types';

// Locks the per-product skeleton resolution precedence shipped in commit
// c943293. The skeleton's image-frame bg resolves as:
//   1. imageBackground prop (caller override) wins
//   2. else getProductRoles(product).imageBackground if product given
//   3. else 'gray-900' (dominant default for products without imageRoles pinning)
// getProductRoles itself is locked by tests/productImageRenderProfile.test.ts;
// this spec covers the *consumption* precedence on the skeleton side.
//
// The image-frame Skeleton is the only element rendered with className
// 'animate-pulse' (from components/ui/Skeleton.tsx). The product skeleton
// mounts three additional Skeletons (title, subtitle, price/heart row) but
// those are below the image frame and have no bg class. We query
// 'div.animate-pulse' to grab the image-frame specifically.
//
// The full image-frame className reads:
//   '<primitive> aspect-[4/5] w-full <resolved-bg-class> rounded-none'
// where <primitive> = 'animate-pulse bg-gray-200 rounded' (Skeleton default)
// and <resolved-bg-class> = one of 'bg-gray-900' | 'bg-white' | 'bg-transparent'.
// We assert presence of the resolution class plus the always-on fidelity
// classes (aspect-[4/5], w-full, rounded-none).

const findImageFrame = (container: HTMLElement): HTMLElement => {
    // Stable selector via data-testid -- avoids DOM-order dependency on a
    // class-only selector that all 4 Skeletons (image + title/subtitle +
    // price/heart) share via the Skeleton primitive.
    const frame = container.querySelector('[data-testid="image-frame"]') as HTMLElement | null;
    if (!frame) throw new Error('image-frame Skeleton ([data-testid="image-frame"]) not found in DOM');
    return frame;
};

// Build a minimal product shape that satisfies the ImageRoles interface so
// getProductRoles() can run without TypeScript complaining about missing
// required Product fields at the test level. Only `imageRoles` matters
// for the bg-precedence path; everything else is filler.
const buildProduct = (imageRoles: ImageRoles | undefined): Product => ({
    id: 'prod_test',
    name: 'Test',
    price: 40,
    images: ['https://example.com/a.jpg'],
    imageRoles,
    description: 'Test',
    category: 'shirt',
});

describe('ProductCardSkeleton bg resolution precedence', () => {
    afterEach(() => cleanup());

    // (3) default fallback when no inputs are given
    it('falls back to bg-gray-900 when neither product nor imageBackground prop is given', () => {
        const { container } = render(<ProductCardSkeleton />);
        expect(findImageFrame(container).className).toContain('bg-gray-900');
        expect(findImageFrame(container).className).not.toContain('bg-white');
        expect(findImageFrame(container).className).not.toContain('bg-transparent');
    });

    // (2) product-derived resolution -- the 3 active legacy products read
    // imageRoles.imageBackground='white' off pinned INITIAL_PRODUCTS data,
    // so this is the path that eliminates the bg-mismatch jolt for them.
    it('uses product imageRoles.imageBackground when only product prop is given', () => {
        const { container } = render(
            <ProductCardSkeleton product={buildProduct({ imageBackground: 'white' })} />
        );
        expect(findImageFrame(container).className).toContain('bg-white');
        expect(findImageFrame(container).className).not.toContain('bg-gray-900');
    });

    it('honors product imageRoles.imageBackground="transparent"', () => {
        const { container } = render(
            <ProductCardSkeleton product={buildProduct({ imageBackground: 'transparent' })} />
        );
        expect(findImageFrame(container).className).toContain('bg-transparent');
    });

    // (2) degenerate: product-without-imageRoles or product-without-imageBackground
    it('falls back to bg-gray-900 when product is given but imageRoles is undefined', () => {
        const { container } = render(<ProductCardSkeleton product={buildProduct(undefined)} />);
        expect(findImageFrame(container).className).toContain('bg-gray-900');
    });

    it('falls back to bg-gray-900 when product imageRoles lacks imageBackground', () => {
        const { container } = render(
            <ProductCardSkeleton product={buildProduct({ primaryUrl: 'https://example.com/a.jpg', hoverUrl: null })} />
        );
        expect(findImageFrame(container).className).toContain('bg-gray-900');
    });

    // (1) caller override wins -- prop path is independent of product-derived.
    it('uses imageBackground prop directly when only the prop is given (no product)', () => {
        const { container } = render(<ProductCardSkeleton imageBackground="white" />);
        expect(findImageFrame(container).className).toContain('bg-white');
    });

    it('honors imageBackground="transparent" prop alone', () => {
        const { container } = render(<ProductCardSkeleton imageBackground="transparent" />);
        expect(findImageFrame(container).className).toContain('bg-transparent');
    });

    // (1) override > (2) product-derived -- the load-bearing precedence
    // rule. Locked so a future regression that swaps the resolution order
    // surfaces immediately here, not at runtime during a real /shop load.
    it('imageBackground prop overrides product-derived bg (precedence #1 > #2)', () => {
        const { container } = render(
            <ProductCardSkeleton
                product={buildProduct({ imageBackground: 'gray-900' })}
                imageBackground="white"
            />
        );
        expect(findImageFrame(container).className).toContain('bg-white');
        expect(findImageFrame(container).className).not.toContain('bg-gray-900');
    });

    it('imageBackground prop overrides even when product has transparent bg', () => {
        const { container } = render(
            <ProductCardSkeleton
                product={buildProduct({ imageBackground: 'transparent' })}
                imageBackground="gray-900"
            />
        );
        expect(findImageFrame(container).className).toContain('bg-gray-900');
        expect(findImageFrame(container).className).not.toContain('bg-transparent');
    });
});

describe('ProductCardSkeleton image-frame class fidelity', () => {
    afterEach(() => cleanup());

    // The fidelity classes keep the skeleton DOM footprint matched to the
    // real ProductCard image frame, so hydration doesn't grow the leaf
    // element (~95px jolt on 4-col desktop grids was the original bug).
    it('always emits PRODUCT_IMAGE_ASPECTS.card (matches ProductCard image frame, locked via the centralised map)', () => {
        const { container } = render(<ProductCardSkeleton />);
        expect(findImageFrame(container).className).toContain(PRODUCT_IMAGE_ASPECTS.card);
    });

    it('always emits w-full', () => {
        const { container } = render(<ProductCardSkeleton />);
        expect(findImageFrame(container).className).toContain('w-full');
    });

    it('always emits rounded-none (neutralises Skeleton primitive default "rounded")', () => {
        const { container } = render(<ProductCardSkeleton />);
        const frameClass = findImageFrame(container).className;
        expect(frameClass).toContain('rounded-none');
        // The Skeleton primitive's own `rounded` class will still be in
        // the string (it comes from ./ui/Skeleton.tsx default). rounded-none
        // is appended *after* it via our className prop so Tailwind's JIT
        // picks up the later override; visually the frame ends up square.
        expect(frameClass).toContain('animate-pulse');
    });
});
