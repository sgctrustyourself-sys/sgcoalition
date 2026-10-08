import { supabase } from './supabase.js';
import { Product } from '../types.js';

/**
 * Verifies that a product exists in the Supabase database
 * @param productId - The ID of the product to verify
 * @returns Promise<boolean> - True if product exists, false otherwise
 */
export async function verifyProductExists(productId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('id')
            .eq('id', productId)
            .single();

        if (error) {
            console.error(`❌ Product ${productId} verification failed:`, error);
            return false;
        }

        if (!data) {
            console.warn(`⚠️ Product ${productId} not found in database`);
            return false;
        }

        console.log(`✅ Product ${productId} verified in database`);
        return true;
    } catch (err) {
        console.error(`❌ Unexpected error verifying product ${productId}:`, err);
        return false;
    }
}

/**
 * Verifies that a product write operation succeeded
 * Retries up to 3 times with exponential backoff
 */
export async function verifyProductWrite(
    productId: string,
    maxRetries: number = 3
): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const exists = await verifyProductExists(productId);

        if (exists) {
            return true;
        }

        if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
            console.log(`⏳ Retry ${attempt}/${maxRetries} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.error(`❌ Product ${productId} verification failed after ${maxRetries} attempts`);
    return false;
}

/**
 * Fetches a product from the database and compares with expected values
 * Useful for debugging write issues
 */
export async function debugProductState(productId: string, expectedProduct?: Partial<Product>) {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error) {
            console.error(`❌ Debug fetch failed for ${productId}:`, error);
            return;
        }

        console.log(`🔍 Database state for ${productId}:`, data);

        if (expectedProduct) {
            const differences: string[] = [];
            Object.keys(expectedProduct).forEach(key => {
                if (JSON.stringify(data[key]) !== JSON.stringify(expectedProduct[key as keyof Product])) {
                    differences.push(`${key}: expected ${JSON.stringify(expectedProduct[key as keyof Product])}, got ${JSON.stringify(data[key])}`);
                }
            });

            if (differences.length > 0) {
                console.warn(`⚠️ Differences found:`, differences);
            } else {
                console.log(`✅ Product matches expected state`);
            }
        }
    } catch (err) {
        console.error(`❌ Debug failed:`, err);
    }
}
