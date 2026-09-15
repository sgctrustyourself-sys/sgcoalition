// C:/tmp/diag-prod-read.ts
// One-shot diagnostic. Fetches prod_1784012446238 via BOTH anon and
// service-role Supabase clients on the SAME project, then dumps raw JSON
// so we can see whether the write persisted AND whether RLS is hiding
// the row from anon reads (which would explain the browser still showing
// the OLD state despite a successful service-role update).
//
// CJS-safe: top-level await removed; everything wraps in main().

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

async function main(): Promise<void> {
    dotenv.config();

    const anonUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const srvUrl = process.env.SUPABASE_URL;
    const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('=== URL identity check ===');
    console.log('VITE_SUPABASE_URL slug :', new URL(anonUrl ?? '').hostname.split('.')[0]);
    console.log('SUPABASE_URL      slug :', new URL(srvUrl ?? '').hostname.split('.')[0]);
    console.log('match              :', new URL(anonUrl ?? '').hostname === new URL(srvUrl ?? '').hostname);

    console.log('\n=== Service-role SELECT prod_1784012446238 ===');
    const srv = createClient(srvUrl!, srvKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const srvResult = await srv
        .from('products')
        .select('id, name, category, sizes, size_inventory, stock, is_limited_edition, archived, is_featured')
        .eq('id', 'prod_1784012446238')
        .maybeSingle();
    console.log('error :', JSON.stringify(srvResult.error));
    console.log('data  :', JSON.stringify(srvResult.data, null, 2));

    console.log('\n=== Anon SELECT prod_1784012446238 (what the live browser does) ===');
    const anon = createClient(anonUrl!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const anonResult = await anon
        .from('products')
        .select('id, name, category, sizes, size_inventory, stock, is_limited_edition, archived, is_featured')
        .eq('id', 'prod_1784012446238')
        .maybeSingle();
    console.log('error :', JSON.stringify(anonResult.error));
    console.log('data  :', JSON.stringify(anonResult.data, null, 2));

    console.log('\n=== Anon LIST both rows for cross-reference ===');
    const anonList = await anon
        .from('products')
        .select('id, name, category, sizes, archived')
        .in('id', ['prod_1784012446238', 'prod_1784012355221']);
    console.log('error :', JSON.stringify(anonList.error));
    console.log('rows  :', JSON.stringify(anonList.data, null, 2));
}

main().catch((err) => { console.error('Unhandled error:', err); process.exit(1); });
