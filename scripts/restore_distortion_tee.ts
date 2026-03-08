import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreDistortionTee() {
    console.log('Restoring deleted Distortion Tee (prod_1771428520137)...');

    const originalDistortionTee = {
        "id": "prod_1771428520137",
        "name": "Coalition 1/1 Distortion Tee",
        "price": 65,
        "stock": 1,
        "category": "shirt",
        "images": [
            "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/new-product_1771429152330_ssdfg.jpg",
            "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/new-product_1771429156022_12p5s.jpg",
            "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/new-product_1771429168483_gk7g9.jpg",
            "https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/new-product_1771429172666_oha5t.jpg"
        ],
        "description": "This Coalition tee was created during one of the lowest chapters of my life — a moment where everything felt heavy, but the vision didn’t die. Every splatter, every stroke, every word on this shirt came from learning to see the beauty inside pain and the quiet pull of destiny working behind it all.\n\nIt’s more than a graphic tee. It’s a reminder that even in the darkest seasons, there’s still something worth creating, something worth becoming. The design carries that tension — raw emotion, sharp honesty, and the kind of resilience you only earn by surviving what was meant to break you.\n\nA piece for anyone who’s walked through their own fire and came out with a story worth wearing.",
        "is_featured": false,
        "sizes": ["S", "M", "L", "XL"],
        "nft_metadata": null,
        "size_inventory": {
            "L": 0,
            "M": 0,
            "S": 1,
            "XL": 0
        },
        "archived": false
    };

    const { error: insertError } = await supabase
        .from('products')
        .insert(originalDistortionTee);

    if (insertError) {
        console.error('Failed to restore tee:', insertError);
    } else {
        console.log('Distortion Tee restored successfully.');
    }
}

restoreDistortionTee();
