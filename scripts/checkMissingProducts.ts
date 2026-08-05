import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
    // Get all products with price
    const { data, error } = await supabase
        .from("products")
        .select("id,name,price,archived,category,created_at,images")
        .order("name");

    if (error) { console.error(error); process.exit(1); }

    console.log("=== ALL PRODUCTS WITH PRICES ===");
    for (const p of data) {
        const overLimit = Number(p.price) > 1000 ? " *** OVER $1000 PRICE FILTER ***" : "";
        console.log(`${p.id} | $${p.price} | ${p.archived ? 'ARCHIVED' : 'ACTIVE'} | ${p.category} | ${p.name}${overLimit}`);
    }

    console.log("\n=== PRODUCTS MISSING FROM LIVE SITE (in DB but not on shop) ===");
    const missingIds = [
        'prod_set_above_as_below',
        'prod_halo_mini_dress',
        'prod_womens_above_as_below_contrast_shorts',
        'prod_womens_above_as_below_crop_tank',
        'prod_womens_above_as_below_set',
        'prod_womens_coalition_halo_contrast_tee',
        'prod_paypal_test_001'
    ];
    for (const id of missingIds) {
        const p = data.find((x: any) => x.id === id);
        if (p) {
            console.log(`  ${p.id} | $${p.price} | images: ${p.images?.length || 0} | created: ${p.created_at || 'NULL'}`);
        } else {
            console.log(`  ${id} | NOT FOUND IN DB`);
        }
    }
}
main();
