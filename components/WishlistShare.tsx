import React, { useState } from 'react';
import { Share2, Link as LinkIcon, Check, X as XIcon } from 'lucide-react';

interface WishlistShareProps {
    favoriteIds: string[];
}

const WishlistShare: React.FC<WishlistShareProps> = ({ favoriteIds }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    if (favoriteIds.length === 0) return null;

    const generateShareUrl = () => {
        const baseUrl = window.location.origin;
        const params = new URLSearchParams({ items: favoriteIds.join(',') });
        return `${baseUrl}/favorites?${params.toString()}`;
    };

    const handleCopyLink = async () => {
        const url = generateShareUrl();
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const shareToTwitter = () => {
        const url = generateShareUrl();
        const text = `Check out my wishlist from Coalition!`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    };

    const shareToPinterest = () => {
        const url = generateShareUrl();
        window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent('My Coalition Wishlist')}`, '_blank');
    };

    const shareToFacebook = () => {
        const url = generateShareUrl();
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
            >
                <Share2 className="w-5 h-5" />
                <span className="font-bold">Share Wishlist</span>
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
