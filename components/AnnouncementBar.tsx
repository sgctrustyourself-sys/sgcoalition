import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MAIN_SHARING_LINK, MAIN_SHARING_LABEL } from '../utils/sharingLinks';

/**
 * Coalition AnnouncementBar — factual product news, not manufactured urgency.
 *
 * Surfaces real drops and collection news in the same founder-voice register
 * as the rest of the site: no countdowns, no pulsing icons, no "FLASH SALE".
 * Currently carrying the member discount (30% off, logged-in account holders)
 * and the breast cancer awareness tie-in.
 *
 * The bar also carries the main sharing link — the linktree holds the
 * portfolio next to the shop, so the portfolio is one click away on every
 * screen. The two links are siblings, never nested: an anchor inside the
 * promo Link would be invalid HTML.
 *
 * The copy changes for a member: a member already has the discount, so
 * telling them to "log in to unlock" it is the wrong instruction — they get
 * the "your discount is live" line and a link to the shop instead.
 *
 * To swap the promoted link/text, update the promo `to` and children below.
 */
const AnnouncementBar = () => {
    const { user } = useApp();
    const isMember = Boolean(user?.uid);

    return (
        <div
            className="bg-pink-500/10 border-b border-pink-500/20 text-pink-200 py-2 px-4 min-h-[36px] flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em]"
            role="region"
            aria-label={isMember ? 'Your 30% member discount is active' : 'Members get 30% off — supporting breast cancer awareness'}
        >
            <Link
                to={isMember ? '/shop' : '/login'}
                className="hover:text-white hover:bg-pink-500/15 transition-all duration-300 group"
            >
                <span className="text-center">
                    {isMember
                        ? '👻 Your 30% member discount is live ♥'
                        : '👻 Members get 30% off every piece ♥'}
                    <span className="mx-2 text-white/20" aria-hidden="true">·</span>
                    {isMember ? 'Applied automatically at checkout' : 'Supporting breast cancer awareness'}
                    <span className="inline-block ml-2 text-pink-300 group-hover:text-white group-hover:translate-x-0.5 transition-all" aria-hidden="true">→</span>
                </span>
            </Link>
            <span className="text-white/20" aria-hidden="true">·</span>
            {/* The main sharing link — same URL the brand prints for "link in
                bio", imported from its one owner so a link change cannot
                leave this bar behind. */}
            <a
                href={MAIN_SHARING_LINK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Portfolio and all links (opens ${MAIN_SHARING_LABEL})`}
                className="hover:text-white transition-colors whitespace-nowrap"
            >
                Portfolio &amp; Links <span aria-hidden="true">→</span>
            </a>
        </div>
    );
};

export default AnnouncementBar;
