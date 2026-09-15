/**
 * Imgur upload service
 */

import { buildGitOperationsUrl, getAdminAuthHeaders, clearAdminSession } from './apiBase.js';

/**
 * Upload an image to Imgur via the local backend processor
 * @param file - File object or base64 string
 * @param title - Optional title for the image
 * @param description - Optional description for the image
 * @returns Promise with the direct Imgur URL
 */
export async function uploadToImgur(
    file: File | string,
    title?: string,
    description?: string
): Promise<string> {
    try {
        let base64Image: string;

        if (file instanceof File) {
            base64Image = await fileToBase64(file);
        } else {
            base64Image = file;
        }

        const response = await fetch(buildGitOperationsUrl('upload-imgur'), {
            method: 'POST',
            // Admin-only endpoint -- see api/_handlers/git-operations.ts.
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeaders(),
            },
            body: JSON.stringify({
                image: base64Image,
                title,
                description
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                clearAdminSession();
                throw new Error('Admin session expired — sign in again.');
            }
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Imgur upload failed');
        }

        const data = await response.json();
        return data.url;
    } catch (error: any) {
        console.error('Imgur Upload Service Error:', error);
        throw error;
    }
}

/**
 * Trigger product synchronization from Supabase to local constants.ts.
 * Returns the full server response so ProductManager can read the
 * `noChanges` flag when the file already matches the database.
 */
export async function syncProductsToCode(): Promise<{ hash?: string; noChanges?: boolean; success?: boolean }> {
    try {
        const response = await fetch(buildGitOperationsUrl('sync-constants'), {
            method: 'POST',
            // sync-constants commits to origin/main through the server's
            // GITHUB_TOKEN, so it is admin-gated as of the repo-write fix.
            headers: {
                'Content-Type': 'application/json',
                ...getAdminAuthHeaders(),
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                clearAdminSession();
                throw new Error('Admin session expired — sign in again to sync products.');
            }
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Sync failed (HTTP ${response.status})`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Sync Service Error:', error);
        throw error;
    }
}

/**
 * Convert File object to base64 string
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
}
