import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('productionState realtime-driven shop-floor texture', () => {
    const home    = read('pages/Home.tsx');
    const wallets = read('pages/Wallets.tsx');
    const ctx     = read('context/AppContext.tsx');
    const table   = read('supabase/migrations/20260722_create_production_state_table.sql');
    const pub     = read('supabase/migrations/20260722_publish_production_state_for_realtime.sql');
    const runner  = read('scripts/applyProductionState.cjs');

    describe('Home.tsx renders the production-floor pair', () => {
        it('destructure pulls productionState (no longer walletMints7d)', () => {
            expect(home).toMatch(/const\s*\{[^}]*\bproductionState\b[^}]*\}\s*=\s*useApp\(\)/);
            const destructure = home.match(/const\s*\{[^}]*\}\s*=\s*useApp\(\)/)?.[0] ?? '';
            expect(destructure).not.toMatch(/orders/);
            expect(destructure).not.toMatch(/walletMints7d/);
        });
        it('renders the "Currently being built" line with workshop + drop sku + ISO timestamp', () => {
            expect(home).toContain('Currently being built');
            expect(home).toContain('productionState.currently_being_built_label');
            expect(home).toContain('productionState.last_drop_sku_label');
            expect(home).toContain('productionState.last_drop_at');
        });
        it('renders the "On deck" line with cylinder progress', () => {
            expect(home).toContain('On deck');
            expect(home).toContain('productionState.on_deck_label');
            expect(home).toContain('productionState.on_deck_cylinder_current');
            expect(home).toContain('productionState.on_deck_cylinder_total');
        });
        it('honors aria-live=polite on both lines', () => {
            const liveCount = (home.match(/aria-live="polite"/g) ?? []).length;
            expect(liveCount).toBeGreaterThanOrEqual(2);
        });
        it('does not contain the legacy weeklyWalletMints useMemo or productCategoryById', () => {
            expect(home).not.toMatch(/weeklyWalletMints/);
            expect(home).not.toMatch(/productCategoryById/);
        });
    });

    describe('Wallets.tsx renders the production-floor pair', () => {
        it('destructure pulls productionState (no longer walletMints7d)', () => {
            expect(wallets).toMatch(/const\s*\{[^}]*\bproductionState\b[^}]*\}\s*=\s*useApp\(\)/);
            const destructure = wallets.match(/const\s*\{[^}]*\}\s*=\s*useApp\(\)/)?.[0] ?? '';
            expect(destructure).not.toMatch(/orders/);
            expect(destructure).not.toMatch(/walletMints7d/);
        });
        it('renders the "Currently being built" line', () => {
            expect(wallets).toContain('Currently being built');
            expect(wallets).toContain('productionState.currently_being_built_label');
            expect(wallets).toContain('productionState.last_drop_sku_label');
            expect(wallets).toContain('productionState.last_drop_at');
        });
        it('renders the "On deck" line with cylinder progress', () => {
            expect(wallets).toContain('On deck');
            expect(wallets).toContain('productionState.on_deck_label');
            expect(wallets).toContain('productionState.on_deck_cylinder_current');
            expect(wallets).toContain('productionState.on_deck_cylinder_total');
        });
        it('aria-live=polite on both lines', () => {
            const liveCount = (wallets.match(/aria-live="polite"/g) ?? []).length;
            expect(liveCount).toBeGreaterThanOrEqual(2);
        });
        it('does not contain legacy useMemo aggregations', () => {
            expect(wallets).not.toMatch(/weeklyWalletMints/);
            expect(wallets).not.toMatch(/productCategoryById/);
        });
    });

    describe('AppContext exposes productionState on AppState', () => {
        it('declares the field as ProductionState | null', () => {
            expect(ctx).toMatch(/productionState:\s*ProductionState\s*\|\s*null\s*;/);
        });
        it('initialises the state with null on first paint', () => {
            expect(ctx).toMatch(/\[productionState,\s*setProductionState\]\s*=\s*useState<ProductionState\s*\|\s*null>\(null\);/);
        });
        it('defines fetchProductionState() that reads production_state', () => {
            expect(ctx).toMatch(/const\s+fetchProductionState\s*=\s*async/);
            expect(ctx).toMatch(/\.from\(['"]production_state['"]\)/);
            expect(ctx).toMatch(/currently_being_built_label[^,]*,\s*last_drop_at/);
        });
        it('subscribes to production_state realtime UPDATEs', () => {
            expect(ctx).toMatch(/channel\(['"]production_state_sync['"]\)/);
            expect(ctx).toMatch(/table:\s*['"]production_state['"]/);
            expect(ctx).toMatch(/setProductionState\(prev\s*=>\s*applyProductionStateUpdate/);
        });
        it('exports the Pure ProductionState interface', () => {
            expect(ctx).toMatch(/export\s+interface\s+ProductionState/);
            expect(ctx).toMatch(/currently_being_built_label:\s*string/);
            expect(ctx).toMatch(/last_drop_at:\s*string/);
            expect(ctx).toMatch(/on_deck_cylinder_current:\s*number/);
        });
        it('exports the pure applyProductionStateUpdate reducer', () => {
            expect(ctx).toMatch(/export\s+function\s+applyProductionStateUpdate/);
            // Reject malformed payloads on text fields
            expect(ctx).toMatch(/All five text fields must be non-empty/);
            expect(ctx).toMatch(/tot\s*<=\s*0[\s\S]*return\s*prev/);
        });
        it('includes fetchProductionState() in the initApp Promise.all', () => {
            const all = ctx.match(/await\s+Promise\.all\(\[[^\]]*fetchProductionState\(\)[^\]]*\]\)/);
            expect(all, 'Promise.all must include fetchProductionState()').toBeTruthy();
        });
        it('exposes productionState in the provider value object', () => {
            const providerStart = ctx.indexOf('<AppContext.Provider');
            expect(providerStart).toBeGreaterThan(-1);
            expect(ctx.slice(providerStart)).toMatch(/\bproductionState\b/);
        });
    });

    describe('Phase-1 table SQL', () => {
        it('CREATE TABLE IF NOT EXISTS for idempotency', () => {
            expect(table).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.production_state/);
        });
        it('singleton enforcement via CHECK (id = 1)', () => {
            expect(table).toMatch(/CONSTRAINT\s+production_state_singleton\s+CHECK\s+\(id\s*=\s*1\)/);
        });
        it('column types match the runner contract', () => {
            expect(table).toMatch(/currently_being_built_label\s+text\s+NOT\s+NULL/);
            expect(table).toMatch(/last_drop_at\s+timestamptz\s+NOT\s+NULL/);
            expect(table).toMatch(/last_drop_sku_label\s+text\s+NOT\s+NULL/);
            expect(table).toMatch(/on_deck_label\s+text\s+NOT\s+NULL/);
            expect(table).toMatch(/on_deck_cylinder_current\s+int\s+NOT\s+NULL/);
            expect(table).toMatch(/on_deck_cylinder_total\s+int\s+NOT\s+NULL/);
        });
        it('seed value matches the user example (Coalition Parts Wallet 2/4, cylinder 14 of 30)', () => {
            expect(table).toContain("'North Yard Stitching'");
            expect(table).toContain("'2026-07-19T14:32:00Z'");
            expect(table).toContain("'Coalition Parts Wallet 1/4'");
            expect(table).toContain("'Coalition Parts Wallet 2/4'");
            expect(table).toMatch(/14\s*,\s*\n\s*30/);
        });
        it('idempotent seeding via ON CONFLICT (id) DO NOTHING', () => {
            expect(table).toMatch(/ON\s+CONFLICT\s+\(id\)\s+DO\s+NOTHING/);
        });
        it('RLS enabled with public-read policy', () => {
            expect(table).toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
            // Policy name contains spaces: "production_state public read"
            expect(table).toMatch(/CREATE\s+POLICY\s+"production_state\s+public\s+read"/);
            expect(table).toMatch(/FOR\s+SELECT\s*\n\s*USING\s+\(\s*true\s*\)/);
        });
    });

    describe('Phase-2 publication SQL — direct-only', () => {
        it('adds the table to the supabase_realtime publication in a DO/EXCEPTION block (idempotent)', () => {
            expect(pub).toMatch(/ALTER\s+PUBLICATION\s+supabase_realtime\s+ADD\s+TABLE\s+public\.production_state/);
            expect(pub).toMatch(/DO\s+\$\$/);
            expect(pub).toMatch(/EXCEPTION/);
            expect(pub).toMatch(/duplicate_object/);
        });
        it('does NOT include CREATE TABLE IF NOT EXISTS (lives in phase-1)', () => {
            expect(pub).not.toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/);
        });
    });

    describe('Two-phase runner', () => {
        it('reads both migration files by YYYY-MM-DD prefix', () => {
            expect(runner).toContain('20260722_create_production_state_table.sql');
            expect(runner).toContain('20260722_publish_production_state_for_realtime.sql');
        });
        it('tags candidates as direct=true / direct=false', () => {
            expect(runner).toMatch(/direct:\s*true/);
            expect(runner).toMatch(/direct:\s*false/);
        });
        it('phase-1 (table + RLS + seed) walks all candidates (pooler + direct both covered)', () => {
            // The runner inlines the predicate as `all.filter(c => true)` — no
            // intermediate `phase1Conn =` variable. Loose regex anchored to
            // the filter call.
            expect(runner).toMatch(/all\.filter\(\s*c\s*=>\s*true\s*\)/);
        });
        it('phase-2 (publication) ONLY walks direct candidates', () => {
            expect(runner).toMatch(/all\.filter\(\s*c\s*=>\s*c\.direct\s*\)/);
        });
        it('sniffs the user-supplied SUPABASE_DB_URL host for pooler', () => {
            expect(runner).toContain('pooler');
            expect(runner).toContain('.supabase.com');
        });
    });
});
