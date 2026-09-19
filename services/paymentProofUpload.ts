// services/paymentProofUpload.ts
//
// Uploads payment proof images (receipt screenshots, cash app confirmations)
// to Supabase Storage. Mirrors the proofUpload.ts pattern used for SGCoin
// purchase requests, but targets a dedicated payments-proofs bucket.
//
// Used by the PaymentRecordModal in the admin OrderManager so every
// partial-payment recording can optionally attach a proof image.

import { supabase } from './supabase.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

export function validatePaymentProofFile(file: File): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'File must be less than 10 MB.' };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: 'File must be an image (JPG, PNG, WebP) or PDF.' };
    }
    return { valid: true };
}

export async function uploadPaymentProof(file: File, orderId: string): Promise<string> {
    const validation = validatePaymentProofFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${fileExt}`;
    const filePath = `payments/${fileName}`;

    const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('[paymentProofUpload] Upload error:', error);
        throw new Error('Failed to upload payment proof: ' + error.message);
    }

    const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

export async function deletePaymentProof(proofUrl: string): Promise<void> {
    try {
        const url = new URL(proofUrl);
        const pathParts = url.pathname.split('/');
        const filePath = pathParts.slice(pathParts.indexOf('payments')).join('/');

        const { error } = await supabase.storage
            .from('payment-proofs')
            .remove([filePath]);

        if (error) {
            console.error('[paymentProofUpload] Delete error:', error);
        }
    } catch (err) {
        console.error('[paymentProofUpload] Error parsing proof URL:', err);
    }
}
