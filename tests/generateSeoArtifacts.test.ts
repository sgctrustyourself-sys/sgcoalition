// tests/generateSeoArtifacts.test.ts
//
// Regression test for scripts/generateSeoArtifacts.mjs.
//
// History: the parser originally expected unquoted object keys (`id: "..."`).
// When constants.ts was reformatted to use quoted keys (`"id": "..."`), the
// regex silently stopped matching every field, dropping the sitemap from 18
// product URLs to 0. The fix uses `String.raw` template literals so that
// `\b` and `\s` stay as proper regex escapes (not ASCII backspace / bare `s`).
//
// These tests lock in the fix so a future refactor can't reintroduce the bug.

import { describe, it, expect } from 'vitest';
import {
    readStringField,
    readNumberField,
    buildSitemap,
} from '../scripts/generateSeoArtifacts.mjs';

describe('SEO parser — field extractors', () => {
    // REGRESSION CATCH: this is the exact failure mode that dropped the
    // sitemap to 0 product URLs. If readStringField ever stops matching
    // quoted keys again, this test fails immediately.
    describe('readStringField with quoted keys', () => {
        it('extracts a string field whose key is double-quoted', () => {
            const block = `{
    "id": "prod_test_item",
    "name": "Test Item",
    "description": "A test product",
    "category": "tees",
}`;
            expect(readStringField(block, 'id')).toBe('prod_test_item');
            expect(readStringField(block, 'name')).toBe('Test Item');
            expect(readStringField(block, 'description')).toBe('A test product');
            expect(readStringField(block, 'category')).toBe('tees');
        });

        it('extracts a string field whose key is single-quoted', () => {
            const block = `{
    'id': 'prod_test_item',
    'name': 'Test Item',
}`;
            expect(readStringField(block, 'id')).toBe('prod_test_item');
            expect(readStringField(block, 'name')).toBe('Test Item');
        });
    });

    // Backward compatibility: the old (unquoted) form must still work.
    describe('readStringField with unquoted keys', () => {
        it('extracts a string field whose key is unquoted', () => {
            const block = `{
    id: "prod_legacy_item",
    name: "Legacy Item",
}`;
            expect(readStringField(block, 'id')).toBe('prod_legacy_item');
            expect(readStringField(block, 'name')).toBe('Legacy Item');
        });
    });

    // The \b word boundary must prevent `id` from matching inside `tokenId`.
    describe('readStringField word-boundary safety', () => {
        it('does not match `id` inside `tokenId`', () => {
            const block = `{
    "tokenId": "tok_should_not_match",
    "id": "prod_should_match",
}`;
            expect(readStringField(block, 'id')).toBe('prod_should_match');
        });

        it('does not match `name` inside `displayName`', () => {
            const block = `{
    "displayName": "Display Name",
    "name": "Real Name",
}`;
            expect(readStringField(block, 'name')).toBe('Real Name');
        });

        it('does not match `archived` inside `archivedAt`', () => {
            const block = `{
    "archivedAt": "2024-01-01",
    "archived": "should-not-pick-this-up",
}`;
            // The \b boundary ensures we match `archived:` not `archivedAt:`.
            expect(readStringField(block, 'archived')).toBe('should-not-pick-this-up');
        });
    });

    // REGRESSION CATCH: price must extract as a number, not a string.
    describe('readNumberField', () => {
        it('extracts price from a quoted-key block as a number', () => {
            const block = `{
    "id": "prod_test_item",
    "name": "Test Item",
    "price": 99.99,
}`;
            expect(readNumberField(block, 'price')).toBe(99.99);
            expect(typeof readNumberField(block, 'price')).toBe('number');
        });

        it('extracts price from an unquoted-key block as a number', () => {
            const block = `{
    id: "prod_legacy",
    name: "Legacy",
    price: 49,
}`;
            expect(readNumberField(block, 'price')).toBe(49);
        });

        it('returns 0 for a missing field', () => {
            const block = `{
    "id": "prod_test",
    "name": "Test",
}`;
            expect(readNumberField(block, 'price')).toBe(0);
        });
    });
});

describe('SEO parser — full block regression', () => {
    // End-to-end shape check: this is the exact scenario that broke in
    // production. A block shaped like a real constants.ts entry (quoted
    // keys) must yield the correct id, name, and price through the
    // readStringField / readNumberField helpers.
    it('extracts id, name, and price from a realistic quoted-key block', () => {
        const block = `{
        "id": "prod_womens_coalition_halo_contrast_tee",
        "name": "Women's Coalition Halo Contrast Tee",
        "description": "Premium streetwear tee with contrast halo detail.",
        "category": "tees",
        "price": 65,
        "images": ["/img/tee-front.png", "/img/tee-back.png"],
        "archived": false,
        "isLimitedEdition": true,
    }`;    expect(readStringField(block, 'id')).toBe('prod_womens_coalition_halo_contrast_tee');
    expect(readStringField(block, 'name')).toBe("Women's Coalition Halo Contrast Tee");
    expect(readNumberField(block, 'price')).toBe(65);
    });
});

// REGRESSION CATCH: the buildSitemap helper pins the priority +
// changefreq assignment so a future refactor cannot silently roll back the
// limited-edition exception. Background: the prior rule demoted any product
// with archived=true OR soldAt=... to monthly/0.6, which made every numbered
// limited wallet (Coalition 'Racing Team' 1/4 → 4/4, etc.) drop out of the
// high-value cluster the moment it sold. The operator's directive on
// 2026-07-14 was "archive limited editions stay at weekly/0.8 because
// they keep drawing long-tail queries" — this test is the lock that future
// refactors can't revert that intent.
describe('SEO sitemap priorities', () => {
    const ACTIVE_STANDARD = 'prod_active_standard';
    const ARCHIVED_STANDARD = 'prod_archived_standard';
    const ARCHIVED_LIMITED = 'prod_archived_limited';

    // The helper's full Product type has more fields than the synthetic
    // fixtures supply here. Cast through Parameters<typeof buildSitemap>[0]
    // once at the helper boundary so each assertion stays clean — and so a
    // future refactor that loosens the helper's parameter type doesn't
    // break the test through a stale `@ts-expect-error`.
    const sitemapFor = (
        products: Array<{ id: string; archived: boolean; soldAt?: string | null; isLimitedEdition?: boolean }>,
    ) => buildSitemap(products as Parameters<typeof buildSitemap>[0]);

    const rowRegex = (id: string, changefreq: 'weekly' | 'monthly', priority: '0.8' | '0.6') =>
        new RegExp(
            `<loc>${`https://sgcoalition.xyz/product/${id}`}<\\/loc>\\s*` +
                `<lastmod>[\\d-]+<\\/lastmod>\\s*` +
                `<changefreq>${changefreq}<\\/changefreq>\\s*` +
                `<priority>${priority}<\\/priority>`,
        );

    it('keeps active non-limited products at 0.8/weekly', () => {
        const xml = sitemapFor([
            { id: ACTIVE_STANDARD, archived: false, soldAt: null, isLimitedEdition: false },
        ]);
        expect(xml).toMatch(rowRegex(ACTIVE_STANDARD, 'weekly', '0.8'));
    });

    it('demotes standard archived products to 0.6/monthly', () => {
        const xml = sitemapFor([
            { id: ARCHIVED_STANDARD, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: false },
        ]);
        expect(xml).toMatch(rowRegex(ARCHIVED_STANDARD, 'monthly', '0.6'));
    });

    it('keeps limited-edition archived products at 0.8/weekly', () => {
        const xml = sitemapFor([
            { id: ARCHIVED_LIMITED, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: true },
        ]);
        expect(xml).toMatch(rowRegex(ARCHIVED_LIMITED, 'weekly', '0.8'));
    });

    it('mixes active + archived standard + archived limited correctly', () => {
        const xml = sitemapFor([
            { id: ACTIVE_STANDARD, archived: false, soldAt: null, isLimitedEdition: false },
            { id: ARCHIVED_STANDARD, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: false },
            { id: ARCHIVED_LIMITED, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: true },
        ]);
        expect(xml).toMatch(rowRegex(ACTIVE_STANDARD, 'weekly', '0.8'));
        expect(xml).toMatch(rowRegex(ARCHIVED_STANDARD, 'monthly', '0.6'));
        expect(xml).toMatch(rowRegex(ARCHIVED_LIMITED, 'weekly', '0.8'));
    });

    it('demotes soldAt-only products (no archived flag) to 0.6/monthly when not a limited edition', () => {
        // Coalition_x_True_Religion_S1-style row: archived=false but soldAt
        // is set by the archive override. The rule still applies the demotion
        // because the predicate is (archived || soldAt) && !isLimitedEdition.
        const soldNoArchive = 'prod_sold_no_archive';
        const xml = sitemapFor([
            { id: soldNoArchive, archived: false, soldAt: '2026-03-06T00:00:00+00:00', isLimitedEdition: false },
        ]);
        expect(xml).toMatch(rowRegex(soldNoArchive, 'monthly', '0.6'));
    });

    it('keeps soldAt-only products (no archived flag) at 0.8/weekly when they are a limited edition', () => {
        // Symmetric to the previous test: same shape (soldAt set, archived
        // not yet flipped), but isLimitedEdition=true keeps the row in the
        // active-product cluster. Locks the limited branch of the rule and
        // prevents the previous test's name from being misleading.
        const soldNoArchiveLimited = 'prod_sold_no_archive_limited';
        const xml = sitemapFor([
            { id: soldNoArchiveLimited, archived: false, soldAt: '2026-03-06T00:00:00+00:00', isLimitedEdition: true },
        ]);
        expect(xml).toMatch(rowRegex(soldNoArchiveLimited, 'weekly', '0.8'));
    });
});
