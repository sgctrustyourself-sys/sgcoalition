// tests/viewContractButton.test.ts
//
// VIEW CONTRACT REGRESSION CATCH: the 'View Contract' anchor inside the
// BurnTracker card on /ecosystem must navigate to the SGCoin V2 contract
// on PolygonScan. Catches:
//
//   1. regression to href="#" (the original dead-end bug)
//   2. drift to any other URL (wrong contract, wrong explorer, etc.)
//   3. drift to non-popup navigation (target missing or _self)
//   4. JS handler hijacking the click and going elsewhere
//
// Follows the same Playwright-via-vitest convention as
// tests/clsRegression.test.ts: spins up a real Vite dev server in
// beforeAll, mocks external HTTP so the page hydrates, then exercises
// the DOM.
//
// EXCLUDED from default vitest run (see vitest.config.ts) - ~10-15s
// runtime + ~3s Chromium launch. Run directly:
//   npx vitest run tests/viewContractButton.test.ts
//
// @vitest-environment node
//
// node-vs-jsdom note: this test drives a real Chromium via Playwright
// and a Vite dev server in a Node subprocess - we don't render any
// jsdom-bound React. Forcing node here sidesteps the esbuild TextEncoder
// invariant violation that occurs when vitest re-hydrates jsdom for an
// isolated single-file run.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createServer, ViteDevServer } from 'vite';
import path from 'path';
import { SGCOIN_V2_CONTRACT_ADDRESS } from '../constants';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Different port from clsRegression.test.ts (5199) so the two suites can
// run side-by-side without a port-in-use flake.
const TEST_PORT = 5201;
const ROOT = path.resolve(__dirname, '..');
const EXPECTED_POPUP_URL = `https://polygonscan.com/token/${SGCOIN_V2_CONTRACT_ADDRESS}`;

// Same mocks used by clsRegression.test.ts. BurnTracker renders the loaded
// state on mount (its isLoading default is false), but siblings
// (SGCoinCard, LiveTransactions) call these endpoints and would otherwise
// thrash network errors during the test timeout.
const MOCK_DEXSCREENER_WPOL = {
    pairs: [
        {
            chainId: 'polygon',
            dexId: 'quickswap',
            pairAddress: '0xmock',
            priceUsd: '0.08245',
            priceNative: '1.0',
            liquidity: { usd: 2500000 },
            volume: { h24: 120000 },
        },
    ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function installApiMocks(context: BrowserContext) {
    await context.route('**/api.dexscreener.com/latest/dex/tokens/**', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_DEXSCREENER_WPOL),
        });
    });
    await context.route('**/api.etherscan.io/v2/api**', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{"status":"1","message":"OK","result":[]}',
        });
    });
}

async function gotoEcosystem(page: Page, baseUrl: string) {
    await page.goto(`${baseUrl}/ecosystem`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
    });
    // Anchor text appears as the link's accessible name (the lucide
    // ExternalLink SVG child contributes no text). getByRole for
    // robustness against whitespace/newline differences.
    const viewContract = page.getByRole('link', { name: /^View Contract$/ });
    await viewContract.waitFor({ state: 'visible', timeout: 30_000 });
    return viewContract;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('View Contract anchor (Ecosystem -> PolygonScan)', () => {
    let server: ViteDevServer;
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;
    const baseUrl = `http://localhost:${TEST_PORT}`;

    beforeAll(async () => {
        server = await createServer({
            configFile: path.join(ROOT, 'vite.config.ts'),
            root: ROOT,
            server: { port: TEST_PORT, strictPort: true },
        });
        await server.listen();
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await installApiMocks(context);
        page = await context.newPage();

        // Warmup nav: prime Vite's on-demand module compilation cache so
        // the first real test gets a fast domcontentloaded, not the slow
        // cold-start (which can exceed 15s on a busy machine).
        await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }, 90_000);

    afterAll(async () => {
        await page?.close().catch(() => undefined);
        await context?.close().catch(() => undefined);
        await browser?.close().catch(() => undefined);
        await server?.close().catch(() => undefined);
    });

    it('links to the SGCoin V2 contract on PolygonScan (NOT to "#")', async () => {
        const viewContract = await gotoEcosystem(page, baseUrl);
        const href = await viewContract.getAttribute('href');

        // PRIMARY regression: this exact string was the original dead-end bug.
        expect(href).toBe(EXPECTED_POPUP_URL);

        // Defense-in-depth: if EXPECTED_POPUP_URL ever widens in the future,
        // these guards still reject the historical dead-end shapes.
        expect(href).not.toBe('#');
        expect(href).not.toBe('');
        expect(href).toMatch(/^https:\/\/(www\.)?polygonscan\.com\/token\/0x[0-9a-fA-F]{40}$/);
    }, 30_000);

    it('opens as a popup (target="_blank", rel includes "noopener")', async () => {
        const viewContract = await gotoEcosystem(page, baseUrl);
        const target = await viewContract.getAttribute('target');
        const rel = await viewContract.getAttribute('rel');

        // Without target="_blank", the click would NAVIGATE the user away
        // from the storefront - the canonical "leads right back to the
        // same page" UX bug.
        expect(target).toBe('_blank');

        // rel="noopener noreferrer" is the security baseline for external
        // links. A regression that strips noopener would let the popup
        // window.opener mutate our tab.
        expect(rel).toMatch(/noopener/);
    }, 30_000);

    it('actually opens PolygonScan when clicked (popup URL contract)', async () => {
        const viewContract = await gotoEcosystem(page, baseUrl);

        // target="_blank" fires Playwright's "page" event on the BrowserContext.
        // Promise.all races the listener against the click so we don't miss it.
        // popup.url() reads the URL Chrome ended up on - which is the
        // destination href, possibly with Cloudflare's __cf_chl_rt_tk
        // challenge query appended. The regex anchors on the EXACT V2
        // contract hex so a JS hijack to /token/<different-contract>
        // would still fail (not just /token/<V2>).
        const [popup] = await Promise.all([
            context.waitForEvent('page', { timeout: 20_000 }),
            viewContract.click({ modifiers: [] }),
        ]);

        const popupUrl = popup.url();
        expect(popupUrl).toMatch(
            /^https:\/\/(www\.)?polygonscan\.com\/token\/0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e(\?|#|$)/,
        );
    }, 30_000);

    it('constant SGCOIN_V2_CONTRACT_ADDRESS points at the V2 token, not V1 (or anything else)', () => {
        // Anti-confusion guard. Catches two real failure modes:
        //   1. someone refactors and accidentally swaps SGCOIN_V2_CONTRACT_ADDRESS
        //      for SGCOIN_V1_CONTRACT_ADDRESS (0x951806a...) - V1 is a different
        //      chain's address and PolygonScan would show a different token.
        //   2. someone pastes the contract with a transcription typo (last
        //      few hex digits off) - PolygonScan would render a different
        //      (probably nonexistent) contract.
        // Both classes of bug would silently PASS the polygon URL regex
        // because the URL still resolves to polygonscan.com. This test
        // pins the exact V2 hex against the canonical value documented
        // in the project's INITIAL_ORDERS archive notes and on-chain
        // deployment record.
        expect(SGCOIN_V2_CONTRACT_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
        expect(SGCOIN_V2_CONTRACT_ADDRESS.toLowerCase()).toBe(
            '0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e',
        );
        // Cross-reference: V1 is a known DIFFERENT address. If the constant
        // ever equals V1 by accident, this catches it as a sanity floor.
        expect(SGCOIN_V2_CONTRACT_ADDRESS.toLowerCase()).not.toBe(
            '0x951806a2581c22c478ac613a675e6c898e2abe21',
        );
    });
});
