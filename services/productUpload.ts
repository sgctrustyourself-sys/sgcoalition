import { supabase } from './supabase';

/**
 * Upload a product image to Supabase Storage
 * @param file - The image file to upload
 * @param productName - Name of the product (for folder organization/naming)
 * @returns Public URL of the uploaded image
 */
export async function uploadProductImage(
    file: File,
    productName: string = 'unknown'
): Promise<string> {
    // Validate file
    const validation = validateProductImage(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7);
    const extension = file.name.split('.').pop();
    const cleanName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `${cleanName}_${timestamp}_${random}.${extension}`;

    // We'll use a standard 'products' bucket
    const bucketName = 'products';
    const filePath = `images/${filename}`;

    try {
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            // If bucket doesn't exist, we might get an error. 
            // In a real scenario, the bucket should be created in the dashboard.
            console.error('Supabase Storage Error:', error);
            throw new Error(`Upload failed: ${error.message}. Please ensure the 'products' bucket exists and is public.`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Upload catch error:', error);
        throw error;
    }
}

/**
 * Validate product image file
 */
export function validateProductImage(file: File): { valid: boolean; error?: string } {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Please upload JPG, PNG, WebP or GIF images.'
        };
    }

    // Check file size (5MB max for products to keep site fast)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File too large. Maximum size for product images is 5MB.'
        };
    }

    return { valid: true };
}
