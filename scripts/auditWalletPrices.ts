import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_PRODUCTS } from '../constants/products';
import fullProducts from '../full_products.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

interface DbProduct {
    id: string;
    name: string;
    price: number;
    category: string;
    archived: boolean;
    updated_at?: string;
}

interface FullProduct {
    id: string;
    name: string;
    price: number;
    category: string;
    archived: boolean;
}

const typedFullProducts = fullProducts as FullProduct[];

function normalizeCategory(category: string) {
    return category?.toLowerCase() ?? '';
}

async function audit() {
    console.log('🔍 Auditing wallet/accessory prices in live Supabase...\n');

    const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id,name,price,category,archived,updated_at')
        .in('category', ['wallet', 'accessory']);

    if (error) {
        console.error('❌ Supabase error:', error.message);
        process.exit(1);
    }

    const wallets = (dbProducts as DbProduct[] || []).filter(p => {
        const cat = normalizeCategory(p.category);
        return cat === 'wallet' || cat === 'accessory';
    }).sort((a, b) => a.id.localeCompare(b.id));

    const initialMap = new Map(INITIAL_PRODUCTS.map(p => [p.id, p]));
    const fullMap = new Map(typedFullProducts.map(p => [p.id, p]));

    const stale35: DbProduct[] = [];
    const mismatches: { db: DbProduct; source: string; sourcePrice: number; localPrice: number }[] = [];

    for (const dbProd of wallets) {
        if (dbProd.price === 35) {
            stale35.push(dbProd);
        }

        const initial = initialMap.get(dbProd.id);
        if (initial && initial.price !== dbProd.price) {
            mismatches.push({
                db: dbProd,
                source: 'INITIAL_PRODUCTS',
                sourcePrice: dbProd.price,
                localPrice: initial.price,
            });
        }

        const full = fullMap.get(dbProd.id);
        if (full && full.price !== dbProd.price) {
            mismatches.push({
                db: dbProd,
                source: 'full_products.json',
                sourcePrice: dbProd.price,
                localPrice: full.price,
            });
        }
    }

    console.log(`Found ${wallets.length} wallet/accessory rows in Supabase:\n`);
    console.table(wallets.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category, archived: p.archived })));

    if (stale35.length > 0) {
        console.error(`\n Found ${stale35.length} wallet(s) still priced at $35 in the live DB:`);
        console.table(stale35.map(p => ({ id: p.id, name: p.name, price: p.price })));
    } else {
        console.log('\n✅ No wallets are priced at $35 in the live DB.');
    }

    if (mismatches.length > 0) {
        console.error(`\n❌ Found ${mismatches.length} price mismatch(es) between live DB and local sources:`);
        console.table(mismatches.map(m => ({
            id: m.db.id,
            name: m.db.name,
            'live DB': m.sourcePrice,
            [m.source]: m.localPrice,
        })));
        process.exit(1);
    } else {
        console.log('\n✅ Live DB wallet prices match INITIAL_PRODUCTS and full_products.json.');
    }
}

audit().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
