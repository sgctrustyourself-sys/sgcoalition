// utils/productMerge.ts
//
// Pure-data product merge helpers - extracted from context/AppContext.tsx so
// tests and any other consumers can import the same logic the React layer
// uses, instead of mirroring it (mirrored copies silently drift when the
// production implementation changes).
//
// Order of operations in AppContext.fetchProducts:
//   1. Per-product spread:   { ...localProduct, ...withoutUndefinedFields(supabaseRow) }
//                            Supabase wins for non-undefined fields so the live
//                            row stays authoritative over local INITIAL_PRODUCTS.
//   2. Local-only tail:      [...uniqueByIdFromSupabase, ...localOnlyProducts]
//                            Local-only rows surface in the catalog while it's
//                            being reconciled.
//   3. Pinned overrides:     applyLocalProductOverrides(mergedProducts)
//                            Override wins for every pinned field. This is the
//                            layer that puts category:sweatshirt for
//                            prod_hoodie_overwhelmingly_patient on the live
//                            SWEATSHIRTS filter ahead of the live DB landing
//                            the same value through scripts/syncProductCategories.cjs.

import { Product } from '../types';
import { PRODUCT_LOCAL_OVERRIDES } from '../constants';

/**
 * Apply PRODUCT_LOCAL_OVERRIDES on top of every product, leaving non-pinned
 * fields intact. Pinned fields always win - this is the layer that lets an
 * operator force-pin metadata (e.g. category, images) without waiting for a
 * Supabase row to land the same value. Runs LAST in the AppContext merge so
 * any other upstream source is allowed to set the field first.
 */
export const applyLocalProductOverrides = (items: Product[]): Product[] =>
    items.map(product => ({
        ...product,
        ...(PRODUCT_LOCAL_OVERRIDES[product.id] || {}),
    }));

/**
 * Strip undefined-valued keys from a product so a
 * { ...localProduct, ...sp } spread cannot clobber an existing local value
 * with undefined. A Supabase row whose schema is newer than the local type
 * often returns undefined for deprecated fields, and this helper turns those
 * gaps into no-ops instead of destructive assignments.
 */
export const withoutUndefinedFields = (product: Product): Product =>
    Object.fromEntries(
        Object.entries(product).filter(([, value]) => value !== undefined)
    ) as Product;
