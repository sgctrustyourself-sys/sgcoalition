/**
 * Wishlist sharing utilities
 */

/**
 * Generate a unique share ID for a user's wishlist
 */
export const generateShareId = (userId: string): string => {
    // Create a unique, non-guessable share ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const userHash = userId.substring(0, 4);
    return `${userHash}-${timestamp}-${random}`;
};

/**
 * Get the public wishlist URL
 */
export const getPublicWishlistUrl = (shareId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/#/wishlist/${shareId}`;
};

/**
 * Generate QR code data URL for wishlist
 */
export const generateWishlistQR = async (url: string): Promise<string> => {
    // Simple QR code generation using a data URL
    // In production, you might use a library like qrcode.react
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    return qrApiUrl;
};

/**
 * Share wishlist to social media platforms
 */
export const shareToSocial = (
    platform: 'facebook' | 'twitter' | 'pinterest' | 'whatsapp' | 'email',
    url: string,
    title: string,
    description: string
): void => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);

    let shareUrl = '';

    switch (platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
            break;
        case 'pinterest':
            shareUrl = `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`;
            break;
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`;
            break;
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
};

/**
 * Get share count from localStorage
 */
export const getShareCount = (shareId: string): number => {
    const key = `wishlist_share_count_${shareId}`;
    const count = localStorage.getItem(key);
    return count ? parseInt(count, 10) : 0;
};

/**
 * Increment share count
 */
export const incrementShareCount = (shareId: string): number => {
    const currentCount = getShareCount(shareId);
    const newCount = currentCount + 1;
    const key = `wishlist_share_count_${shareId}`;
    localStorage.setItem(key, newCount.toString());
    return newCount;
};

/**
 * Track share analytics
 */
export const trackShare = (platform: string, shareId: string): void => {
    // Track share event (can integrate with analytics later)
    console.log(`Wishlist shared on ${platform}:`, shareId);
    incrementShareCount(shareId);
};
