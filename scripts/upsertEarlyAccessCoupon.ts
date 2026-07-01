import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    EARLYACCESS_MAX_REDEMPTIONS,
    EARLYACCESS_PROMO_CODE,
    EARLYACCESS_DISCOUNT_PERCENTAGE,
} from '../utils/promoCodes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase service-role environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const coupon = {
    code: EARLYACCESS_PROMO_CODE,
    discount_type: 'percent',
    discount_value: EARLYACCESS_DISCOUNT_PERCENTAGE,
    min_order_value: 0,
    max_uses: EARLYACCESS_MAX_REDEMPTIONS,
    end_date: null,
    is_active: true,
};

async function upsertEarlyAccessCoupon() {
    const { data: existing, error: lookupError } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', EARLYACCESS_PROMO_CODE)
        .maybeSingle();

    if (lookupError) {
        console.error('Error looking up EARLYACCESS coupon:', lookupError);
        process.exit(1);
    }

    const result = existing?.id
        ? await supabase.from('coupons').update(coupon).eq('id', existing.id).select()
        : await supabase.from('coupons').insert(coupon).select();

    if (result.error) {
        console.error('Error upserting EARLYACCESS coupon:', result.error);
        process.exit(1);
    }

    console.log('Upserted EARLYACCESS coupon (cap=' + EARLYACCESS_MAX_REDEMPTIONS + '):', result.data);
}

upsertEarlyAccessCoupon();
