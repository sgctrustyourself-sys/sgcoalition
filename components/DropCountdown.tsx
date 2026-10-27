import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * DropCountdown — quiet exhibition calendar surface.
 *
 * The previous version simulated a joiner count (1420 → 1421 → 1422),
 * rendered a "Filling Fast" progress bar with a shimmer animation, and
 * displayed a fake "Quantum Drift" name ticking down from a synthetic
 * 3-day window. All of that was manufactured FOMO + fake demo data —
 * removed as part of the "Peaceful Space" wedge.
 *
 * The surface now renders an honest "Next drop — to be announced"
 * placeholder with a join-the-list CTA. When a real upcoming drop is
 * wired in (via the product service), the title + date render in place
 * of the placeholder. Until then, no fake urgency, no fake demo.
 */
const DropCountdown = () => {
    return (
        <div className="bg-gray-900/30 border border-white/10 rounded-2xl p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-2">
                Next drop
            </p>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">
                To be announced
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
                Join the list to be notified when the next piece opens.
            </p>
            <button
                type="button"
                className="mt-6 w-full bg-white text-black font-bold uppercase tracking-wider py-3 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2 group/btn"
            >
                Join the list
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
            </button>
        </div>
    );
};

export default DropCountdown;
