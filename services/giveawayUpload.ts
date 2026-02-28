import { supabase } from './supabase';

/**
 * Upload a screenshot to Supabase Storage
 * @param file - The image file to upload
 * @param type - Type of screenshot (follow, like, story)
 * @param giveawayId - ID of the giveaway
 * @returns Public URL of the uploaded image
 */
export async function uploadScreenshot(
    file: File,
    type: 'follow' | 'like' | 'story',
    giveawayId: string
): Promise<string> {
    // Validate file
    const validation = validateImage(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.name, type, giveawayId);
    const filePath = `${giveawayId}/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('giveaway-screenshots')
        .upload(filePath, file, {
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

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File too large. Maximum size is 5MB.'
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
