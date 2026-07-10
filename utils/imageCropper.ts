export interface CropFrameSize {
    width: number;
    height: number;
}

export interface CropPosition {
    x: number;
    y: number;
}

export interface CropAspectOption {
    label: string;
    ratio: number;
}

export const PRODUCT_CROP_ASPECT_OPTIONS: CropAspectOption[] = [
    { label: 'Square', ratio: 1 },
    { label: '4:5', ratio: 4 / 5 },
    { label: '3:4', ratio: 3 / 4 },
    { label: '16:9', ratio: 16 / 9 },
];

export const DEFAULT_PRODUCT_CROP_RATIO = 4 / 5;
export const PRODUCT_CROP_OUTPUT_WIDTH = 1600;
const PRODUCT_CROP_MIN_ZOOM = 1;
const PRODUCT_CROP_MAX_ZOOM = 4;

export const clamp = (value: number, min: number, max: number) => {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
};

export const getCoverScale = (frame: CropFrameSize, image: CropFrameSize) => {
    if (frame.width <= 0 || frame.height <= 0 || image.width <= 0 || image.height <= 0) {
        return 1;
    }

    return Math.max(frame.width / image.width, frame.height / image.height);
};

export const getDisplayedImageSize = (
    frame: CropFrameSize,
    image: CropFrameSize,
    zoom: number
) => {
    const safeZoom = clamp(zoom, PRODUCT_CROP_MIN_ZOOM, PRODUCT_CROP_MAX_ZOOM);
    const scale = getCoverScale(frame, image) * safeZoom;

    return {
        width: image.width * scale,
        height: image.height * scale,
        scale,
    };
};

export const getCenteredCropPosition = (frame: CropFrameSize, displayed: CropFrameSize): CropPosition => ({
    x: (frame.width - displayed.width) / 2,
    y: (frame.height - displayed.height) / 2,
});

export const clampCropPosition = (
    position: CropPosition,
    frame: CropFrameSize,
    displayed: CropFrameSize
) => {
    const minX = frame.width - displayed.width;
    const minY = frame.height - displayed.height;

    return {
        x: clamp(position.x, minX, 0),
        y: clamp(position.y, minY, 0),
    };
};

export const sanitizeFileName = (fileName: string) => {
    const baseName = fileName
        .toLowerCase()
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return baseName || 'cropped-image';
};

export const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image for cropping.'));
        image.src = src;
    });

export const createCroppedImageFile = async (
    image: HTMLImageElement,
    frame: CropFrameSize,
    position: CropPosition,
    zoom: number,
    fileName: string,
    aspectRatio: number,
    mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg'
) => {
    const naturalSize = {
        width: image.naturalWidth,
        height: image.naturalHeight,
    };

    const displayed = getDisplayedImageSize(frame, naturalSize, zoom);
    const sourceX = clamp(-position.x / displayed.scale, 0, naturalSize.width);
    const sourceY = clamp(-position.y / displayed.scale, 0, naturalSize.height);
    const sourceW = Math.min(naturalSize.width - sourceX, frame.width / displayed.scale);
    const sourceH = Math.min(naturalSize.height - sourceY, frame.height / displayed.scale);

    if (sourceW <= 0 || sourceH <= 0) {
        throw new Error('The crop area is empty. Please adjust the image and try again.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = PRODUCT_CROP_OUTPUT_WIDTH;
    canvas.height = Math.max(1, Math.round(PRODUCT_CROP_OUTPUT_WIDTH / aspectRatio));

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Your browser does not support image cropping.');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Unable to export the cropped image.'));
                    return;
                }

                resolve(result);
            },
            mimeType,
            mimeType === 'image/png' ? undefined : 0.92
        );
    });

    const extension = mimeType === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `${sanitizeFileName(fileName)}-cropped.${extension}`, {
        type: mimeType,
        lastModified: Date.now(),
    });
};

