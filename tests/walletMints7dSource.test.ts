import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('walletMints7d realtime-driven count', () => {
    const home = read('pages/Home.tsx');
    const wallets = read('pages/Wallets.tsx');
    const ctx = read('context/AppContext.tsx');
    const view = read('supabase/migrations/20260721_create_wallet_mints_7d_view.sql');
    const pub  = read('supabase/migrations/20260721_publish_wallet_mints_7d_for_realtime.sql');
    const runner = read('scripts/applyWalletMints7dView.cjs');

    // Visible-surface assertions for Home + Wallets moved to tests/productionStateSource.test.ts (Home.tsx + Wallets.tsx now read productionState, not walletMints7d).
    describe('AppContext exposes walletMints7d on AppState', () => {
        it('declares the field on the AppState interface as number | null', () => {
            expect(ctx).toMatch(/walletMints7d:\s*number\s*\|\s*null\s*;/);
        });
        it('initialises the state with null (first paint = loading)', () => {
            expect(ctx).toMatch(/const\s*\[walletMints7d,\s*setWalletMints7d\]\s*=\s*useState<number\s*\|\s*null>\(null\);/);
        });
        it('exposes walletMints7d in the provider value object', () => {
            const providerStart = ctx.indexOf('<AppContext.Provider');
            expect(providerStart).toBeGreaterThan(-1);
            expect(ctx.slice(providerStart)).toMatch(/\bwalletMints7d\b/);
        });
        it('defines fetchWalletMints7d() that reads wallet_mints_7d', () => {
            expect(ctx).toMatch(/const\s+fetchWalletMints7d\s*=\s*async/);
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
            const all = ctx.match(/await\s+Promise\.all\(\[[^\]]*fetchWalletMints7d\(\)[^\]]*\]\)/);
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

    describe('Phase-2 publication SQL — direct-only', () => {
        it('adds the view to the supabase_realtime publication in a DO/EXCEPTION block (idempotent)', () => {
            expect(pub).toMatch(/ALTER\s+PUBLICATION\s+supabase_realtime\s+ADD\s+TABLE\s+public\.wallet_mints_7d/);
            expect(pub).toMatch(/DO\s+\$\$/);
            expect(pub).toMatch(/EXCEPTION/);
            expect(pub).toMatch(/duplicate_object/);
        });
        it('does NOT include CREATE OR REPLACE VIEW (must live in phase-1)', () => {
            expect(pub).not.toMatch(/CREATE\s+OR\s+REPLACE\s+VIEW/);
        });
    });

    describe('Two-phase runner', () => {
        it('reads both migration files', () => {
            expect(runner).toMatch(/20260721_create_wallet_mints_7d_view\.sql/);
            expect(runner).toMatch(/20260721_publish_wallet_mints_7d_for_realtime\.sql/);
        });
        it('tags candidates as direct=true / direct=false', () => {
            expect(runner).toMatch(/direct:\s*true/);
            expect(runner).toMatch(/direct:\s*false/);
        });
        it('phase-1 (view+grant) walks all candidates (pooler + direct)', () => {
            expect(runner).toMatch(/phase1Conn\s*=\s*all\.filter\(\s*c\s*=>\s*true\s*\)/);
        });
        it('phase-2 (publication) ONLY walks direct candidates', () => {
            expect(runner).toMatch(/phase2Conn\s*=\s*all\.filter\(\s*c\s*=>\s*c\.direct\s*\)/);
        });
        it('sniffs the user-supplied SUPABASE_DB_URL host for pooler', () => {
            // The runner must contain a regex literal that detects pooler URLs.
            // Loose substring check avoids exact regex-escape fragility.
            expect(runner).toContain('pooler');
            expect(runner).toContain('.supabase.com');
        });
    });
});
