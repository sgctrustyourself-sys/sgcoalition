// tests/categoryFilter.test.ts
//
// Unit tests for utils/categoryFilter.ts > matchesCategoryFilter. Focused
// on the new `/shop?category=women` filter introduced for the women's
// section. The products table stores `category` as a single varchar, so
// 'women' lives as a CROSS-CUT filter matched by product ID prefix
// (`prod_womens_*`) — these tests pin both the womens_* membership and
// the unchanged behavior of every pre-existing filter (regression guard
// against the apparel-umbrella accidentally swallowing women's products).

import { describe, expect, it } from 'vitest';
import { matchesCategoryFilter } from '../utils/categoryFilter';
import type { Product } from '../types';

const makeProduct = (overrides: Partial<Product>): Product => ({
    id: 'prod_test_default',
    name: 'Test Product',
    price: 40,
    description: 'Test description',
    images: [],
    category: 'shirt',
    ...overrides,
});

describe('matchesCategoryFilter > women cross-cut filter', () => {
    it('includes every prod_womens_* product under ?category=women', () => {
        // The four products the user explicitly asked to surface under
        // `/shop?category=women`. If a future maintainer adds a new
        // women's SKU with a non-conforming ID, this test will fail and
        // surface the drift.
        const womensIds = [
            'prod_womens_above_as_below_contrast_shorts',
            'prod_womens_above_as_below_crop_tank',
            'prod_womens_above_as_below_set',
            'prod_womens_coalition_halo_contrast_tee',
        ];

        for (const id of womensIds) {
            // Categories vary (shorts/shirt/apparel/shirt) \u2014 the filter
            // should NOT care; the prefix match is the source of truth.
            const category = id.includes('shorts') ? 'shorts'
                : id.includes('set') ? 'apparel'
                    : 'shirt';
            const product = makeProduct({ id, category });
            expect(matchesCategoryFilter(product, 'women')).toBe(true);
        }
    });

    it('excludes non-prod_womens_* products even if their category is dress', () => {
        // Halo Mini Dress predates the prod_womens_ naming convention
        // but is a women's piece. The user explicitly scoped this
        // filter to "womens_* products" so we keep it OUT. This test
        // locks that decision \u2014 flip the predicate if the maintainer
        // later asks to broaden the scope.
        const haloDress = makeProduct({ id: 'prod_halo_mini_dress', category: 'dress' });
        expect(matchesCategoryFilter(haloDress, 'women')).toBe(false);
    });

    it('excludes standard mens/unisex products', () => {
        const nfTee = makeProduct({ id: 'Coalition_NF_Tee', category: 'shirt' });
        const sharkTee = makeProduct({ id: 'prod_1773860269374', category: 'shirt' });
        const hoodie = makeProduct({ id: 'prod_hoodie_overwhelmingly_patient', category: 'sweatshirt' });

        expect(matchesCategoryFilter(nfTee, 'women')).toBe(false);
        expect(matchesCategoryFilter(sharkTee, 'women')).toBe(false);
        expect(matchesCategoryFilter(hoodie, 'women')).toBe(false);
    });

    it('accepts the "womens" alias (without apostrophe-s) for shareable URLs', () => {
        const product = makeProduct({ id: 'prod_womens_above_as_below_crop_tank', category: 'shirt' });
        expect(matchesCategoryFilter(product, 'womens')).toBe(true);
    });

    it('is case-insensitive on the filter parameter', () => {
        const product = makeProduct({ id: 'prod_womens_coalition_halo_contrast_tee', category: 'shirt' });
        expect(matchesCategoryFilter(product, 'WOMEN')).toBe(true);
        expect(matchesCategoryFilter(product, 'Women')).toBe(true);
    });
});

describe('matchesCategoryFilter > backward compat for existing filters', () => {
    it('still surfaces prod_womens_* products under their apparel-type filters', () => {
        // REGRESSION GUARD: the womens_* products already appeared under
        // these filters via their normal `category` string. The new
        // 'women' filter must be ADDITIVE \u2014 collapsing them away would
        // break the shop grid navigation.
        const cropTank = makeProduct({ id: 'prod_womens_above_as_below_crop_tank', category: 'shirt' });
        const newTee = makeProduct({ id: 'prod_womens_coalition_halo_contrast_tee', category: 'shirt' });
        const shorts = makeProduct({ id: 'prod_womens_above_as_below_contrast_shorts', category: 'shorts' });
        const set = makeProduct({ id: 'prod_womens_above_as_below_set', category: 'apparel' });

        expect(matchesCategoryFilter(cropTank, 'shirts')).toBe(true);
        expect(matchesCategoryFilter(newTee, 'shirts')).toBe(true);
        expect(matchesCategoryFilter(shorts, 'apparel')).toBe(true);
        expect(matchesCategoryFilter(set, 'apparel')).toBe(true);
    });

    it('still surfaces the halo mini dress under ?category=dresses', () => {
        const haloDress = makeProduct({ id: 'prod_halo_mini_dress', category: 'dress' });
        expect(matchesCategoryFilter(haloDress, 'dresses')).toBe(true);
    });

    it('returns true for "all" and falsy filters regardless of product ID', () => {
        const product = makeProduct({ id: 'Coalition_NF_Tee', category: 'shirt' });
        expect(matchesCategoryFilter(product, 'all')).toBe(true);
        expect(matchesCategoryFilter(product, '')).toBe(true);
    });

    it('does not cross-contaminate men/women with the apparel umbrella', () => {
        // REGRESSION GUARD for the men + women cross-cut filters: the
        // apparel umbrella pools shirts | jeans | shorts | sweatshirt |
        // dress | apparel. The men + women sections must NOT eat any
        // sub-bucket results — every apparel filter that has at least
        // one mens/unisex OR womens_* representative today must keep
        // surfacing that product. A regression in ANY sub-bucket of the
        // umbrella would break product discovery.
        //
        // We step a paired-probe table: each row pins one sub-category
        // with a real (mens / womens) product pair. Rows where one side
        // has no catalog representative today (e.g. men's dresses)
        // still assert the present side — they're a lock against the
        // present side going invisible.
        type Pair = {
            filter: string;
            men?: { id: string; category: string };
            women?: { id: string; category: string };
        };

        const apparelPairs: Pair[] = [
            // shirts: Coalition_NF_Tee + prod_womens_above_as_below_crop_tank
            { filter: 'shirts', men: { id: 'Coalition_NF_Tee', category: 'shirt' }, women: { id: 'prod_womens_above_as_below_crop_tank', category: 'shirt' } },
            // shorts: prod_shorts_above_as_below + prod_womens_above_as_below_contrast_shorts
            { filter: 'shorts', men: { id: 'prod_shorts_above_as_below', category: 'shorts' }, women: { id: 'prod_womens_above_as_below_contrast_shorts', category: 'shorts' } },
            // apparel umbrella: prod_set_above_as_below + prod_womens_above_as_below_set
            { filter: 'apparel', men: { id: 'prod_set_above_as_below', category: 'apparel' }, women: { id: 'prod_womens_above_as_below_set', category: 'apparel' } },
            // dresses: no men's dress today; assert the women's-side probe (prod_halo_mini_dress)
            // still surfaces. This is also the regression test for the halo-mini-dress carve-out
            // being in the women's category map exactly where it belongs.
            { filter: 'dresses', women: { id: 'prod_halo_mini_dress', category: 'dress' } },
            // jeans: no women's jeans today; assert the men's-side probe (Coalition_x_True_Religion_S1)
            { filter: 'jeans', men: { id: 'Coalition_x_True_Religion_S1', category: 'jeans' } },
            // sweatshirt: no women's sweatshirt today; assert the men's-side probe (the hoodie)
            { filter: 'sweatshirt', men: { id: 'prod_hoodie_overwhelmingly_patient', category: 'sweatshirt' } },
        ];

        for (const { filter, men, women } of apparelPairs) {
            if (men) expect(matchesCategoryFilter(makeProduct(men), filter)).toBe(true);
            if (women) expect(matchesCategoryFilter(makeProduct(women), filter)).toBe(true);
        }

        // Symmetric cross-cut check: the men + women filters must not
        // accidentally mutate the apparel-filter surfacing of the same
        // product when the prefix match is also true.
        const womenShirt = makeProduct({ id: 'prod_womens_above_as_below_crop_tank', category: 'shirt' });
        expect(matchesCategoryFilter(womenShirt, 'shirts')).toBe(true);
        expect(matchesCategoryFilter(womenShirt, 'men')).toBe(false);
        expect(matchesCategoryFilter(womenShirt, 'women')).toBe(true);
    });
});

describe('matchesCategoryFilter > men cross-cut filter', () => {
    it('includes standard mens/unisex products under ?category=men', () => {
        // The men's section is the inverse of the women's section. This
        // test pins that broad "mens/unisex" membership.
        const nfTee = makeProduct({ id: 'Coalition_NF_Tee', category: 'shirt' });
        const sharkTee = makeProduct({ id: 'prod_1773860269374', category: 'shirt' });
        const aboveTee = makeProduct({ id: 'prod_tee_above_as_below', category: 'shirt' });
        const aboveShorts = makeProduct({ id: 'prod_shorts_above_as_below', category: 'shorts' });
        const aboveSet = makeProduct({ id: 'prod_set_above_as_below', category: 'apparel' });
        const distortion = makeProduct({ id: 'prod_tee_distortion', category: 'shirt' });
        const hoodie = makeProduct({ id: 'prod_hoodie_overwhelmingly_patient', category: 'sweatshirt' });
        const aboveAsBelowWallet = makeProduct({ id: 'Coalition_Above_As_Below_Wallet_1_1', category: 'wallet' });

        for (const product of [nfTee, sharkTee, aboveTee, aboveShorts, aboveSet, distortion, hoodie, aboveAsBelowWallet]) {
            expect(matchesCategoryFilter(product, 'men')).toBe(true);
        }
    });

    it('excludes every prod_womens_* product under ?category=men', () => {
        // Symmetric to the women's test — these products belong to the
        // women's section, not men's.
        const womensIds = [
            'prod_womens_above_as_below_contrast_shorts',
            'prod_womens_above_as_below_crop_tank',
            'prod_womens_above_as_below_set',
            'prod_womens_coalition_halo_contrast_tee',
        ];
        for (const id of womensIds) {
            const category = id.includes('shorts') ? 'shorts'
                : id.includes('set') ? 'apparel'
                    : 'shirt';
            const product = makeProduct({ id, category });
            expect(matchesCategoryFilter(product, 'men')).toBe(false);
        }
    });

    it('excludes the halo mini dress even though it does not use the prod_womens_ prefix', () => {
        // Halo Mini Dress (`prod_halo_mini_dress`) predates the prod_womens_
        // naming convention. It is a women's piece, so the men's inverse
        // filter must explicitly carve it out. If the maintainer later
        // renames it to prod_womens_halo_mini_dress (or otherwise brings
        // it under the prod_womens_ umbrella), this carve-out becomes a
        // no-op and the prior test covers it via the prefix check.
        const haloDress = makeProduct({ id: 'prod_halo_mini_dress', category: 'dress' });
        expect(matchesCategoryFilter(haloDress, 'men')).toBe(false);
    });

    it('accepts the "mens" alias (without apostrophe-s) for shareable URLs', () => {
        // Today: 'mens' and 'men' resolve identically. The "all" suffix
        // is intentionally NOT supported (so ?category=all_mens shields
        // against accidental silent surfacing of the entire catalog).
        const product = makeProduct({ id: 'Coalition_NF_Tee', category: 'shirt' });
        expect(matchesCategoryFilter(product, 'mens')).toBe(true);
    });

    it('is case-insensitive on the filter parameter', () => {
        const product = makeProduct({ id: 'Coalition_NF_Tee', category: 'shirt' });
        expect(matchesCategoryFilter(product, 'MEN')).toBe(true);
        expect(matchesCategoryFilter(product, 'Men')).toBe(true);
    });
});
