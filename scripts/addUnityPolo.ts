import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function addUnityPolo() {
    console.log('🎽 Upserting Coalition Custom Unity No. 4 Polo (1/1)...');

    // 1/1 identity — only size M is in stock (1 unit). The other sizes are
    // listed so the size selector renders cleanly if the operator later offers
    // the same build in additional sizes; mirrors the Shark Tee pattern.
    // Sizes are uppercase to match the rest of the catalog (S, M, L, XL, 2XL).
    const sizeInventory: Record<string, number> = { 'XS': 0, 'S': 0, 'M': 1, 'L': 0, 'XL': 0, '2XL': 0 };

    const product = {
        id: 'prod_unity_polo',
        name: 'Coalition Custom Unity No. 4 Polo',
        price: 400.0,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            'https://i.imgur.com/EIwJZlG.jpeg',
            'https://i.imgur.com/Cyyojl8.jpeg',
        ],
        description:
            "Created on an authentic Ralph Lauren polo.",
        category: 'shirt',
        gender: 'unisex',
        is_featured: false,
        is_limited_edition: true,
        sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
        size_inventory: sizeInventory,
        archived: false,
    };

    const { data, error } = await upsertWithSchemaFallback(product, []);

    if (error) {
        console.error('❌ Error upserting product:', error);
        console.warn('💡 If the error mentions gender or is_limited_edition does not exist, apply the relevant supabase/migrations/<column>.sql first.');
        process.exit(1);
    }

    console.log('✅ Successfully upserted Coalition Custom Unity No. 4 Polo:', data);
    console.log('🔗 View at: https://sgcoalition.xyz/#/shop');
    console.log('🏷️  is_limited_edition=true — the Limited Edition badge will render on the deployed shop.');
    console.log('👕 gender=unisex — surfaces under both ?category=men and ?category=women on /shop.');
}

addUnityPolo();

// Idempotent upsert helper that gracefully degrades when a referenced column
// doesn't exist yet on the live Supabase schema (e.g. gender or is_limited_edition
// before the relevant migration is applied). On PostgREST's PGRST204
// ('column not in schema cache') error we strip the offending column from the
// payload and retry once per column, with a blacklist so a malformed
// can't-locate message can't loop forever. Operator is warned on each missing
// column so they know which migration is unapplied and which PDP feature
// won't be live until it is.
async function upsertWithSchemaFallback(row: any, blacklist: string[]): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase
        .from('products')
        .upsert([row])
        .select();

    if (error?.code === 'PGRST204') {
        const match = /'([^']+)' column/i.exec(error.message || '');
        const missingCol = match?.[1];
        if (missingCol && row[missingCol] !== undefined && !blacklist.includes(missingCol)) {
            console.warn(`!! Column '${missingCol}' missing in public.products — retrying upsert without it.`);
            console.warn(`   Apply supabase/migrations/<that column>.sql to enable this field on the live shop.`);
            const stripped = { ...row };
            delete (stripped as any)[missingCol];
            return upsertWithSchemaFallback(stripped, [...blacklist, missingCol]);
        }
    }
    return { data, error };
}
