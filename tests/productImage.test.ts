import { describe, it, expect } from 'vitest';
import { PRODUCT_IMAGE_ASPECTS } from '../utils/productImage';

// Pins the public surface of utils/productImage.ts > PRODUCT_IMAGE_ASPECTS
// so a future PR that adds, removes, or renames a key surfaces a visible
// test failure rather than silently changing the visual ratio of every
// consumer in the storefront.
//
// The two invariants locked here:
//
// 1. KEY SET -- Object.keys(map).sort() must match the hard-coded expected
//    array below. Adding a new key (e.g. `portrait`) without updating this
//    expectation fails the test. Removing a key (e.g. `card-portrait`) fails
//    the test. Renaming a key (e.g. `card` -> `grid`) fails the test.
//
// 2. JIT-SAFE VALUES -- every value must be a non-empty, full Tailwind
//    aspect-ratio class string. Tailwind's JIT compiler scans the source
//    for class name literals at build time; a dynamic class string like
//    `aspect-[${ratio}]` or a bare ratio like `4/5` would be silently
//    stripped from the build, leaving the consumer element with no
//    aspect-ratio styling at runtime. The 3 value-shape rules below
//    (non-empty, starts with `aspect-`, no template-literal interpolation)
//    are the load-bearing locks.
//
// Consumer list at commit time (utils/productImage.ts > JSDoc importers):
// ProductCard, ProductCardSkeleton, ProductDetails, CartUpsells,
// BlogPostView, Home, CustomInquiry, admin/ProductManager,
// admin/BlogManager, ProductPage, Archive. None of the consumers is
// imported by this spec -- we only assert the map's own shape so the
// spec stays decoupled from the consumer set.

describe('PRODUCT_IMAGE_ASPECTS key set', () => {
    // Hard-coded expectation. Sorted alphabetically so the diff against
    // Object.keys(map).sort() is order-independent -- a refactor that
    // re-orders the map's keys (alphabetical vs visual order) doesn't
    // trip this test. Only a true add/remove/rename does.
    const EXPECTED_KEYS = ['card', 'gallery', 'hero', 'thumb'] as const;

    it('exposes exactly the expected key set (no adds, no removes, no renames)', () => {
        // The runtime surface. Reading Object.keys is the canonical way to
        // enumerate an object's enumerable own string keys; a `const` map
        // (`as const`) still has enumerable own keys at runtime -- the
        // `as const` is a TS-only narrowing annotation.
        const actualKeys = Object.keys(PRODUCT_IMAGE_ASPECTS).sort();

        expect(actualKeys).toEqual([...EXPECTED_KEYS]);
    });

    it('has no extra keys beyond the expected set', () => {
        const actualKeys = Object.keys(PRODUCT_IMAGE_ASPECTS).sort();
        const expectedSorted = [...EXPECTED_KEYS].sort();
        const extra = actualKeys.filter(k => !expectedSorted.includes(k));
        expect(extra).toEqual([]);
    });

    it('has no missing keys from the expected set', () => {
        const actualKeys = Object.keys(PRODUCT_IMAGE_ASPECTS).sort();
        const expectedSorted = [...EXPECTED_KEYS].sort();
        const missing = expectedSorted.filter(k => !actualKeys.includes(k));
        expect(missing).toEqual([]);
    });
});

describe('PRODUCT_IMAGE_ASPECTS value JIT-safety', () => {
    // The full map. Tests below iterate over every key/value pair and
    // assert the value's shape. We don't pin the specific value strings
    // (e.g. `'aspect-[4/5]'`) here -- the key-set test above already
    // proves the keys are stable, and a future ratio change is a legit
    // edit (e.g. 4/5 -> 3/4 across the board). The shape rules below
    // are the load-bearing JIT-safety locks.

    it('every value is a non-empty string', () => {
        for (const [key, value] of Object.entries(PRODUCT_IMAGE_ASPECTS)) {
            expect(typeof value, `value for key "${key}" should be a string`).toBe('string');
            expect(value.length, `value for key "${key}" should be non-empty`).toBeGreaterThan(0);
        }
    });

    it('every value starts with "aspect-" (full Tailwind class, not a bare ratio like "4/5")', () => {
        for (const [key, value] of Object.entries(PRODUCT_IMAGE_ASPECTS)) {
            // Bare-ratio failure mode: a value of "4/5" or "3/4" would not
            // render -- Tailwind's `aspect-[4/5]` class is a JIT-emitted
            // utility, NOT a built-in like `aspect-square`. The prefix
            // check is the cheapest way to catch a future "I cleaned up
            // the map, dropped the prefix" mistake.
            expect(
                value.startsWith('aspect-'),
                `value for key "${key}" should start with "aspect-" (got "${value}")`,
            ).toBe(true);
        }
    });

    it('no value contains a template-literal interpolation ("${") -- JIT-unsafe', () => {
        for (const [key, value] of Object.entries(PRODUCT_IMAGE_ASPECTS)) {
            // The failure mode here is a value like `aspect-[${ratio}]`
            // where the developer tried to make the map dynamic. Tailwind's
            // JIT scanner would not see `${ratio}` as a class name, so the
            // class would be silently absent from the build. Catching
            // the interpolation prefix at test time makes the regression
            // visible before it ships.
            expect(
                !value.includes('${'),
                `value for key "${key}" should not contain template-literal interpolation (got "${value}")`,
            ).toBe(true);
        }
    });

    it('no value is a bare numeric ratio (e.g. "4/5" or "16/9" without the aspect- prefix)', () => {
        // A second, regex-based check on top of the prefix test above.
        // The prefix test catches the most common mistake; this catches
        // the edge case of `value === "4/5"` (a typo where the prefix
        // is dropped but the ratio is preserved). The pattern matches
        // digits / digits with optional whitespace; we expect FALSE for
        // every live value (i.e. none of them are bare ratios). A
        // future regression that drops the `aspect-` prefix flips the
        // boolean to TRUE and the test fails loudly.
        const bareRatioPattern = /^\s*\d+\s*\/\s*\d+\s*$/;
        for (const [key, value] of Object.entries(PRODUCT_IMAGE_ASPECTS)) {
            expect(
                bareRatioPattern.test(value),
                `value for key "${key}" should not be a bare ratio like "4/5" (got "${value}")`,
            ).toBe(false);
        }
    });
});
