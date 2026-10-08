import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
    const missingIds = [
        'prod_set_above_as_below',
        'prod_halo_mini_dress',
        'prod_womens_above_as_below_contrast_shorts',
        'prod_womens_above_as_below_crop_tank',
        'prod_womens_above_as_below_set',
        'prod_womens_coalition_halo_contrast_tee',
        'prod_paypal_test_001'
    ];

    const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("id", missingIds);

    if (error) { console.error(error); process.exit(1); }

    console.log(`Found ${data.length} of ${missingIds.length} missing products`);
    console.log("===");
    
    for (const p of data) {
        console.log(`\n--- ${p.id} ---`);
        console.log(`name: ${p.name}`);
        console.log(`price: ${p.price}`);
        console.log(`category: ${p.category}`);
        console.log(`description: ${p.description}`);
        console.log(`sizes: ${JSON.stringify(p.sizes || [])}`);
        console.log(`size_inventory: ${JSON.stringify(p.size_inventory || {})}`);
        console.log(`images: ${JSON.stringify((p.images || []).slice(0, 4))}`);
        console.log(`is_featured: ${p.is_featured}`);
        console.log(`is_limited_edition: ${p.is_limited_edition}`);
        console.log(`stock: ${p.stock}`);
        console.log(`archived: ${p.archived}`);
    }
}
main();
