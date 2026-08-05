// tests/clsRegression.test.ts
//
// CLS REGRESSION CATCH: asserts that Ecosystem, Home, Shop, and PDP pages
// maintain Cumulative Layout Shift < 0.1 under simulated data loading.
//
// Uses Playwright's Chromium to load each page in a real browser, injects a
// PerformanceObserver for layout-shift entries, waits for async data +
// animations to settle, then asserts the total CLS (excluding input shifts).
//
// API MOCKING:
//   DexScreener WPOL endpoint -> mocked so fetchPolUsdPrice() returns 0.08245.
//     Provides a live POL/USD price for the cached provider path.
//
//   QuickSwap V2/V3 RPC (eth_call via ethers) -> NOT mocked. The Polygon RPC
//     calls to getReserves() / slot0() will fail in the test environment.
//     fetchSGCoinData() catches internally and returns mock data, so the
//     SGCoinCard WILL transition skeleton->loaded with fallback data. But
//     fetchPoolBreakdown() throws because readPoolData() hits the unmocked
//     RPC, which causes the Ecosystem Promise.all to reject, leaving coinData
//     null and the SGCoinCard skeleton persistent. The pool breakdown
//     skeleton also persists.
//
//   PolygonScan API -> returns built-in mock data when no API key is set
//     (no VITE_POLYGONSCAN_API_KEY in test), so it never makes an HTTP
//     request. The page.route() mock for api.etherscan.io is a future-proof
//     guard if the key is ever configured in CI.
//
// WHAT IS ACTUALLY TESTED:
//   - LiveTransactions: skeleton->loaded (polygonScanApi internal fallback)
//   - Navbar auth block: fixed width prevents horizontal shifts
//   - AnnouncementBar: min-height prevents mount-time shift
//   - Pool breakdown skeleton: min-height prevents zero->full jump
//   - Structural CLS: font loading, CSS transitions, React hydration
//
// EXCLUDED from default vitest run (see vitest.config.ts). Run directly:
//   npx vitest run tests/clsRegression.test.tsimport { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { createServer, ViteDevServer } from 'vite';
import path from 'path';
import { PRODUCT_IDS } from '../constants/productIds';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TEST_PORT = 5199;
const CLS_THRESHOLD = 0.1;
const LOAD_TIMEOUT_MS = 10_000;
const ROOT = path.resolve(__dirname, '..');

// Mock DexScreener WPOL pairs response. The Ecosystem page calls
// fetchPolUsdPrice() → api.dexscreener.com/latest/dex/tokens/{WPOL_ADDRESS}.
// Returning a valid priceUsd causes fetchSGCoinData() to resolve real data,
// which triggers the SGCoinCard skeleton→loaded transition for CLS measurement.
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

// Mock PolygonScan token-transfer API response. Note: polygonScanApi.ts
// returns built-in mock data when no VITE_POLYGONSCAN_API_KEY is configured,
// so this route mock may never be hit in CI. It's here as a future-proof
// guard and as documentation of the expected API shape.
const MOCK_POLYGONSCAN_TXS = {
    status: '1',
    message: 'OK',
    result: [
        {
            hash: '0xmock1',
            from: '0x1234567890abcdef1234567890abcdef12345678',
            to: '0xabcdef1234567890abcdef1234567890abcdef12',
            value: '125000000000000000000',
            timeStamp: String(Math.floor(Date.now() / 1000) - 60),
            tokenName: 'SGCoin V2',
            tokenSymbol: 'SGC',
            tokenDecimal: '18',
        },
        {
            hash: '0xmock2',
            from: '0x2234567890abcdef1234567890abcdef12345678',
            to: '0xbbcdef1234567890abcdef1234567890abcdef12',
            value: '50000000000000000000',
            timeStamp: String(Math.floor(Date.now() / 1000) - 120),
            tokenName: 'SGCoin V2',
            tokenSymbol: 'SGC',
            tokenDecimal: '18',
        },
    ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Install API mocks so the Ecosystem page transitions skeleton→content. */
async function installApiMocks(page: Page) {
    // DexScreener WPOL price — triggers SGCoinCard price display
    await page.route('**/api.dexscreener.com/latest/dex/tokens/**', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_DEXSCREENER_WPOL),
        });
    });

    // PolygonScan — guards if API key is ever configured in CI
    await page.route('**/api.etherscan.io/v2/api**', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_POLYGONSCAN_TXS),
        });
    });
}

/** Navigate to a page, inject CLS observer, wait for settle, return CLS. */
async function collectCls(page: Page, url: string): Promise<{
    cls: number;
    entries: { value: number; sources: string[] }[];
}> {
    // Navigate to the target page. page.goto() creates a fresh document
    // context, so any globals/observers from prior tests are automatically
    // cleaned up — no need for an explicit about:blank reset.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // Inject PerformanceObserver with buffered:true so all layout-shift
    // entries from the initial render are captured. The observer callback
    // fires synchronously for buffered entries, then asynchronously for
    // new shifts during async data loading.
    await page.evaluate(() => {
        (window as any).__clsValue = 0;
        (window as any).__clsEntries = [];
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const ls = entry as any;
                if (!ls.hadRecentInput) {
                    (window as any).__clsValue += ls.value;
                    (window as any).__clsEntries.push({
                        value: ls.value,
                        sources: (ls.sources || []).map(
                            (s: any) => s.node?.nodeName || s.node?.localName || 'unknown',
                        ),
                    });
                }
            }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
    });

    // Wait for network to settle (API calls resolve, images load)
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Extra settle time for React state updates, AnimatedCounter (1.5s),
    // CSS transitions, and framer-motion whileInView animations
    await page.waitForTimeout(LOAD_TIMEOUT_MS);

    const cls = await page.evaluate(() =>
        typeof (window as any).__clsValue === 'number' ? (window as any).__clsValue : 0,
    );
    const entries = await page.evaluate(() => (window as any).__clsEntries || []);
    return { cls, entries };
}

function warnIfHigh(
    pageName: string,
    cls: number,
    entries: { value: number; sources: string[] }[],
) {
    if (cls >= CLS_THRESHOLD) {
        const details = entries
            .map((e) => `  shift=${e.value.toFixed(4)} srcs=[${e.sources.join(',')}]`)
            .join('\n');
        console.warn(`\n\u26a0\ufe0f  ${pageName} CLS=${cls.toFixed(4)} (threshold ${CLS_THRESHOLD}):\n${details}`);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLS Regression', () => {
    let server: ViteDevServer;
    let browser: Browser;
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
        page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await installApiMocks(page);
    }, 60_000);

    afterAll(async () => {
        await page?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await server?.close().catch(() => {});
    });

    // ── Ecosystem ──────────────────────────────────────────────────
    it(`Ecosystem page CLS < ${CLS_THRESHOLD}`, async () => {
        const { cls, entries } = await collectCls(page, `${baseUrl}/ecosystem`);
        warnIfHigh('Ecosystem', cls, entries);
        expect(cls, `Ecosystem CLS (${cls.toFixed(4)}) should be < ${CLS_THRESHOLD}`).toBeLessThan(CLS_THRESHOLD);
    }, 45_000);

    // ── Home ───────────────────────────────────────────────────────
    it(`Home page C
