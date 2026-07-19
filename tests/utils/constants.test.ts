// tests/utils/constants.test.ts
//
// VALIDITY CONTRACT: locks the PRODUCT_IDS constant so no ID string can be
// typosquatted, duplicated, or orphaned (pointing at a product that doesn't
// exist in INITIAL_PRODUCTS). When a product is added to or removed from the
// catalog, this file breaks first and tells the operator exactly which
// PRODUCT_IDS entry needs to be updated.
//
// These tests are DECOUPLED from catalog shape — they check that every
// PRODUCT_IDS value has a real home in INITIAL_PRODUCTS, but they do NOT
// lock the catalog order, featured status, or any other business rule.

import { describe, it, expect } from 'vitest';
import { PRODUCT_IDS, WHITE_BG_PRODUCT_IDS } from '../../constants/productIds';
import { INITIAL_PRODUCTS } from '../../constants/products';
import { Product } from '../../types';

// ── Helpers ────────────────────────────────────────────────────────────────

/** All real product IDs from the catalog. */
const realProductIds: string[] = INITIAL_PRODUCTS.map((p: Product) => p.id);

/** All values defined in PRODUCT_IDS. */
const productIdValues: string[] = Object.values(PRODUCT_IDS);

/** All keys defined in PRODUCT_IDS. */
const productIdKeys: string[] = Object.keys(PRODUCT_IDS) as (keyof typeof PRODUCT_IDS)[];

/**
 * Wallets that are NOT in WHITE_BG_PRODUCT_IDS because their product
 * photos fill the frame differently (object-cover, not object-contain)
 * or haven't been reshot on a white backdrop yet.
 *
 * RATCHET: this list must trend DOWNWARD over time. When a wallet gets
 * a white-backdrop reshoot, move it to WHITE_BG_PRODUCT_IDS and remove
 * it from here. The test suite enforces a size cap (currently 5).
 */
const EXCLUDED_WALLET_IDS = new Set([
    'Coalition_Above_As_Below_Wallet_1_1',
    'GreenCamoWallet',
    'SKYYBLUEWALLET1_2',
    'prod_1784012446238', // ABOVE AS BELOW 2/4 WALLET
    'prod_1784012355221', // ABOVE AS BELOW 3/4 WALLET
]);

/** Maximum allowed size of EXCLUDED_WALLET_IDS — lowered whenever a wallet graduates to white-bg. */
const MAX_EXCLUDED_WALLETS = 5;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PRODUCT_IDS', () => {
    describe('no empty or whitespace-only IDs', () => {
        it.each(productIdKeys)('"%s" is a non-empty string', (key: string) => {
            const value: string = PRODUCT_IDS[key as keyof typeof PRODUCT_IDS];
            expect(value).toBeTruthy();
            expect(value.trim().length).toBeGreaterThan(0);
        });
    });

    describe('no duplicate values', () => {
        it('every PRODUCT_IDS value is unique', () => {
            const unique = new Set(productIdValues);
            expect(unique.size).toBe(productIdValues.length);
        });
    });

    describe('every value matches a real product in INITIAL_PRODUCTS', () => {
        it.each(productIdKeys)(
            '"%s" exists in INITIAL_PRODUCTS',
            (key: string) => {
                const value: string = PRODUCT_IDS[key as keyof typeof PRODUCT_IDS];
                expect(realProductIds).toContain(value);
            },
        );
    });

    describe('each matching product has a non-empty name', () => {
        it.each(productIdKeys)(
            'product for "%s" has a non-empty name',
            (key: string) => {
                const value: string = PRODUCT_IDS[key as keyof typeof PRODUCT_IDS];
                const product = INITIAL_PRODUCTS.find((p: Product) => p.id === value);
                expect(product).toBeDefined();
                expect(product!.name.trim().length).toBeGreaterThan(0);
            },
        );
    });
});

// ── WHITE_BG_PRODUCT_IDS tests ─────────────────────────────────────────────

describe('WHITE_BG_PRODUCT_IDS', () => {
    const whiteBgValues = Array.from(WHITE_BG_PRODUCT_IDS);

    describe('no empty or whitespace-only IDs', () => {
        it.each(whiteBgValues)('"%s" is a non-empty string', (id: string) => {
            expect(id).toBeTruthy();
            expect(id.trim().length).toBeGreaterThan(0);
        });
    });

    describe('Set has expected minimum size', () => {
        it('contains at least 13 entries (Above-as-Below x2 + Grey Wave x2 + Parts x4 + Racing Team x4 + Chrome Hearts x1)', () => {
            expect(WHITE_BG_PRODUCT_IDS.size).toBeGreaterThanOrEqual(13);
        });
    });

    describe('every value matches a real product in INITIAL_PRODUCTS', () => {
        it.each(whiteBgValues)(
            '"%s" exists in INITIAL_PRODUCTS',
            (id: string) => {
                expect(realProductIds).toContain(id);
            },
        );
    });

    describe('each matching product has a non-empty name', () => {
        it.each(whiteBgValues)(
            'product for "%s" has a non-empty name',
            (id: string) => {
                const product = INITIAL_PRODUCTS.find((p: Product) => p.id === id);
                expect(product).toBeDefined();
                expect(product!.name.trim().length).toBeGreaterThan(0);
            },
        );
    });

    describe('wallet collections get consistent treatment', () => {
        it('all Parts wallet IDs are in the Set', () => {
            const partsIds = [
                PRODUCT_IDS.PARTS_WALLET_1_4,
                PRODUCT_IDS.PARTS_WALLET_2_4,
                PRODUCT_IDS.PARTS_WALLET_3_4,
                PRODUCT_IDS.PARTS_WALLET_4_4,
            ];
            for (const id of partsIds) {
                expect(WHITE_BG_PRODUCT_IDS.has(id)).toBe(true);
            }
        });

        it('all Grey Wave wallet IDs are in the Set', () => {
            const greyWaveIds = [
                PRODUCT_IDS.GREY_WAVE_WALLET_1_2,
                PRODUCT_IDS.GREY_WAVE_WALLET_2_2,
            ];
            for (const id of greyWaveIds) {
                expect(WHITE_BG_PRODUCT_IDS.has(id)).toBe(true);
            }
        });

        it('all Racing Team wallet IDs are in the Set', () => {
            const racingTeamIds = [
                PRODUCT_IDS.RACING_TEAM_WALLET_1_4,
                PRODUCT_IDS.RACING_TEAM_WALLET_2_4,
                PRODUCT_IDS.RACING_TEAM_WALLET_3_4,
                PRODUCT_IDS.RACING_TEAM_WALLET_4_4,
            ];
            for (const id of racingTeamIds) {
                expect(WHITE_BG_PRODUCT_IDS.has(id)).toBe(true);
            }
        });

        it('Chrome Hearts wallet ID is in the Set', () => {
            expect(WHITE_BG_PRODUCT_IDS.has(PRODUCT_IDS.CHROME_HEARTS_WALLET)).toBe(true);
        });

        it('every wallet in INITIAL_PRODUCTS with a white-backdrop photo is in the Set', () => {
            // All wallet products in the catalog with real Imgur images
            // shot on white backdrops should be in WHITE_BG_PRODUCT_IDS.
            const walletIds = INITIAL_PRODUCTS
                .filter((p: Product) => p.category === 'wallet')
                .map((p: Product) => p.id);

            for (const id of walletIds) {
                const inSet = WHITE_BG_PRODUCT_IDS.has(id);
                const isExcluded = EXCLUDED_WALLET_IDS.has(id);
                // Every wallet must be either in the Set OR in the exclusion list.
                // If a new wallet is added to INITIAL_PRODUCTS but not to either
                // list, this test fails and forces the operator to decide.
                expect(
                    inSet || isExcluded,
                    `wallet "${id}" is not in WHITE_BG_PRODUCT_IDS and not in the exclusion list — add it to one or the other`,
                ).toBe(true);
            }
        });

        it('exclusion list has not grown beyond its current size (5) — must trend downward', () => {
            // When a wallet gets a white-backdrop reshoot it moves from
            // EXCLUDED_WALLET_IDS → WHITE_BG_PRODUCT_IDS, and the cap
            // here must be LOWERED. To raise the cap, update
            // MAX_EXCLUDED_WALLETS with an explicit commit message
            // explaining which new wallet was added and why it can't
            // get a reshoot yet.
            expect(EXCLUDED_WALLET_IDS.size).toBeLessThanOrEqual(MAX_EXCLUDED_WALLETS);
        });
    });
});
