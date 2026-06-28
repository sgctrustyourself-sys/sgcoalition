import React from 'react';
import { AlertCircle, Eye, TrendingUp, Zap, Clock } from 'lucide-react';

interface UrgencyBadgeProps {
    type: 'low-stock' | 'limited-edition' | 'viewing' | 'sold-recently' | 'flash-sale';
    /** Current count. For limited-edition this is the surviving mintable units. */
    count?: number;
    /** Total cap. For limited-edition this is the sum of sizeInventory (or product.stock fallback). */
    cap?: number;
    text?: string;
    className?: string;
}

const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ type, count, cap, text, className = '' }) => {
    const getConfig = () => {
        switch (type) {
            case 'low-stock':
                return {
                    icon: AlertCircle,
                    bgColor: count === 0 ? 'bg-red-900/40' : count && count <= 3 ? 'bg-red-500/20' : 'bg-orange-500/20',
                    textColor: count === 0 ? 'text-red-300' : count && count <= 3 ? 'text-red-400' : 'text-orange-400',
                    borderColor: count === 0 ? 'border-red-500/50' : count && count <= 3 ? 'border-red-500/30' : 'border-orange-500/30',
                    label: text || (count === 0 ? 'SOLD OUT' : `Only ${count} left!`),
                    pulse: count && count <= 3 && count > 0
                };
            case 'limited-edition':
                return {
                    icon: Zap,
                    bgColor: 'bg-purple-500/20',
                    textColor: 'text-purple-400',
                    borderColor: 'border-purple-500/30',
                    // Reads as "X / Y available" so the verb lines up with
                    // count = product.stock (i.e., remaining units, not
                    // units-sold). 43 / 44 at fresh drop means "43 of 44
                    // are still available", matching what product.stock
                    // actually says. Falls back to the static label when
                    // the cap can't be derived.
                    label: text || (typeof count === 'number' && typeof cap === 'number' && cap > 0
                        ? `${count} / ${cap} available`
                        : 'Limited Edition'),
                    pulse: true
                };
            case 'viewing':
                return {
                    icon: Eye,
                    bgColor: 'bg-blue-500/20',
                    textColor: 'text-blue-400',
                    borderColor: 'border-blue-500/30',
                    label: text || `${count} viewing now`,
                    pulse: false
                };
            case 'sold-recently':
                return {
                    icon: TrendingUp,
                    bgColor: 'bg-green-500/20',
                    textColor: 'text-green-400',
                    borderColor: 'border-green-500/30',
                    label: text || `${count} sold today`,
                    pulse: false
                };
            case 'flash-sale':
                return {
                    icon: Clock,
                    bgColor: 'bg-red-500/20',
                    textColor: 'text-red-400',
                    borderColor: 'border-red-500/30',
                    label: text || 'Flash Sale',
                    pulse: true
                };
            default:
                return {
                    icon: AlertCircle,
                    bgColor: 'bg-gray-500/20',
                    textColor: 'text-gray-400',
                    borderColor: 'border-gray-500/30',
                    label: text || '',
                    pulse: false
                };
        }
    };

    const config = getConfig();
    const Icon = config.icon;
    // Announce the limited-edition fraction as a sentence rather than the
    // literal "12 / 44" so screen readers don't pipe through the slash.
    // The "limited edition piece" phrasing mirrors the founder-voice copy
    // in pages/About.tsx ("Every piece from our drops...") rather than
    // streetwear-slang default.
    const fractionAriaLabel = type === 'limited-edition' && typeof count === 'number' && typeof cap === 'number' && cap > 0
        ? `${count} of ${cap} available, limited edition piece`
        : undefined;

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${config.bgColor} ${config.textColor} ${config.borderColor} text-xs font-semibold ${config.pulse ? 'animate-pulse' : ''} ${className}`}
            aria-label={fractionAriaLabel}
        >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
        </div>
    );
};

export default UrgencyBadge;
