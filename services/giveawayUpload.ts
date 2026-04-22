import { supabase } from './supabase';

/**
 * Compress image on the client side before uploading to save bandwidth and storage
 */
async function compressImage(file: File): Promise<File> {
    // Only compress if > 1MB
    if (file.size < 1024 * 1024) return file;
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Max dimensions
                const MAX_SIZE = 1200;
                if (width > height && width > MAX_SIZE) {
                    height *= Math.round(MAX_SIZE / width);
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= Math.round(MAX_SIZE / height);
                    height = MAX_SIZE;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(file);
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        }));
                    } else {
                        resolve(file); // Fallback to original
                    }
                }, 'image/webp', 0.8);
            };
            img.onerror = () => resolve(file); // Fallback on error
            img.src = event.target?.result as string;
        };
        reader.onerror = () => resolve(file); // Fallback on error
        reader.readAsDataURL(file);
    });
}

/**
 * Upload a screenshot to Supabase Storage
 * @param file - The image file to upload
 * @param type - Type of screenshot (follow, like, story)
 * @param giveawayId - ID of the giveaway
 * @returns Public URL of the uploaded image
 */
export async function uploadScreenshot(
    file: File,
    type: string,
    giveawayId: string
): Promise<string> {
    // Check initial file size (15MB hard limit to prevent browser crash)
    if (file.size > 15 * 1024 * 1024) {
        throw new Error('File too large. Please upload an image under 15MB.');
    }

    // Compress the file
    const compressedFile = await compressImage(file);

    // Validate compressed file
    const validation = validateImage(compressedFile);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Generate unique filename
    const filename = generateUniqueFilename(compressedFile.name, type, giveawayId);
    const filePath = `${giveawayId}/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('giveaway-screenshots')
        .upload(filePath, compressedFile, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload ${type} screenshot: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('giveaway-screenshots')
        .getPublicUrl(filePath);

    return publicUrl;
}

/**
 * Validate image file
 */
export function validateImage(file: File): { valid: boolean; error?: string } {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Please upload JPG, PNG, or WebP images only.'
        };
    }

    // Check file size (5MB max after compression)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File is still too large after compression. Please upload a smaller image.'
        };
    }

    return { valid: true };
}

/**
 * Generate unique filename to prevent collisions
 */
export function generateUniqueFilename(
    originalName: string,
    type: string,
    giveawayId: string
): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    return `${type}_${timestamp}_${random}.${extension}`;
}

/**
 * Delete a screenshot from storage
 */
export async function deleteScreenshot(url: string): Promise<void> {
    // Extract file path from URL
    const urlParts = url.split('/giveaway-screenshots/');
    if (urlParts.length < 2) {
        throw new Error('Invalid screenshot URL');
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
        .from('giveaway-screenshots')
        .remove([filePath]);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete screenshot: ${error.message}`);
    }
}

/**
 * Upload multiple screenshots at once
 */
export async function uploadAllScreenshots(
    followFile: File,
    likeFile: File,
    storyFile: File,
    giveawayId: string
): Promise<{
    followUrl: string;
    likeUrl: string;
    storyUrl: string;
}> {
    try {
        const [followUrl, likeUrl, storyUrl] = await Promise.all([
            uploadScreenshot(followFile, 'follow', giveawayId),
            uploadScreenshot(likeFile, 'like', giveawayId),
            uploadScreenshot(storyFile, 'story', giveawayId)
        ]);

        return { followUrl, likeUrl, storyUrl };
    } catch (error) {
        // If any upload fails, attempt to clean up uploaded files
        console.error('Upload failed, cleaning up...', error);
        throw error;
    }
}
