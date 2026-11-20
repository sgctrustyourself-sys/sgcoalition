// Verifies the injected-article contract on a page that actually carries the node.
//
// The loader-fade check drives "/", which carries no injected article, so it cannot
// see this failure: if the app stopped removing the prerendered node — or the two
// sides disagreed about its id — that page would keep working, every existing check
// would stay green, and a post would ship the served copy twice on every load.
//
// This check takes a post URL from the sitemap the build just wrote, confirms the
// served HTML carries the node, then loads it in a real browser and fails if the
// node is still in the DOM after the entry bundle has run. It imports the node's id
// from utils/prerenderedArticle.mjs, the same owner the generator writes from and
// index.tsx removes with, so the check cannot drift from either side.
//
// Requires built output — a preview server or a deployment — not the dev server:
// the injected node only exists in prerendered pages. A page without it is a
// failure with the reason spelled out, never a silent pass, because a check that
// inspects nothing is worse than no check.

import { chromium } from 'playwright';
import { PRERENDERED_ARTICLE_ID } from '../utils/prerenderedArticle.mjs';

const ORIGIN = (process.env.TEST_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const BOOT_TIMEOUT_MS = Number(process.env.ARTICLE_TIMEOUT_MS || 30000);

const fail = (message) => {
  console.error(`\n❌ Injected-article check FAILED\n   ${message}`);
  process.exit(1);
};

// The build's own list of post pages, so no slug is hardcoded here and a new drop
// is covered by its next build.
const postUrlFromSitemap = async () => {
  const response = await fetch(`${ORIGIN}/sitemap.xml`);
  if (!response.ok) {
    fail(`no sitemap at ${ORIGIN}/sitemap.xml (HTTP ${response.status}) — run this against built output (npm run preview), not the dev server.`);
  }

  const loc = (await response.text()).match(/<loc>([^<]*\/blog\/[^<]+)<\/loc>/);
  if (!loc) {
    fail(`the sitemap at ${ORIGIN}/sitemap.xml advertises no post page, so there is no page carrying the injected node to check.`);
  }

  // The sitemap carries absolute production URLs; this check talks to ORIGIN.
  const pathname = new URL(loc[1]).pathname.replace(/\/+$/, '');
  // Trailing slash on purpose: vite preview serves the prerendered file for a
  // directory request and the SPA shell without it. Vercel's clean URLs serve both.
  return `${ORIGIN}${pathname}/`;
};

const main = async () => {
  const url = await postUrlFromSitemap();

  const served = await (await fetch(url)).text();
  if (!served.includes(`id="${PRERENDERED_ARTICLE_ID}"`)) {
    fail(
      `the page served at ${url} carries no id="${PRERENDERED_ARTICLE_ID}" node, so there is nothing for the app to remove and this check would prove nothing. ` +
        `It needs prerendered output: run "npm run build && npm run preview" (or point TEST_URL at a deployment), not the dev server.`
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Watch for the moment the node leaves, before any page script runs, because the
  // end state alone proves nothing: React's first commit clears #root as well, so a
  // page whose boot never calls the removal still ends up with no injected node.
  //
  // The two removals are distinguishable by what else is still in the DOM. The
  // app's call runs at the top of the entry module — before the loader fades and
  // long before React mounts — so the loader is still there when it happens. When
  // React is the one clearing the container, it drops the loader in the same
  // commit, so the loader is gone by the time this observer sees the node missing.
  await context.addInitScript((id) => {
    window.__articleRemoval = null;
    window.__articleSeen = false;

    new MutationObserver(() => {
      if (window.__articleRemoval) return;
      if (document.getElementById(id)) {
        window.__articleSeen = true; // the parser inserted the served copy
        return;
      }
      if (window.__articleSeen) {
        window.__articleRemoval = {
          loaderStillPresent: Boolean(document.getElementById('initial-loader')),
          rootChildren: document.getElementById('root')?.children.length ?? -1,
        };
      }
    }).observe(document, { childList: true, subtree: true });
  }, PRERENDERED_ARTICLE_ID);

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(url, { waitUntil: 'load' });

  // Two things have to happen, and they are not simultaneous: the removal runs at
  // the top of the entry module (as soon as the bundle executes), while the app
  // reaches boot later — after the loader fade and the first render commit. So wait
  // for each rather than guessing a delay, and assert them separately: a page that
  // removed the node but never booted is a different failure from a node that was
  // never removed.
  const waitFor = (predicate, ...args) =>
    page.waitForFunction(predicate, ...args, { timeout: BOOT_TIMEOUT_MS }).then(() => true).catch(() => false);

  const removed = await waitFor((id) => !document.getElementById(id), PRERENDERED_ARTICLE_ID);
  const booted = await waitFor(() => window.__coalitionBooted === true);

  const state = await page.evaluate((id) => {
    const nodes = document.querySelectorAll(`[id="${id}"]`);
    return {
      duplicates: nodes.length,
      firstText: (nodes[0]?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      removal: window.__articleRemoval,
      rootChildren: document.getElementById('root')?.children.length ?? -1,
    };
  }, PRERENDERED_ARTICLE_ID);

  await browser.close();

  if (!removed || state.duplicates > 0) {
    fail(
      `the served copy was never removed from ${url}. ` +
        `${state.duplicates} node(s) with id="${PRERENDERED_ARTICLE_ID}" are still in the DOM${state.firstText ? `, starting "${state.firstText}…"` : ''}. ` +
        `Either index.tsx stopped calling removePrerenderedArticle(), or it is looking for a different node than the generator wrote — ` +
        `both take the id from utils/prerenderedArticle.mjs, so this is drift between them and a visitor now sees the article twice.`
    );
  }

  if (!state.removal?.loaderStillPresent) {
    fail(
      `the served copy left ${url}, but not because the app removed it: the loader was already gone when the node disappeared, which is React clearing #root on its first commit. ` +
        `index.tsx is not removing the node the generator wrote: removePrerenderedArticle() either lost its call or is looking for an id the generator never wrote. The container render is doing the cleanup instead, so the copy survives until React's first commit and would keep surviving under any mount that does not clear the container (hydration, for one). Both sides take the id from utils/prerenderedArticle.mjs — if this fires, one of them stopped.`
    );
  }

  if (!booted) {
    fail(`the injected node was removed from ${url}, but the app never reached boot within ${BOOT_TIMEOUT_MS}ms (window.__coalitionBooted is unset), so whatever replaced it may be a blank page. Check the entry bundle, not the generator.`);
  }

  console.log('\n✅ Injected-article check PASSED');
  console.log(`   ${url}`);
  console.log(`   served node #${PRERENDERED_ARTICLE_ID}: present in the HTML, removed by the boot (loader still up, ${state.removal.rootChildren} child(ren) in #root)`);
  console.log(`   app booted: true, no copies left in the DOM`);
  if (consoleErrors.length) {
    console.log(`   page errors (not asserted): ${consoleErrors.length}`);
  }
};

main().catch((error) => {
  fail(`verification could not run: ${error?.stack || error}`);
});
