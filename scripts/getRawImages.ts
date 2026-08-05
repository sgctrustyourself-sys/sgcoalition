import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
    const ids = [
        'prod_halo_mini_dress',
        'prod_womens_above_as_below_contrast_shorts',
        'prod_womens_above_as_below_crop_tank',
        'prod_womens_above_as_below_set',
        'prod_womens_coalition_halo_contrast_tee'
    ];

    for (const id of ids) {
        const { data } = await supabase.from("products").select("id, name, images").eq("id", id).single();
        if (data) {
            console.log(`\n${data.id}:`);
            const imgs = data.images as string[];
            imgs.forEach((url, i) => console.log(`  [${i}] ${url}`));
        }
    }
}
main();
