import React, { useState } from 'react';
import { X, Clock, Zap } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const PromoBar = () => {
    const [isVisible, setIsVisible] = useState(true);
    const location = useLocation();

    // Don't show on admin or checkout pages
    if (!isVisible || location.pathname.startsWith('/admin') || location.pathname.startsWith('/checkout')) {
        return null;
    }

    return (
        <div className="bg-brand-accent text-black py-2 px-4 relative z-50 animate-in slide-in-from-top duration-500">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex-1 text-center font-bold text-sm md:text-base flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4 fill-current animate-pulse" />
                    <span>
                        FLASH SALE: Use code <span className="bg-black text-white px-2 py-0.5 rounded mx-1 font-mono">EARLYACCESS</span> for 20% OFF!
                    </span>
                    <span className="hidden md:inline-flex items-center gap-1 ml-2 text-xs font-normal opacity-75">
                        <Clock className="w-3 h-3" /> Ends Soon
                    </span>
                </div>
                <button
                    onClick={() => setIsVisible(false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full transition"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default PromoBar;
