// tests/productPriceConsistency.test.ts
//
// A product's price has exactly two owners: the `products` table (what the shop
// charges) and constants/products.ts (the fallback the storefront renders when the
// table is unreachable). Those two are compared where both of them live — the drift
// rule in scripts/productSeed.ts, which the admin Products tab shows and Sync Code
// writes through.
//
// This file used to assert a third owner instead: full_products.json, an eight-entry
// dump of an older, 26-row table, compared entry by entry against the seed. That is
// how the Shark Tee sat at $60 for two months while checkout charged $40 — two stale
// copies agreeing with each other, a green test certifying the agreement, and nothing
// anywhere checking either copy against the table. The seed could only be corrected
// by hand.
//
// The dump is retired, so this file pins the retirement rather than restating it: a
// checked-in copy of the table must not come back, whatever it is named.
//
// Two things keep that pin honest, because a scan that inspects nothing passes
// everything: the floor below fails if the walk finds no files, or never leaves the
// repo root, and the row predicate asks for a product field so a bare {id, price} map
// — a fee table, a tier list, a price export — does not get reported as a catalog copy.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

/** Output, dependencies and tooling — not sources, so not scanned. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.next', 'dist', 'coverage', 'build', 'tmp']);

function jsonFilesIn(dir: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) jsonFilesIn(path.join(dir, entry.name), found);
            continue;
        }
        if (entry.name.endsWith('.json')) found.push(path.join(dir, entry.name));
    }
    return found;
}

/**
 * Fields a row of the products table carries and a bare id→price map does not.
 * Every row of the retired snapshot had `name` and `category` (and the seed's rows
 * carry `name`, `images`, `category`, `sizes`), so this does not narrow detection of
 * a real catalog copy — only of the id-and-price shape that is not one.
 */
const PRODUCT_FIELDS = [
    'name',
    'category',
    'images',
    'stock',
    'sizes',
    'size_inventory',
    'description',
    'slug',
    'archived',
];

/** Rows carrying a product id, a price and at least one product field are catalog rows. */
function productRowCount(value: unknown): number {
    if (!Array.isArray(value)) return 0;
    return value.filter(
        row =>
            row &&
            typeof row === 'object' &&
            'id' in row &&
            'price' in row &&
            PRODUCT_FIELDS.some(field => field in row),
    ).length;
}

/** Walked once: the check below reads these files, the floor test proves it was not empty. */
const scannedFiles = jsonFilesIn(projectRoot);

describe('a product price has one owner', () => {
    it('has no checked-in JSON copy of the products table to drift against', () => {
        const offenders: string[] = [];

        for (const file of scannedFiles) {
            let parsed: unknown;
            try {
                parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch {
                continue; // not our concern here
            }
            const rows = productRowCount(parsed);
            if (rows > 0) offenders.push(`${path.relative(projectRoot, file)} (${rows} product row${rows === 1 ? '' : 's'})`);
        }

        expect(
            offenders,
            'A JSON dump of the products table goes stale silently, and while it agrees with an equally ' +
                'stale seed it certifies the pair as correct. Compare against the live table instead — ' +
                'scripts/productSeed.ts owns that comparison, and the drift rule it backs is what shows it.',
        ).toEqual([]);
    });

    it('the anti-vacuity floor: the scan found files to inspect, in more than one directory', () => {
        expect(
            scannedFiles.length,
            'The scan must produce files to inspect: an empty list makes the check above pass while ' +
                'checking nothing, which is worse than no check at all.',
        ).toBeGreaterThanOrEqual(5);

        const nested = scannedFiles.filter(file => path.relative(projectRoot, file).includes(path.sep));
        expect(
            nested.length,
            'and the walk must descend into subdirectories, not stop at the repo root — otherwise a ' +
                'copy under public/ or data/ would be invisible.',
        ).toBeGreaterThan(0);
    });

    it('compares the seed with the live table, through the rule that owns the comparison', () => {
        const drift = fs.readFileSync(path.join(projectRoot, 'api', '_handlers', 'product-drift.ts'), 'utf8');
        expect(drift, 'the drift check must compare through the shared rule').toContain('mergeSeedProducts');

        const audit = fs.readFileSync(path.join(projectRoot, 'scripts', 'auditWalletPrices.ts'), 'utf8');
        expect(audit, 'the live wallet audit must read the table, not a snapshot').not.toMatch(/from\s+['"][^'"]+\.json['"]/);
        expect(audit, 'and it must ask the rule rather than compare prices itself').toContain('refreshSeed');
    });
});
