// scripts/seedVerifiedCustomers.ts
// ----------------------------------------------------------------------------
// Mirrors scripts/seedSmsContact.ts structure but for verified past_customer
// / manual_seed contacts WITHOUT a phone number (operator-attributed via
// instagram handle, offline cash buyer, etc.).
//
// Each contact in VERIFIED_CUSTOMERS_TO_REGISTER gets a marketing_contacts
// row with `source` in VERIFIED_CUSTOMER_SOURCES
// (utils/marketingAudience.ts: 'manual_seed' | 'past_customer'), so the
// test-campaign guard in api/_handlers/marketing-send.ts automatically drops
// them from any campaign whose name contains "test" (case-insensitive).
//
// Why this is a separate script (not folded into scripts/seedSmsContact.ts):
//   * seedSmsContact.ts is for SMS opt-ins - it normalizes a phone number,
//     writes channel='sms', and pairs every insert with a
//     marketing_consent_log entry (the contact just opted in to SMS).
//   * This script is for offline-cash buyers, instagram-attributed
//     contacts, and any other verified-customer row that has no digital
//     opt-in. No phone, no consent log. The suppression is the entire
//     point; no consent narrative needs to be fabricated for audit.
//
// `source` choice:
//   * 'past_customer' - the right default for any verified buyer
//     associated with an order (this is what marketing-send.ts tags the
//     orders fetch with).
//   * 'manual_seed' - the operator's manual-override slot for buyers
//     they want to suppress without an order backing (e.g. someone who
//     DMed the shop asking to be added to the suppression list).
// Both keys are in VERIFIED_CUSTOMER_SOURCES so the test-campaign guard
// treats them identically. Pick whichever is more semantically accurate
// for each entry.
//
// Idempotent: looks up by metadata.instagram_username; insert-if-missing,
// never overwrites an existing contact's source/status (preserves opt-out
// state if the operator ever unsubscribes the contact).
// ----------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { VERIFIED_CUSTOMER_SOURCES } from '../utils/marketingAudience';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
    if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    console.error('Set them in .env (or .env.local) or export them before running:');
    console.error('  SUPABASE_URL=https://your-project.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    console.error('Note: VITE_SUPABASE_URL is accepted as a fallback for SUPABASE_URL, but');
    console.error('SUPABASE_SERVICE_ROLE_KEY is server-side only and has no VITE_* variant.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

// Verified buyers WITHOUT a phone number to register for the test-campaign
// guard. Add new entries here as offline cash sales / instagram-attributed
// contacts come in. `source` is constrained at the TYPE level via the
// `VerifiedSource` alias on the array type below (catches typos like
// 'pastcostumer' at compile time). The `isVerifiedCustomerSource()`
// runtime guard is purely defensive - it would only fire if the array
// type were widened or bypassed in a future refactor.
//
// `instagramUsername` lives in metadata (the marketing_contacts table does
// NOT have a dedicated instagram_username column today; if a future
// migration adds one, flip the lookup below to
// `eq('instagram_username', c.instagramUsername)` and the rest of this
// script is unchanged).
type VerifiedSource = (typeof VERIFIED_CUSTOMER_SOURCES)[number];

const VERIFIED_CUSTOMERS_TO_REGISTER: Array<{
    instagramUsername: string;
    customerName: string;
    source: VerifiedSource;
    notes: string;
}> = [
    {
        // @friiqy on Instagram (https://www.instagram.com/friiqy/) bought
        // the wholesale + the True Religion S1 jeans in two separate
        // offline cash deals. Same buyer across both rows, joined via
        // orders.instagram_username = 'friiqy' (the column added by
        // supabase/migrations/20260704_add_instagram_username_to_orders.sql).
        // `past_customer` is the right source because the orders
        // marketing-send.ts fetch already tags every order-derived
        // contact with `source: 'past_customer'`.
        instagramUsername: 'friiqy',
        customerName: 'Abingdon Customer', // privacy contract (no real name)
        source: 'past_customer',
        notes: 'Offline cash buyer: 7-wallet wholesale (2026-05-22, $175) + True Religion S1 jeans (2024-02-14, $140) + Denim Patchwork 1/1 jeans (2024-11-08, $140). Registered for test-campaign suppression.',
    },
];

function isVerifiedCustomerSource(source: string): boolean {
    return source === 'manual_seed' || source === 'past_customer';
}

async function seedVerifiedCustomers() {
    for (const contact of VERIFIED_CUSTOMERS_TO_REGISTER) {
        const handle = contact.instagramUsername;

        if (!isVerifiedCustomerSource(contact.source)) {
            console.error(`[@${handle}] source="${contact.source}" is NOT in VERIFIED_CUSTOMER_SOURCES. Refusing to insert - the test-campaign guard would NOT exclude this contact.`);
            console.error(`  Valid values: 'manual_seed' | 'past_customer' (see utils/marketingAudience.ts).`);
            continue;
        }

        // Look up by metadata.instagram_username so re-runs are idempotent
        // even if the row's email/phone changes (we don't store either
        // for these contacts, but the pattern is forward-compatible).
        const { data: existing, error: lookupError } = await supabase
            .from('marketing_contacts')
            .select('id, status, source, unsubscribed_at, metadata')
            .eq('metadata->>instagram_username', handle)
            .maybeSingle();

        if (lookupError) {
            console.error(`[@${handle}] Error looking up existing row:`, lookupError.message);
            continue;
        }

        if (existing) {
            console.log(`[@${handle}] Row already exists (id=${existing.id}, status=${existing.status}, source=${existing.source}, unsubscribed_at=${existing.unsubscribed_at || 'null'}).`);
            if (existing.source !== contact.source) {
                console.warn(`[@${handle}] WARNING: existing row has source="${existing.source}", expected "${contact.source}". Leaving it alone to preserve operator-set state.`);
            }
            if (existing.unsubscribed_at) {
                console.warn(`[@${handle}] WARNING: existing row is unsubscribed. Leaving it alone - this contact will not be reached by ANY campaign (test or production).`);
            }
            continue;
        }

        const { data: inserted, error: insertError } = await supabase
            .from('marketing_contacts')
            .insert({
                email: null,
                phone_e164: null,
                country_code: null,
                channel: 'email',
                source: contact.source,
                status: 'active',
                metadata: {
                    instagram_username: handle,
                    customer_name: contact.customerName,
                    seeded_via: 'scripts/seedVerifiedCustomers.ts',
                    seeded_at: new Date().toISOString(),
                    notes: contact.notes,
                },
            })
            .select('id, status, source')
            .single();

        if (insertError) {
            console.error(`[@${handle}] Error inserting row:`, insertError.message);
            continue;
        }

        console.log(`[@${handle}] Inserted verified-customer row: id=${inserted.id}, status=${inserted.status}, source=${inserted.source}.`);
        console.log(`[@${handle}] Now excluded from any campaign whose name contains "test" (case-insensitive).`);
    }

    console.log('\nDone. Verify in Supabase:');
    console.log("  SELECT id, status, source, metadata->>'instagram_username' AS instagram");
    console.log("  FROM marketing_contacts");
    console.log("  WHERE metadata->>'instagram_username' IS NOT NULL");
    console.log("  ORDER BY created_at DESC;");
}

seedVerifiedCustomers().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
