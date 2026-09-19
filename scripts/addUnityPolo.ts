import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearOtherFeaturedProducts } from '../utils/featuredExclusivity';

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
    console.log('🎽 Upserting Coalition Unity No. 4 Polo...');

    // Official Ralph Lauren x Coalition collaboration — 1 unit per size
    // across the full XS-2XL run (6 units total). The size selector renders
    // all sizes since each is independently purchasable. Sizes are uppercase
    // to match the rest of the catalog (S, M, L, XL, 2XL).
    const sizeInventory: Record<string, number> = { 'XS': 1, 'S': 1, 'M': 1, 'L': 1, 'XL': 1, '2XL': 1 };

    const product = {
        id: 'prod_unity_polo',
        name: 'Coalition Unity No. 4 Polo',
        price: 400.0,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            'https://i.imgur.com/EIwJZlG.jpeg',
            'https://i.imgur.com/Cyyojl8.jpeg',
        ],
        description:
            "Official Ralph Lauren x Coalition collaboration. Built on an authentic Ralph Lauren polo and hand-finished with the Unity No. 4 mark. Heritage prep meets Coalition attitude — sized XS through 2XL at $400.",
        category: 'shirt',
        gender: 'unisex',
        is_featured: true,
        created_at: '2026-07-12T00:00:00Z',
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

    // Mirror api/_handlers/admin-products.ts featured-exclusivity hook:
    // after a successful upsert that flips is_featured to true, clear the
    // flag on every other row so the catalog invariant (at most one
    // featured row) holds even though we bypassed the admin API endpoint.
    if (product.is_featured) {
        // Pre-flight: surface what clearOtherFeaturedProducts is about to
        // unfeature BEFORE the clear runs. Purely informational — the
        // helper itself is idempotent and safe to call. But logging the
        // count + IDs catches accidental unfeaturing of an unrelated
        // product (e.g., DB drift: another product got featured since the
        // last sync). If the pre-flight query itself fails, log a warning
        // and let the helper run as a safety net — better to clear a
        // row we didn't intend to than to leave two featured rows alive.
        console.log('🔍 Pre-flight: checking for other featured products...');
        const { data: otherFeatured, error: preflightError } = await supabase
            .from('products')
            .select('id, name')
            .eq('is_featured', true)
            .neq('id', product.id);

        if (preflightError) {
            console.warn(`!! Pre-flight query failed: ${preflightError.message}`);
            console.warn('   clearOtherFeaturedProducts will still run as a safety net.');
        } else if (!otherFeatured || otherFeatured.length === 0) {
            console.log(`   None — ${product.id} is the sole featured product.`);
        } else {
            console.log(`   Found ${otherFeatured.length} other featured product(s) that will be unfeatured:`);
            for (const p of otherFeatured) {
                console.log(`     - ${p.id} (${p.name})`);
            }
        }

        await clearOtherFeaturedProducts(supabase, product.id, product.is_featured);
    }

    console.log('✅ Successfully upserted Coalition Unity No. 4 Polo:', data);
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
