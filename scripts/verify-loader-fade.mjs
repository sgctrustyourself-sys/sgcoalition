// Verifies the #initial-loader fade transition in index.html by
// loading the dev server on a throttled Slow 3G connection and
// capturing the loader's opacity + screenshots over time.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', '.loader-fade-screenshots');
const URL = process.env.TEST_URL || 'http://localhost:3000';

mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Throttle to Slow 3G (~400 kbps, 400ms latency) via CDP. Throttling
  // is enabled BEFORE navigation so the HTML + JS bundle download slowly,
  // giving the loader time to be visible and the fade time to play out.
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (400 * 1024) / 8, // 400 kbps -> bytes/s
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  const start = Date.now();
  page.setDefaultNavigationTimeout(120000);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Sample loader opacity + screenshot at fixed wall-clock times so we
  // can see the fade progress regardless of when the JS bundle finishes.
  const sampleTimes = [200, 600, 1200, 2000, 3000, 4000, 5000, 6500, 8000, 10000];
  const snapshots = [];

  for (const ms of sampleTimes) {
    const elapsed = Date.now() - start;
    const wait = ms - elapsed;
    if (wait > 0) await page.waitForTimeout(wait);

    const snapshot = await page.evaluate(() => {
      const loader = document.getElementById('initial-loader');
      if (!loader) return { inDOM: false, opacity: null };
      const cs = window.getComputedStyle(loader);
      return {
        inDOM: true,
        opacity: parseFloat(cs.opacity),
        display: cs.display,
        visibility: cs.visibility,
      };
    });

    const rootChildren = await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return null;
      return Array.from(root.children).map((c) => c.id || c.tagName);
    });

    const path = join(OUT_DIR, `loader-fade-${String(ms).padStart(5, '0')}ms.png`);
    await page.screenshot({ path, fullPage: false });
    snapshots.push({
      targetMs: ms,
      actualMs: Date.now() - start,
      ...snapshot,
      rootChildren,
      screenshot: path,
    });
  }

  // Final check: is the React app mounted (root has non-loader children)?
  const finalState = await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return { rootExists: false };
    const children = Array.from(root.children);
    const loaderStillThere = children.some((c) => c.id === 'initial-loader');
    const reactContent = children.filter((c) => c.id !== 'initial-loader');
    return {
      rootExists: true,
      loaderStillThere,
      reactChildCount: reactContent.length,
      reactChildTags: reactContent.slice(0, 3).map((c) => c.tagName),
    };
  });

  // Summary: did the opacity actually decrease over time?
  const opacities = snapshots
    .filter((s) => s.inDOM && s.opacity !== null)
    .map((s) => ({ t: s.actualMs, o: s.opacity }));
  const opacityDecreased =
    opacities.length >= 2 && opacities[opacities.length - 1].o < opacities[0].o;

  const result = {
    url: URL,
    totalTimeMs: Date.now() - start,
    opacitySamples: opacities,
    opacityDecreased,
    finalState,
    consoleErrors,
    snapshots,
  };

  // Noscript visibility test: must be HIDDEN when JS is enabled and
  // VISIBLE when JS is disabled. Runs in a second browser context
  // because `javaScriptEnabled` is a context option, not a page option.
  // Uses a fresh context without the Slow 3G throttle — the no-JS page
  // renders instantly from the static HTML.
  const noscriptVisibleWithJs = await page.locator('#noscript-fallback').isVisible();

  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto(URL, { waitUntil: 'domcontentloaded' });

  const noscriptVisibleNoJs = await noJsPage.locator('#noscript-fallback').isVisible();
  const noJsScreenshotPath = join(OUT_DIR, 'nojs-state.png');
  await noJsPage.screenshot({ path: noJsScreenshotPath, fullPage: false });

  await noJsContext.close();

  result.noscript = {
    visibleWithJs: noscriptVisibleWithJs,
    visibleWithoutJs: noscriptVisibleNoJs,
    correct: !noscriptVisibleWithJs && noscriptVisibleNoJs,
    screenshot: noJsScreenshotPath,
  };

  writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify(result, null, 2));

  await browser.close();

  // CI-friendly pass/fail summary + exit code.
  const passed =
    result.opacityDecreased &&
    result.finalState.reactChildCount > 0 &&
    result.noscript.correct;

  if (passed) {
    const first = opacities[0];
    const last = opacities[opacities.length - 1];
    console.log('\n✅ Loader fade test PASSED');
    if (first && last) {
      console.log(`   opacity: ${first.o} -> ${last.o} over ${result.totalTimeMs}ms`);
    }
    console.log(`   React mounted: ${result.finalState.reactChildCount} child(ren) in #root`);
    console.log(`   Noscript: hidden with JS, visible without JS ✓`);
  } else {
    console.log('\n❌ Loader fade test FAILED');
    console.log(`   opacityDecreased: ${result.opacityDecreased}`);
    console.log(`   reactChildCount: ${result.finalState.reactChildCount}`);
    console.log(`   noscript.correct: ${result.noscript.correct}`);
    console.log(`   noscript.visibleWithJs: ${result.noscript.visibleWithJs}`);
    console.log(`   noscript.visibleWithoutJs: ${result.noscript.visibleWithoutJs}`);
    console.log(`   opacitySamples: ${JSON.stringify(opacities)}`);
  }

  if (!passed) process.exit(1);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
