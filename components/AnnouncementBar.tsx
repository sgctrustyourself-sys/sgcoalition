import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Coalition AnnouncementBar — factual product news, not manufactured urgency.
 *
 * Surfaces real drops and collection news in the same founder-voice register
 * as the rest of the site: no countdowns, no pulsing icons, no "FLASH SALE".
 * Currently promoting the new Coalition Parts wallet collection.
 *
 * To swap the promoted link/text, update the `href` and children below.
 */
const AnnouncementBar = () => {
    return (
        <Link
            to="/wallets"
            className="bg-white/[0.05] border-b border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.08] py-2 px-4 min-h-[36px] flex items-center justify-center text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] transition-all duration-300 group"
            role="region"
            aria-label="New Coalition Parts wallet collection"
        >
            <span className="text-center">
                New: Coalition Parts Wallets
                <span className="mx-2 text-white/20" aria-hidden="true">·</span>
                Four numbered drops, one piece at a time
                <span className="inline-block ml-2 text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" aria-hidden="true">→</span>
            </span>
        </Link>
    );
};

export default AnnouncementBar;
