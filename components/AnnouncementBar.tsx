import React from 'react';

/**
 * Coalition AnnouncementBar — a quiet brand line, not a sales surface.
 *
 * Previously: a flashing "FLASH SALE / Ends Soon" promo with pulsing
 * Zap and Clock icons. Removed as part of the "Peaceful Space" wedge
 * (see plans/peaceful-space.md). The bar still renders (so the brand
 * statement has presence) but the copy and styling now match a calm,
 * founder-voice register: no urgency, no countdowns, no icons, no color
 * callouts. Mirrors the Wallets page line: "no factory, no shortcuts".
 */
const AnnouncementBar = () => {
    return (
        <div
            // Bumped from bg-white/[0.03] / text-gray-400 to register as
            // a deliberate brand surface on a black navbar. Still quiet
            // (no icon, no pulse, no callout color), still tracking-wide
            // uppercase so it reads as a brand line not a sale.
            className="bg-white/[0.05] border-b border-white/10 text-gray-300 py-2 px-4 flex items-center justify-center text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em]"
            role="region"
            aria-label="Coalition brand statement"
        >
            <span className="text-center">
                Coalition
                <span className="mx-2 text-white/20" aria-hidden="true">·</span>
                Hand-built in Baltimore
                <span className="mx-2 text-white/20" aria-hidden="true">·</span>
                No factory, no shortcuts
            </span>
        </div>
    );
};

export default AnnouncementBar;
