import { createClient } from '@supabase/supabase-js';
import { INITIAL_PRODUCTS } from '../constants';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

// Create local Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * One-time script to seed initial products to Supabase database
 * Run this to populate your database with the Coalition products
 */
async function seedProducts() {
    console.log('🌱 Starting product seeding...');
    console.log(`📦 Seeding ${INITIAL_PRODUCTS.length} products to Supabase...`);

    try {
        // Check if products already exist
        const { data: existingProducts, error: fetchError } = await supabase
            .from('products')
            .select('id');

        if (fetchError) {
            console.error('❌ Error checking existing products:', fetchError);
            throw fetchError;
        }

        const existingIds = new Set(existingProducts?.map(p => p.id) || []);
        console.log(`📊 Found ${existingIds.size} existing products in database`);

        // Filter out products that already exist
        const productsToSeed = INITIAL_PRODUCTS.filter(p => !existingIds.has(p.id));

        if (productsToSeed.length === 0) {
            console.log('✅ All products already exist in database. No seeding needed.');
            return;
        }

        console.log(`➕ Seeding ${productsToSeed.length} new products...`);

        // Transform products to database format
        const dbProducts = productsToSeed.map(product => {
            // Calculate total stock from size inventory
            const totalStock = product.sizeInventory
                ? Object.values(product.sizeInventory).reduce((sum, count) => sum + count, 0)
                : 0;

            return {
                id: product.id,
                name: product.name,
                price: product.price,
                stock: totalStock, // Calculated from inventory
                category: product.category,
                images: product.images,
                description: product.description,
                is_featured: product.isFeatured,
                sizes: product.sizes,
                size_inventory: product.sizeInventory || {},
                nft_metadata: product.nft
            };
        });

        // Insert products
        const { data, error } = await supabase
            .from('products')
            .insert(dbProducts)
            .select();

        if (error) {
            console.error('❌ Error seeding products:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        console.log(`✅ Successfully seeded ${data?.length || 0} products!`);
        console.log('📋 Seeded products:');
        data?.forEach(p => {
            console.log(`  - ${p.name} (${p.id})`);
        });

        // Verify seeding
        const { data: allProducts, error: verifyError } = await supabase
            .from('products')
            .select('id, name');

        if (verifyError) {
            console.warn('⚠️ Could not verify seeding:', verifyError);
        } else {
            console.log(`\n✅ Total products in database: ${allProducts?.length || 0}`);
        }

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

// Run the seeding
seedProducts()
    .then(() => {
        console.log('\n🎉 Seeding complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Seeding failed:', error);
        process.exit(1);
    });
