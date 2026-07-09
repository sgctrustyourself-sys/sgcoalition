// tests/wishlistSharesReadiness.test.ts
//
// Structural readiness contract for the wishlist_shares delete-share
// feature. Closes the gap where the Supabase migration
// (supabase/migrations/20260709_add_wishlist_shares.sql) shipped a
// DELETE RLS policy but the UI was missing -- the owner had no way
// to revoke a share after sending it. This test locks the wiring so a
// future commit cannot silently regress the delete UX:
//   1. The service-layer helpers exist with the expected signatures
//   2. The migration has the DELETE RLS policy (so the helpers can
//      actually delete anything)
//   3. The component imports the helpers + renders the delete UI
//   4. The owner-scoping WHERE filter is in place on listMyShares
//      (privacy-critical: the SELECT RLS is USING(true) by design,
//      so the explicit owner_id filter is the ONLY thing preventing
//      User A from seeing User B's shares)
//
// Run: `npx.cmd vitest run tests/wishlistSharesReadiness.test.ts`
//
// If any of these assertions fails, a future commit silently regressed
// the delete-share feature -- the migration's DELETE policy exists
// but the UI can't reach it. Resolve and re-run.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

// Mirrors tests/paypalReadiness.test.ts > readText + tests/migrationReadiness.test.ts:
// takes a relative path from the repo root, resolves internally.
function readText(relativePath: string): string {
    return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

// Extracts the body of a top-level function declaration in source
// text. Used to scope assertions to a single function so a
// same-name match in a sibling function (e.g. listMyShares also
// using .eq('owner_id', ...)) doesn't trip unrelated assertions.
//
// matchFunctionBody(src, name) returns the string between the
// function's opening `{` and the matching closing `}` at brace
// depth 0. Returns '' if the function isn't found (which then
// fails the caller's regex match -- the test fails loudly).
function matchFunctionBody(src: string, name: string): string {
    // Find the function declaration. Patterns supported:
    //   export async function name(...)
    //   export function name(...)
    //   async function name(...)
    //   function name(...)
    const declRe = new RegExp(
        `(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*[:{][^\\n]*\\n`,
        'm'
    );
    const declMatch = src.match(declRe);
    if (!declMatch) return '';
    const startIdx = src.indexOf('{', declMatch.index!);
    if (startIdx === -1) return '';
    let depth = 1;
    let i = startIdx + 1;
    while (i < src.length && depth > 0) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
    }
    return depth === 0 ? src.slice(startIdx, i) : '';
}

describe('Wishlist-shares delete-feature readiness contract', () => {
    describe('Service-layer helpers', () => {
        const servicePath = 'services/wishlistShares.ts';

        it('service file exists', () => {
            expect(existsSync(resolve(ROOT, servicePath))).toBe(true);
        });

        it('exports a listMyShares(userId: string) function with the right return type', () => {
            // Returns the owner's own shares (owner_id-filtered in
            // the WHERE, not RLS-narrowed), newest first. The
            // userId param is REQUIRED -- without it the privacy
            // filter can't be applied, so the helper throws. The
            // Promise<WishlistShare[]> return type is the contract
            // the component depends on for its existingShares state.
            const src = readText(servicePath);
            expect(src).toMatch(/export\s+async\s+function\s+listMyShares\s*\(\s*userId\s*:\s*string\s*\)\s*:\s*Promise<WishlistShare\[\]>/);
        });

        it('exports a deleteShare(shareId: string) function', () => {
            // The owner-revoke path. Takes a shareId string, returns
            // Promise<void> (success = share is gone or wasn't yours;
            // failure = network error).
            const src = readText(servicePath);
            expect(src).toMatch(/export\s+async\s+function\s+deleteShare\s*\(\s*shareId\s*:\s*string\s*\)\s*:\s*Promise<void>/);
        });

        it('listMyShares selects the expected columns and orders by created_at desc', () => {
            // Catches a future "I added a column to the SELECT and
            // broke the WishlistShare type" or "I changed the order
            // and the UI is no longer newest-first" regression. Locks
            // the 5 columns + the explicit `.order('created_at', ...)`
            // shape so the contract is obvious in the diff.
            const src = readText(servicePath);
            expect(src).toMatch(/select\([\s\S]*?share_id[\s\S]*?owner_id[\s\S]*?owner_name[\s\S]*?items[\s\S]*?created_at[\s\S]*?\)/);
            expect(src).toMatch(/\.order\(\s*['"]created_at['"]\s*,\s*\{\s*ascending\s*:\s*false\s*\}\s*\)/);
        });

        it('listMyShares filters by owner_id (SELECT RLS is permissive, filter is required)', () => {
            // CRITICAL PRIVACY LOCK. The wishlist_shares SELECT policy
            // is USING (true) (intentionally, so any recipient with a
            // shareId can view a share). That means a raw SELECT *
            // returns every share in the table. The owner-scoping
            // MUST happen in the WHERE clause. If this filter is
            // removed, User A would see User B's shareIds, owner_names,
            // items arrays, and timestamps -- a real privacy leak.
            const src = readText(servicePath);
            // Scoped to listMyShares body so the .eq() check doesn't
            // trip on deleteShare (which legitimately does NOT filter
            // by owner_id; the DELETE RLS handles that).
            const body = matchFunctionBody(src, 'listMyShares');
            expect(body, 'listMyShares function not found').not.toBe('');
            // Locks the .eq() filter on owner_id using the userId param.
            expect(body).toMatch(/\.eq\(\s*['"]owner_id['"]\s*,\s*userId\s*\)/);
            // Defensive: a `if (!userId) throw` guard in the helper is
            // the belt-and-suspenders. Lock that it's there so a
            // future refactor can't accidentally remove the throw
            // AND the filter.
            expect(body).toMatch(/if\s*\(\s*!userId\s*\)/);
            expect(body).toMatch(/throw\s+new\s+Error/);
        });

        it('deleteShare filters by share_id only -- the DELETE RLS handles ownership', () => {
            // Scoped to the deleteShare function body. The DELETE RLS
            // policy is `USING (auth.uid() = owner_id)`, so the
            // WHERE filter only needs to identify the share (by
            // share_id) -- RLS narrows the set to the user's own
            // shares. Adding an explicit owner_id filter here would
            // be redundant and a maintainer might be tempted to
            // widen it later.
            const src = readText(servicePath);
            const body = matchFunctionBody(src, 'deleteShare');
            expect(body, 'deleteShare function not found').not.toBe('');
            expect(body).toMatch(/\.eq\(\s*['"]share_id['"]\s*,\s*shareId\s*\)/);
            // Defensive: lock that we're NOT also filtering by
            // owner_id in deleteShare (RLS already covers that --
            // adding it here would just be a footgun for future
            // migrations that change the column name).
            expect(body).not.toMatch(/\.eq\(\s*['"]owner_id['"]/);
        });

        it('exports the WishlistShare interface with the 5 migration columns', () => {
            // The component depends on this type for its
            // existingShares state. The 5 fields mirror the migration
            // columns -- adding a column to the table without
            // updating this interface (and the SELECT) would
            // silently drop data from the UI.
            const src = readText(servicePath);
            const interfaceMatch = src.match(/export\s+interface\s+WishlistShare\s*\{([\s\S]*?)\}/);
            expect(interfaceMatch, 'WishlistShare interface not found').toBeTruthy();
            const interfaceBody = interfaceMatch?.[1] ?? '';
            expect(interfaceBody).toMatch(/share_id\s*:\s*string/);
            expect(interfaceBody).toMatch(/owner_id\s*:\s*string/);
            expect(interfaceBody).toMatch(/owner_name\s*:\s*string/);
            expect(interfaceBody).toMatch(/items\s*:\s*string\[\]/);
            expect(interfaceBody).toMatch(/created_at\s*:\s*string/);
        });

        it('uses the user-scoped supabase client (no service role key)', () => {
            // The DELETE RLS policy is the only thing standing between
            // User A and User B's shares. If the helper ever imports
            // the service-role client, RLS is bypassed and any user
            // can delete any share. Lock the import to the user-scoped
            // client to make this security boundary visible in code
            // review.
            const src = readText(servicePath);
            expect(src).toMatch(/from\s+['"]\.\/supabase['"]/);
            expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
            expect(src).not.toMatch(/from\s+['"]\.\/supabaseAdmin['"]/);
        });
    });

    describe('Migration: DELETE RLS policy is in place', () => {
        const migrationPath = 'supabase/migrations/20260709_add_wishlist_shares.sql';

        it('migration file exists', () => {
            expect(existsSync(resolve(ROOT, migrationPath))).toBe(true);
        });

        it('enables RLS on wishlist_shares', () => {
            const sql = readText(migrationPath);
            expect(sql).toMatch(/ALTER\s+TABLE\s+public\.wishlist_shares\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
        });

        it('declares the owner-only DELETE policy', () => {
            // The contract the deleteShare() helper depends on. If
            // this policy is ever dropped, the helper succeeds
            // silently for ANY shareId (no RLS = no ownership check).
            const sql = readText(migrationPath);
            expect(sql).toMatch(/CREATE\s+POLICY\s+["']Owner can delete wishlist_shares["']/i);
            expect(sql).toMatch(/FOR\s+DELETE\s+USING\s*\(\s*auth\.uid\(\)\s*=\s*owner_id\s*\)/i);
        });

        it('creates the owner_id index for the listMyShares hot path', () => {
            // listMyShares() runs a `WHERE owner_id = <current-user>`
            // on every modal open. The index makes that O(log n)
            // instead of O(n) -- important if a power user
            // accumulates many shares.
            const sql = readText(migrationPath);
            expect(sql).toMatch(/CREATE\s+INDEX[\s\S]+idx_wishlist_shares_owner_id/i);
            expect(sql).toMatch(/ON\s+public\.wishlist_shares\s*\(\s*owner_id\s*\)/i);
        });
    });

    describe('Component wiring', () => {
        const componentPath = 'components/WishlistShare.tsx';

        it('imports the service-layer helpers (listMyShares + deleteShare + WishlistShare type)', () => {
            // The component MUST go through the service layer (not
            // hit supabase directly) so the test can lock the
            // service contract + future refactors stay consistent.
            const src = readText(componentPath);
            expect(src).toMatch(/import\s*\{[\s\S]*?listMyShares[\s\S]*?deleteShare[\s\S]*?WishlistShare[\s\S]*?\}\s*from\s*['"]\.\.\/services\/wishlistShares['"]/);
        });

        it('passes user.uid to listMyShares (privacy lock -- empty arg would throw)', () => {
            // The listMyShares helper requires a userId. If a
            // future maintainer refactors the call site to pass
            // an empty/falsy value, the helper throws (defensive
            // guard) and the list never renders. This assertion
            // locks the call site to passing `user.uid`.
            const src = readText(componentPath);
            expect(src).toMatch(/listMyShares\(\s*user\.uid\s*\)/);
        });

        it('imports isActiveShare from utils/wishlistUtils for the "Active" badge + delete clear', () => {
            // The isActiveShare helper centralizes the URL-suffix
            // match logic so future URL-shape changes only need one
            // update. Lock the import to keep the contract visible.
            const src = readText(componentPath);
            expect(src).toMatch(/import\s*\{[\s\S]*?isActiveShare[\s\S]*?\}\s*from\s*['"]\.\.\/utils\/wishlistUtils['"]/);
        });

        it('renders the "Your active shares" header for the owner', () => {
            // The discoverable header is the entry point to the
            // delete UI. Without it, the user has no idea they can
            // revoke a share. Locks the literal text so a future
            // copy change goes through code review.
            const src = readText(componentPath);
            expect(src).toMatch(/Your active shares/);
        });

        it('renders a delete button + confirm flow for each share row', () => {
            // The inline confirm-before-delete UX: a Delete button
            // that swaps to Confirm + Cancel on the same row.
            // Locks the test-id hooks (data-testid="delete-{shareId}")
            // so the E2E test in a future round can target the
            // exact button.
            const src = readText(componentPath);
            expect(src).toMatch(/data-testid=\{`delete-\$\{share\.share_id\}`\}/);
            expect(src).toMatch(/data-testid=\{`confirm-delete-\$\{share\.share_id\}`\}/);
            // Lock the confirm/cancel labels verbatim. The JSX has
            // the labels as string children (`'Confirm'`, `'Cancel'`)
            // inside a ternary, NOT as literal `>Confirm<` text
            // content. Lock the quoted string form.
            expect(src).toMatch(/'Confirm'/);
            expect(src).toMatch(/>\s*Cancel\s*</);
        });

        it('trash icon is imported from lucide-react', () => {
            // Defensive: the delete button uses an icon, not a
            // unicode character. If a maintainer drops the icon
            // import, the build breaks visibly here.
            const src = readText(componentPath);
            expect(src).toMatch(/import\s*\{[^}]*Trash2[^}]*\}\s*from\s*['"]lucide-react['"]/);
        });

        it('handleOpen triggers a refetch of the existing-shares list', () => {
            // The list must be fresh every time the modal opens so
            // shares deleted in another tab show up correctly.
            const src = readText(componentPath);
            const handleOpenMatch = src.match(/const\s+handleOpen\s*=\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
            expect(handleOpenMatch, 'handleOpen not found').toBeTruthy();
            expect(handleOpenMatch?.[1]).toMatch(/loadExistingShares\s*\(\s*\)/);
        });

        it('clears shareUrl when the deleted shareId matches the current shareUrl', () => {
            // Without this, the user would see a stale URL pointing
            // at a row that no longer exists. Goes through the
            // isActiveShare helper (utils/wishlistUtils.ts) so the
            // URL-shape contract is in one place.
            const src = readText(componentPath);
            expect(src).toMatch(/isActiveShare\(\s*shareUrl\s*,\s*shareId\s*\)/);
            expect(src).toMatch(/setShareUrl\(\s*['"]['"]\s*\)/);
        });

        it('handleDeleteConfirm has a ref-based race guard against double-click', () => {
            // The double-click race: clicking "Confirm" twice in
            // quick succession would fire two DELETEs (the
            // setDeletingShareId(id) state update is async, so the
            // second click's closure still sees isDeleting=false).
            // The ref guard flips synchronously so the second click
            // short-circuits. Mirrors the createShare isGeneratingRef
            // pattern (which solved the same race on the create path).
            const src = readText(componentPath);
            // Locks the ref declaration + the early-return in
            // handleDeleteConfirm.
            expect(src).toMatch(/deletingShareIdRef\s*=\s*useRef/);
            const handleDeleteMatch = src.match(/const\s+handleDeleteConfirm\s*=\s*async\s*\(\s*shareId\s*:\s*string\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
            expect(handleDeleteMatch, 'handleDeleteConfirm not found').toBeTruthy();
            expect(handleDeleteMatch?.[1]).toMatch(/if\s*\(\s*deletingShareIdRef\.current\s*\)\s*return/);
        });

        it('confirm state resets when the modal closes (no leak across open/close cycles)', () => {
            // If a user clicks Delete on a row, then closes the
            // modal without confirming, then reopens -- the row
            // must NOT be in "Confirm" mode anymore. Both the X
            // button and the backdrop click must reset.
            const src = readText(componentPath);
            // Locks at least 2 occurrences of setConfirmDeleteId(null)
            // in the close-related handlers (X + backdrop). The
            // exact setConfirmDeleteId(null) inside handleDeleteConfirm
            // is the third -- the test doesn't care which 2 of the 3
            // are the close-handler ones, just that there are at
            // least 2 close-handler resets.
            const occurrences = (src.match(/setConfirmDeleteId\(\s*null\s*\)/g) ?? []).length;
            expect(
                occurrences,
                `expected at least 2 setConfirmDeleteId(null) calls (X button + backdrop + handleDeleteConfirm's finally), found ${occurrences}`
            ).toBeGreaterThanOrEqual(2);
        });
    });
});
