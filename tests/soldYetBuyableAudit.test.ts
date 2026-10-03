// @vitest-environment node
// tests/soldYetBuyableAudit.test.ts
//
// Audit: find every product — any category — that has actually sold but is
// still listed as buyable, plus a dedicated listing of order lines whose
// product id no longer exists anywhere (orphans: offline sales, deleted
// SKUs, custom deposits). Orphans cannot be bought — no catalog row exists —
// so they are surfaced for review rather than failed.
// "Buyable" is the live `products` row — services/orderIntake.ts
// refuses a sale on `archived` alone and validates stock, so a row with
// archived=false and stock > 0 can still be purchased right now.
//
// Sale evidence, strongest first:
//   1. paid rows in the live `orders` table referencing the product
//   2. paid rows in INITIAL_ORDERS (offline/legacy sales)
//   3. an archiveNote in PRODUCT_LOCAL_OVERRIDES asserting the piece sold
//
// Three-tier output:
//   FLAGS    — hard violations: a paid sale (or sold_at, or archive prose)
//              against a row that can still be ordered. Fails the test.
//              Escalated from warnings: pending units >= remaining stock.
//   WARNINGS — unpaid pending cashapp/crypto orders on a well-stocked item,
//              and deliberate test SKUs (prod_checkout_test_dollar and kin
//              are meant to stay buyable — mirrors the marketing campaign
//              guard where a name containing "test" drops real customers).
//   ORPHANS  — order lines whose product id exists in neither the products
//              table nor the seed. Not buyable (no row to purchase), but
//              surfaced so deleted SKUs and offline sales stay visible.
//              Each orphan must carry a decision in ORPHAN_DECISIONS below —
//              an unreviewed orphan fails the audit.
//
// EXCLUDED from the default `vitest run` by self-gating on RUN_LIVE_AUDIT:
// this queries the live Supabase project and needs credentials in .env, and a
// config-level exclude would also block an explicit `vitest run <file>` (CLI
// --exclude appends to the config list). Run with:
//   RUN_LIVE_AUDIT=1 npx vitest run tests/soldYetBuyableAudit.test.ts
//
// Read-only: never writes to products or orders.

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { INITIAL_PRODUCTS } from '../constants/products';
import { PRODUCT_LOCAL_OVERRIDES, INITIAL_ORDERS } from '../constants';

const LIVE = Boolean(process.env.RUN_LIVE_AUDIT);

// Vitest gives us no setupFiles here, so load the repo .env by hand — the
// service role key is un-prefixed and therefore invisible to import.meta.env.
// Only when live: a default run must not inherit these into process.env.
if (LIVE) dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const supabaseUrl = LIVE
    ? (import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
    : undefined;
const supabaseKey = LIVE
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)
    : undefined;

type Row = {
    id: string; name: string | null; category: string | null;
    stock: number | null; size_inventory: Record<string, number> | null;
    archived: boolean | null; archived_at: string | null; sold_at: string | null;
};

type OrderRow = {
    id: string; order_number: string | null; payment_status: string | null;
    created_at: string | null; items: any;
};

/**
 * Units a customer could still buy from a product record.
 * Field names differ by source: live DB rows are snake_case (`size_inventory`),
 * seed rows are camelCase (`sizeInventory` — the Product type). Reading only
 * one casing made every seed row report 0 and produced a phantom "seed/live
 * drift" for Above as Below 1/1, Parts 3/4 and Ghost Riders — all three
 * actually agree at 1 unit. soldStateOwnership.test.ts reads camelCase.
 */
const sellableStock = (p: { stock?: number | null; size_inventory?: Record<string, number> | null; sizeInventory?: Record<string, number> | null }) => {
    const sizes = p.size_inventory ?? p.sizeInventory;
    const sum = Object.values(sizes || {}).reduce<number>((s, n) => s + Number(n || 0), 0);
    return sum > 0 ? sum : Number(p.stock || 0);
};

/** Archive prose that asserts the piece is gone. */
const SOLD_CLAIM = /\bhas sold\b|\bsold\b|given away|no longer (?:available|on record|for sale)/i;

/** Order items JSONB shifted shape over time — be liberal in what we accept. */
const itemProductId = (i: any) => String(i?.productId ?? i?.product_id ?? i?.id ?? '');
const itemQty = (i: any) => Number(i?.quantity ?? i?.qty ?? 1);

/**
 * Curated disposition for known orphan order lines, decided 2026-10-03 after
 * digging through orders, git history, scripts and README. "Intentionally
 * gone" means the order record IS the product's history — nothing to re-list.
 * A new orphan without an entry prints as UNREVIEWED and fails the audit, so
 * every orphan gets a decision instead of quietly accumulating.
 */
const ORPHAN_DECISIONS: Record<string, string> = {
    prod_wallet_004:
        'intentionally gone — Skyy Blue 2/2, sold in the May 2026 wholesale bundle (ORD-SG-WHOLESALE-1002; INITIAL_ORDERS public-md-wholesale-wallets-2026_05_22; tombstone in constants.ts; README Archived table)',
    Coalition_Denim_Patchwork_S1:
        'intentionally gone — 1/1 jeans, sold Nov 2024 via the @friiqy relationship (ORD-SG-DENIM-PATCH-S1-9003; scripts/upsertFriiqyDenimPatchwork.ts; tombstone in constants.ts; README Archived table)',
    prod_tee_distortion:
        'intentionally gone — paid PayPal order Feb 2026 (ORD-PP-8SN773); seed entry had no stock fields and was dropped by the 2026-07-10 admin sync; images survive in PRODUCT_IMAGE_URLS.distortionTee; README row moved to Archived. Re-list via admin ProductManager if physical units remain.',
    prod_travis_shirt_custom_deposit:
        'intentionally order-only — $40 custom commission deposit recorded by order TRAVIS-SHIRT-DEPOSIT-2026-07-25 (row verified by scripts/applyMigrationsSql.ts); never a catalog product',
};

describe.runIf(LIVE)('catalog audit: sold products must not be buyable', () => {
    it('finds no product with sale evidence that can still be bought, and surfaces orphan order lines', async () => {
        expect(supabaseUrl, 'run this from the repo root with .env loaded').toBeTruthy();
        expect(supabaseKey, 'service role key required to read orders').toBeTruthy();
        const sb = createClient(supabaseUrl!, supabaseKey!);

        const { data: products, error: pErr } = await sb
            .from('products')
            .select('id,name,category,price,stock,size_inventory,archived,archived_at,sold_at');
        expect(pErr?.message ?? null).toBeNull();

        const { data: orders, error: oErr } = await sb
            .from('orders')
            .select('id,order_number,payment_status,created_at,items');
        expect(oErr?.message ?? null).toBeNull();

        // --- live order evidence -------------------------------------------
        const paidUnits = new Map<string, number>();
        const pendingUnits = new Map<string, number>();
        const statusCounts = new Map<string, number>();
        for (const o of (orders || []) as OrderRow[]) {
            const st = String(o.payment_status ?? 'null');
            statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
            const items = Array.isArray(o.items) ? o.items : [];
            for (const it of items) {
                const pid = itemProductId(it);
                if (!pid) continue;
                const qty = itemQty(it);
                if (st === 'paid') paidUnits.set(pid, (paidUnits.get(pid) || 0) + qty);
                else if (st === 'pending') pendingUnits.set(pid, (pendingUnits.get(pid) || 0) + qty);
            }
        }

        // --- local order evidence (INITIAL_ORDERS) -------------------------
        const localPaid = new Map<string, number>();
        for (const o of INITIAL_ORDERS as any[]) {
            if (o.paymentStatus !== 'paid') continue;
            for (const it of o.items || []) {
                const pid = String(it.productId || '');
                if (pid) localPaid.set(pid, (localPaid.get(pid) || 0) + Number(it.quantity || 1));
            }
        }

        // --- union of ALL catalog rows: live table + seed ------------------
        const seedById = new Map(INITIAL_PRODUCTS.map((p: any) => [String(p.id), p]));
        const liveById = new Map((products || []).map((p: any) => [String(p.id), p]));
        const productIds = [...new Set([...liveById.keys(), ...seedById.keys()])];

        console.log(`orders rows: ${(orders || []).length}  statuses: ${[...statusCounts].map(([k, v]) => `${k}=${v}`).join(' ')}`);
        console.log(`products inspected: ${productIds.length} (live ${liveById.size} + seed ${seedById.size})\n`);

        // Every order line, so a product hiding under an unrecognized id shape
        // (or a product id that no longer exists) is visible instead of silently
        // skipped by the aggregation above.
        const knownIds = new Set([...liveById.keys(), ...seedById.keys()]);
        const orphans: string[] = [];
        let parsedLines = 0;
        console.log('--- order lines (id | status | productId | name | qty) ---');
        for (const o of (orders || []) as OrderRow[]) {
            const items = Array.isArray(o.items) ? o.items : [];
            if (!items.length) { console.log(`${o.order_number || o.id} | ${o.payment_status} | (no items parsed)`); continue; }
            for (const it of items) {
                parsedLines++;
                const pid = itemProductId(it);
                const nm = it?.productName ?? it?.name ?? '';
                const missing = !pid;
                const unknown = !!pid && !knownIds.has(pid);
                const tag = missing ? '  <== NO PRODUCT ID' : unknown ? '  <== ORPHAN (id not in catalog)' : '';
                console.log(`${o.order_number || o.id} | ${o.payment_status} | ${pid || '?'} | ${nm} | ${itemQty(it)}${tag}`);
                if (missing || unknown) {
                    const key = pid || `order:${o.order_number || o.id}`;
                    const decision = ORPHAN_DECISIONS[key]
                        ?? 'UNREVIEWED — investigate (orders, git history, scripts), then document the decision in ORPHAN_DECISIONS';
                    orphans.push(`${String(o.payment_status ?? '?').padEnd(7)} ${o.order_number || o.id} — ${pid || '(no product id)'} — "${nm}" ×${itemQty(it)} — ${decision}`);
                }
            }
        }
        console.log('');

        const header = ['product', 'cat', 'live arch/stock', 'seed arch/stock', 'paid', 'pend', 'loc', 'note'];
        const rows: string[][] = [];
        const flags: string[] = [];
        const warnings: string[] = [];

        for (const id of productIds.sort()) {
            const live = liveById.get(id) as Row | undefined;
            const seed = seedById.get(id) as any;
            const note = String((PRODUCT_LOCAL_OVERRIDES as any)[id]?.archiveNote || '');
            const liveStock = live ? sellableStock(live as any) : null;
            const seedStock = seed ? sellableStock(seed) : null;
            const liveBuyable = !!live && !live.archived && (liveStock ?? 0) > 0;
            const seedBuyable = !!seed && !seed.archived && (seedStock ?? 0) > 0;
            const paid = paidUnits.get(id) || 0;
            const pend = pendingUnits.get(id) || 0;
            const loc = localPaid.get(id) || 0;
            const claim = SOLD_CLAIM.test(note);

            rows.push([
                String(live?.name || seed?.name || id).slice(0, 44),
                String(live?.category || seed?.category || '—').slice(0, 10),
                live ? `${live.archived ? 'Y' : 'n'}/${liveStock}` : '—',
                seed ? `${seed.archived ? 'Y' : 'n'}/${seedStock}` : '—',
                String(paid), String(pend), String(loc),
                note ? (claim ? 'SOLD' : 'yes') : '',
            ]);

            // Direct contradiction first: the row itself says sold.
            if (live && live.sold_at && !live.archived) {
                flags.push(`SOLD_AT, NOT ARCHIVED  ${id} (${live.name}) — sold_at=${live.sold_at} but archived=false stock=${liveStock}`);
            }
            const evidence = paid > 0 || loc > 0 || claim;
            // Test SKUs are meant to survive purchases — see header.
            const isTestSku = /test/i.test(id) || /test/i.test(String(live?.name || seed?.name || ''));
            if (liveBuyable && evidence) {
                const why = [
                    paid > 0 ? `${paid} paid live order unit(s)` : '',
                    loc > 0 ? `${loc} paid INITIAL_ORDERS unit(s)` : '',
                    claim ? 'archiveNote asserts sold' : '',
                ].filter(Boolean).join(' + ');
                const msg = `BUYABLE BUT SOLD  ${id} (${live?.name}) — live row archived=false stock=${liveStock}; evidence: ${why}`;
                if (isTestSku) warnings.push(`test sku, expected to stay buyable — ${msg}`);
                else flags.push(msg);
            }
            if (!live && seedBuyable && evidence) {
                flags.push(`SEED-ONLY BUYABLE ${id} (${seed?.name}) — no live row, seed archived=false stock=${seedStock}, evidence exists`);
            }
            if (liveBuyable && seed && !seedBuyable && seed.archived) {
                flags.push(`SEED/LIVE DRIFT   ${id} (${live?.name}) — seed says archived, live row says buyable`);
            }
            if (pend > 0 && liveBuyable) {
                const msg = `PENDING ORDER     ${id} (${live?.name}) — ${pend} unit(s) in pending cashapp/crypto order(s) while still buyable (stock ${liveStock})`;
                // Unpaid orders are not sales — unless they already cover every
                // remaining unit, at which point paying them double-sells.
                if (pend >= (liveStock ?? 0)) flags.push(`${msg} — pending units cover ALL remaining stock`);
                else warnings.push(msg);
            }
        }

        const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
        const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join('  ');
        console.log(line(header));
        console.log(widths.map(w => '-'.repeat(w)).join('  '));
        for (const r of rows) console.log(line(r));

        console.log(`\n=== ORPHAN ORDER LINES (${orphans.length}) — product id absent from products table and seed ===`);
        for (const o of orphans) console.log('~ ' + o);
        console.log('  (not buyable — no catalog row exists to purchase — surfaced for review)');

        console.log(`\n=== WARNINGS (${warnings.length}) — review, does not fail ===`);
        for (const w of warnings) console.log('~ ' + w);

        console.log(`\n=== FLAGS (${flags.length}) ===`);
        for (const f of flags) console.log('! ' + f);

        expect(parsedLines, 'the order-line dump must actually have parsed lines').toBeGreaterThan(0);
        const unreviewed = orphans.filter(l => l.includes('UNREVIEWED'));
        expect(unreviewed, 'every orphan order line needs a documented decision in ORPHAN_DECISIONS').toEqual([]);
        expect(flags, 'products with sale evidence must be unsellable').toEqual([]);
    }, 60_000);
});
