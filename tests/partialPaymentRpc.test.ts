// tests/partialPaymentRpc.test.ts
//
// Locks every `INSERT INTO profiles` in the migrations tree to the shape the
// live `profiles` table actually has: keyed by `id` alone.
//
// The regression this pins: 20260730_create_payments_table.sql wrote
//   INSERT INTO profiles (id, user_id, lifetime_spend_usd) ...
// but the live table has no `user_id` column, so every call to
// record_partial_payment failed at runtime with
//   column "user_id" of relation "profiles" does not exist
// — discovered 2026-10-03 when resolving the Travis deposit order. The admin
// partial-payment flow (PaymentRecordModal > recordPartialPayment) was dead
// until then, failing only at the moment money was being recorded. Its
// sibling reconcile_balance_payment has always used (id, lifetime_spend_usd)
// and worked — the two functions were written from the same intent but not
// the same schema.
//
// SQL never runs in tests (no database here), so the guard reads the source:
// if a future migration inserts into profiles with different columns, this
// fails and forces the author to confirm those columns exist live before
// shipping a function that only breaks when an admin uses it.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations');

/** Every `INSERT INTO profiles (...)` across the migrations tree. */
const profileInserts = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .flatMap((file) => {
        const src = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        return [...src.matchAll(/INSERT INTO profiles \(([^)]*)\)/g)].map((m) => ({
            file,
            columns: m[1].replace(/\s+/g, ' ').trim(),
        }));
    });

describe('migration profile upserts match the live profiles schema', () => {
    it('finds the known RPC upserts, so the matcher itself is proven', () => {
        expect(profileInserts.length).toBeGreaterThanOrEqual(2);
        expect(profileInserts.map((p) => p.file)).toContain('20260730_create_payments_table.sql');
        expect(profileInserts.map((p) => p.file)).toContain('20260730_create_reconcile_balance_payment.sql');
    });

    it('inserts only (id, lifetime_spend_usd) — the columns the live table has', () => {
        for (const { file, columns } of profileInserts) {
            expect(
                columns,
                `${file} inserts (${columns}) into profiles — the live table is keyed by id alone ` +
                    '(no user_id); a divergent INSERT only fails when the function is called at runtime',
            ).toBe('id, lifetime_spend_usd');
        }
    });
});
