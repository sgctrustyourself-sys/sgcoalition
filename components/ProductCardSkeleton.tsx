import React from 'react';
import Skeleton from './ui/Skeleton';
import { Product } from '../types';
import { getProductRoles, IMAGE_BACKGROUND_CLASS } from '../utils/productImage';

// Skeleton status: matches the real ProductCard image frame so the /shop
// grid stops reflowing ~95px when products hydrate. Three things had to
// align for this to actually work instead of leaking a height jolt:
//
// 1. aspect ratio. ProductCard's <div className="aspect-[4/5] ... bg-gray-900">
//    sets the image frame via aspect ratio, not h-64. The old h-64 (=256px)
//    was fixed regardless of grid column width, so a 4-col desktop card
//    (~280px wide ⇒ aspect-[4/5] = 350px tall) grew ~95px on hydrate and
//    pushed every card below it down. New: aspect-[4/5] w-full matches the
//    real card at every breakpoint.
//
// 2. background color. There are now TWO modes:
//    a. props-free (no `product` prop): bg-gray-900. Faithful for the
//       dominant ~95% render profile (the default imageRoles shape).
//    b. per-product (pass a `product`): the skeleton reads
//       `getProductRoles(product).imageBackground` and resolves to the
//       matching bg class. This eliminates the bg-color jolt for the 5
//       once-legacy ids pinned in constants.ts > INITIAL_PRODUCTS +
//       PRODUCT_LOCAL_OVERRIDES
//       (prod_tee_above_as_below, prod_shorts_above_as_below,
//       prod_hoodie_overwhelmingly_patient, Coalition_Grey_Wave_Wallet_1_2,
//       Coalition_Grey_Wave_Wallet_2_2 -- all 5 use imageBackground='white').
//    Caveat: as of this commit Shop.tsx's loading branch (`isLoading &&
//    products.length === 0`) only fires when products is empty, so the
//    per-product path is dormant at site-load (AppContext inits products
//    synchronously from INITIAL_PRODUCTS). The dominant-case mirror still
//    covers the brief Supabase-fetch window because the bg-gray-900
//    Skeleton primitive matches ProductCard's 95% default; the per-product
//    variant is in place for future code paths (refetch states, Profile.tsx
//    favorites, search-loading, anywhere the eventual product id is known
//    at skeleton-render time).
//
// 3. corner radius. ProductCard's image frame has no rounding; the Skeleton
//    primitive defaults to `rounded`, so pass `rounded-none` to match.
interface ProductCardSkeletonProps {
    /**
     * When set, the skeleton's image-frame bg is derived from
     * `getProductRoles(product).imageBackground`. When undefined, defaults
     * to `bg-gray-900` -- the dominant render profile for products created
     * without explicit imageRoles pinning.
     */
    product?: Product;
    /**
     * Direct override -- wins over `product`-derived bg. Useful when the
     * caller already knows the bg value (e.g. via a parallel
     * `getProductRoles(p).imageBackground` read at the call site) and
     * wants to skip the per-render getProductRoles call. When both props
     * are set, `imageBackground` wins; when neither is set, defaults
     * to `'gray-900'`.
     */
    imageBackground?: 'gray-900' | 'white' | 'transparent';
}

const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ product, imageBackground: imageBackgroundProp }) => {
    // Resolution order: explicit imageBackground prop wins; else if a product
    // is given derive from getProductRoles; else default to the dominant
    // 'gray-900'. An imageRoles.imageBackground reading from the product
    // still wins when no override prop is passed.
    const imageBackground: 'gray-900' | 'white' | 'transparent' =
        imageBackgroundProp
            ?? (product ? getProductRoles(product).imageBackground : 'gray-900');
    const imageFrameClass = IMAGE_BACKGROUND_CLASS[imageBackground];

    return (
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
            <Skeleton className={`aspect-[4/5] w-full ${imageFrameClass} rounded-none`} />
            <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </div>
        </div>
    );
};

export default ProductCardSkeleton;
