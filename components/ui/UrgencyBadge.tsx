import React from 'react';

interface UrgencyBadgeProps {
    /**
     * Two quiet states survive the "Peaceful Space" wedge:
     *   - 'low-stock'       → "X remaining" or "Claimed" when count is 0
     *   - 'limited-edition' → "X / Y" (numbered provenance, no purple pulse)
     *
     * Earlier versions also accepted 'viewing', 'sold-recently', and
     * 'flash-sale' for manufactured FOMO badges. They are removed from
     * the type signature entirely; TypeScript will flag any caller that
     * still passes them.
     */
    type: 'low-stock' | 'limited-edition';
    /** Current count. For limited-edition this is the surviving mintable units. */
    count?: number;
    /** Total cap. For limited-edition this is the sum of sizeInventory (or product.stock fallback). */
    cap?: number;
    className?: string;
}

const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ type, count, cap, className = '' }) => {
    let label: string;
    let toneClass: string;

    if (type === 'limited-edition') {
        if (typeof count === 'number' && typeof cap === 'number' && cap > 0) {
            label = `${count} / ${cap}`;
        } else {
            label = 'Numbered piece';
        }
        toneClass = 'border-white/15 text-gray-300';
    } else {
        // 'low-stock'
        if (count === 0) {
            // Reframed: this piece has been claimed. It is archived
            // provenance, not a stockout at a fast-fashion store.
            label = 'Claimed';
            toneClass = 'border-white/10 text-gray-500';
        } else {
            // "X remaining" reads as fact, not pressure. No exclamation,
            // no pulse, no red. The numbered-tier copy elsewhere on the
            // PDP carries the real scarcity signal.
            label = `${count} remaining`;
            toneClass = 'border-white/10 text-gray-300';
        }
    }

    // Announce the limited-edition fraction as a sentence rather than
    // the literal "12 / 44" so screen readers don't pipe through the
    // slash. Mirrors the founder-voice copy in pages/About.tsx.
    const fractionAriaLabel = type === 'limited-edition' && typeof count === 'number' && typeof cap === 'number' && cap > 0
        ? `${count} of ${cap} remaining, numbered piece`
        : undefined;

    return (
        <div
            className={`inline-flex items-center px-2.5 py-1 rounded-md border bg-transparent text-[10px] font-bold uppercase tracking-[0.18em] ${toneClass} ${className}`}
            aria-label={fractionAriaLabel}
        >
            <span>{label}</span>
        </div>
    );
};

export default UrgencyBadge;
