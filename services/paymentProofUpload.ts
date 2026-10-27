// services/paymentProofUpload.ts
//
// Uploads payment proof images (receipt screenshots, cash app confirmations)
// to Supabase Storage. Mirrors the proofUpload.ts pattern used for SGCoin
// purchase requests, but targets a dedicated payments-proofs bucket.
//
// Used by the PaymentRecordModal in the admin OrderManager so every
// partial-payment recording can optionally attach a proof image.
//
// Also carries uploadClaimProof, the buyer-facing upload behind /claim: a claim
// needs the same file rules (10 MB, image or PDF, public URL back) and the same
// bucket, so it shares this module's validator rather than declaring a second
// set of limits that could drift from these. It writes under `claims/` so an
// operator can tell a buyer's receipt from an admin's payment proof at a glance.

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

    const { error } = await supabase.storage
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

/**
 * Upload a buyer's order receipt for a point claim, returning its public URL.
 *
 * `reference` is whatever the claimant typed as their order number. It is
 * reduced to `[A-Za-z0-9._-]` before it becomes part of a storage path: the value
 * is free text from a form, and a `/` or `..` in a path segment is a directory
 * traversal in the bucket, not a filename.
 */
export async function uploadClaimProof(file: File, reference: string): Promise<string> {
    const validation = validatePaymentProofFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const safeReference = reference.trim().replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'order';
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${safeReference}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${fileExt}`;
    const filePath = `claims/${fileName}`;

    const { error } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('[paymentProofUpload] Claim proof upload error:', error);
        throw new Error('Failed to upload the receipt: ' + error.message);
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
