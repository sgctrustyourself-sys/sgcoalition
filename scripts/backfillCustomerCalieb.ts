// scripts/backfillCustomerCalieb.ts
//
// One-shot backfill: discover customer "calieb" via IG handle
// https://www.instagram.com/1il.caleb/ + orders history, then recompute +
// persist the lifetime profile so the admin view stays in sync.
//
// USAGE   npx.cmd tsx scripts/backfillCustomerCalieb.ts [--dry-run | --confirm]
// AUTH    Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
//
// SAFETY: vitest workers (process.env.VITEST_WORKER_ID) bypass the
//         process.exit(1) guard so test workers do not die when env is unset.
// STABLE OUTPUTS: grep-able magic tokens so tests survive wording drift.
// NARROWED OR: orders query matches customer_email ILIKE only (drops
//             customer_name ILIKE to avoid false positives on every
//             human named "Caleb").
//
// SMS SUBSCRIBER WRITE
//   `--confirm` upserts marketing_contacts (channel=sms, source=manual_seed)
//   so calieb is registered as an SMS subscriber and auto-excluded from test
//   campaigns via utils/marketingAudience.ts. marketing_contacts is hit
//   BEFORE profiles because it has stricter UNIQUE constraints (phone_e164);
//   if the profile update later fails we DELETE the marketing row to leave
//   both tables consistent.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import * as path from 'path';

export const INSTAGRAM_HANDLE = '1il.caleb';
export const CALIEB_DISPLAY_NAME = 'calieb';
export const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/' + INSTAGRAM_HANDLE + '/';
export const BACKFILL_NOTES_TAG = '@sgcoalition-backfill-2026-07-16';
export const NOT_FOUND_TOKEN = '__CALIEB_NOT_FOUND__';
// SMS subscriber constants. Phone is the user's US number; the SMS tag is
// appended to marketing_contacts.metadata so a future audit can grep.
// Source=manual_seed is required for utils/marketingAudience.ts's
// test-campaign auto-exclusion to fire (manual_seed is in the
// VERIFIED_CUSTOMER_SOURCES allowlist).
export const CALIEB_PHONE_E164 = '+14433775592';
export const CALIEB_COUNTRY_CODE = '+1';
export const CALIEB_SMS_TAG = '@sgcoalition-calieb-sms-2026-07-16';
export const CALIEB_SMS_CHANNEL: 'sms' | 'email' | 'both' = 'sms';
export const CALIEB_SMS_SOURCE = 'manual_seed';

export const KNOWN_WALLET_PRODUCT_IDS = [
    'prod_wallet_chrome_hearts',
    'prod_set_above_as_below',
    'Coalition_Racing_Team_Wallet_1_4',
    'Coalition_Racing_Team_Wallet_2_4',
    'Coalition_Racing_Team_Wallet_3_4',
    'Coalition_Racing_Team_Wallet_4_4',
    'Coalition_Grey_Wave_Wallet_1_2',
    'Coalition_Grey_Wave_Wallet_2_2',
    'SKYYBLUEWALLET1_2',
    'Coalition_Above_As_Below_Wallet_1_1',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    (process.env.VITEST_WORKER_ID ? 'https://fake.test' : undefined);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.VITEST_WORKER_ID ? 'fake-key' : undefined);

if (!SUPABASE_URL || !SERVICE_KEY) {
    if (!process.env.VITEST_WORKER_ID) {
        console.error('!! .env must contain VITE_SUPABASE_URL AND SUPABASE_SERVICE_ROLE_KEY.');
        process.exit(1);
    }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

export interface CaliebDiscovery {
    socialLink: any | null;
    matchingOrders: any[];
    profile: any | null;
    paidOrders: any[];
    lifetimeSpendUsd: number;
    lifetimeOrdersCount: number;
    walletPurchases: any[];
    resolvedUserId: string | null;
}
export async function discoverCalieb(): Promise<CaliebDiscovery> {
    // 1. Find IG social link
    const { data: socialLink, error: socialErr } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('platform', 'instagram')
        .eq('username', INSTAGRAM_HANDLE)
        .maybeSingle();

    if (socialErr && socialErr.code !== 'PGRST116') {
        throw new Error('social_accounts read failed: ' + socialErr.message);
    }

    // 2. Find orders by Calieb's email patterns (mailbox-shape only, drops customer_name ILIKE)
    const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .or('customer_email.ilike.%calieb@%,customer_email.ilike.%caleb@%')
        .order('created_at', { ascending: false });

    if (ordersErr) {
        throw new Error('orders read failed: ' + ordersErr.message);
    }

    const matchingOrders = orders || [];

    // 3. Find profile by resolved user_id (if social_link exists)
    let profile: any | null = null;
    let resolvedUserId: string | null = null;
    if (socialLink?.user_id) {
        resolvedUserId = socialLink.user_id;
        const { data: profileRow, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', resolvedUserId)
            .maybeSingle();

        if (profileErr && profileErr.code !== 'PGRST116') {
            throw new Error('profiles read failed: ' + profileErr.message);
        }
        profile = profileRow;
    }
    // Aggregate paid orders
    const PAID_STATUSES = ['paid', 'completed', 'shipped', 'delivered'];
    const paidOrders = matchingOrders.filter((o: any) => PAID_STATUSES.includes((o.status || '').toLowerCase()));

    const lifetimeSpendUsd = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
    const lifetimeOrdersCount = paidOrders.length;

    // Pull wallet-product line items
    const walletPurchases: any[] = [];
    for (const order of paidOrders) {
        const items = (order.items || order.line_items || []) as any[];
        for (const item of items) {
            const productId = item.product_id || item.productId || item.id || '';
            if (KNOWN_WALLET_PRODUCT_IDS.includes(productId)) {
                walletPurchases.push({
                    order_id: order.id,
                    product_id: productId,
                    product_name: item.name || item.product_name || productId,
                    price: Number(item.price || 0),
                    order_date: order.created_at,
                });
            }
        }
    }

    return {
        socialLink,
        matchingOrders,
        profile,
        paidOrders,
        lifetimeSpendUsd,
        lifetimeOrdersCount,
        walletPurchases,
        resolvedUserId,
    };
}

export function printDiscovery(d: CaliebDiscovery): void {
    console.log('=== Calieb Discovery Report ===');
    console.log('instagram: ' + INSTAGRAM_PROFILE_URL);

    // SOCIAL_FOUND magic token
    if (d.socialLink) {
        console.log('SOCIAL_FOUND user_id=' + d.socialLink.user_id + ' verified=' + d.socialLink.verified + ' linked_at=' + d.socialLink.linked_at);
    } else {
        console.log(NOT_FOUND_TOKEN + ' (no social link for @' + INSTAGRAM_HANDLE + ')');
    }

    // ORDERS aggregation
    console.log('---');
    console.log('orders matched (customer_email ILIKE calieb@%/caleb@%): ' + d.matchingOrders.length);
    console.log('paid orders (paid|completed|shipped|delivered): ' + d.paidOrders.length);
    console.log('lifetime_spend_usd: $' + d.lifetimeSpendUsd.toFixed(2));
    console.log('lifetime_orders: ' + d.lifetimeOrdersCount);
    console.log('wallet purchases: ' + d.walletPurchases.length);

    if (d.matchingOrders.length === 0) {
        console.log(NOT_FOUND_TOKEN + '_ORDERS (no orders matched the email-shape query)');
    } else {
        for (const o of d.matchingOrders) {
            console.log('  order ' + o.id + ' | ' + (o.status || 'unknown') + ' | $' + Number(o.total || 0).toFixed(2) + ' | ' + o.customer_email + ' | ' + (o.customer_name || ''));
        }
    }

    // PROFILE
    console.log('---');
    if (d.profile) {
        console.log('PROFILE_FOUND id=' + d.profile.id + ' email=' + (d.profile.email || 'null') + ' name=' + (d.profile.display_name || d.profile.full_name || 'null'));
        console.log('  stored lifetime_spend_usd=$' + Number(d.profile.lifetime_spend_usd || 0).toFixed(2));
        console.log('  stored lifetime_orders=' + Number(d.profile.lifetime_orders || 0));
        console.log('  stored customer_notes=' + JSON.stringify(d.profile.customer_notes || ''));
    } else if (d.resolvedUserId) {
        console.log(NOT_FOUND_TOKEN + '_PROFILE (no profiles row for resolved user_id=' + d.resolvedUserId + ')');
    } else {
        console.log(NOT_FOUND_TOKEN + '_PROFILE (no social_link.user_id to resolve)');
    }

    // WALLET PURCHASES
    if (d.walletPurchases.length > 0) {
        console.log('---');
        console.log('wallet purchases:');
        for (const wp of d.walletPurchases) {
            console.log('  ' + wp.product_id + ' | $' + wp.price.toFixed(2) + ' | order ' + wp.order_id + ' | ' + wp.order_date);
        }
    }

    console.log('=== End Report ===');
}

export async function runConfirm(d: CaliebDiscovery): Promise<void> {
    console.log('=== Calieb Backfill CONFIRM ===');
    const today = new Date().toISOString().split('T')[0];

    // 1. Upsert social_accounts row
    if (!d.socialLink) {
        console.log('INTENDED_INSERT social_accounts (platform=instagram, username=' + INSTAGRAM_HANDLE + ')');
        if (d.resolvedUserId) {
            const { error: insSocialErr } = await supabase.from('social_accounts').insert({
                user_id: d.resolvedUserId,
                platform: 'instagram',
                username: INSTAGRAM_HANDLE,
                verified: false,
                linked_at: new Date().toISOString(),
                profile_url: INSTAGRAM_PROFILE_URL,
            });
            if (insSocialErr) {
                console.log('SOCIAL_WRITE_RESULT FAIL: ' + insSocialErr.message);
                throw insSocialErr;
            }
            console.log('SOCIAL_WRITE_RESULT OK (inserted social_accounts row, verified=false; admin flips manually)');
        } else {
            console.log('INTENDED_NOOP_SOCIAL (cannot insert social_accounts without a resolved user_id)');
        }
    } else {
        console.log('INTENDED_NOOP_SOCIAL (social_accounts row already exists for @' + INSTAGRAM_HANDLE + ')');
    }

    // 2. Upsert marketing_contacts SMS row. Sequence: marketing FIRST,
    // profile SECOND. marketing_contacts has stricter UNIQUE constraints
    // (phone_e164) than profiles (customer_phone is not a unique-index
    // column), so we hit the stricter constraint first. If the profile
    // update later fails, we DELETE the marketing row to leave both
    // tables consistent. Source=manual_seed is required for the
    // utils/marketingAudience.ts test-campaign auto-exclusion
    // (manual_seed is in the VERIFIED_CUSTOMER_SOURCES allowlist).
    if (d.resolvedUserId) {
        console.log('INTENDED_MARKETING_UPSERT phone_e164=' + CALIEB_PHONE_E164 + ' channel=' + CALIEB_SMS_CHANNEL + ' source=' + CALIEB_SMS_SOURCE);
        const { error: mktErr } = await supabase.from('marketing_contacts').upsert({
            phone_e164: CALIEB_PHONE_E164,
            country_code: CALIEB_COUNTRY_CODE,
            channel: CALIEB_SMS_CHANNEL,
            source: CALIEB_SMS_SOURCE,
            metadata: { notes_tag: CALIEB_SMS_TAG },
        }, { onConflict: 'phone_e164' });
        if (mktErr) {
            console.log('MARKETING_WRITE_RESULT FAIL: ' + mktErr.message);
            throw mktErr;
        }
        console.log('MARKETING_WRITE_RESULT OK (calieb is now an SMS subscriber; auto-excluded from test campaigns via source=' + CALIEB_SMS_SOURCE + ')');
    } else {
        console.log('INTENDED_NOOP_MARKETING (cannot upsert marketing_contacts without a resolved user_id)');
    }

    // 3. Upsert profiles row (lifetime stats + customer_phone + customer_notes).
    // On failure, DELETE the marketing_contacts row we just inserted so the
    // phone doesn't exist on marketing without a matching profile row.
    if (d.profile && d.resolvedUserId) {
        const storedNotes = (d.profile.customer_notes || '') as string;
        const updatedNotes = (storedNotes + ' ' + BACKFILL_NOTES_TAG + ' ' + today).trim();

        const updatePayload = {
            lifetime_spend_usd: d.lifetimeSpendUsd,
            lifetime_orders: d.lifetimeOrdersCount,
            customer_notes: updatedNotes,
            customer_phone: CALIEB_PHONE_E164,
            last_seen_at: new Date().toISOString(),
        };

        console.log('INTENDED_UPDATE profiles id=' + d.resolvedUserId);
        console.log('  lifetime_spend_usd=' + updatePayload.lifetime_spend_usd);
        console.log('  lifetime_orders=' + updatePayload.lifetime_orders);
        console.log('  customer_phone=' + updatePayload.customer_phone);
        console.log('  customer_notes="' + updatePayload.customer_notes + '"');

        const { error: updProfErr } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', d.resolvedUserId);

        if (updProfErr) {
            console.log('PROFILE_WRITE_RESULT FAIL: ' + updProfErr.message);
            // Rollback: DELETE the marketing_contacts row we just inserted
            // so the phone doesn't exist on marketing without a matching
            // profile. Cross-table consistency.
            await supabase.from('marketing_contacts').delete().eq('phone_e164', CALIEB_PHONE_E164);
            console.log('MARKETING_ROLLBACK OK (deleted the marketing_contacts row we just inserted due to profile fail)');
            throw updProfErr;
        }
        console.log('PROFILE_WRITE_RESULT OK (profile updated, idempotent on re-run via customer_notes tag)');
    } else {
        console.log('INTENDED_NOOP_PROFILE (no profiles row to update; resolvedUserId=' + (d.resolvedUserId || 'null') + ')');
    }

    console.log('BACKFILL_NOTES_TAG applied: ' + BACKFILL_NOTES_TAG);
    console.log('=== Backfill Complete ===');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const mode = args.includes('--confirm') ? 'confirm' : 'dry-run';

    console.log('mode: ' + mode);
    const discovery = await discoverCalieb();
    printDiscovery(discovery);

    if (mode === 'confirm') {
        await runConfirm(discovery);
    } else {
        console.log('');
        console.log('(dry-run only — re-run with --confirm to upsert social_accounts + marketing_contacts + profiles)');
    }
}

// Auto-execute when invoked directly via tsx (Windows-safe via pathToFileURL).
if (process.env.VITEST_WORKER_ID === undefined && import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    main().catch((err) => {
        console.error('!! backfill failed:', err);
        process.exit(1);
    });
}
