import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables (same pattern as addSharkTee.ts / seedProducts.ts)
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

async function addPayPalTestItem() {
    console.log("Upserting PayPal test item ($0.50, active)...");

    // No size selector -- a one size fits all test SKU. 999 stock so the
    // operator can re-run the PayPal flow many times without re-seeding.
    const sizeInventory = { "One Size": 999 };
    // Single size -- stock equals the One Size count directly. (No reduce
    // needed; add sizes before reintroducing a reduce.)

    // Static, easy-to-remember id so the operator can find it in the admin
    // (ProductManager) and the storefront direct-URL is stable across re-seeds.
    const product = {
        id: "prod_paypal_test_001",
        name: "PayPal Test Item - $0.50",
        price: 0.5,
        stock: 999,
        // Empty images array is OK -- ProductDetails renders a placeholder.
        images: [] as string[],
        description:
            "**TEST SKU -- DO NOT PURCHASE FOR FULFILLMENT.** " +
            "This is a $0.50 PayPal test item used to verify the live PayPal checkout flow end-to-end. " +
            "It is active in the public shop so the full Add-to-Cart -> PayPal path is exercisable, and the name + description mark it as a test SKU. " +
            "No physical or digital goods will ship. If you found this organically, please contact sgctrustyourself@gmail.com so we can refund.",
        category: "accessory",
        is_featured: false,
        // mirrors services/retryQueue.ts mapProductToDb; column added in
        // supabase/migrations/20260620_add_is_limited_edition_to_products.sql
        is_limited_edition: false,
        sizes: ["One Size"],
        size_inventory: sizeInventory,
        // archived:false so the storefront treats this as a normal product
        // and the full Add-to-Cart -> PayPal checkout path is exercised.
        // (Originally set to true to hide it from the main shop grid, but
        //  the live Shop page doesn't filter on archived anyway, and the
        //  archived label on the PDP blocks the Add-to-Cart button -- so
        //  leaving the row visible-and-active is the right call for a
        //  checkout-flow test SKU. The description still loudly warns it's
        //  a TEST SKU -- DO NOT PURCHASE FOR FULFILLMENT.)
        archived: false,
    };

    const { data, error } = await supabase
        .from("products")
        .upsert([product])
        .select();

    if (error) {
        console.error("Error upserting PayPal test item:", error);
        console.error("   details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
        });
        process.exit(1);
    }

    console.log("Successfully upserted PayPal test item:", data);
    console.log("");
    console.log("   Direct URL:   https://sgcoalition.xyz/product/prod_paypal_test_001");
    console.log("   Add to cart:  /shop -> search PayPal Test or use the direct URL above");
    console.log("   Checkout:     Cart total will be $0.50 + shipping + tax. PayPal is the only");
    console.log("                 method that should be exercised with this row (Stripe, SGCoin,");
    console.log("                 and store-credit all have other rules that complicate a $1 test).");
    console.log("");
    console.log("   To remove later:  npx.cmd tsx scripts/deleteProduct.ts prod_paypal_test_001");
}

addPayPalTestItem();
