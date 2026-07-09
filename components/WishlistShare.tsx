import React, { useState, useRef } from 'react';
import { Share2, Link as LinkIcon, Check, X as XIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { generateShareId, getPublicWishlistUrl } from '../utils/wishlistUtils';

interface WishlistShareProps {
    favoriteIds: string[];
}

const WishlistShare: React.FC<WishlistShareProps> = ({ favoriteIds }) => {
    const { user } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    // Lazy-generated on first modal open so the shareId is created
    // exactly once per session (re-opening the modal reuses the same
    // slug). The wishlist_shares INSERT happens in handleOpen below;
    // shareUrl is populated only after a successful insert.
    const [shareUrl, setShareUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Ref-based guard against the double-click race: a rapid
    // second click on the share button would otherwise fire a
    // second createShare() (the React state update for
    // `isGenerating=true` is async, so the second click's closure
    // still sees `isGenerating=false`). The ref flips synchronously
    // so the second click short-circuits. Without this, double-
    // clickers create 2 rows in wishlist_shares with 2 different
    // shareIds -- wasted rows, and the displayed URL races
    // between the two.
    const isGeneratingRef = useRef(false);

    if (favoriteIds.length === 0) return null;

    // Insert a new row into public.wishlist_shares and return the
    // shareId-based URL. Called once per modal open (memoised via
    // the shareUrl state). The RLS INSERT policy
    // (20260709_add_wishlist_shares.sql) gates on auth.uid() =
    // owner_id, so a non-logged-in user would hit the policy and
    // the share URL never lands -- the !user guard in handleOpen
    // short-circuits before this is ever called without a user.
    const createShare = async (): Promise<string> => {
        if (!user) {
            // Defensive: handleOpen gates on !user, so this branch
            // is unreachable. The throw + the TS non-null assertion
            // below are belt-and-suspenders.
            throw new Error('Please sign in to share your wishlist.');
        }
        const newShareId = generateShareId(user.uid);
        const { error: insertError } = await supabase
            .from('wishlist_shares')
            .insert([{
                share_id: newShareId,
                owner_id: user.uid,
                owner_name: user.displayName || user.email?.split('@')[0] || 'Anonymous',
                items: favoriteIds,
            }]);
        if (insertError) {
            throw new Error(insertError.message || 'Failed to create share link.');
        }
        return getPublicWishlistUrl(newShareId);
    };

    const handleOpen = async () => {
        setIsOpen(true);
        setError(null);
        if (shareUrl) return; // already created this session
        // Sign-in gate is handled in the JSX (amber AlertCircle
        // below). Bail here so the error state stays reserved for
        // actual insert failures, not the sign-in case.
        if (!user) return;
        // Ref-based race guard (see declaration above). The state-
        // based check is not sufficient because the
        // setIsGenerating(true) update is async.
        if (isGeneratingRef.current) return;
        isGeneratingRef.current = true;
        setIsGenerating(true);
        try {
            const url = await createShare();
            setShareUrl(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create share link.');
        } finally {
            setIsGenerating(false);
            isGeneratingRef.current = false;
        }
    };

    const handleCopyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const shareToTwitter = () => {
        if (!shareUrl) return;
        const text = `Check out my wishlist from Coalition!`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
    };

    const shareToPinterest = () => {
        if (!shareUrl) return;
        window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent('My Coalition Wishlist')}`, '_blank');
    };

    const shareToFacebook = () => {
        if (!shareUrl) return;
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
    };

    return (
        <div className="relative">
            <button
                onClick={handleOpen}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <Share2 className="w-5 h-5" />
                )}
                <span className="font-bold">{isGenerating ? 'Generating...' : 'Share Wishlist'}</span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal */}
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md z-50 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Share Your Wishlist</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Sign-in gate: the wishlist_shares RLS INSERT
                            policy (20260709_add_wishlist_shares.sql)
                            requires auth.uid() = owner_id, so a
                            non-logged-in user would hit the policy
                            and get a generic error. Show the
                            explicit message up front. */}
                        {!user && (
                            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-200">Please sign in to share your wishlist.</p>
                            </div>
                        )}

                        {/* Error from the failed insert path (e.g.
                            network / RLS). */}
                        {error && (
                            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-300">{error}</p>
                            </div>
                        )}

                        {/* Loading state during the lazy INSERT. */}
                        {isGenerating && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                Generating share link...
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Copy Link */}
                            <button
                                onClick={handleCopyLink}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
                            >
                                <div className="flex items-center gap-3">
                                    <LinkIcon className="w-5 h-5 text-gray-400" />
                                    <span className="font-bold">Copy Link</span>
                                </div>
                                {copied && <Check className="w-5 h-5 text-green-500" />}
                            </button>

                            {/* Social Share Buttons */}
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={shareToTwitter}
                                    className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-blue-400">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                    <span className="text-xs font-bold">X</span>
                                </button>

                                <button
                                    onClick={shareToPinterest}
                                    className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-500">
                                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.399.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.951-7.252 4.173 0 7.41 2.967 7.41 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z" />
                                    </svg>
                                    <span className="text-xs font-bold">Pinterest</span>
                                </button>

                                <button
                                    onClick={shareToFacebook}
                                    className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-blue-600">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                    <span className="text-xs font-bold">Facebook</span>
                                </button>
                            </div>

                            {copied && (
                                <div className="text-center text-sm text-green-500 font-bold">
                                    ✓ Link copied to clipboard!
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WishlistShare;
