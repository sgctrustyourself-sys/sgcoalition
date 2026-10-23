// tests/sgcoinReverseButton.test.ts
//
// BROWSER TEST for the clawback: the admin SGCoin tab must be able to take a
// grant back from the operator's real screen — the confirmation, the POST, and
// the ledger re-read that proves the correction landed.
//
// Why a real browser and not a component render: the button only exists on the
// `sgcoin-distribution` tab of /admin, behind ProtectedRoute's admin-mode gate,
// inside a lazy-loaded chunk, and the flow ends in window.confirm — none of
// which a shallow render exercises. This drives the deployed shape of the page
// (deep link, gate, chunk, dialog) against a stubbed API.
//
// The API is stubbed at the network boundary so the test is deterministic and
// never mints or claws back real SGCoin. The stub keeps a ledger that the
// reversal POST MUTATES, because the component deliberately re-reads the ledger
// after a reversal rather than guessing what the new rows look like — a stub
// that always returned the same list would hide a regression there.
//
// Follows the Playwright-via-vitest convention of tests/viewContractButton.test.ts:
// a real Vite dev server in beforeAll, headless Chromium, external HTTP mocked.
//
// DELIBERATELY NOT in vitest.config.ts's exclude list, unlike the other
// Playwright suites: vitest 4 drops the positional file filter through the
// exclude list, so an excluded file cannot be run on its own either. This one
// costs ~10s and runs with the normal `npx vitest run`; run just it with
//   npx vitest run tests/sgcoinReverseButton.test.ts
//
// @vitest-environment node
//
// node-vs-jsdom note: this drives Chromium over CDP and a Vite server in a Node
// subprocess. No React is rendered into jsdom here, so node sidesteps the
// esbuild TextEncoder issue that the other Playwright suites hit.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createServer, ViteDevServer } from 'vite';
import path from 'path';

const TEST_PORT = 5202;
const ROOT = path.resolve(__dirname, '..');
const ADMIN_TOKEN = 'browser-test-admin-token';

/** The member the seeded grants belong to. */
const MEMBER = {
    userId: '8c1f1f9a-1c2e-4b1a-9d2f-3b8f0b1e9a11',
    name: 'Wrong Desk',
    // A reserved-domain address: tests/downDomain.test.ts fails the build if a
    // source file references a retired storefront host.
    email: 'wrong.desk@example.test',
    sgCoinBalance: 8,
};

/** The grant the test claws back. */
const TARGET_GRANT_ID = '2f6f9d4c-8a3e-4c07-9b5e-0c1d2e3f4a5b';
/** A grant that was already clawed back before the page loaded. */
const REVERSED_GRANT_ID = 'c0a1b2c3-d4e5-4f60-8a90-b1c2d3e4f506';

/**
 * The ledger the page reads on mount: one grant already corrected (so the
 * "Reversal" and "Reversed" badges are on screen from the first paint) and one
 * live grant whose Reverse button the test clicks.
 */
function seededLedger() {
    return [
        {
            id: 'b7d0e1f2-3a4b-4c5d-9e6f-7a8b9c0d1e2f',
            userId: MEMBER.userId,
            memberName: MEMBER.name,
            memberEmail: MEMBER.email,
            amount: -5,
            note: 'clawback E2E — wrong member',
            balanceAfter: 8,
            createdAt: '2026-10-23T03:20:00.000Z',
            kind: 'reversal',
            reversesGrantId: REVERSED_GRANT_ID,
        },
        {
            id: REVERSED_GRANT_ID,
            userId: MEMBER.userId,
            memberName: MEMBER.name,
            memberEmail: MEMBER.email,
            amount: 5,
            note: 'first grant',
            balanceAfter: 13,
            createdAt: '2026-10-23T03:10:00.000Z',
            kind: 'grant',
            reversesGrantId: null,
        },
        {
            id: TARGET_GRANT_ID,
            userId: MEMBER.userId,
            memberName: MEMBER.name,
            memberEmail: MEMBER.email,
            amount: 3,
            note: 'sent to the wrong desk',
            balanceAfter: 8,
            createdAt: '2026-10-23T03:05:00.000Z',
            kind: 'grant',
            reversesGrantId: null,
        },
    ];
}

interface Harness {
    ledger: ReturnType<typeof seededLedger>;
    posts: { body: unknown; authorization: string | undefined }[];
    dialogs: string[];
}

/**
 * Stub every API the admin shell can reach. One handler for all paths, so
 * precedence between overlapping route globs can never decide the outcome.
 */
async function installApiMocks(context: BrowserContext, harness: Harness) {
    await context.route('**/api/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const json = (body: unknown, status = 200) =>
            route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

        // The tab's own four reads.
        if (url.pathname === '/api/admin-sgcoin-grants') {
            return json({ grants: harness.ledger, limit: 50 });
        }
        if (url.pathname === '/api/admin-sgcoin-members') {
            return json({ members: [MEMBER], limit: 1000 });
        }
        if (url.pathname === '/api/sgcoin-allocation') {
            return json({ totalSales: 0, totalOrders: 0, sgcoinAllocationCents: 0, allocationPercentage: 0, note: '' });
        }
        if (url.pathname === '/api/sgcoin-v2-rate') {
            return json({ v2PerUsd: 100, usdPerV2: 0.01, note: '' });
        }

        // The write under test.
        if (url.pathname === '/api/admin-sgcoin-reverse') {
            if (request.method() !== 'POST') return json({ error: 'Method not allowed' }, 405);
            const body = JSON.parse(request.postData() || '{}') as { grantId?: string };
            harness.posts.push({ body, authorization: request.headers()['authorization'] });

            const grant = harness.ledger.find(
                (row) => row.id === body.grantId && row.kind === 'grant',
            );
            if (!grant) return json({ error: 'Grant not found.' }, 404);

            // Mutate the ledger the way the RPC does: append a negative reversal
            // row and leave the original grant where it is.
            harness.ledger = [
                {
                    id: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
                    userId: grant.userId,
                    memberName: grant.memberName,
                    memberEmail: grant.memberEmail,
                    amount: -grant.amount,
                    note: null,
                    balanceAfter: MEMBER.sgCoinBalance,
                    createdAt: '2026-10-23T03:30:00.000Z',
                    kind: 'reversal',
                    reversesGrantId: grant.id,
                },
                ...harness.ledger,
            ];

            return json({
                grantId: grant.id,
                reversalId: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
                reversedAmount: grant.amount,
                balanceAfter: MEMBER.sgCoinBalance,
            });
        }

        return json({});
    });

    // Nothing in this tab should reach Supabase, but the app shell boots a
    // client and would otherwise spend the test's timeout on failed lookups.
    await context.route('**supabase.co/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
}

describe('admin SGCoin tab — Reverse button (browser)', () => {
    let server: ViteDevServer;
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    const harness: Harness = { ledger: seededLedger(), posts: [], dialogs: [] };
    const baseUrl = `http://localhost:${TEST_PORT}`;

    beforeAll(async () => {
        server = await createServer({
            configFile: path.join(ROOT, 'vite.config.ts'),
            root: ROOT,
            server: { port: TEST_PORT, strictPort: true },
        });
        await server.listen();
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

        // Unlock /admin the way a logged-in operator's tab is unlocked. The flag
        // is read from sessionStorage when useAuth initialises, and the token is
        // what every admin call echoes as a Bearer credential.
        await context.addInitScript(
            `sessionStorage.setItem('coalition_admin_mode', 'true');
             sessionStorage.setItem('coalition_admin_token', ${JSON.stringify(ADMIN_TOKEN)});`,
        );

        await installApiMocks(context, harness);
        page = await context.newPage();
        page.on('dialog', async (dialog) => {
            harness.dialogs.push(dialog.message());
            await dialog.accept();
        });

        // Warmup: prime Vite's module graph so the real navigation is not the
        // cold start.
        await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }, 120_000);

    // Teardown gets its own budget: under the full parallel suite Chromium and
    // the Vite server can take longer to release than the 10s hook default, and
    // a slow close is not a test failure.
    afterAll(async () => {
        await page?.close().catch(() => undefined);
        await context?.close().catch(() => undefined);
        await browser?.close().catch(() => undefined);
        await server?.close().catch(() => undefined);
    }, 90_000);

    async function openTab() {
        await page.goto(`${baseUrl}/admin?tab=sgcoin-distribution`, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
        });
        await page.getByRole('heading', { name: 'Recent Grants' }).waitFor({ timeout: 60_000 });
        return page;
    }

    it('renders a seeded reversal row beside the grant it undoes', async () => {
        await openTab();

        const reversalRow = page.getByRole('listitem').filter({ hasText: 'clawback E2E' });
        await reversalRow.waitFor({ timeout: 20_000 });
        expect(await reversalRow.getByText('Reversal', { exact: true }).count()).toBe(1);
        // The reversal reads as a debit, not a second credit.
        expect(await reversalRow.innerText()).toContain('−5');
        // A reversal is never itself reversible.
        expect(await reversalRow.getByRole('button', { name: 'Reverse' }).count()).toBe(0);

        const reversedGrant = page
            .getByRole('listitem')
            .filter({ hasText: 'first grant' });
        expect(await reversedGrant.getByText('Reversed', { exact: true }).count()).toBe(1);
        expect(await reversedGrant.getByRole('button', { name: 'Reverse' }).count()).toBe(0);

        // Only the grant that has no reversal yet offers the action.
        const targetRow = page.getByRole('listitem').filter({ hasText: 'sent to the wrong desk' });
        expect(await targetRow.getByRole('button', { name: 'Reverse' }).count()).toBe(1);
    }, 30_000);

    it('does not POST when the operator cancels the confirmation', async () => {
        await openTab();

        // This page instance dismisses the dialog instead of accepting it.
        page.removeAllListeners('dialog');
        const dismissed: string[] = [];
        page.once('dialog', (dialog) => {
            dismissed.push(dialog.message());
            return dialog.dismiss();
        });

        const postsBefore = harness.posts.length;
        const targetRow = page.getByRole('listitem').filter({ hasText: 'sent to the wrong desk' });
        await targetRow.getByRole('button', { name: 'Reverse' }).click();

        // The dialog was raised, and declining leaves the ledger untouched.
        expect(dismissed).toHaveLength(1);
        expect(dismissed[0]).toContain('Reverse this grant?');
        await page.waitForTimeout(500);
        expect(harness.posts.length).toBe(postsBefore);
        expect(await targetRow.getByRole('button', { name: 'Reverse' }).count()).toBe(1);

        // Restore the accepting handler for the test that performs the reversal.
        page.removeAllListeners('dialog');
        page.on('dialog', async (dialog) => {
            harness.dialogs.push(dialog.message());
            await dialog.accept();
        });
    }, 30_000);

    it('clicking Reverse confirms, POSTs the grant id with the admin token, and shows the correction', async () => {
        await openTab();

        const targetRow = page.getByRole('listitem').filter({ hasText: 'sent to the wrong desk' });
        const reverseButton = targetRow.getByRole('button', { name: 'Reverse' });
        await reverseButton.waitFor({ timeout: 20_000 });

        const requestPromise = page.waitForRequest(
            (request) =>
                request.url().includes('/api/admin-sgcoin-reverse') && request.method() === 'POST',
            { timeout: 20_000 },
        );
        await reverseButton.click();
        const request = await requestPromise;

        // The exact wire contract: the grant id, and the operator's credential.
        expect(JSON.parse(request.postData() || '{}')).toEqual({ grantId: TARGET_GRANT_ID });
        expect(request.headers()['authorization']).toBe(`Bearer ${ADMIN_TOKEN}`);

        // The operator was warned first, with the amount and the member named.
        expect(harness.dialogs).toHaveLength(1);
        expect(harness.dialogs[0]).toContain('Reverse this grant?');
        expect(harness.dialogs[0]).toContain('3 SGCoin');
        expect(harness.dialogs[0]).toContain(MEMBER.name);

        // After the re-read: the new reversal row is on screen, and the grant it
        // undoes now carries the "Reversed" badge and no button.
        const newReversal = page.getByRole('listitem').filter({ hasText: '−3' });
        await newReversal.waitFor({ timeout: 20_000 });
        expect(await newReversal.getByText('Reversal', { exact: true }).count()).toBe(1);

        const correctedGrant = page.getByRole('listitem').filter({ hasText: 'sent to the wrong desk' });
        expect(await correctedGrant.getByText('Reversed', { exact: true }).count()).toBe(1);
        expect(await correctedGrant.getByRole('button', { name: 'Reverse' }).count()).toBe(0);
    }, 30_000);

});
