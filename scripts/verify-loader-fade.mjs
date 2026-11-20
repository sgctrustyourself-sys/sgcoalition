// Verifies the #initial-loader fade transition in index.html by
// loading the dev server on a throttled Slow 3G connection and
// recording every opacity change via a MutationObserver set up
// BEFORE navigation (via page.addInitScript). This is deterministic
// — the previous polling-based approach was racy because the fade
// can start before the first sample after DCL on fast connections.
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

  // Set up the MutationObserver BEFORE any page scripts run. This
  // ensures we catch the fade from the very beginning, even if the
  // JS bundle downloads fast enough that the fade starts before DCL
  // (the previous polling approach missed the fade in that case).
  await context.addInitScript(() => {
    window.__opacityHistory = [];

    const recordOpacity = () => {
      const loader = document.getElementById('initial-loader');
      if (!loader) return; // Loader removed (React mounted)
      const cs = window.getComputedStyle(loader);
      const o = parseFloat(cs.opacity);
      if (Number.isNaN(o)) return;
      const t = performance.now();
      const last = window.__opacityHistory[window.__opacityHistory.length - 1];
      // Only record if opacity changed by >1% to avoid duplicate
      // records from the 20ms polling interval.
      if (!last || Math.abs(last.o - o) > 0.01) {
        window.__opacityHistory.push({ t, o });
      }
    };

    const setupObserver = () => {
      const loader = document.getElementById('initial-loader');
      if (!loader) {
        // Loader not in DOM yet — wait for it (HTML is being parsed)
        setTimeout(setupObserver, 5);
        return;
      }

      // Record initial opacity (should be 1)
      recordOpacity();

      // Observe style attribute changes (catches `style.opacity = '0'`
      // set by index.tsx). This fires when the JS sets the opacity,
      // not when the CSS transition interpolates.
      const observer = new MutationObserver(recordOpacity);
      observer.observe(loader, { attributes: true, attributeFilter: ['style'] });

      // Also poll for opacity changes every 20ms to catch the CSS
      // transition frames (which don't fire mutation events on the
      // style attribute). 20ms is fast enough to capture the 500ms
      // fade with ~25 samples.
      const pollInterval = setInterval(() => {
        recordOpacity();
        if (!document.getElementById('initial-loader')) {
          clearInterval(pollInterval);
        }
      }, 20);
      // Safety net: stop polling after 15s
      setTimeout(() => clearInterval(pollInterval), 15000);
    };

    // Set up when DOM is ready (loader is in the HTML)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupObserver);
    } else {
      setupObserver();
    }
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

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Give the fade a moment to complete (CSS transition is 500ms)
  await page.waitForTimeout(1000);

  // Read the opacity history captured by the init script
  const opacityHistory = await page.evaluate(() => window.__opacityHistory || []);

  // Final state: is the React app mounted (root has non-loader children)?
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

  // Check that the history shows the fade: opacity went from ~1 to ~0
  const sawFullOpacity = opacityHistory.some((s) => s.o >= 0.9);
  const sawLowOpacity = opacityHistory.some((s) => s.o <= 0.1);
  const opacityDecreased = sawFullOpacity && sawLowOpacity;

  // Take a final screenshot (React mounted, loader removed)
  await page.screenshot({ path: join(OUT_DIR, 'loader-fade-final.png'), fullPage: false });

  const result = {
    url: URL,
    totalTimeMs: Date.now(),
    opacityHistory,
    opacityDecreased,
    finalState,
    consoleErrors,
  };

  // Noscript visibility test: must be HIDDEN when JS is enabled and
  // VISIBLE when JS is disabled. Runs in a second browser context
  // because `javaScriptEnabled` is a context option, not a page option.
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
    const first = opacityHistory[0];
    const last = opacityHistory[opacityHistory.length - 1];
    console.log('\n✅ Loader fade test PASSED');
    if (first && last) {
      console.log(`   opacity: ${first.o.toFixed(3)} -> ${last.o.toFixed(3)} over ${(last.t - first.t).toFixed(0)}ms (${opacityHistory.length} samples)`);
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
    console.log(`   opacityHistory length: ${opacityHistory.length}`);
    console.log(`   sawFullOpacity (>=0.9): ${sawFullOpacity}`);
    console.log(`   sawLowOpacity (<=0.1): ${sawLowOpacity}`);
    if (opacityHistory.length > 0) {
      console.log(`   first: t=${opacityHistory[0].t.toFixed(0)}ms o=${opacityHistory[0].o.toFixed(3)}`);
      console.log(`   last:  t=${opacityHistory[opacityHistory.length-1].t.toFixed(0)}ms o=${opacityHistory[opacityHistory.length-1].o.toFixed(3)}`);
    }
  }

  if (!passed) process.exit(1);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
