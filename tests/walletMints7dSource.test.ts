import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('walletMints7d realtime-driven count', () => {
    const home = read('pages/Home.tsx');
    const wallets = read('pages/Wallets.tsx');
    const ctx = read('context/useWallets.ts');
    const appCtx = read('context/AppContext.tsx');
    const view = read('supabase/migrations/20260721_create_wallet_mints_7d_view.sql');
    // The original phase-2 plan (publish the VIEW) is impossible — Postgres
    // rejects views in publications on every version. It was replaced by a
    // materialized singleton TABLE kept fresh by a trigger on orders, which
    // IS publishable. The .deferred manifest documents the deletion.
    const materialized = read('supabase/migrations/20260812_materialize_wallet_mints_7d_for_realtime.sql');
    const deferred = read('supabase/migrations/.deferred');

    // Visible-surface assertions for Home + Wallets moved to tests/productionStateSource.test.ts (Home.tsx + Wallets.tsx now read productionState, not walletMints7d).
    describe('useWallets exposes walletMints7d', () => {
        it('declares the field on the AppState interface as number | null', () => {
            expect(appCtx).toMatch(/walletMints7d:\s*number\s*\|\s*null\s*;/);
        });
        it('initialises the state with null (first paint = loading)', () => {
            expect(ctx).toMatch(/const\s*\[walletMints7d,\s*setWalletMints7d\]\s*=\s*useState<number\s*\|\s*null>\(null\);/);
        });
        it('exposes walletMints7d in the provider value object', () => {
            const providerStart = appCtx.indexOf('<AppContext.Provider');
            expect(providerStart).toBeGreaterThan(-1);
            expect(appCtx.slice(providerStart)).toMatch(/\bwalletMints7d\b/);
        });
        it('defines fetchWalletMints7d() that reads wallet_mints_7d', () => {
            expect(ctx).toMatch(/const\s+fetchWalletMints7d\s*=\s*useCallback/);
            expect(ctx).toMatch(/\.from\(['"]wallet_mints_7d['"]\)/);
            expect(ctx).toMatch(/\.select\(['"]mint_count['"]\)/);
        });
        it('subscribes to wallet_mints_7d realtime updates', () => {
            expect(ctx).toMatch(/channel\(['"]wallet_mints_7d_sync['"]\)/);
            expect(ctx).toMatch(/table:\s*['"]wallet_mints_7d['"]/);
            expect(ctx).toMatch(/payload\?\.new\?\.mint_count/);
        });
        it('exports the pure applyWalletMintsUpdate reducer (the SLA contract)', () => {
            expect(ctx).toMatch(/export\s+function\s+applyWalletMintsUpdate/);
            expect(ctx).toMatch(/setWalletMints7d\(prev\s*=>\s*applyWalletMintsUpdate/);
        });
        it('guards the realtime payload against empty / NaN (no silent-0 flicker)', () => {
            expect(ctx).toMatch(/Number\.isFinite/);
        });
        it('includes fetchWalletMints7d in the initApp Promise.all', () => {
            const all = appCtx.match(/await\s+Promise\.all\(\[[^\]]*fetchWalletMints7d\(\)[^\]]*\]\)/);
            expect(all, 'Promise.all must include fetchWalletMints7d()').toBeTruthy();
        });
    });

    describe('Phase-1 view SQL — pooler-compatible', () => {
        it('uses CREATE OR REPLACE VIEW for idempotency', () => {
            expect(view).toMatch(/CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.wallet_mints_7d/);
        });
        it('returns the mint_count scalar in one row', () => {
            expect(view).toMatch(/SELECT[\s\S]+mint_count[\s\S]+FROM\s+public\.orders/);
        });
        it('filters to paid orders within the last 7 days', () => {
            expect(view).toMatch(/payment_status\s*=\s*'paid'/);
            expect(view).toMatch(/created_at\s*>=\s*\(\s*NOW\(\)\s*-\s*INTERVAL\s+'7\s*days'\s*\)/);
        });
        it('joins orders.items JSON to products to filter category = wallet', () => {
            expect(view).toMatch(/jsonb_array_elements/);
            expect(view).toMatch(/JOIN\s+public\.products/);
            expect(view).toMatch(/p\.category\s*=\s*'wallet'/);
        });
        it('grants SELECT to anon + authenticated (public read)', () => {
            expect(view).toMatch(/GRANT\s+SELECT\s+ON\s+public\.wallet_mints_7d\s+TO\s+anon,\s*authenticated/);
        });
        it('does NOT include ALTER PUBLICATION ... ADD TABLE (must be direct-only)', () => {
            // The view file may MENTION ALTER PUBLICATION in a comment explaining
            // why it's split out. What it must NOT contain is the actual SQL
            // that adds it to a publication, which is `ALTER PUBLICATION ... ADD TABLE`.
            expect(view).not.toMatch(/ALTER\s+PUBLICATION\s+\w+\s+ADD\s+TABLE/);
        });
    });

    describe('Materialized realtime table — 20260812 (replaces the impossible view publication)', () => {
        it('drops the view before creating the table (same-name conflict)', () => {
            expect(materialized).toMatch(/DROP\s+VIEW\s+IF\s+EXISTS\s+public\.wallet_mints_7d/);
        });
        it('creates a singleton TABLE with the mint_count scalar (same read shape as the view)', () => {
            expect(materialized).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.wallet_mints_7d/);
            expect(materialized).toMatch(/mint_count\s+bigint\s+NOT\s+NULL/);
            expect(materialized).toMatch(/CHECK\s*\(\s*id\s*=\s*1\s*\)/);
        });
        it('keeps the paid/7-days/wallet filter via a trigger-maintained refresh function', () => {
            expect(materialized).toMatch(/refresh_wallet_mints_7d/);
            expect(materialized).toMatch(/payment_status\s*=\s*'paid'/);
            expect(materialized).toMatch(/INTERVAL\s+'7\s*days'/);
            expect(materialized).toMatch(/p\.category\s*=\s*'wallet'/);
        });
        it('wires the trigger on orders so every order change recomputes the count', () => {
            expect(materialized).toMatch(/CREATE\s+TRIGGER\s+trg_wallet_mints_7d_refresh/);
            expect(materialized).toMatch(/AFTER\s+INSERT\s+OR\s+UPDATE\s+OR\s+DELETE\s+ON\s+public\.orders/);
        });
        it('grants SELECT to anon + authenticated (public read, same as the view)', () => {
            expect(materialized).toMatch(/GRANT\s+SELECT\s+ON\s+public\.wallet_mints_7d\s+TO\s+anon,\s*authenticated/);
        });
        it('publishes the TABLE (not a view) idempotently in a DO/EXCEPTION block', () => {
            expect(materialized).toMatch(/ALTER\s+PUBLICATION\s+supabase_realtime\s+ADD\s+TABLE\s+public\.wallet_mints_7d/);
            expect(materialized).toMatch(/DO\s+\$\$/);
            expect(materialized).toMatch(/EXCEPTION/);
            expect(materialized).toMatch(/duplicate_object/);
        });
        it('documents why the view publication was deleted in the .deferred manifest', () => {
            expect(deferred).toContain('20260812_materialize_wallet_mints_7d');
            expect(deferred).toContain('cannot add relation');
        });
    });
});
