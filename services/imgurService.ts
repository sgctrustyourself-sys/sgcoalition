/**
 * Imgur upload service
 */

import { buildGitOperationsUrl } from './apiBase';

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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Image,
                title,
                description
            })
        });

        if (!response.ok) {
            const error = await response.json();
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
 * Trigger product synchronization from Supabase to local constants.ts
 */
export async function syncProductsToCode(): Promise<string> {
    try {
        const response = await fetch(buildGitOperationsUrl('sync-constants'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Sync failed');
        }

        const data = await response.json();
        return data.hash;
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
