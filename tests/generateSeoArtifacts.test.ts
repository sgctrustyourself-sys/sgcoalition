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
    }`;

        expect(readStringField(block, 'id')).toBe('prod_womens_coalition_halo_contrast_tee');
        expect(readStringField(block, 'name')).toBe("Women's Coalition Halo Contrast Tee");
        expect(readNumberField(block, 'price')).toBe(65);
    });
});
