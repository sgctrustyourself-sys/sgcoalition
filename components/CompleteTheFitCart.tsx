import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ShoppingBag, Truck, Sparkles, Check } from 'lucide-react';
import {
    ABOVE_AS_BELOW_TEE_ID,
    ABOVE_AS_BELOW_SHORTS_ID,
    ABOVE_AS_BELOW_SET_BONUS_CENTS,
} from '../utils/aboveAsBelowSet';
import { resolveLocalImageUrl } from '../utils/localImageAssets';
import { getProductImage, getProductImageSrcSet, PRODUCT_IMAGE_SIZES } from '../utils/productImage';

interface CompleteTheFitCartProps {
    // drawer (default): compact single-row card sized for the slide-in drawer.
    // page:             wider stacked card for the /cart page sidebar.
    variant?: 'drawer' | 'page';
}

const setBonusDollars = ABOVE_AS_BELOW_SET_BONUS_CENTS / 100;

const CompleteTheFitCart: React.FC<CompleteTheFitCartProps> = ({ variant = 'drawer' }) => {
    const { products, cart, addToCart } = useApp();
    const { addToast } = useToast();

    // Same-tick double-click guard. The render-time cartProductIds check
    // below only catches "already in cart" *across renders*; two synchronous
    // clicks (before React re-renders with the updated cart) would both
    // pass that check and fire addToCart + toast twice. A ref is mutated
    // synchronously, so the second handleAdd invocation always observes
    // the flag set during the same task. Reset in a setTimeout(0) so a
    // deliberate, later click after the post-add paint still works.
    const inFlightRef = useRef<boolean>(false);

    // Symmetry: tee in cart suggests shorts; shorts in cart suggests tee.
    // XOR via !== (logical) returns null when both are present (set-bonus
    // card takes over) and when neither is in cart — TypeScript forbids the
    // bitwise ^ operator on booleans; use strict inequality for boolean XOR.
    const cartProductIds = new Set(cart.map((item) => item.id));
    const hasTee = cartProductIds.has(ABOVE_AS_BELOW_TEE_ID);
    const hasShorts = cartProductIds.has(ABOVE_AS_BELOW_SHORTS_ID);
    if (hasTee === hasShorts) return null;

    const missingIsShorts = hasTee && !hasShorts;
    const missingId = missingIsShorts ? ABOVE_AS_BELOW_SHORTS_ID : ABOVE_AS_BELOW_TEE_ID;
    const missingProduct = products.find((p) => p.id === missingId);
    if (!missingProduct) return null;

    // Hide if the missing piece itself is unavailable — no point marketing
    // something the shopper cannot add.
    const totalStock = Object.values(missingProduct.sizeInventory || {}).reduce(
        (sum, count) => sum + Number(count || 0),
        0
    );
    if (missingProduct.archived || totalStock === 0) return null;

    // Mirror the in-cart line's size so the pair lands at matching sizes.
    // If the shopper has multiple lines of the same product (different
    // sizes / qty bumps), pick the most-recent line via findLast so the
    // upsell matches whichever size they last added rather than an
    // arbitrary first-match ordering.
    const presentProductId = missingIsShorts ? ABOVE_AS_BELOW_TEE_ID : ABOVE_AS_BELOW_SHORTS_ID;
    const presentLines = cart.filter((item) => item.id === presentProductId);
    const presentSize = presentLines.length > 0
        ? presentLines[presentLines.length - 1].selectedSize
        : undefined;
    const targetSize = (() => {
        if (missingProduct.sizes && missingProduct.sizes.length === 1) return missingProduct.sizes[0];
        if (presentSize && missingProduct.sizes?.includes(presentSize)) return presentSize;
        return missingProduct.sizes?.[0] || 'One Size';
    })();

    const handleAdd = () => {
        // Same-tick double-click guard: bail if a previous click is still
        // being processed. Writes to inFlightRef.current are synchronous,
        // so the *second* synchronous handleAdd invocation within the
        // same tick always sees the latch set — closing the race that the
        // render-time cartProductIds check can't catch (it only sees the
        // pre-click render).
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            // Render-time guard: if the missing piece is already in cart
            // (e.g., added on a previous render), skip and surface a
            // existing-in-cart toast so the user understands why nothing
            // happened rather than seeing a duplicate add toast.
            if (cartProductIds.has(missingId)) {
                addToast(
                    `${missingProduct.name} already in cart. Set bonus locked in.`,
                    'success'
                );
                return;
            }
            addToCart(missingProduct, targetSize);
            addToast(
                `Added ${missingProduct.name} (size ${targetSize}) — $30 set bonus will lock in at checkout.`,
                'success'
            );
        } finally {
            // Reset on the next macrotask so any same-tick duplicate click
            // is suppressed, but a deliberate subsequent click after the
            // post-add paint can still go through.
            setTimeout(() => {
                inFlightRef.current = false;
            }, 0);
        }
    };

    const missingImage = resolveLocalImageUrl(missingProduct.images?.[0] || '');
    const missingHref = `/product/${missingProduct.id}`;
    const missingShortLabel = missingIsShorts ? 'Shorts' : 'Tee';
    const presentShortLabel = missingIsShorts ? 'Tee' : 'Shorts';
    const isPageVariant = variant === 'page';

    return (
        <div
            className={
                isPageVariant
                    ? 'mt-8 rounded-lg border border-brand-accent/30 bg-gradient-to-br from-brand-accent/[0.08] via-transparent to-transparent p-5'
                    : 'rounded-lg border border-brand-accent/30 bg-gradient-to-br from-brand-accent/[0.08] via-transparent to-transparent p-4'
            }
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="h-4 w-4 text-brand-accent flex-shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white truncate">
                        Complete the outfit
                    </h3>
                </div>
                <span className="border border-green-500/40 bg-green-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-green-300 whitespace-nowrap flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Free Ship
                </span>
            </div>

            {/* Match row */}
            <div className="flex items-center gap-3">
                <Link
                    to={missingHref}
                    className="h-16 w-16 flex-shrink-0 overflow-hidden border border-white/10 bg-white block"
                >
                    <img
                        src={getProductImage(missingImage, 'thumb')}
                        srcSet={getProductImageSrcSet(missingImage)}
                        sizes={PRODUCT_IMAGE_SIZES.thumb}
                        alt={missingProduct.name}
                        width={96}
                        height={120}
                        loading="lazy"
                        fetchPriority="auto"
                        decoding="async"
                        onError={(event) => {
                            const img = event.currentTarget;
                            if (img.getAttribute('data-fallback-applied') === '1') return;
                            img.setAttribute('data-fallback-applied', '1');
                            img.src = missingImage;
                            img.removeAttribute('srcset');
                        }}
                        className="h-full w-full object-contain"
                    />
                </Link>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                        Pair with your {presentShortLabel}
                    </p>
                    <Link
                        to={missingHref}
                        className="block text-sm font-bold uppercase tracking-widest text-white transition-colors hover:text-brand-accent truncate"
                    >
                        {missingProduct.name}
                    </Link>
                    <p className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-green-200">
                        <Truck className="h-3 w-3" />
                        Ship free · save ${setBonusDollars.toFixed(0)} on the set
                    </p>
                </div>
            </div>

            {/* Primary add button */}
            <button
                type="button"
                onClick={handleAdd}
                className={
                    isPageVariant
                        ? 'mt-4 flex w-full items-center justify-center gap-2 bg-brand-accent py-3.5 px-6 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black'
                        : 'mt-3 flex w-full items-center justify-center gap-2 bg-brand-accent py-3 px-5 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black'
                }
                aria-label={`Add ${missingProduct.name} at size ${targetSize} to complete the outfit and qualify for the $${setBonusDollars.toFixed(0)} set bonus plus free shipping`}
            >
                <ShoppingBag className={isPageVariant ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                Add {missingShortLabel} (size {targetSize}) · ${setBonusDollars.toFixed(0)} set bonus · Free Ship
            </button>

            {/* Secondary row: view-link + reassurance */}
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em]">
                <Link
                    to={missingHref}
                    className="text-gray-300 transition-colors hover:text-white"
                >
                    View {missingShortLabel} details →
                </Link>
                <span className="flex items-center gap-1 text-gray-400">
                    <Check className="h-3 w-3 text-green-400" />
                    {presentShortLabel} ship free already
                </span>
            </div>
        </div>
    );
};

export default CompleteTheFitCart;
