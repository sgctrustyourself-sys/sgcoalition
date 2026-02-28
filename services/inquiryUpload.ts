import { supabase } from './supabase';

/**
 * Upload a reference image for custom inquiry
 * @param file - The image file to upload
 * @param inquiryId - ID of the inquiry (or temp ID before submission)
 * @returns Public URL of the uploaded image
 */
export async function uploadInquiryImage(
    file: File,
    inquiryId: string
): Promise<string> {
    // Validate file
    const validation = validateInquiryImage(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.name, inquiryId);
    const filePath = `${inquiryId}/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('custom-inquiry-images')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('custom-inquiry-images')
        .getPublicUrl(filePath);

    return publicUrl;
}

/**
 * Validate inquiry image file
 */
export function validateInquiryImage(file: File): { valid: boolean; error?: string } {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Please upload JPG, PNG, or WebP images only.'
        };
    }

    // Check file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File too large. Maximum size is 10MB.'
        };
    }

    return { valid: true };
}

/**
 * Generate unique filename to prevent collisions
 */
export function generateUniqueFilename(
    originalName: string,
    inquiryId: string
): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    return `ref_${timestamp}_${random}.${extension}`;
}

/**
 * Delete an inquiry image from storage
 */
export async function deleteInquiryImage(url: string): Promise<void> {
    // Extract file path from URL
    const urlParts = url.split('/custom-inquiry-images/');
    if (urlParts.length < 2) {
        throw new Error('Invalid image URL');
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
        .from('custom-inquiry-images')
        .remove([filePath]);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete image: ${error.message}`);
    }
}

/**
 * Upload multiple reference images at once
 */
export async function uploadAllInquiryImages(
    files: File[],
    inquiryId: string
): Promise<string[]> {
    if (files.length === 0) {
        return [];
    }

    if (files.length > 5) {
        throw new Error('Maximum 5 images allowed');
    }

    try {
        const uploadPromises = files.map(file => uploadInquiryImage(file, inquiryId));
        const urls = await Promise.all(uploadPromises);
        return urls;
    } catch (error) {
        console.error('Batch upload failed:', error);
        throw error;
    }
}
