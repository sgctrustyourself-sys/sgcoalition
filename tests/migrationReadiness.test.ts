// tests/migrationReadiness.test.ts
//
// Structural readiness contract for the live Supabase migrations directory.
// Closes the manual-deploy drift class of bugs: previously, a new .sql file
// could land in supabase/migrations/ and ship in a release without being
// applied to the production database, leaving the frontend wired against a
// table that does not exist. (See the 2026-07-09 wishlist_shares incident:
// the frontend code shipped with the share button, but the table had to be
// applied manually via the Supabase SQL editor before the feature worked.)
//
// This test does NOT query the live database. Instead it locks the
// expectation that every .sql file in supabase/migrations/ is recorded in a
// checked-in operator-maintained manifest (supabase/APPLIED_MIGRATIONS.txt).
// The operator MUST append the filename to that manifest immediately after
// applying the migration to production -- same commit as the .sql file is
// the expected workflow.
//
// **Green CI = the migrations/ directory and the applied manifest agree.**
// It does NOT mean the migration is actually applied to prod -- that's a
// separate manual contract the operator owns. The inverse drift (file
// in manifest, never actually applied to prod) is NOT caught by this test;
// it is caught by the smoke-test + browser checks the deploy runbook
// requires before flipping a migration to "shipped".
//
// Run: `npx.cmd vitest run tests/migrationReadiness.test.ts`
//
// If any of these assertions fails, a new .sql file has landed in the
// directory without being applied to prod (or applied to prod without being
// recorded). Resolve the drift and re-run the test before merging.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = resolve(ROOT, 'supabase', 'migrations');

// Mirrors tests/paypalReadiness.test.ts > readText: takes a relative path
// from the repo root, resolves internally. Keeps the call sites readable
// and matches the codebase convention.
function readText(relativePath: string): string {
    return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

/**
 * Parses the operator-maintained applied-migrations manifest.
 *
 * Format:
 *   - One filename per line, exactly matching the .sql basename
 *   - Lines starting with `#` are comments (ignored)
 *   - Blank lines are ignored
 *   - Order does not matter (the test compares as sets, not arrays)
 *
 * Returns a Set<string> of the parsed filenames (NOT including path).
 * `nonSqlLines` collects any non-blank, non-comment line that does not end
 * in `.sql` -- defensive guard against manifest typos like a stray debug
 * line or a wrong-extension entry.
 *
 * NOTE: `.sql` is matched case-sensitively. On a case-insensitive dev
 * filesystem (macOS, Windows) a stray `Wishlist.SQL` would be picked up by
 * readdirSync but not match the manifest's lowercase entry -- the CI runner
 * is Linux so the failure surfaces there, not on the dev machine. Worth a
 * CI catch, not worth a code change.
 */
function parseAppliedManifest(text: string): { applied: Set<string>; nonSqlLines: string[] } {
    const applied = new Set<string>();
    const nonSqlLines: string[] = [];
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (line === '' || line.startsWith('#')) continue;
        if (!line.endsWith('.sql')) {
            nonSqlLines.push(line);
            continue;
        }
        applied.add(line);
    }
    return { applied, nonSqlLines };
}

function listMigrationFiles(): Set<string> {
    return new Set(
        readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort()
    );
}

describe('Supabase migrations readiness contract', () => {
    describe('Applied-manifest file', () => {
        it('exists at supabase/APPLIED_MIGRATIONS.txt', () => {
            // The manifest is the source of truth for "what migrations are
            // expected to have been applied to prod". A missing file means
            // the operator never initialized the tracking contract.
            expect(existsSync(resolve(ROOT, 'supabase/APPLIED_MIGRATIONS.txt'))).toBe(true);
        });

        it('has no non-blank, non-comment lines that do not end in .sql', () => {
            // Defensive guard against typos in the manifest like a stray
            // `wishlist_sahres.ts` (wrong extension) or a leftover debug
            // line. Only `.sql` filenames are valid entries.
            const text = readText('supabase/APPLIED_MIGRATIONS.txt');
            const { nonSqlLines } = parseAppliedManifest(text);
            expect(
                nonSqlLines,
                `supabase/APPLIED_MIGRATIONS.txt has ${nonSqlLines.length} line(s) that are not .sql filenames: ${JSON.stringify(nonSqlLines)}`
            ).toEqual([]);
        });
    });

    describe('Directory <-> manifest consistency', () => {
        it('every .sql file in supabase/migrations/ is listed in the applied manifest', () => {
            // Primary drift detector. A new .sql file in the directory that
            // is NOT in the manifest means either:
            //   (a) the migration has not been applied to prod yet, OR
            //   (b) the operator forgot to record it after applying.
            // Both are CI failures -- the deploy should not ship.
            const text = readText('supabase/APPLIED_MIGRATIONS.txt');
            const { applied } = parseAppliedManifest(text);
            const onDisk = listMigrationFiles();
            const missing = [...onDisk].filter((f) => !applied.has(f)).sort();

            expect(
                missing,
                `Found ${missing.length} .sql file(s) in supabase/migrations/ that are NOT listed in supabase/APPLIED_MIGRATIONS.txt.\n` +
                    `Likely cause: a new migration was added without being applied to prod and recorded in the manifest.\n` +
                    `Fix: apply the migration to the live Supabase instance, then append the filename to supabase/APPLIED_MIGRATIONS.txt in the same commit.\n` +
                    `Missing: ${JSON.stringify(missing)}`
            ).toEqual([]);
        });

        it('every filename in the applied manifest corresponds to a real .sql file', () => {
            // Reverse direction: catches manifest typos and stale entries
            // (e.g. a migration was deleted from the directory but the
            // manifest line was not removed). The set comparison would
            // pass for these because the same name is in both -- this case
            // specifically tests "manifest line that has no matching file".
            const text = readText('supabase/APPLIED_MIGRATIONS.txt');
            const { applied } = parseAppliedManifest(text);
            const onDisk = listMigrationFiles();
            const phantom = [...applied].filter((f) => !onDisk.has(f)).sort();

            expect(
                phantom,
                `Found ${phantom.length} filename(s) in supabase/APPLIED_MIGRATIONS.txt that do NOT exist in supabase/migrations/.\n` +
                    `Likely cause: a manifest line was left in place after the corresponding .sql file was deleted (stale entry), or the filename has a typo.\n` +
                    `Phantom: ${JSON.stringify(phantom)}`
            ).toEqual([]);
        });

        it('the manifest has no duplicate .sql filenames', () => {
            // Set-based parsing hides duplicates. This case explicitly
            // checks the raw line count vs the set size so a manifest
            // that lists `20260709_add_wishlist_shares.sql` twice (e.g.
            // from a copy-paste when appending) fails the readiness gate.
            const text = readText('supabase/APPLIED_MIGRATIONS.txt');
            const { applied } = parseAppliedManifest(text);
            const lines = text.split(/\r?\n/);
            const rawSqlLines = lines
                .map((l) => l.trim())
                .filter((l) => l !== '' && !l.startsWith('#') && l.endsWith('.sql'));

            expect(
                rawSqlLines.length,
                `supabase/APPLIED_MIGRATIONS.txt has ${rawSqlLines.length} .sql lines but only ${applied.size} unique filenames. The manifest contains a duplicate.`
            ).toBe(applied.size);
        });
    });

    describe('Sanity check', () => {
        // The two cases in 'Directory <-> manifest consistency' already
        // prove the counts are equal (subset in both directions implies
        // same-size). This block only asserts the non-zero guards, which
        // are the unique contribution: catches the "operator nuked the
        // file" case so a future wipe-and-rebuild cannot accidentally go
        // green. If this ever fires with zero rows, the operator likely
        // emptied the manifest by mistake; restore from git, do not just
        // delete this case.
        it('the manifest + the migrations/ directory have at least one entry', () => {
            const text = readText('supabase/APPLIED_MIGRATIONS.txt');
            const { applied } = parseAppliedManifest(text);
            const onDisk = listMigrationFiles();

            expect(applied.size).toBeGreaterThan(0);
            expect(onDisk.size).toBeGreaterThan(0);
        });
    });
});

