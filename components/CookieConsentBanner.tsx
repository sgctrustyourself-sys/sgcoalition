import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Cookie, X } from 'lucide-react';
import { useCookieConsent } from '../hooks/useCookieConsent';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
    OPEN_CONSENT_EVENT,
    acceptAllConsent,
    rejectNonEssentialConsent,
    saveConsent,
} from '../services/cookieConsent';

const buttonBase =
    'inline-flex items-center justify-center rounded-sm px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black';

const outlinedButton = `${buttonBase} border border-white/35 text-white hover:border-white hover:bg-white/10`;
const solidButton = `${buttonBase} bg-white text-black hover:bg-gray-200`;

interface Draft {
    statistics: boolean;
    marketing: boolean;
}

const CookieConsentBanner: React.FC = () => {
    const consent = useCookieConsent();
    const [bannerOpen, setBannerOpen] = useState(() => !consent.hasResponded);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [draft, setDraft] = useState<Draft>({
        statistics: consent.statistics,
        marketing: consent.marketing,
    });

    const dialogRef = useRef<HTMLDivElement>(null);

    // Footer "Cookie Settings" (and anything else) can reopen the panel.
    useEffect(() => {
        const openSettings = () => {
            setDraft({ statistics: consent.statistics, marketing: consent.marketing });
            setBannerOpen(false);
            setDetailsOpen(true);
        };

        window.addEventListener(OPEN_CONSENT_EVENT, openSettings);
        return () => window.removeEventListener(OPEN_CONSENT_EVENT, openSettings);
    }, [consent.statistics, consent.marketing]);

    // Stop the page scrolling behind the preferences dialog. Focus entry,
    // containment and Escape belong to the shared trap below.
    useEffect(() => {
        if (!detailsOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [detailsOpen]);

    const close = () => {
        setDetailsOpen(false);
        setBannerOpen(false);
    };

    useFocusTrap({ active: detailsOpen, containerRef: dialogRef, onEscape: close });

    const acceptAll = () => {
        acceptAllConsent();
        close();
    };

    const rejectAll = () => {
        const wasUsingAnalytics = consent.statistics;
        rejectNonEssentialConsent();
        close();
        // Once a measurement script has been injected it cannot be unloaded, and
        // its SPA listener would keep reporting after withdrawal. A reload is the
        // only reliable way to make "reject" mean reject.
        if (wasUsingAnalytics) window.location.reload();
    };

    const savePreferences = () => {
        const wasUsingAnalytics = consent.statistics;
        saveConsent(draft);
        close();
        if (wasUsingAnalytics && !draft.statistics) window.location.reload();
    };

    if (detailsOpen) {
        return (
            <div
                className="fixed inset-0 z-[140] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setDetailsOpen(false);
                }}
            >
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cookie-preferences-title"
                    tabIndex={-1}
                    className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-sm border border-white/15 bg-[#0b0b0b] p-6 text-white shadow-2xl focus:outline-none sm:p-8"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
                                <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
                                Privacy
                            </p>
                            <h2 id="cookie-preferences-title" className="font-display text-2xl font-bold uppercase tracking-wide">
                                Cookie settings
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setDetailsOpen(false)}
                            aria-label="Close cookie settings"
                            className="rounded-sm p-1 text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-gray-400">
                        Choose which optional cookies we may use. Strictly necessary storage keeps the
                        shop, cart and checkout working and cannot be switched off. Your choice is saved
                        for six months and can be changed at any time from the footer.
                    </p>

                    <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
                        <div className="flex items-start justify-between gap-6 py-4">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-wide">Strictly necessary</p>
                                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                                    Cart, checkout, sign-in, fraud prevention and your cookie choice.
                                    Required for the store to work.
                                </p>
                            </div>
                            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300">
                                <Check className="h-3 w-3" aria-hidden="true" /> Always on
                            </span>
                        </div>

                        <div className="flex items-start justify-between gap-6 py-4">
                            <div>
                                <label htmlFor="consent-statistics" className="text-sm font-bold uppercase tracking-wide">
                                    Analytics
                                </label>
                                <p id="consent-statistics-description" className="mt-1 text-xs leading-relaxed text-gray-400">
                                    Vercel Analytics and Speed Insights. Cookieless page-view and
                                    performance measurement that helps us fix slow pages. Off by default.
                                </p>
                            </div>
                            <input
                                id="consent-statistics"
                                type="checkbox"
                                checked={draft.statistics}
                                onChange={(event) => setDraft((current) => ({ ...current, statistics: event.target.checked }))}
                                aria-describedby="consent-statistics-description"
                                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            />
                        </div>

                        <div className="flex items-start justify-between gap-6 py-4">
                            <div>
                                <label htmlFor="consent-marketing" className="text-sm font-bold uppercase tracking-wide">
                                    Marketing
                                </label>
                                <p id="consent-marketing-description" className="mt-1 text-xs leading-relaxed text-gray-400">
                                    Reserved for advertising and retargeting. No marketing scripts are
                                    active today. Off by default.
                                </p>
                            </div>
                            <input
                                id="consent-marketing"
                                type="checkbox"
                                checked={draft.marketing}
                                onChange={(event) => setDraft((current) => ({ ...current, marketing: event.target.checked }))}
                                aria-describedby="consent-marketing-description"
                                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-3">
                            <button type="button" className={outlinedButton} onClick={rejectAll}>
                                Reject all
                            </button>
                            <button type="button" className={outlinedButton} onClick={acceptAll}>
                                Accept all
                            </button>
                        </div>
                        <button type="button" className={solidButton} onClick={savePreferences}>
                            Save preferences
                        </button>
                    </div>

                    <p className="mt-4 text-xs text-gray-500">
                        Read our{' '}
                        <Link to="/privacy" className="underline decoration-white/30 underline-offset-2 hover:text-white" onClick={() => setDetailsOpen(false)}>
                            Privacy Policy
                        </Link>{' '}
                        for the full list of cookies and storage we use.
                    </p>
                </div>
            </div>
        );
    }

    if (!bannerOpen) return null;

    return (
        <div className="fixed inset-x-0 bottom-16 z-[65] px-3 pb-3 md:bottom-0 md:px-6 md:pb-6">
            <div
                role="region"
                aria-label="Cookie consent"
                className="mx-auto w-full max-w-5xl rounded-sm border border-white/15 bg-[#0b0b0b]/95 p-4 text-white shadow-2xl backdrop-blur-md sm:p-5"
            >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
                            <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
                            Your privacy choices
                        </p>
                        <p className="text-sm leading-relaxed text-gray-300">
                            We use strictly necessary storage to run the shop and checkout. With your
                            permission we also use cookieless analytics to understand how the site is
                            used. You can accept all, reject everything optional, or choose per
                            category.{' '}
                            <Link to="/privacy" className="underline decoration-white/30 underline-offset-2 hover:text-white">
                                Learn more
                            </Link>
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                            type="button"
                            className={outlinedButton}
                            onClick={() => {
                                setDraft({ statistics: consent.statistics, marketing: consent.marketing });
                                setBannerOpen(false);
                                setDetailsOpen(true);
                            }}
                        >
                            Manage preferences
                        </button>
                        <button type="button" className={outlinedButton} onClick={rejectAll}>
                            Reject non-essential
                        </button>
                        <button type="button" className={outlinedButton} onClick={acceptAll}>
                            Accept all
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookieConsentBanner;
