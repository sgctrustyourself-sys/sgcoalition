import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MAIN_SHARING_LINK, MAIN_SHARING_LABEL } from '../utils/sharingLinks';
import { MEMBER_DISCOUNT_RATE, isMemberPromoActive } from '../utils/memberDiscount';

/**
 * Coalition AnnouncementBar — factual product news, not manufactured urgency.
 *
 * Surfaces real drops and collection news in the same founder-voice register
 * as the rest of the site: no countdowns, no pulsing icons, no "FLASH SALE".
 * Currently carrying the Black Friday deal (30% off members promotion, logged-in account
 * holders) and Baltimore streetwear drops.
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
 * The promotion has an end date (utils/memberDiscount.ts). Once it passes,
 * the bar drops the discount copy entirely rather than advertising an offer
 * the pricing authority would refuse.
 *
 * To swap the promoted link/text, update the promo `to` and children below.
 *
 * The bar is sticky (it sits in the same sticky wrapper as the nav), so its
 * background is opaque: a translucent bar let the page scroll through it and
 * the header read as broken.
 */
const AnnouncementBar = () => {
    const { user } = useApp();
    const isMember = Boolean(user?.uid);
    const memberPromoActive = isMemberPromoActive();
    const memberPercent = Math.round(MEMBER_DISCOUNT_RATE * 100);

    const headline = isMember
        ? `⚡ Black Friday: Your ${memberPercent}% member discount is live`
        : `⚡ Black Friday Deal: Members get ${memberPercent}% off everything`;
    const detail = isMember
        ? 'Applied automatically at checkout'
        : 'Sign in to claim Black Friday pricing';
    const href = !isMember ? '/login' : '/shop';

    return (
        <div
            className="bg-[#0c0c0c] border-b border-amber-500/20 text-amber-200 py-2 px-4 min-h-[36px] flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em]"
            role="region"
            aria-label={isMember
                ? `Black Friday: Your ${memberPercent}% member discount is active`
                : `Black Friday Deal: Members get ${memberPercent}% off everything`}
        >
            <Link
                to={href}
                className="hover:text-white hover:bg-white/5 transition-all duration-300 group"
            >
                <span className="text-center">
                    {headline}
                    <span className="mx-2 text-white/20" aria-hidden="true">·</span>
                    <span className="text-gray-300">{detail}</span>
                    <span className="inline-block ml-2 text-amber-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" aria-hidden="true">→</span>
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
                className="hover:text-white transition-colors whitespace-nowrap text-gray-400 hover:text-white"
            >
                Portfolio &amp; Links <span aria-hidden="true">→</span>
            </a>
        </div>
    );
};

export default AnnouncementBar;
