import { supabase } from './supabase';

/**
 * Upload payment proof to Supabase Storage
 */
export async function uploadPaymentProof(file: File, requestId: string): Promise<string> {
    // Validate file
    const validation = validateProofFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${requestId}-${Date.now()}.${fileExt}`;
    const filePath = `proofs/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('sgcoin-payment-proofs')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('Error uploading payment proof:', error);
        throw new Error('Failed to upload payment proof');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('sgcoin-payment-proofs')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

/**
 * Validate payment proof file
 */
export function validateProofFile(file: File): { valid: boolean; error?: string } {
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File size must be less than 10MB'
        };
    }

    // Check file type
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'File must be an image (JPG, PNG, WebP) or PDF'
        };
    }

    return { valid: true };
}

/**
 * Delete payment proof from storage
 */
export async function deletePaymentProof(proofUrl: string): Promise<void> {
    try {
        // Extract file path from URL
        const url = new URL(proofUrl);
        const pathParts = url.pathname.split('/');
        const filePath = pathParts.slice(pathParts.indexOf('proofs')).join('/');

        const { error } = await supabase.storage
            .from('sgcoin-payment-proofs')
            .remove([filePath]);

        if (error) {
            console.error('Error deleting payment proof:', error);
        }
    } catch (error) {
        console.error('Error parsing proof URL:', error);
    }
}
