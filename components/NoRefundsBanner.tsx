import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { CONSENT_TEXT } from '../constants';

interface NoRefundsBannerProps {
    dismissible?: boolean;
    onDismiss?: () => void;
    variant?: 'warning' | 'info';
    className?: string;
}

const NoRefundsBanner: React.FC<NoRefundsBannerProps> = ({
    dismissible = false,
    onDismiss,
    variant = 'warning',
    className = ''
}) => {
    const [isDismissed, setIsDismissed] = React.useState(false);

    const handleDismiss = () => {
        setIsDismissed(true);
        onDismiss?.();
    };

    if (isDismissed) return null;

    const variantStyles = {
        warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200',
        info: 'bg-blue-500/10 border-blue-500/30 text-blue-200'
    };

    return (
        <div className={`relative rounded-lg border p-4 ${variantStyles[variant]} ${className}`}>
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="font-bold text-sm uppercase mb-1">Important Policy</p>
                    <p className="text-sm">{CONSENT_TEXT}</p>
                </div>
                {dismissible && (
                    <button
                        onClick={handleDismiss}
                        className="text-current hover:opacity-70 transition"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default NoRefundsBanner;
