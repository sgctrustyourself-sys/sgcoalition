import { describe, it, expect } from 'vitest';
import { getProductRoles, reconcileImageRoles } from '../utils/productImage';

// Tests the getProductRoles / reconcileImageRoles contract for the new
// imageFit + imageBackground fields added to ImageRoles (types.ts). The
// ProductCard store-front consumer relies on these defaults to match the
// pre-migration render so old Supabase rows paint identically until the
// operator opts in via ProductManager > Render Profile.

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
    // The 3 product ids that pre-date imageRoles.imageFit + imageBackground
    // and previously hard-coded object-contain + bg-white in
    // components/ProductCard.tsx. utils/productImage.ts > LEGACY_FIT_FULL_IMAGE_IDS
    // carries the legacy fallback until each Supabase row is migrated.
    const LEGACY_FULL_IDS = [
        'prod_tee_above_as_below',
        'prod_shorts_above_as_below',
        'prod_hoodie_overwhelmingly_patient',
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

    it('explicit imageFit/imageBackground win over the legacy product-id fallback', () => {
        const roles = getProductRoles(buildProduct({
            id: 'prod_tee_above_as_below', // legacy list member
            imageRoles: { imageFit: 'cover', imageBackground: 'gray-900' },
        }));
        expect(roles.imageFit).toBe('cover');
        expect(roles.imageBackground).toBe('gray-900');
    });

    it.each(LEGACY_FULL_IDS)('legacy %s falls back to contain + white without explicit fields', (id) => {
        const roles = getProductRoles(buildProduct({ id, imageRoles: undefined }));
        expect(roles.imageFit).toBe('contain');
        expect(roles.imageBackground).toBe('white');
    });

    it.each(LEGACY_FULL_IDS)('legacy %s falls back to contain + white when imageRoles exists but new fields are absent', (id) => {
        const roles = getProductRoles(buildProduct({
            id,
            imageRoles: { primaryUrl: 'https://example.com/a.jpg' },
        }));
        expect(roles.imageFit).toBe('contain');
        expect(roles.imageBackground).toBe('white');
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
        // Undefined on purpose — the read-helper's legacy-id fallback is the
        // source of truth here, not reconcile. That keeps the legacy
        // fallback in play for any save path that hasn't yet picked a
        // render profile.
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
