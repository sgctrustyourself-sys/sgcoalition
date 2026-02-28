import React from 'react';
import { AlertCircle, Eye, TrendingUp, Zap, Clock } from 'lucide-react';

interface UrgencyBadgeProps {
    type: 'low-stock' | 'limited-edition' | 'viewing' | 'sold-recently' | 'flash-sale';
    count?: number;
    text?: string;
    className?: string;
}

const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ type, count, text, className = '' }) => {
    const getConfig = () => {
        switch (type) {
            case 'low-stock':
                return {
                    icon: AlertCircle,
                    bgColor: count && count <= 3 ? 'bg-red-500/20' : 'bg-orange-500/20',
                    textColor: count && count <= 3 ? 'text-red-400' : 'text-orange-400',
                    borderColor: count && count <= 3 ? 'border-red-500/30' : 'border-orange-500/30',
                    label: text || `Only ${count} left!`,
                    pulse: count && count <= 3
                };
            case 'limited-edition':
                return {
                    icon: Zap,
                    bgColor: 'bg-purple-500/20',
                    textColor: 'text-purple-400',
                    borderColor: 'border-purple-500/30',
                    label: text || 'Limited Edition',
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

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${config.bgColor} ${config.textColor} ${config.borderColor} text-xs font-semibold ${config.pulse ? 'animate-pulse' : ''} ${className}`}
        >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
        </div>
    );
};

export default UrgencyBadge;
