import React, { useState } from 'react';
import { Twitter, Link as LinkIcon, Check } from 'lucide-react';

interface SocialShareProps {
    productName: string;
    productDescription: string;
    productImage: string;
    url: string;
}

const SocialShare: React.FC<SocialShareProps> = ({ productName, productDescription, productImage, url }) => {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const shareToTwitter = () => {
        const text = `Check out ${productName} by Coalition! ${productDescription.substring(0, 100)}...`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    };

    const shareToPinterest = () => {
        window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(productImage)}&description=${encodeURIComponent(productName)}`, '_blank');
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">Share:</span>

            {/* X / Twitter */}
            <button
                onClick={shareToTwitter}
                aria-label="Share on X (Twitter)"
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
                <Twitter className="w-5 h-5" />
            </button>

            {/* Pinterest */}
            <button
                onClick={shareToPinterest}
                aria-label="Share on Pinterest"
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.399.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.951-7.252 4.173 0 7.41 2.967 7.41 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z" />
                </svg>
            </button>

            {/* Copy Link */}
            <button
                onClick={handleCopyLink}
                aria-label="Copy Link"
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative"
            >
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <LinkIcon className="w-5 h-5" />}
                {copied && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded border border-white/20 whitespace-nowrap">
                        Copied!
                    </span>
                )}
            </button>
        </div>
    );
};

export default SocialShare;
