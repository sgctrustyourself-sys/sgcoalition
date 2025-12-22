import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncProducts() {
    console.log('🔄 Fetching products from Supabase...');

    const { data: dbProducts, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching products:', error);
        process.exit(1);
    }

    console.log(`✅ Fetched ${dbProducts.length} products`);

    const mappedProducts = dbProducts.map(p => ({
        id: p.id,
        name: p.name?.trim(),
        price: p.price,
        images: p.images,
        description: p.description?.trim(),
        category: p.category?.toLowerCase()?.trim() === 'accessories' ? 'accessory' : p.category?.toLowerCase()?.trim(),
        isFeatured: p.is_featured,
        sizes: p.sizes,
        sizeInventory: p.size_inventory,
        nft: p.nft_metadata,
        archived: p.archived,
        archivedAt: p.archived_at,
        releasedAt: p.released_at,
        soldAt: p.sold_at
    }));

    const constantsPath = path.resolve(__dirname, '../constants.ts');
    const content = fs.readFileSync(constantsPath, 'utf8');

    // Regex to find and replace INITIAL_PRODUCTS array
    const updatedContent = content.replace(
        /export const INITIAL_PRODUCTS: Product\[\] = \[[\s\S]*?\];/,
        `export const INITIAL_PRODUCTS: Product[] = ${JSON.stringify(mappedProducts, null, 2)};`
    );

    fs.writeFileSync(constantsPath, updatedContent);
    console.log('✅ constants.ts updated with latest products from Supabase');
}

syncProducts().catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
});
