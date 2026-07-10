import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Crop, Image as ImageIcon, Maximize2, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import {
    DEFAULT_PRODUCT_CROP_RATIO,
    PRODUCT_CROP_ASPECT_OPTIONS,
    clampCropPosition,
    createCroppedImageFile,
    getCenteredCropPosition,
    getDisplayedImageSize,
    type CropAspectOption,
    type CropFrameSize,
    type CropPosition,
} from '../../utils/imageCropper';

interface ImageCropperModalProps {
    file: File | null;
    open: boolean;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    defaultAspectRatio?: number;
    aspectOptions?: CropAspectOption[];
    onCancel: () => void;
    onConfirm: (croppedFile: File) => Promise<void> | void;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
    file,
    open,
    title = 'Crop Image',
    description = 'Drag to reposition, zoom to frame, then apply the crop before uploading.',
    confirmLabel = 'Use Crop',
    cancelLabel = 'Cancel',
    defaultAspectRatio = DEFAULT_PRODUCT_CROP_RATIO,
    aspectOptions = PRODUCT_CROP_ASPECT_OPTIONS,
    onCancel,
    onConfirm,
}) => {
    const frameRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const dragStateRef = useRef<{
        startX: number;
        startY: number;
        origin: CropPosition;
    } | null>(null);

    const [imageUrl, setImageUrl] = useState('');
    const [naturalSize, setNaturalSize] = useState<CropFrameSize | null>(null);
    const [frameSize, setFrameSize] = useState<CropFrameSize | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 });
    const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedAspect = useMemo(
        () => aspectOptions.find(option => option.ratio === aspectRatio) || aspectOptions[0],
        [aspectOptions, aspectRatio]
    );

    useEffect(() => {
        if (!open || !file) {
            setImageUrl('');
            setNaturalSize(null);
            setFrameSize(null);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
            setAspectRatio(defaultAspectRatio);
            setIsDragging(false);
            setIsSubmitting(false);
            setError(null);
            dragStateRef.current = null;
            return;
        }

        const nextUrl = URL.createObjectURL(file);
        setImageUrl(nextUrl);
        setNaturalSize(null);
        setFrameSize(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setAspectRatio(defaultAspectRatio);
        setIsDragging(false);
        setIsSubmitting(false);
        setError(null);
        dragStateRef.current = null;

        return () => URL.revokeObjectURL(nextUrl);
    }, [file, open, defaultAspectRatio]);

    useEffect(() => {
        if (!imageUrl) return;

        const image = new Image();

        image.onload = () => {
            setNaturalSize({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        };

        image.onerror = () => {
            setError('Unable to load this image. Please choose a different file.');
        };

        image.src = imageUrl;

        return () => {
            image.onload = null;
            image.onerror = null;
        };
    }, [imageUrl]);

    useEffect(() => {
        if (!open || !frameRef.current) return;

        const updateSize = () => {
            if (!frameRef.current) return;
            const rect = frameRef.current.getBoundingClientRect();
            setFrameSize({
                width: rect.width,
                height: rect.height,
            });
        };

        updateSize();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }

        const observer = new ResizeObserver(updateSize);
        observer.observe(frameRef.current);

        return () => observer.disconnect();
    }, [open, aspectRatio, imageUrl]);

    useEffect(() => {
        if (!frameSize || !naturalSize) return;

        const displayed = getDisplayedImageSize(frameSize, naturalSize, 1);
        setZoom(1);
        setPosition(getCenteredCropPosition(frameSize, displayed));
    }, [frameSize, naturalSize, aspectRatio]);

    useEffect(() => {
        if (!frameSize || !naturalSize) return;

        const displayed = getDisplayedImageSize(frameSize, naturalSize, zoom);
        setPosition(prev => clampCropPosition(prev, frameSize, displayed));
    }, [zoom, frameSize, naturalSize]);

    const updatePosition = (nextPosition: CropPosition) => {
        if (!frameSize || !naturalSize) {
            setPosition(nextPosition);
            return;
        }

        const displayed = getDisplayedImageSize(frameSize, naturalSize, zoom);
        setPosition(clampCropPosition(nextPosition, frameSize, displayed));
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!frameSize || !naturalSize) return;

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStateRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            origin: position,
        };
        setIsDragging(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStateRef.current || !frameSize || !naturalSize) return;

        updatePosition({
            x: dragStateRef.current.origin.x + (event.clientX - dragStateRef.current.startX),
            y: dragStateRef.current.origin.y + (event.clientY - dragStateRef.current.startY),
        });
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        dragStateRef.current = null;
        setIsDragging(false);
    };

    const handleZoomChange = (value: number) => {
        if (!frameSize || !naturalSize) {
            setZoom(value);
            return;
        }

        const previousDisplayed = getDisplayedImageSize(frameSize, naturalSize, zoom);
        const currentCenter = {
            x: position.x + previousDisplayed.width / 2,
            y: position.y + previousDisplayed.height / 2,
        };

        const nextDisplayed = getDisplayedImageSize(frameSize, naturalSize, value);
        setZoom(value);
        setPosition(clampCropPosition({
            x: currentCenter.x - nextDisplayed.width / 2,
            y: currentCenter.y - nextDisplayed.height / 2,
        }, frameSize, nextDisplayed));
    };

    const fitToFrame = () => {
        if (!frameSize || !naturalSize) return;

        const displayed = getDisplayedImageSize(frameSize, naturalSize, 1);
        setZoom(1);
        setPosition(getCenteredCropPosition(frameSize, displayed));
    };

    const handleAspectChange = (ratio: number) => {
        setAspectRatio(ratio);
    };

    const handleConfirm = async () => {
        if (!file || !imageRef.current || !frameSize || !naturalSize) {
            setError('The cropper is still loading. Please wait a moment and try again.');
            return;
        }

        try {
            setError(null);
            setIsSubmitting(true);
            const croppedFile = await createCroppedImageFile(
                imageRef.current,
                frameSize,
                position,
                zoom,
                file.name,
                aspectRatio,
            );
            await onConfirm(croppedFile);
        } catch (err) {
            setIsSubmitting(false);
            setError(err instanceof Error ? err.message : 'Unable to apply the crop.');
        }
    };

    if (!open || !file) return null;

    const displayedSize = frameSize && naturalSize
        ? getDisplayedImageSize(frameSize, naturalSize, zoom)
        : null;

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className="absolute inset-0" onClick={!isSubmitting ? onCancel : undefined} />

            <div className="relative z-10 w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b0d] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-brand-accent">
                            <Crop className="h-4 w-4" />
                            Image Tools
                        </div>
                        <h3 className="mt-2 font-display text-2xl font-bold uppercase text-white">{title}</h3>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">{description}</p>
                    </div>

                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Close cropper"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_320px]">
                    <div className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
                        <div className="flex flex-wrap items-center gap-2 px-6 py-4">
                            {aspectOptions.map((option) => (
                                <button
                                    key={option.label}
                                    type="button"
                                    onClick={() => handleAspectChange(option.ratio)}
                                    disabled={isSubmitting}
                                    className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition ${selectedAspect.ratio === option.ratio
                                        ? 'border-white bg-white text-black'
                                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/30 hover:bg-white/10'
                                        } disabled:cursor-not-allowed disabled:opacity-50`}
                                >
                                    {option.label}
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={fitToFrame}
                                disabled={isSubmitting}
                                className="ml-auto rounded-full border border-brand-accent/30 bg-brand-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent transition hover:bg-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Fit to Frame
                            </button>
                        </div>

                        <div className="px-6 pb-6">
                            <div
                                ref={frameRef}
                                className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-inner"
                                style={{ aspectRatio: `${aspectRatio}` }}
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_45%),linear-gradient(135deg,_rgba(255,255,255,0.04),_transparent_50%)]" />

                                {displayedSize && imageUrl ? (
                                    <div
                                        className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                        onPointerDown={handlePointerDown}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        onPointerCancel={handlePointerUp}
                                    >
                                        <img
                                            ref={imageRef}
                                            src={imageUrl}
                                            alt="Crop preview"
                                            className="absolute left-0 top-0 max-w-none select-none pointer-events-none"
                                            style={{
                                                width: `${displayedSize.width}px`,
                                                height: `${displayedSize.height}px`,
                                                left: `${position.x}px`,
                                                top: `${position.y}px`,
                                            }}
                                            draggable={false}
                                        />
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                                                <ImageIcon className="h-6 w-6" />
                                            </div>
                                            <p className="text-sm">Loading image preview...</p>
                                        </div>
                                    </div>
                                )}

                                <div className="pointer-events-none absolute inset-0">
                                    <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
                                    <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
                                    <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
                                    <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
                                    <div className="absolute inset-4 rounded-[1.4rem] border border-white/35" />
                                </div>

                                <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                                    {selectedAspect.label} crop
                                </div>

                                <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-200">
                                    <Move className="h-3 w-3" />
                                    Drag to align
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5 px-6 py-6">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-gray-300">
                                <Maximize2 className="h-4 w-4 text-brand-accent" />
                                Zoom
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                                <ZoomOut className="h-4 w-4 text-gray-400" />
                                <input
                                    type="range"
                                    min="1"
                                    max="4"
                                    step="0.01"
                                    value={zoom}
                                    onChange={(event) => handleZoomChange(parseFloat(event.target.value))}
                                    disabled={isSubmitting}
                                    className="h-2 w-full cursor-pointer accent-white"
                                />
                                <ZoomIn className="h-4 w-4 text-gray-400" />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                                <span>1.0x</span>
                                <span className="font-mono text-gray-200">{zoom.toFixed(2)}x</span>
                                <span>4.0x</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-gray-300">
                                <RotateCcw className="h-4 w-4 text-brand-accent" />
                                Crop Specs
                            </div>
                            <div className="mt-4 space-y-3 text-sm text-gray-400">
                                <div className="flex items-center justify-between gap-4">
                                    <span>Source</span>
                                    <span className="font-mono text-white">{file.name}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span>Frame</span>
                                    <span className="font-mono text-white">{selectedAspect.label}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span>Output</span>
                                    <span className="font-mono text-white">1600px wide</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-gray-300">
                                <AlertCircle className="h-4 w-4 text-brand-accent" />
                                Tips
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-gray-400">
                                <li>- Center the subject before saving.</li>
                                <li>- Use the zoom slider to fill the frame without distortion.</li>
                                <li>- Switch to Square for card-style assets or 4:5 for storefront hero shots.</li>
                            </ul>
                        </div>

                        {error && (
                            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="grid gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting || !imageUrl}
                                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.24em] text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                        Applying...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        {confirmLabel}
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={isSubmitting}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase tracking-[0.24em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {cancelLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropperModal;
