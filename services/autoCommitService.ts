/**
 * Auto-commit service for tracking data changes
 */

const API_BASE = 'http://localhost:3001/api';

export interface AutoCommitOptions {
    message: string;
    author?: string;
    silent?: boolean;
}

/**
 * Create an automatic Git commit
 */
export async function autoCommit(options: AutoCommitOptions): Promise<string | null> {
    try {
        const response = await fetch(`${API_BASE}/git-operations?action=commit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: options.message,
                author: options.author || 'Coalition Admin <admin@coalition.local>'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create commit');
        }

        const data = await response.json();

        if (!options.silent) {
            console.log(`✅ Auto-commit created: ${data.hash} - ${options.message}`);
        }

        return data.hash;
    } catch (error: any) {
        console.error('Auto-commit failed:', error);
        // Don't throw - we don't want to break the app if Git fails
        return null;
    }
}

/**
 * Generate commit message for product addition
 */
export function generateProductAddedMessage(productName: string): string {
    return `Added product: ${productName}`;
}

/**
 * Generate commit message for product update
 */
export function generateProductUpdatedMessage(productName: string): string {
    return `Updated product: ${productName}`;
}

/**
 * Generate commit message for product deletion
 */
export function generateProductDeletedMessage(productName: string): string {
    return `Deleted product: ${productName}`;
}

/**
 * Generate commit message for order creation
 */
export function generateOrderCreatedMessage(orderNumber: string): string {
    return `Created order: ${orderNumber}`;
}

/**
 * Generate commit message for order update
 */
export function generateOrderUpdatedMessage(orderNumber: string, status: string): string {
    return `Updated order ${orderNumber}: ${status}`;
}

/**
 * Debounced auto-commit to prevent excessive commits
 */
let commitTimeout: NodeJS.Timeout | null = null;
const COMMIT_DELAY = 2000; // 2 seconds

export function debouncedAutoCommit(options: AutoCommitOptions): void {
    if (commitTimeout) {
        clearTimeout(commitTimeout);
    }

    commitTimeout = setTimeout(() => {
        autoCommit(options);
        commitTimeout = null;
    }, COMMIT_DELAY);
}
