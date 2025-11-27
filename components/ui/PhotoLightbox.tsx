import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoLightboxProps {
    photos: string[];
    initialIndex?: number;
    onClose: () => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ photos, initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrevious();
            if (e.key === 'ArrowRight') handleNext();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition z-10"
                aria-label="Close lightbox"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Navigation Buttons */}
            {photos.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                        className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition z-10"
                        aria-label="Previous photo"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition z-10"
                        aria-label="Next photo"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </>
            )}

            {/* Image */}
            <div
                className="max-w-7xl max-h-[90vh] px-4"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={photos[currentIndex]}
                    alt={`Photo ${currentIndex + 1} of ${photos.length}`}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
            </div>

            {/* Counter */}
            {photos.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm">
                    {currentIndex + 1} / {photos.length}
                </div>
            )}
        </div>
    );
};

export default PhotoLightbox;
