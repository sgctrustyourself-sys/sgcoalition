import { describe, it, expect } from 'vitest';
import { getProductRoles, reconcileImageRoles } from '../utils/productImage';

// Tests the getProductRoles / reconcileImageRoles contract for the new
// imageFit + imageBackground fields added to ImageRoles (types.ts). All
// product rows that pre-date the migration are pinned explicitly in
// constants.ts > INITIAL_PRODUCTS / PRODUCT_LOCAL_OVERRIDES with
// imageFit='contain' + imageBackground='white', so the read-helper's
// default branch is only reachable for unmigrated Supabase rows. The
// "explicit wins" test still uses a once-legacy id because it's the
// simplest disambiguator against any future id-based fallback that
// might sneak back in.

const buildProduct = (overrides: Partial<{
    id: string;
    images: string[];
    imageRoles: any;
}>): any => ({
    id: overrides.id ?? 'prod_test_default',
    name: 'Test Product',
    price: 40,
    images: overrides.images ?? ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    imageRoles: overrides.imageRoles,
    description: '',
    category: 'shirt',
});

describe('productImage render profile (imageFit + imageBackground)', () => {
    // The 5 once-legacy product ids that pre-date the imageRoles.imageFit
    // + imageBackground fields. They used to read from a legacy-id
    // fallback that hard-coded {'contain', 'white'} in
    // components/ProductCard.tsx + pages/ProductDetails.tsx. After the
    // legacy-list cleanup, all 5 are pinned explicitly in
    // constants.ts > INITIAL_PRODUCTS / PRODUCT_LOCAL_OVERRIDES, so the
    // fixtures below exercise the default branch to confirm no id-based
    // fallback remains in the read-helper.
    const ONCE_LEGACY_IDS = [
        'prod_tee_above_as_below',
        'prod_shorts_above_as_below',
        'prod_hoodie_overwhelmingly_patient',
        'Coalition_Grey_Wave_Wallet_1_2',
        'Coalition_Grey_Wave_Wallet_2_2',
    ];

    it('defaults to cover + gray-900 when imageRoles is undefined', () => {
        const roles = getProductRoles(buildProduct({ imageRoles: undefined }));
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('gray-900');
    });

    it('defaults to cover + gray-900 when imageRoles exists but new fields are missing', () => {
        const roles = getProductRoles(buildProduct({
            imageRoles: { primaryUrl: 'https://example.com/a.jpg' },
        }));
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('gray-900');
    });

    it('honors explicit imageRoles.imageFit + imageBackground', () => {
        const roles = getProductRoles(buildProduct({
            imageRoles: { imageFit: 'contain', imageBackground: 'white' },
        }));
        expect(roles.imageFit).toBe('contain');
        expect(roles.imageBackground).toBe('white');
    });

    it('honors mixed combos: cover + white', () => {
        const roles = getProductRoles(buildProduct({
            imageRoles: { imageFit: 'cover', imageBackground: 'white' },
        }));
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('white');
    });

    it('honors mixed combos: contain + gray-900', () => {
        const roles = getProductRoles(buildProduct({
            imageRoles: { imageFit: 'contain', imageBackground: 'gray-900' },
        }));
        expect(roles.imageFit).toBe('contain');
        expect(roles.imageBackground).toBe('gray-900');
    });

    it('honors explicit transparent background', () => {
        const roles = getProductRoles(buildProduct({
            imageRoles: { imageFit: 'cover', imageBackground: 'transparent' },
        }));
        expect(roles.imageBackground).toBe('transparent');
    });

    it('explicit imageFit/imageBackground override the read-helper defaults for any product id', () => {
        // Uses a once-legacy id as input so the test fails loudly if a
        // future id-based fallback tries to reintroduce the historical
        // {'contain', 'white'} quirk.
        const roles = getProductRoles(buildProduct({
            id: 'prod_tee_above_as_below',
            imageRoles: { imageFit: 'cover', imageBackground: 'gray-900' },
        }));
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('gray-900');
    });

    it.each(ONCE_LEGACY_IDS)('once-legacy id %s defaults to cover + gray-900 without explicit fields', (id) => {
        const roles = getProductRoles(buildProduct({ id, imageRoles: undefined }));
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('gray-900');
    });

    it.each(ONCE_LEGACY_IDS)('once-legacy id %s defaults to cover + gray-900 when imageRoles exists but new fields are absent', (id) => {
        const roles = getProductRoles(buildProduct({
            id,
            imageRoles: { primaryUrl: 'https://example.com/a.jpg' },
        }));
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('gray-900');
    });

    it('handles null product without throwing', () => {
        const roles = getProductRoles(null);
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('gray-900');
        expect(roles.primaryUrl).toBe('');
    });
});

describe('reconcileImageRoles preserves imageFit + imageBackground', () => {
    it('passes through explicit imageFit/imageBackground unchanged', () => {
        const reconciled = reconcileImageRoles(
            ['https://example.com/a.jpg'],
            {
                primaryUrl: 'https://example.com/a.jpg',
                hoverUrl: null,
                imageFit: 'contain',
                imageBackground: 'white',
            },
        );
        expect(reconciled.imageFit).toBe('contain');
        expect(reconciled.imageBackground).toBe('white');
    });

    it('does not synthesise fallback values when imageRoles has no new fields', () => {
        const reconciled = reconcileImageRoles(
            ['https://example.com/a.jpg'],
            { primaryUrl: 'https://example.com/a.jpg' },
        );
        // Undefined on purpose — the read-helper's default-(cover,
        // gray-900) branch is the source of truth here, not reconcile.
        // That keeps unmigrated Supabase rows rendering identically
        // until the operator saves explicit fields via the admin editor.
        expect(reconciled.imageFit).toBeUndefined();
        expect(reconciled.imageBackground).toBeUndefined();
    });

    it('walks imageFit/imageBackground through even when images trim drops other fields', () => {
        const reconciled = reconcileImageRoles(
            ['https://example.com/a.jpg'],
            {
                primaryUrl: 'https://example.com/deleted.jpg', // drops the primary
                imageFit: 'contain',
                imageBackground: 'white',
            },
        );
        expect(reconciled.primaryUrl).toBe('https://example.com/a.jpg');
        expect(reconciled.imageFit).toBe('contain');
        expect(reconciled.imageBackground).toBe('white');
    });
});
