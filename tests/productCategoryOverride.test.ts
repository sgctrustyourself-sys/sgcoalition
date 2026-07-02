// PR-time regression catch for "prod_hoodie_overwhelmingly_patient should
// appear under SWEATSHIRTS" — even when the live Supabase row has drifted
// back to category='apparel' (the value originally written by
// scripts/addOverwhelminglyPatientHoodie.ts before the override landed).
//
// The override in PRODUCT_LOCAL_OVERRIDES is applied LAST in AppContext
// merge so pinned fields win regardless of what Supabase returns. This
// suite asserts both halves of that guarantee without ever rendering with
// the real React tree.

import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS, PRODUCT_LOCAL_OVERRIDES } from '../constants';
import type { Product } from '../types';
import { applyLocalProductOverrides, withoutUndefinedFields } from '../utils/productMerge';
import { matchesCategoryFilter } from '../utils/categoryFilter';

const HOODIE_ID = 'prod_hoodie_overwhelmingly_patient';

// Faithful mirror of AppContext.fetchProducts merge step on the two values
// that matter for this regression. We keep the AppContext helpers in the
// import list above so the merge itself is run against production code.
const mergeLocalWithSupabase = (localProduct: Product, supabaseRow: Product | null | undefined): Product => {
    if (!supabaseRow) return localProduct;
    return { ...localProduct, ...withoutUndefinedFields(supabaseRow) };
};

describe('prod_hoodie_overwhelmingly_patient category override', () => {
    const localInitial = INITIAL_PRODUCTS.find(p => p.id === HOODIE_ID);
    if (!localInitial) {
        throw new Error(`${HOODIE_ID} missing from INITIAL_PRODUCTS — cannot run regression.`);
    }

    it('INITIAL_PRODUCTS declares the hoodie as category=sweatshirt in source', () => {
        expect(localInitial.category).toBe('sweatshirt');
    });

    it('PRODUCT_LOCAL_OVERRIDES pins category=sweatshirt for the hoodie', () => {
        expect(PRODUCT_LOCAL_OVERRIDES[HOODIE_ID]?.category).toBe('sweatshirt');
    });

    it('merge step 1: Supabase drift to app/apparel is visible mid-pipeline (proves override is what rescues us)', () => {
        const driftedSupabaseRow: Product = { ...localInitial, category: 'apparel' };
        const mergedFromSupabase = mergeLocalWithSupabase(localInitial, driftedSupabaseRow);
        expect(mergedFromSupabase.category).toBe('apparel');
    });

    it('merge step 2: applyLocalProductOverrides re-pins category=sweatshirt after the Supabase merge', () => {
        const driftedSupabaseRow: Product = { ...localInitial, category: 'apparel' };
        const mergedFromSupabase = mergeLocalWithSupabase(localInitial, driftedSupabaseRow);
        const finalProduct = applyLocalProductOverrides([mergedFromSupabase])[0];
        expect(finalProduct.category).toBe('sweatshirt');
    });

    it('Shop filter: SWEATSHIRTS filter includes the merged hoodie (primary fix assertion)', () => {
        const finalProduct = applyLocalProductOverrides([
            mergeLocalWithSupabase(localInitial, { ...localInitial, category: 'apparel' }),
        ])[0];
        expect(matchesCategoryFilter(finalProduct, 'sweatshirt')).toBe(true);
    });

    it('Shop filter: APPAREL parent bucket still includes the merged hoodie (regression guard)', () => {
        const finalProduct = applyLocalProductOverrides([
            mergeLocalWithSupabase(localInitial, { ...localInitial, category: 'apparel' }),
        ])[0];
        expect(matchesCategoryFilter(finalProduct, 'apparel')).toBe(true);
    });

    it('Shop filter: unrelated filters still exclude the merged hoodie', () => {
        const finalProduct = applyLocalProductOverrides([
            mergeLocalWithSupabase(localInitial, { ...localInitial, category: 'apparel' }),
        ])[0];
        expect(matchesCategoryFilter(finalProduct, 'shirts')).toBe(false);
        expect(matchesCategoryFilter(finalProduct, 'wallets')).toBe(false);
        expect(matchesCategoryFilter(finalProduct, 'hats')).toBe(false);
        expect(matchesCategoryFilter(finalProduct, 'dresses')).toBe(false);
    });
});
