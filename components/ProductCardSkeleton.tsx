import React from 'react';
import Skeleton from './ui/Skeleton';

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
// 2. background color. Most products render with the default imageRoles
//    shape (imageBackground='gray-900'), so bg-gray-900 is faithful for the
//    dominant render profile. The 5 once-legacy ids
//    (prod_tee_above_as_below, prod_shorts_above_as_below,
//    prod_hoodie_overwhelmingly_patient, Coalition_Grey_Wave_Wallet_1_2,
//    Coalition_Grey_Wave_Wallet_2_2 -- all pinned in constants.ts >/
//    INITIAL_PRODUCTS + PRODUCT_LOCAL_OVERRIDES) use imageBackground='white',
//    so for those 3 active listings (tee/shorts/hoodie; the 2 grey waves are
//    sold-out and overlaid with the `bg-black/40` SOLD stamp which dims but
//    does not fully hide the bg-white mismatch) the skeleton mismatch is a
//    tiny visual jolt -- much smaller than the height jolt this change
//    eliminates. A per-product skeleton would
//    resolve the 3 active cases, at the cost of a `product` prop variant
//    used only inside the Shop.tsx product loop where the eventual
//    product is known. Not pursued here because the height jolt was the
//    user-reported regression; this commit captures the dominant-case
//    mirror as the easy win.
//
// 3. corner radius. ProductCard's image frame has no rounding; the Skeleton
//    primitive defaults to `rounded`, so pass `rounded-none` to match.
const ProductCardSkeleton = () => {
    return (
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
            <Skeleton className="aspect-[4/5] w-full bg-gray-900 rounded-none" />
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
