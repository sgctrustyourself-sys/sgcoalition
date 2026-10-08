// tests/productSeed.test.ts
//
// Guards on scripts/productSeed.ts — the single owner of the rule that refreshes
// constants/products.ts — and on the script that is supposed to obey it.
//
// The failure this pins is the one that actually happened: `drop:list --confirm`
// re-ran a sync that regenerated the seed from the DB alone, which deleted the five
// seed-only products (no DB row exists for them) and overwrote an unrelated price,
// failing 21 tests. The repair was a hand-restore, so the next run repeated it.
//
// These assert the rule rather than the implementation:
//   - an entry with no DB row survives every refresh
//   - the entry set never shrinks
//   - an untargeted difference is reported, not applied
//   - a targeted id IS rewritten (that is how a publish corrects its own listing)
//   - the real seed round-trips through the merge and the file writer unchanged
//   - the sync script uses this rule instead of replacing the array wholesale

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_PRODUCTS } from '../constants/products';
import {
    formatSeedMergeReport,
    mapDbRowToSeedEntry,
    mergeSeedProducts,
    parseSeedEntries,
    replaceSeedArray,
    summarizeValue,
    unknownSeedIds,
} from '../scripts/productSeed';
import type { ProductRow } from '../scripts/productSeed';
import type { Product } from '../types';

const projectRoot = path.resolve(__dirname, '..');
const seedPath = path.join(projectRoot, 'constants', 'products.ts');
const seedText = fs.readFileSync(seedPath, 'utf8');

const SEED_ONLY_ID = 'Coalition_Parts_Wallet_1_4';

/** Inverse of mapDbRowToSeedEntry, so a seed entry can be fed back in as its own DB row. */
const toRow = (p: Product): ProductRow => ({
    id: p.id,
    name: p.name,
    price: p.price,
    images: p.images,
    description: p.description,
    category: p.category,
    is_featured: p.isFeatured,
    is_limited_edition: p.isLimitedEdition,
    sizes: p.sizes,
    size_inventory: p.sizeInventory,
    nft_metadata: p.nft,
    archived: p.archived,
    archived_at: p.archivedAt,
    released_at: p.releasedAt,
    sold_at: p.soldAt,
});

const variant = (over: Partial<Product>): Product =>
    ({ ...(INITIAL_PRODUCTS[0] as Product), ...over }) as Product;

describe('seed merge rule', () => {
    it('keeps an entry the database has no row for', () => {
        const seedOnly = INITIAL_PRODUCTS.find((p) => p.id === SEED_ONLY_ID) as Product;
        // A database that knows plenty of other products, but not this one.
        const dbRows = INITIAL_PRODUCTS.filter((p) => p.id !== SEED_ONLY_ID).slice(0, 5).map(toRow);

        const { products, report } = mergeSeedProducts([seedOnly], dbRows);

        expect(products.map((p) => p.id), 'a seed-only product must survive a refresh').toContain(SEED_ONLY_ID);
        expect(products[0].id, 'and keep its position').toBe(SEED_ONLY_ID);
        expect(report.seedOnly).toContain(SEED_ONLY_ID);
    });

    it('never removes anything, even when the database comes back empty', () => {
        const { products } = mergeSeedProducts(INITIAL_PRODUCTS, []);

        expect(products.map((p) => p.id)).toEqual(INITIAL_PRODUCTS.map((p) => p.id));
        expect(products).toEqual(INITIAL_PRODUCTS);
    });

    it('reports a difference on an untargeted entry instead of applying it', () => {
        const existing = INITIAL_PRODUCTS.filter((p) => p.id === SEED_ONLY_ID);
        const drifted = toRow({ ...(existing[0] as Product), price: 999 });

        const { products, report } = mergeSeedProducts(existing, [drifted]);

        expect(products[0].price, 'an untargeted entry keeps the seed value').toBe(existing[0].price);
        expect(report.drift).toContainEqual({ id: SEED_ONLY_ID, field: 'price', seed: existing[0].price, db: 999 });
        expect(report.targeted).toEqual([]);
        expect(report.rewritten).toEqual([]);
    });

    it('rewrites a targeted entry from its database row', () => {
        const existing = INITIAL_PRODUCTS.filter((p) => p.id === SEED_ONLY_ID);
        const drifted = toRow({ ...(existing[0] as Product), price: 999 });

        const { products, report } = mergeSeedProducts(existing, [drifted], [SEED_ONLY_ID]);

        expect(products[0].price).toBe(999);
        expect(report.targeted).toEqual([SEED_ONLY_ID]);
        expect(report.rewritten).toEqual([SEED_ONLY_ID]);
        expect(report.drift, 'a targeted entry is not also reported as drift').toEqual([]);
    });

    it('appends a database row the seed has never held', () => {
        const existing = INITIAL_PRODUCTS.filter((p) => p.id === SEED_ONLY_ID);
        const fresh = toRow(variant({ id: 'prod_brand_new', name: 'Brand New' }));

        const { products, report } = mergeSeedProducts(existing, [fresh]);

        expect(products).toHaveLength(2);
        expect(products[1].id).toBe('prod_brand_new');
        expect(report.added).toEqual(['prod_brand_new']);
    });

    it('says nothing in the report when the database agrees with the seed', () => {
        const report = mergeSeedProducts(INITIAL_PRODUCTS, INITIAL_PRODUCTS.map(toRow)).report;

        expect(report.drift).toEqual([]);
        expect(report.added).toEqual([]);
        expect(report.seedOnly).toEqual([]);
        expect(report.rewritten, 'agreement is not a rewrite').toEqual([]);
    });
});

describe('the real seed', () => {
    it('survives a refresh against rows derived from itself, unchanged', () => {
        // This is the regression: every entry the DB agrees with must come back
        // byte-for-byte, and the seed-only products must still be there.
        const { products, report } = mergeSeedProducts(INITIAL_PRODUCTS, INITIAL_PRODUCTS.map(toRow));

        expect(products).toEqual(INITIAL_PRODUCTS);
        expect(report.drift, 'the mapping must round-trip without inventing drift').toEqual([]);
    });

    it('reads its own text back as exactly the entries it exports', () => {
        // The reader the writer depends on must agree with the module the app imports.
        expect(parseSeedEntries(seedText)).toEqual(INITIAL_PRODUCTS);
    });

    it('still carries the products that have no database row', () => {
        const ids = INITIAL_PRODUCTS.map((p) => p.id);
        for (const id of [
            'prod_wallet_chrome_hearts',
            'Coalition_Parts_Wallet_1_4',
            'Coalition_Parts_Wallet_2_4',
            'Coalition_Parts_Wallet_3_4',
            'Coalition_Parts_Wallet_4_4',
        ]) {
            expect(ids, `${id} is seed-only and must not be dropped by a refresh`).toContain(id);
        }
    });

    it('is written back byte-identically when nothing changed', () => {
        // A run that changes nothing must not rewrite the file at all — including
        // the hand-written comments inside the array and older entries' escapes.
        expect(replaceSeedArray(seedText, INITIAL_PRODUCTS)).toBe(seedText);
    });

    it('re-serialises only the entry whose data changed, keeping every comment', () => {
        const target = INITIAL_PRODUCTS.find((p) => p.id === SEED_ONLY_ID) as Product;
        const edited = { ...target, price: 999 } as Product;
        const after = replaceSeedArray(
            seedText,
            INITIAL_PRODUCTS.map((p) => (p.id === SEED_ONLY_ID ? edited : p)),
        );

        expect(after).toContain('"price": 999');
        expect(after, 'hand-written comments in the array must survive a rewrite').toContain(
            '// soldAt matches the wholesale-bundle soldAt locked in',
        );
        expect(after, 'untouched entries keep their original escape style').toContain(
            '\\u2014 once sold, gone forever.',
        );
        expect(after).not.toBe(seedText);
    });

    it('lands a rewritten entry at the same indentation as its neighbours', () => {
        const target = INITIAL_PRODUCTS.find((p) => p.id === SEED_ONLY_ID) as Product;
        const edited = { ...target, price: 999 } as Product;
        const after = replaceSeedArray(
            seedText,
            INITIAL_PRODUCTS.map((p) => (p.id === SEED_ONLY_ID ? edited : p)),
        );

        // Reverting the one value must give back the original file exactly — same
        // indentation, commas, comments, and every other entry byte-for-byte.
        expect(after.replace('"price": 999', `"price": ${target.price}`)).toBe(seedText);
    });

    it('refuses to write a file whose array declaration it cannot find', () => {
        expect(() => replaceSeedArray('export const SOMETHING_ELSE = [];\n', INITIAL_PRODUCTS)).toThrow(
            /INITIAL_PRODUCTS/,
        );
    });

    it('reports drift as a line rather than a rewrite, and names the ids it kept', () => {
        const lines = formatSeedMergeReport(
            {
                targeted: [],
                rewritten: [],
                seedOnly: ['a'],
                added: [],
                drift: [{ id: 'b', field: 'price', seed: 60, db: 40 }],
            },
            false,
        ).join('\n');

        expect(lines).toContain('b.price');
        expect(lines).toContain('60');
        expect(lines).toContain('40');
        expect(lines, 'the operator must be told how to apply it deliberately').toContain('--only');
    });

    it('keeps a drift line to one readable line, whatever the value', () => {
        expect(summarizeValue(['a', 'b', 'c'])).toBe('[3 items]');
        expect(summarizeValue('x'.repeat(80))).toHaveLength(49);
        expect(summarizeValue(40)).toBe('40');

        const lines = formatSeedMergeReport(
            {
                targeted: [],
                rewritten: [],
                seedOnly: [],
                added: [],
                drift: [{ id: 'p', field: 'images', seed: ['a', 'b'], db: ['a', 'c'] }],
            },
            false,
        );
        expect(lines).toHaveLength(2);
        expect(lines[0]).not.toContain('\n');
        expect(lines[0]).toContain('p.images: seed [2 items] vs db [2 items]');
    });
});

describe('unknown --only ids', () => {
    const rows = INITIAL_PRODUCTS.filter((p) => p.id !== SEED_ONLY_ID).slice(0, 5).map(toRow);

    it('names an id that exists nowhere', () => {
        expect(unknownSeedIds(INITIAL_PRODUCTS, rows, ['prod_typo'])).toEqual(['prod_typo']);
    });

    it('accepts an id that is only in the seed', () => {
        expect(unknownSeedIds(INITIAL_PRODUCTS, rows, [SEED_ONLY_ID])).toEqual([]);
    });

    it('accepts a product the database has but the seed has never seen', () => {
        const fresh = toRow(variant({ id: 'prod_brand_new' }));
        expect(unknownSeedIds(INITIAL_PRODUCTS, [fresh], ['prod_brand_new'])).toEqual([]);
    });

    it('reports every unknown id rather than just the first', () => {
        expect(unknownSeedIds(INITIAL_PRODUCTS, rows, ['nope_a', 'nope_b'])).toEqual(['nope_a', 'nope_b']);
    });
});

describe('the sync script obeys the rule', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'scripts', 'syncProducts.ts'), 'utf8');

    it('folds rows in through the shared merge instead of rebuilding the array', () => {
        expect(source).toMatch(/from '\.\/productSeed'|from "\.\/productSeed"/);
        expect(source, 'a wholesale replacement is the bug this pins').not.toMatch(
            /INITIAL_PRODUCTS: Product\[\] = \$\{/,
        );
    });

    it('lets the caller name what it may rewrite', () => {
        expect(source).toContain('--only');
    });

    it('refuses an --only id that matches nothing instead of reporting no change', () => {
        expect(source, "the owner of \"what an id can refer to\" must be consulted").toContain(
            'unknownSeedIds(',
        );
        expect(source).toContain('unknown --only id');
        // Verified for real too: `--only <typo>` exits 1. This pins that the script
        // still signals failure rather than falling through to a no-op.
        expect(source, 'and the run must fail, not print a successful no-op').toMatch(
            /process\.exitCode = 1|process\.exit\(1\)/,
        );
        expect(source, 'the error must say how to see valid ids').toContain('--list');
    });
});
