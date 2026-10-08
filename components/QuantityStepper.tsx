/**
 * Quantity stepper — the minus/plus control shared by the product page, /cart
 * and the cart drawer.
 *
 * It owns no cart logic: `onChange` hands the next number to the caller, which
 * writes through context/useCart.ts (`addToCart(…, quantity)` on the product
 * page, `setQuantity(cartId, …)` on the two cart surfaces). `max` is the
 * caller's business too — the cart passes the remaining stock for that line's
 * size, so this stays a dumb control.
 *
 * Before this existed, a line's quantity could only ever rise, and only by
 * re-adding the same size from a product page or the shop grid: both cart
 * surfaces printed "Qty: N" as static text with just a Remove button, so a
 * shopper had no way to buy two deliberately or to come back down to one.
 */

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { MAX_CART_QUANTITY } from '../context/useCart';

interface QuantityStepperProps {
    value: number;
    onChange: (quantity: number) => void;
    /** Upper bound, inclusive. Defaults to the cart's hard ceiling. */
    max?: number;
    /** Lower bound, inclusive. */
    min?: number;
    /** Accessible name, so two cart lines' steppers are distinguishable. */
    label?: string;
    tone?: 'dark' | 'light';
    size?: 'sm' | 'md';
}

const QuantityStepper: React.FC<QuantityStepperProps> = ({
    value,
    onChange,
    max = MAX_CART_QUANTITY,
    min = 1,
    label = 'Quantity',
    tone = 'dark',
    size = 'md',
}) => {
    const upper = Math.max(min, Math.floor(Number.isFinite(max) ? max : MAX_CART_QUANTITY));
    const atMin = value <= min;
    const atMax = value >= upper;

    const shell =
        tone === 'dark' ? 'border-white/15 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900';
    const button =
        tone === 'dark'
            ? 'text-white hover:bg-white/10 disabled:hover:bg-transparent'
            : 'text-gray-900 hover:bg-gray-100 disabled:hover:bg-transparent';
    const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
    const width = size === 'sm' ? 'w-7' : 'w-9';

    return (
        <div role="group" aria-label={label} className={`inline-flex items-center rounded-sm border ${shell}`}>
            <button
                type="button"
                onClick={() => onChange(value - 1)}
                disabled={atMin}
                aria-label={`Decrease ${label}`}
                className={`${box} flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${button}`}
            >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span aria-live="polite" className={`${width} text-center text-sm font-bold tabular-nums`}>
                {value}
            </span>
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                disabled={atMax}
                aria-label={`Increase ${label}`}
                className={`${box} flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${button}`}
            >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </div>
    );
};

export default QuantityStepper;
