import { Product } from '../types';
import { supabase } from './supabase';

interface PendingWrite {
    id: string;
    operation: 'add' | 'update' | 'delete';
    product: Product;
    attempts: number;
    lastAttempt: number;
}

/**
 * Manages a queue of failed product write operations
 * Automatically retries failed writes with exponential backoff
 */
export class RetryQueue {
    private queue: Map<string, PendingWrite> = new Map();
    private maxAttempts = 5;
    private retryInterval: NodeJS.Timeout | null = null;
    private isProcessing = false;

    constructor() {
        // Load pending writes from localStorage on init
        this.loadFromStorage();
        // Start retry processor
        this.startProcessor();
    }

    /**
     * Add a failed write to the retry queue
     */
    add(operation: 'add' | 'update' | 'delete', product: Product) {
        const existing = this.queue.get(product.id);

        if (existing) {
            // Update existing entry
            existing.attempts += 1;
            existing.lastAttempt = Date.now();
            existing.product = product; // Update with latest data
        } else {
            // Add new entry
            this.queue.set(product.id, {
                id: product.id,
                operation,
                product,
                attempts: 1,
                lastAttempt: Date.now()
            });
        }

        this.saveToStorage();
        console.log(`📝 Added ${operation} for ${product.name} to retry queue (${this.queue.size} pending)`);
    }

    /**
     * Remove a product from the retry queue (after successful write)
     */
    remove(productId: string) {
        if (this.queue.delete(productId)) {
            this.saveToStorage();
            console.log(`✅ Removed ${productId} from retry queue (${this.queue.size} remaining)`);
        }
    }

    /**
     * Get count of pending writes
     */
    getPendingCount(): number {
        return this.queue.size;
    }

    /**
     * Get all pending writes
     */
    getPendingWrites(): PendingWrite[] {
        return Array.from(this.queue.values());
    }

    /**
     * Clear all pending writes
     */
    clear() {
        this.queue.clear();
        this.saveToStorage();
        console.log('🗑️ Retry queue cleared');
    }

    /**
     * Start the automatic retry processor
     */
    private startProcessor() {
        if (this.retryInterval) return;

        // Process queue every 10 seconds
        this.retryInterval = setInterval(() => {
            this.processQueue();
        }, 10000);
    }

    /**
     * Stop the automatic retry processor
     */
    stop() {
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
            this.retryInterval = null;
        }
    }

    /**
     * Process the retry queue
     */
    private async processQueue() {
        if (this.isProcessing || this.queue.size === 0) return;

        this.isProcessing = true;
        console.log(`🔄 Processing retry queue (${this.queue.size} items)...`);

        const writes = Array.from(this.queue.values());

        for (const write of writes) {
            // Skip if too many attempts
            if (write.attempts >= this.maxAttempts) {
                console.error(`❌ Max retries exceeded for ${write.product.name}, removing from queue`);
                this.queue.delete(write.id);
                continue;
            }

            // Calculate backoff delay (exponential: 10s, 20s, 40s, 80s, 160s)
            const backoffDelay = Math.pow(2, write.attempts - 1) * 10000;
            const timeSinceLastAttempt = Date.now() - write.lastAttempt;

            if (timeSinceLastAttempt < backoffDelay) {
                console.log(`⏳ Waiting ${Math.round((backoffDelay - timeSinceLastAttempt) / 1000)}s before retry for ${write.product.name}`);
                continue;
            }

            // Attempt retry
            try {
                const success = await this.retryWrite(write);
                if (success) {
                    this.queue.delete(write.id);
                    console.log(`✅ Retry successful for ${write.product.name}`);
                } else {
                    write.attempts += 1;
                    write.lastAttempt = Date.now();
                    console.warn(`⚠️ Retry failed for ${write.product.name} (attempt ${write.attempts}/${this.maxAttempts})`);
                }
            } catch (err) {
                console.error(`❌ Retry error for ${write.product.name}:`, err);
                write.attempts += 1;
                write.lastAttempt = Date.now();
            }
        }

        this.saveToStorage();
        this.isProcessing = false;
    }

    /**
     * Attempt to retry a failed write
     */
    private async retryWrite(write: PendingWrite): Promise<boolean> {
        const dbProduct = this.mapProductToDb(write.product);

        try {
            if (write.operation === 'add') {
                const { error } = await supabase.from('products').insert([dbProduct]);
                return !error;
            } else if (write.operation === 'update') {
                const { error } = await supabase.from('products').update(dbProduct).eq('id', write.id);
                return !error;
            } else if (write.operation === 'delete') {
                const { error } = await supabase.from('products').delete().eq('id', write.id);
                return !error;
            }
        } catch (err) {
            console.error(`Retry write error:`, err);
        }

        return false;
    }

    /**
     * Map Product to database format
     */
    private mapProductToDb(p: Product) {
        return {
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            images: p.images,
            description: p.description,
            is_featured: p.isFeatured,
            sizes: p.sizes,
            size_inventory: p.sizeInventory || {},
            nft_metadata: p.nft,
            archived: p.archived || false,
            archived_at: p.archivedAt,
            released_at: p.releasedAt,
            sold_at: p.soldAt
        };
    }

    /**
     * Save queue to localStorage for persistence across page reloads
     */
    private saveToStorage() {
        try {
            const data = Array.from(this.queue.values());
            localStorage.setItem('coalition_retry_queue', JSON.stringify(data));
        } catch (err) {
            console.error('Failed to save retry queue:', err);
        }
    }

    /**
     * Load queue from localStorage
     */
    private loadFromStorage() {
        try {
            const data = localStorage.getItem('coalition_retry_queue');
            if (data) {
                const writes: PendingWrite[] = JSON.parse(data);
                writes.forEach(write => {
                    this.queue.set(write.id, write);
                });
                console.log(`📥 Loaded ${writes.length} pending writes from storage`);
            }
        } catch (err) {
            console.error('Failed to load retry queue:', err);
        }
    }
}

// Lazy-initialized singleton to avoid SSR/browser environment issues
let _retryQueueInstance: RetryQueue | null = null;

export const retryQueue = {
    get instance(): RetryQueue {
        if (!_retryQueueInstance) {
            _retryQueueInstance = new RetryQueue();
        }
        return _retryQueueInstance;
    },
    add(operation: 'add' | 'update' | 'delete', product: Product) {
        return this.instance.add(operation, product);
    },
    remove(productId: string) {
        return this.instance.remove(productId);
    },
    getPendingCount(): number {
        return this.instance.getPendingCount();
    },
    getPendingWrites() {
        return this.instance.getPendingWrites();
    },
    clear() {
        return this.instance.clear();
    }
};
