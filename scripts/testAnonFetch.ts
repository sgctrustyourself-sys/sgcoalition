import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Use the ANON key (same as the frontend) — NOT the service role key
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
    // Exact same query as fetchProducts in AppContext.tsx
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("QUERY ERROR:", error);
        process.exit(1);
    }

    console.log(`Total products returned by anon query: ${data.length}`);
    console.log("===");
    for (const p of data) {
        console.log(`${p.id} | $${p.price} | ${p.archived ? 'ARCHIVED' : 'ACTIVE'} | created: ${p.created_at || 'NULL'} | ${p.name}`);
    }

    // Check specifically for the missing products
    const missingIds = [
        'prod_set_above_as_below',
        'prod_halo_mini_dress',
        'prod_womens_above_as_below_contrast_shorts',
        'prod_womens_above_as_below_crop_tank',
        'prod_womens_above_as_below_set',
        'prod_womens_coalition_halo_contrast_tee',
        'prod_paypal_test_001'
    ];

    console.log("\n=== MISSING PRODUCTS CHECK (anon key) ===");
    for (const id of missingIds) {
        const found = data.find((x: any) => x.id === id);
        console.log(`  ${id}: ${found ? 'FOUND' : '*** NOT RETURNED BY ANON QUERY ***'}`);
    }
}
main();
