import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from("products")
        .select("id,name,archived,category")
        .order("name");

    if (error) {
        console.error("Error:", error);
        process.exit(1);
    }

    console.log(`Total products in DB: ${data.length}`);
    console.log("---");

    const active = data.filter((p: any) => !p.archived);
    const archived = data.filter((p: any) => p.archived);

    console.log(`\nACTIVE (${active.length}):`);
    for (const p of active) {
        console.log(`  ${p.id} | ${p.category} | ${p.name}`);
    }

    console.log(`\nARCHIVED (${archived.length}):`);
    for (const p of archived) {
        console.log(`  ${p.id} | ${p.category} | ${p.name}`);
    }
}

main();
