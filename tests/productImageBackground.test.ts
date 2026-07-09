import { describe, it, expect } from 'vitest';
import { IMAGE_BACKGROUND_CLASS } from '../utils/productImage';

// Pins the public surface of utils/productImage.ts > IMAGE_BACKGROUND_CLASS
// so a future PR that adds, removes, or corrupts a key/value fails visibly
// at test time rather than silently changing the storefront card bg for
// every consumer.
//
// The two invariants locked here mirror the PRODUCT_IMAGE_ASPECTS lock in
// tests/productImage.test.ts:
//
// 1. KEY SET -- Object.keys(map).sort() must match the hard-coded expected
//    array. Adding a new key (e.g. `cream`) without updating this
//    expectation fails the test. Removing a key (e.g. `gray-900`) fails.
//    Renaming a key (e.g. `white` -> `light`) fails.
//
// 2. JIT-SAFE VALUES -- every value must be a non-empty, full Tailwind
//    background-color class string. Tailwind's JIT compiler scans the
//    source for class name literals at build time; a dynamic class string
//    like `bg-${name}` or a bare keyword like `gray-900` would be silently
//    stripped from the build, leaving the consumer element with no
//    background at runtime. The value-shape rules locked:
//      - typeof value === 'string' and length > 0
//      - value.startsWith('bg-') (full Tailwind class, not a bare keyword)
//      - !value.includes('${') (no template-literal interpolation)
//      - !bareKeywordPattern.test(value) (regex check that catches the
//        edge case of a bare Tailwind keyword like 'gray-900' with the
//        'bg-' prefix dropped)
//
// Consumer list at commit time (utils/productImage.ts > JSDoc on
// IMAGE_BACKGROUND_CLASS): ProductCard.tsx, ProductCardSkeleton.tsx.
// None of the consumers is imported by this spec -- we only assert the
// map's own shape so the spec stays decoupled from the consumer set.

describe('IMAGE_BACKGROUND_CLASS key set', () => {
    // Hard-coded expectation. Sorted alphabetically so the diff against
    // Object.keys(map).sort() is order-independent. A re-order of the
    // map's key declarations doesn't trip the test; only a true
    // add/remove/rename does.
    const EXPECTED_KEYS = ['gray-900', 'transparent', 'white'] as const;

    it('exposes exactly the expected key set (no adds, no removes, no renames)', () => {
        const actualKeys = Object.keys(IMAGE_BACKGROUND_CLASS).sort();
        expect(actualKeys).toEqual([...EXPECTED_KEYS]);
    });

    it('has no extra keys beyond the expected set', () => {
        const actualKeys = Object.keys(IMAGE_BACKGROUND_CLASS).sort();
        const expectedSorted = [...EXPECTED_KEYS].sort();
        const extra = actualKeys.filter(k => !expectedSorted.includes(k));
        expect(extra).toEqual([]);
    });

    it('has no missing keys from the expected set', () => {
        const actualKeys = Object.keys(IMAGE_BACKGROUND_CLASS).sort();
        const expectedSorted = [...EXPECTED_KEYS].sort();
        const missing = expectedSorted.filter(k => !actualKeys.includes(k));
        expect(missing).toEqual([]);
    });
});

describe('IMAGE_BACKGROUND_CLASS value JIT-safety', () => {
    // The full map. Tests below iterate over every key/value pair and
    // assert the value's shape. We don't pin the specific value strings
    // (e.g. 'bg-gray-900') here -- the key-set test above already proves
    // the keys are stable, and a future theme-add is a legit edit (just
    // remember to add the new key to EXPECTED_KEYS too). The shape rules
    // below are the load-bearing JIT-safety locks.

    it('every value is a non-empty string', () => {
        for (const [key, value] of Object.entries(IMAGE_BACKGROUND_CLASS)) {
            expect(typeof value, `value for key "${key}" should be a string`).toBe('string');
            expect(value.length, `value for key "${key}" should be non-empty`).toBeGreaterThan(0);
        }
    });

    it('every value starts with "bg-" (full Tailwind class, not a bare keyword like "gray-900")', () => {
        for (const [key, value] of Object.entries(IMAGE_BACKGROUND_CLASS)) {
            // Bare-keyword failure mode: a value of 'gray-900' or 'white'
            // would not render -- Tailwind's `bg-gray-900` class is a
            // JIT-emitted utility, NOT a built-in like `bg-black`. The
            // prefix check catches a future "I cleaned up the map,
            // dropped the prefix" mistake.
            expect(
                value.startsWith('bg-'),
                `value for key "${key}" should start with "bg-" (got "${value}")`,
            ).toBe(true);
        }
    });

    it('no value contains a template-literal interpolation ("${") -- JIT-unsafe', () => {
        for (const [key, value] of Object.entries(IMAGE_BACKGROUND_CLASS)) {
            // The failure mode here is a value like `bg-${name}` where
            // the developer tried to make the map dynamic. Tailwind's
            // JIT scanner would not see `${name}` as a class name, so
            // the class would be silently absent from the build.
            expect(
                !value.includes('${'),
                `value for key "${key}" should not contain template-literal interpolation (got "${value}")`,
            ).toBe(true);
        }
    });

    it('no value is a bare Tailwind keyword (e.g. "gray-900" or "white" without the bg- prefix)', () => {
        // A second, regex-based check on top of the prefix test above.
        // The prefix test catches the most common mistake; this catches
        // the edge case of `value === "gray-900"` (a typo where the
        // prefix is dropped but the keyword is preserved). The pattern
        // matches an identifier (letters, digits, hyphens) with optional
        // whitespace, AND uses a negative lookahead `(?!bg-)` so it
        // excludes valid `bg-`-prefixed class strings from the match.
        // Without the lookahead, the regex would match `bg-white` as a
        // bare keyword and the test would fail on the live map (this
        // was the same bug pattern the prior commit hit on the aspect
        // ratio test). We expect FALSE for every live value (i.e. none
        // of them are bare keywords). A future regression that drops
        // the `bg-` prefix flips the boolean to TRUE and the test fails
        // loudly.
        const bareKeywordPattern = /^\s*(?!bg-)[a-zA-Z][a-zA-Z0-9-]*\s*$/;
        for (const [key, value] of Object.entries(IMAGE_BACKGROUND_CLASS)) {
            expect(
                bareKeywordPattern.test(value),
                `value for key "${key}" should not be a bare keyword like "gray-900" (got "${value}")`,
            ).toBe(false);
        }
    });
});
