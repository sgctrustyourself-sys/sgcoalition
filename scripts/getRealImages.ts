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
        'prod_halo_mini_dress',
        'prod_womens_above_as_below_contrast_shorts',
        'prod_womens_above_as_below_crop_tank',
        'prod_womens_above_as_below_set',
        'prod_womens_coalition_halo_contrast_tee',
        'prod_set_above_as_below'
    ];

    const { data, error } = await supabase
        .from("products")
        .select("id, name, images, category")
        .in("id", missingIds);

    if (error) { console.error(error); process.exit(1); }
    
    for (const p of data) {
        console.log(`\n=== ${p.id} (${p.name}) ===`);
        console.log(`category: ${p.category}`);
        console.log(`images: ${JSON.stringify(p.images, null, 2)}`);
    }
}
main();
