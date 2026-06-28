import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as fs from 'node:fs';
import * as path from 'node:path';

// vi.hoisted runs first so the bindings are available when vi.mock factories
// (which vitest hoists above all imports) reference them. Without this, the
// factory hits the temporal-dead-zone and throws ReferenceError on load.
const mocks = vi.hoisted(() => ({
    useAppMock: vi.fn(),
    useToastMock: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
    useApp: () => mocks.useAppMock(),
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => mocks.useToastMock(),
}));

import CompleteTheFitCart from '../components/CompleteTheFitCart';
import {
    ABOVE_AS_BELOW_TEE_ID,
    ABOVE_AS_BELOW_SHORTS_ID,
    ABOVE_AS_BELOW_SET_BONUS_CENTS,
    calculateAboveAsBelowSetBonusCents,
} from '../utils/aboveAsBelowSet';

const teeProduct = {
    id: ABOVE_AS_BELOW_TEE_ID,
    name: 'Above as Below Tee',
    price: 75,
    category: 'apparel',
    images: ['/images/above-as-below-tee-front.png'],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    sizeInventory: { S: 5, M: 5, L: 5, XL: 5, '2XL': 5 },
    archived: false,
    freeShipping: true,
};

const shortsProduct = {
    id: ABOVE_AS_BELOW_SHORTS_ID,
    name: 'Above as Below Shorts',
    price: 75,
    category: 'apparel',
    images: ['/images/above-as-below-shorts-front.png'],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    sizeInventory: { S: 5, M: 5, L: 5, XL: 5, '2XL': 5 },
    archived: false,
    freeShipping: true,
};

type CartLine = typeof teeProduct & { selectedSize: string; quantity: number; cartId: string };

const teeLineM: CartLine = {
    ...teeProduct,
    selectedSize: 'M',
    quantity: 1,
    cartId: 'cart_tee_m_initial',
};

const CTA_LABEL_MATCHER = /Add Above as Below Shorts at size M/i;
const CTA_LABEL_FALLBACK = /Add Above as Below Shorts at size XL/i;
const CTA_LABEL_ONESIZE = /Add Above as Below Shorts at size One Size/i;

// ------------------------------------------------------------------
// setupCompleteTheFitCart({ cart, shortsOverride })
// ------------------------------------------------------------------
// The four cart-side upsell tests share ~50 lines of fixture plumbing:
//   - a cartRef mutable bag so addToCart callbacks can mutate cart state
//     synchronously (and a post-click rerender can re-read the same ref),
//   - a vi.fn addToCart that pushes a shorts line onto the cartRef,
//   - useApp + useToast mocks that the component reads via React context,
//   - a MemoryRouter-wrapped render.
//
// Each test only varies the cart seed and the shorts product variant
// (sizes / sizeInventory). Extracting those four pieces into one helper
// collapses the call sites to pure assertions.
type ShortsOverride = Partial<typeof shortsProduct>;

interface CompleteTheFitCartTestSetupOptions {
    cart?: CartLine[];
    shortsOverride?: ShortsOverride;
}

function setupCompleteTheFitCart({
    cart = [teeLineM],
    shortsOverride = {},
}: CompleteTheFitCartTestSetupOptions = {}) {
    const cartRef: { current: CartLine[] } = { current: cart };
    const addToCartFn = vi.fn(
        (product: typeof shortsProduct, size: string) => {
            cartRef.current = [
                ...cartRef.current,
                {
                    ...product,
                    selectedSize: size,
                    quantity: 1,
                    cartId: 'cart_shorts_' + size + '_' + Date.now(),
                },
            ];
        },
    );

    const effectiveShorts = { ...shortsProduct, ...shortsOverride };
    mocks.useAppMock.mockImplementation(() => ({
        products: [teeProduct, effectiveShorts],
        cart: cartRef.current,
        addToCart: addToCartFn,
    }));
    mocks.useToastMock.mockImplementation(() => ({
        addToast: vi.fn(),
        removeToast: vi.fn(),
        toasts: [],
    }));

    const { rerender } = render(
        <MemoryRouter>
            <CompleteTheFitCart />
        </MemoryRouter>,
    );

    return { addToCartFn, rerender, cartRef };
}

describe('CompleteTheFitCart -- cart-side upsell', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    // coverage: resolver branch 2 -- happy path (presentSize match)
    // Branch (2) of the resolver: presentSize in missingProduct.sizes.
    // The happy path -- cart has tee@M, shorts stocks M, resolver picks
    // the cart's M, click calls addToCart, second render returns null
    // (XOR: both pieces now in cart), and the set-bonus math propagates.
    it('mounts with cart=[tee@M], CTA reads "Add Shorts (size M)"; click calls addToCart once and second render returns null (XOR) while set-bonus propagates', () => {
        const { addToCartFn, rerender, cartRef } = setupCompleteTheFitCart();

        const addShortsBtn = screen.getByRole('button', { name: CTA_LABEL_MATCHER });
        expect(addShortsBtn).toBeInTheDocument();
        expect(addShortsBtn.textContent).toMatch(/Add Shorts \(size M\)/);
        expect(
            screen.getByRole('heading', { name: /Complete the outfit/i }),
        ).toBeInTheDocument();

        fireEvent.click(addShortsBtn);

        expect(addToCartFn as Mock).toHaveBeenCalledTimes(1);
        expect(addToCartFn as Mock).toHaveBeenCalledWith(
            expect.objectContaining({ id: ABOVE_AS_BELOW_SHORTS_ID }),
            'M',
        );

        rerender(
            <MemoryRouter>
                <CompleteTheFitCart />
            </MemoryRouter>,
        );

        expect(
            screen.queryByRole('button', { name: CTA_LABEL_MATCHER }),
        ).toBeNull();
        expect(
            screen.queryByRole('heading', { name: /Complete the outfit/i }),
        ).toBeNull();

        const cartForBonus = cartRef.current.map((line) => ({ id: line.id }));
        const hasBothItems =
            cartForBonus.some((line) => line.id === ABOVE_AS_BELOW_TEE_ID) &&
            cartForBonus.some((line) => line.id === ABOVE_AS_BELOW_SHORTS_ID);
        expect(hasBothItems, 'cart should contain both tee and shorts after click').toBe(true);
        expect(
            calculateAboveAsBelowSetBonusCents(cartForBonus),
            'set-bonus math must propagate once both pieces are in cart',
        ).toBe(ABOVE_AS_BELOW_SET_BONUS_CENTS);
    });

    // coverage: resolver branch 3 -- sizes-pick fallback (sizes non-empty but presentSize absent)
    // Branch (3) of the resolver: presentSize NOT in missingProduct.sizes,
    // fall through to `missingProduct.sizes?.[0]` (the default `'One Size'`
    // sub-case is covered by the 4th test). Cart has tee@M but shorts only
    // stocks XL + 2XL, so M is unavailable, resolver lands on XL (first
    // available), the CTA must surface XL, and the click must propagate
    // XL -- not the cart's M.
    it('falls back to missingProduct.sizes[0] when the in-cart size is unavailable in the missing product', () => {
        const { addToCartFn } = setupCompleteTheFitCart({
            shortsOverride: {
                sizes: ['XL', '2XL'],
                sizeInventory: { XL: 5, '2XL': 5 },
            },
        });

        const addShortsBtn = screen.getByRole('button', { name: CTA_LABEL_FALLBACK });
        expect(addShortsBtn).toBeInTheDocument();
        expect(addShortsBtn.textContent).toMatch(/Add Shorts \(size XL\)/);

        fireEvent.click(addShortsBtn);
        expect(addToCartFn as Mock).toHaveBeenCalledTimes(1);
        expect(addToCartFn as Mock).toHaveBeenCalledWith(
            expect.objectContaining({ id: ABOVE_AS_BELOW_SHORTS_ID }),
            'XL',
        );
    });

    // coverage: resolver branch 1 -- single-size override (sizes.length === 1)
    // Branch (1) of the resolver: missingProduct.sizes.length === 1
    // -> return that one size regardless of the cart's presentSize.
    // Pins the common "One Size" wallet/accessory case where the size
    // selector on the PDP is meaningless and the cart is the source
    // of truth.
    it('returns the single size when the missing product only has one size in its sizes array', () => {
        const { addToCartFn } = setupCompleteTheFitCart({
            shortsOverride: {
                sizes: ['One Size'],
                sizeInventory: { 'One Size': 5 },
            },
        });

        const addShortsBtn = screen.getByRole('button', { name: CTA_LABEL_ONESIZE });
        expect(addShortsBtn).toBeInTheDocument();
        expect(addShortsBtn.textContent).toMatch(/Add Shorts \(size One Size\)/);

        fireEvent.click(addShortsBtn);
        expect(addToCartFn as Mock).toHaveBeenCalledTimes(1);
        expect(addToCartFn as Mock).toHaveBeenCalledWith(
            expect.objectContaining({ id: ABOVE_AS_BELOW_SHORTS_ID }),
            'One Size',
        );
    });

    // coverage: resolver branch 3 -- "One Size" default (sizes is empty)
    // Branch (3) extreme case: missingProduct.sizes is empty, the
    // resolver falls through to `missingProduct.sizes?.[0] || 'One Size'`
    // which evaluates to 'One Size' as the ultimate default. Locks in
    // the user-visible contract that the CTA never shows a blank
    // size token. sizeInventory still has stock so the totalStock
    // early-return does not fire -- the resolver still has to pick.
    it('falls back to "One Size" when the missing product has an empty sizes array', () => {
        const { addToCartFn } = setupCompleteTheFitCart({
            shortsOverride: {
                sizes: [],
                sizeInventory: { 'One Size': 5 },
            },
        });

        const addShortsBtn = screen.getByRole('button', { name: CTA_LABEL_ONESIZE });
        expect(addShortsBtn).toBeInTheDocument();
        expect(addShortsBtn.textContent).toMatch(/Add Shorts \(size One Size\)/);

        fireEvent.click(addShortsBtn);
        expect(addToCartFn as Mock).toHaveBeenCalledTimes(1);
        expect(addToCartFn as Mock).toHaveBeenCalledWith(
            expect.objectContaining({ id: ABOVE_AS_BELOW_SHORTS_ID }),
            'One Size',
        );
    });
});

// ------------------------------------------------------------------
// size-resolver -> it() block coverage guard
// ------------------------------------------------------------------
// Pins each of the three branches of the size-resolver IIFE in
// components/CompleteTheFitCart.tsx against a corresponding it() block
// in this file. The "source" regex is a fingerprint of the branch's
// defining expression in the component (small refactors that retain
// branch semantics still pass -- e.g., renaming `presentSize` -> `cartSize`
// does not break the branch-2 fingerprint since we don't pin the local
// variable's name). The "markerPrefix" is a literal comment prefix that
// every it() block covering that branch must declare above itself, so
// an it() deletion or rewrite stops being a silent coverage drop.
//
// Two failure modes the guard catches:
//   1. Resolver refactor drops or merges a branch -- the source regex
//      for that branch no longer matches -> guard test fails clearly.
//   2. This file's it() block for a branch is deleted or stops
//      declaring the marker (e.g., a future contributor rewrites the
//      tests to share a parameterized it() and removes the comments)
//      -- the marker-prefix substring disappears -> guard test fails.
//
// The 4 production it() blocks above all declare `// coverage: resolver
// branch N` markers (1, 2, 3, 3). Branch 3 has two test bodies covering
// its two sub-cases (XL fallback + empty-sizes fallback) -- the prefix
// match is found at least once either way.
//
// Fingerprint-leniency caveat (branch 3): branch 3's fingerprint is
// just `/sizes?.[0]/`, NOT `/sizes?.[0] || 'One Size'/`. The lenient
// form lets refactors that extract `'One Size'` into a named constant
// still pass the guard. The trade-off: if a future change adds an
// UNRELATED line in the component that legitimately does
// `someProduct.sizes?.[0]`, this guard will silently continue to pass
// even though the new line is not part of the resolver. A future
// contributor must tighten or split the branch-3 fingerprint in that
// case (e.g., by re-pinning the `|| 'One Size'` literal).
describe('size-resolver -> it() block coverage guard', () => {
    const matrix = [
        {
            branch: 'branch 1: single-size (sizes.length === 1)',
            source: /sizes\.length === 1/,
            markerPrefix: '// coverage: resolver branch 1',
        },
        {
            branch: 'branch 2: presentSize match (sizes?.includes(presentSize))',
            source: /sizes\?\.includes\(presentSize\)/,
            markerPrefix: '// coverage: resolver branch 2',
        },
        {
            branch:
                'branch 3: fallback (sizes?.[0] || \'One Size\')',
            source: /sizes\?\.\[0\]/,
            markerPrefix: '// coverage: resolver branch 3',
        },
    ] as const;

    // resolve from project root -- vitest always runs from cwd, and these
    // are repo-relative paths (no test-runner relocation tricks).
    const componentPath = path.resolve(process.cwd(), 'components/CompleteTheFitCart.tsx');
    const testFilePath = path.resolve(process.cwd(), 'tests/CompleteTheFitCart.test.tsx');

    // Fail fast on missing files rather than silently passing -- if the
    // component or this test file cannot be located, the guard cannot
    // actually guard, and a silent pass would defeat the purpose.
    const componentSrc = fs.readFileSync(componentPath, 'utf-8');
    const testFileSrc = fs.readFileSync(testFilePath, 'utf-8');

    it('branch 1 (single-size) still has a matching it() coverage marker', () => {
        const entry = matrix[0];
        expect(
            componentSrc,
            `components/CompleteTheFitCart.tsx is missing resolver branch 1 fingerprint: "${entry.source}"`,
        ).toMatch(entry.source);
        expect(
            testFileSrc,
            `tests/CompleteTheFitCart.test.tsx is missing "// coverage: resolver branch 1" marker above its branch-1 it() block`,
        ).toContain(entry.markerPrefix);
    });

    it('branch 2 (presentSize match) still has a matching it() coverage marker', () => {
        const entry = matrix[1];
        expect(
            componentSrc,
            `components/CompleteTheFitCart.tsx is missing resolver branch 2 fingerprint: "${entry.source}"`,
        ).toMatch(entry.source);
        expect(
            testFileSrc,
            `tests/CompleteTheFitCart.test.tsx is missing "// coverage: resolver branch 2" marker above its branch-2 it() block`,
        ).toContain(entry.markerPrefix);
    });

    it('branch 3 (fallback) still has a matching it() coverage marker', () => {
        const entry = matrix[2];
        expect(
            componentSrc,
            `components/CompleteTheFitCart.tsx is missing resolver branch 3 fingerprint: "${entry.source}"`,
        ).toMatch(entry.source);
        expect(
            testFileSrc,
            `tests/CompleteTheFitCart.test.tsx is missing "// coverage: resolver branch 3" marker above its branch-3 it() block`,
        ).toContain(entry.markerPrefix);
    });
});
