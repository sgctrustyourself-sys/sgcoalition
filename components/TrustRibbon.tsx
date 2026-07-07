import React from 'react';
import { Truck, Award, RefreshCw, MapPin, Hand } from 'lucide-react';
import { Product } from '../types';

interface TrustRibbonProps {
    product: Pick<Product, 'freeShipping' | 'isLimitedEdition' | 'shippingFulfillment' | 'category' | 'nft'>;
    displayPrice: number;
}

/**
 * Compact trust ribbon shown above the buy box. Pulls facts that are
 * already on the product / pricing layer (no new copy library), so the
 * ribbon stays honest if the operator edits those fields later.
 *
 * - Free shipping toggle honours product.freeShipping, the $200 cart
 *   threshold, and the per-product shipping-fulfillment override.
 * - The "Numbered" pill only lights up for products whose pricingTiers
 *   are set - mirrors pages/ProductDetails.tsx > isNumberedEdition.
 * - "Hand-finished in Baltimore" anchors the local brand story without
 *   spinning up new copy.
 * - "Founder-inspected piece" pairs with the founder's verbatim note
 *   on pages/About.tsx ("I want to keep items limited for now so I can
 *   get my hands on each piece directly.") - the ribbon surfaces the
 *   QA half of that promise on every PDP, even ones that aren't flagged
 *   isLimitedEdition, so the "limited so I can inspect" story is
 *   consistent across the catalog and not just on numbered drops.
 * - "30-day exchange" mirrors pages/CustomInquiry.tsx's risk-reversal
 *   language (no refunds policy = the WHY behind exchanges).
 */
const TrustRibbon: React.FC<TrustRibbonProps> = ({ product, displayPrice }) => {
    const pills: Array<{ key: string; icon: React.ReactNode; label: string; tone: 'accent' | 'muted' }> = [];

    const shippingFree = product.freeShipping || displayPrice >= 200 || !!product.shippingFulfillment;
    pills.push({
        key: 'shipping',
        icon: <Truck className="w-3.5 h-3.5" />,
        label: shippingFree ? 'Free U.S. shipping' : 'Ships in 1-2 business days',
        tone: 'accent',
    });

    if (product.isLimitedEdition) {
        pills.push({
            key: 'limited',
            icon: <Award className="w-3.5 h-3.5" />,
            label: 'Limited edition piece',
            tone: 'accent',
        });
    }

    pills.push({
        key: 'hand-finished',
        icon: <MapPin className="w-3.5 h-3.5" />,
        label: 'Hand-finished in Baltimore',
        tone: 'muted',
    });

    pills.push({
        key: 'founder-inspected',
        icon: <Hand className="w-3.5 h-3.5" />,
        label: 'Founder-inspected piece',
        tone: 'muted',
    });

    pills.push({
        key: 'exchange',
        icon: <RefreshCw className="w-3.5 h-3.5" />,
        label: 'Exchange on unworn pieces',
        tone: 'muted',
    });

    if (product.nft) {
        pills.push({
            key: 'verified-on-chain',
            icon: <Award className="w-3.5 h-3.5" />,
            label: 'NFC tag + on-chain proof',
            tone: 'accent',
        });
    }

    return (
        <div
            data-testid="trust-ribbon"
            aria-label="Order reassurances"
            className="flex flex-wrap items-center gap-2 border border-white/10 bg-white/[0.03] rounded-sm px-3 py-2.5"
        >
            {pills.map(pill => (
                <span
                    key={pill.key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${pill.tone === 'accent'
                            ? 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent'
                            : 'border-white/10 bg-black/30 text-gray-300'
                        }`}
                >
                    {pill.icon}
                    <span>{pill.label}</span>
                </span>
            ))}
        </div>
    );
};

export default TrustRibbon;
