// scripts/smoke-checkout.mjs
//
// Permanent shop -> checkout smoke test for a PREVIEW deployment. This is the
// throwaway production playtest promoted to a committed artifact: one command
// answers "does the money path still work on this build".
//
// Usage:
//   SMOKE_BASE_URL=https://<preview>.vercel.app npm run smoke:checkout
//   npm run build && npm run preview -- --port 4173     # then:
//   SMOKE_BASE_URL=http://127.0.0.1:4173 npm run smoke:checkout
//   SMOKE_HEADED=1            watch it run
//   SMOKE_ALLOW_PRODUCTION=1  aim it at the live store (see the guard below)
//   SMOKE_BYPASS_TOKEN=<token> protection bypass for an SSO-protected preview.
//                             Preview deployments of this project answer 302 to a
//                             Vercel login wall, so without this a preview run
//                             cannot even load the storefront. Create one under
//                             Vercel → Project → Settings → Deployment
//                             Protection → Protection Bypass for Automation,
//                             and expose it to CI as VERCEL_AUTOMATION_BYPASS_SECRET
//                             (read from that name when SMOKE_BYPASS_TOKEN is unset).
//   SMOKE_SKIP_API=1          accept a client-flow-only run; honoured ONLY for a
//                             loopback target, because a local `vite preview`
//                             serves no serverless functions. The money-path
//                             check is then reported as skipped, never passed.
//
// It never types card details and never submits a payment — the run stops one
// step before a shopper would start paying. What it proves, in order:
//   1. /shop renders product links
//   2. the product page offers Add to bag (and a size, when the product has sizes)
//   3. the quantity stepper exists, starts at 1, and steps up when stock allows
//   4. /cart prices the line at exactly quantity x unit price
//   5. stepping down returns it to 1 without deleting the line
//   6. /checkout renders payment UI and its displayed Total equals the server's
//      /api/pricing-preview totalCents — the client/server money agreement
//
// Exit codes: 0 all checks passed, 1 a check failed, 2 the target is missing or
// refused. A failure screenshot lands in .checkout-smoke-artifacts/ (gitignored).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = join(__dirname, '..', '.checkout-smoke-artifacts');
const PRODUCTION_HOSTS = ['sgcoalition.xyz', 'www.sgcoalition.xyz'];

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------
const target = (process.env.SMOKE_BASE_URL || process.env.TEST_URL || '').replace(/\/+$/, '');
if (!target) {
    console.error('smoke-checkout: no target. Set SMOKE_BASE_URL (or TEST_URL).');
    console.error('  e.g. SMOKE_BASE_URL=https://<preview>.vercel.app npm run smoke:checkout');
    process.exit(2);
}
const { host, hostname } = new URL(target);
const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
if (PRODUCTION_HOSTS.includes(host) && process.env.SMOKE_ALLOW_PRODUCTION !== '1') {
    console.error(`smoke-checkout: refusing to smoke the live store (${host}).`);
    console.error('  Its checkout path creates real PaymentIntents. Use a preview URL, or');
    console.error('  set SMOKE_ALLOW_PRODUCTION=1 if you really mean it.');
    process.exit(2);
}

// ---------------------------------------------------------------------------
// Protection bypass (preview deployments are SSO-protected here)
// ---------------------------------------------------------------------------
// One source for the token: the same headers must reach the API probe and every
// browser request.
const bypassToken = (process.env.SMOKE_BYPASS_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim();
const bypassHeaders = bypassToken
    ? { 'x-vercel-protection-bypass': bypassToken, 'x-vercel-set-bypass-cookie': 'true' }
    : {};

// ---------------------------------------------------------------------------
// Check harness — every step is named, and the first failure stops the run
// ---------------------------------------------------------------------------
const results = [];

async function check(name, fn) {
    try {
        const detail = await fn();
        results.push({ name, ok: true });
        console.log(`  ok    ${name}${detail ? ` — ${detail}` : ''}`);
    } catch (e) {
        results.push({ name, ok: false, error: e.message });
        console.log(`  FAIL  ${name} — ${e.message}`);
        throw e;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const textOf = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();

/** "$240.00" -> 24000 */
const cents = (dollars) => Math.round(parseFloat(dollars.replace(/[$,]/g, '')) * 100);

const money = (haystack, pattern) => {
    const found = haystack.match(pattern);
    assert(found, `expected ${pattern} on the page, saw: ${haystack.slice(0, 160)}`);
    return found[0];
};

const browser = await chromium.launch({ headless: !process.env.SMOKE_HEADED });
const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: bypassHeaders,
});
const page = await context.newPage();
page.setDefaultTimeout(25000);

const pricing = [];
page.on('response', async (response) => {
    if (!response.url().includes('/api/pricing-preview')) return;
    const raw = await response.text().catch(() => '');
    let body = null;
    try {
        body = JSON.parse(raw);
    } catch {
        /* recorded as null so the check reports a body it cannot read */
    }
    pricing.push({ status: response.status(), body, raw: raw.slice(0, 200) });
});

// The money-path check needs the serverless API. A local `vite preview` serves
// static files only (no /api), so a loopback run can cover the client flow but
// not the server pricing agreement — that is reported as a skip, never as a
// pass. On any real deployment a missing API is a failure regardless of
// SMOKE_SKIP_API, so the flag can't hide an outage.
const apiAvailable = await fetch(`${target}/api/payment-settings`, { headers: bypassHeaders })
    .then(async (response) => response.ok && /json/.test(response.headers.get('content-type') || ''))
    .catch(() => false);
const allowApiSkip = process.env.SMOKE_SKIP_API === '1' && isLoopback;

console.log(`smoke-checkout -> ${target}${apiAvailable ? '' : '  (no API reachable)'}`);
if (bypassToken) console.log('  protection bypass: x-vercel-protection-bypass header enabled');

let failure = null;
let step = 'startup';

try {
    // ---- 1. shop lists products -------------------------------------------
    // Enter through the site root and click into the shop rather than going
    // straight to /shop. `vite preview` resolves /shop to the prerendered
    // public/shop.html SEO shell (no React root on the page), while Vercel's
    // rewrite sends /shop to index.html — so a direct goto('/shop') would pass
    // against a deployment and fail against the local preview build, which is
    // the workflow's fallback path. Clicking the nav link is the real
    // client-side route in both places.
    step = 'shop';
    await page.goto(`${target}/`, { waitUntil: 'load' });
    const maybeLater = page.getByRole('button', { name: /maybe later/i }).first();
    if (await maybeLater.count()) {
        await maybeLater.click({ timeout: 5000 }).catch(() => {});
    }
    const shopLink = page.locator('a[href="/shop"]').first();
    await shopLink.waitFor({ state: 'visible' });
    await shopLink.click({ timeout: 15000 });
    await page.waitForFunction(
        () =>
            [...document.querySelectorAll('a')].some((a) => /\/product\//.test(a.getAttribute('href') || '')),
        null,
        { timeout: 25000 },
    );
    const productHrefs = await page.evaluate(() => [
        ...new Set(
            [...document.querySelectorAll('a')]
                .map((a) => a.getAttribute('href'))
                .filter((href) => /\/product\//.test(href || '')),
        ),
    ]);
    await check('shop lists a product', () => (productHrefs.length ? `${productHrefs.length} listed` : null));

    // ---- 2. product page offers a bag button, and a size ------------------
    // The first listed product is not necessarily buyable: archived pieces
    // deliberately render no Add to bag button (ProductDetails swaps in
    // "Request similar style"), so pinning to the first link made this check
    // fail at random whenever the shop happened to lead with a sold-out drop.
    // Walk the listed products and use the first that actually sells — the
    // goal is reaching checkout, not exercising a named product — bounded so a
    // genuinely broken catalog still fails fast and loudly.
    step = 'product';
    let productHref = null;
    let addToBag = null;
    const notBuyable = [];
    for (const href of productHrefs.slice(0, 8)) {
        await page.goto(target + href, { waitUntil: 'load' });
        const candidate = page.getByRole('button', { name: /add to (bag|cart)/i }).first();
        const buyable = await candidate
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true)
            .catch(() => false);
        if (buyable) {
            productHref = href;
            addToBag = candidate;
            break;
        }
        notBuyable.push(href);
    }
    assert(
        addToBag,
        `no purchasable product among the first 8 listed (no Add to bag on: ${notBuyable.join(', ') || 'none'})`,
    );
    const sizeButton = page.locator('button').filter({ hasText: /LEFT$/i }).first();
    const hasSizes = (await sizeButton.count()) > 0;
    if (hasSizes) {
        await sizeButton.click();
        await page.waitForTimeout(800);
    }
    await check('product page offers a bag button', () =>
        hasSizes ? `${productHref} (with sizes)` : `${productHref} (single size)`,
    );

    // ---- 3. quantity stepper ---------------------------------------------
    // Stock may legitimately be 1 on a preview database, so the step-up is
    // asserted only when "+" is enabled; the stepper itself must always exist.
    step = 'quantity';
    const quantityGroup = page.getByRole('group', { name: /^Quantity/ }).first();
    await quantityGroup.waitFor({ state: 'visible' });
    const readQuantity = async () => (await quantityGroup.innerText()).trim();
    const increase = page.locator('button[aria-label="Increase Quantity"]').first();
    assert((await readQuantity()) === '1', `stepper should start at 1, saw ${await readQuantity()}`);

    const canIncrease = !(await increase.isDisabled());
    if (canIncrease) {
        await increase.click();
        await page.waitForTimeout(500);
        const stepped = await readQuantity();
        assert(stepped === '2', `stepper should read 2 after one click, saw ${stepped}`);
    }
    await check('quantity stepper works', () => (canIncrease ? 'starts at 1, steps to 2' : 'starts at 1 (stock caps at 1)'));

    // ---- 4. cart prices that quantity exactly ----------------------------
    step = 'cart';
    await addToBag.click();
    await page.waitForTimeout(2500);
    await page.goto(`${target}/cart`, { waitUntil: 'load' });
    const lineGroup = page.locator('[role="group"][aria-label^="Quantity for"]').first();
    await lineGroup.waitFor({ state: 'visible' });
    const cartPage = await textOf(page);
    const quantity = Number((await lineGroup.innerText()).trim());
    assert(Number.isFinite(quantity) && quantity >= 1, `cart quantity should be >= 1, saw ${quantity}`);

    const unitCents = cents(money(cartPage, /Unit Price: \$[0-9.,]+/).replace('Unit Price: ', ''));
    const lineCents = cents(money(cartPage, /\$[0-9.,]+(?= Size:)/));
    assert(
        lineCents === unitCents * quantity,
        `line total should be ${quantity} x ${unitCents}c = ${unitCents * quantity}c, saw ${lineCents}c`,
    );
    await check('cart prices the line', () => `${quantity} x ${unitCents / 100} = ${lineCents / 100}`);

    // ---- 5. stepping down keeps the line --------------------------------
    step = 'decrement';
    if (quantity > 1) {
        await page.locator('button[aria-label^="Decrease Quantity for"]').first().click();
        await page.waitForTimeout(1200);
    }
    const afterDown = await textOf(page);
    assert((await lineGroup.innerText()).trim() === '1', 'stepping down should leave the line at 1');
    assert(/Remove/.test(afterDown), 'the line must survive stepping down to 1');
    const downCents = cents(money(afterDown, /\$[0-9.,]+(?= Size:)/));
    assert(downCents === unitCents, `line total should return to ${unitCents}c, saw ${downCents}c`);
    await check('stepping down keeps the line', () => `1 x ${unitCents / 100}`);

    // ---- 6. checkout agrees with the server ------------------------------
    step = 'checkout';
    assert(
        apiAvailable || allowApiSkip,
        `no API at ${target}, so the money path cannot be verified. Point SMOKE_BASE_URL at a deployment,` +
            ' or set SMOKE_SKIP_API=1 to accept a client-flow-only run against loopback.',
    );
    if (apiAvailable) {
        const previewResponse = page.waitForResponse((r) => r.url().includes('/api/pricing-preview'), {
            timeout: 25000,
        });
        await page.goto(`${target}/checkout`, { waitUntil: 'load' });
        await previewResponse;
        const checkoutPage = await textOf(page);
        assert(/CHECKOUT/i.test(checkoutPage), 'checkout page did not render');
        assert(/payment method/i.test(checkoutPage), 'no payment method section on checkout');

        const serverPricing = pricing[pricing.length - 1];
        assert(serverPricing, 'checkout never called /api/pricing-preview');
        assert(serverPricing.status === 200, `pricing-preview returned ${serverPricing.status} ${serverPricing.raw}`);
        assert(
            serverPricing.body && Number.isFinite(serverPricing.body.totalCents),
            `pricing-preview had no totalCents: ${serverPricing.raw}`,
        );
        const shownCents = cents(money(checkoutPage, /Total\s*\$[0-9.,]+/).replace(/Total\s*/, ''));
        assert(
            shownCents === serverPricing.body.totalCents,
            `checkout shows ${shownCents}c but the server priced ${serverPricing.body.totalCents}c`,
        );
        await check('checkout total matches the server', () => `${shownCents / 100} both sides`);
    } else {
        // Only reachable for a loopback target with SMOKE_SKIP_API=1: the static
        // preview has no serverless functions, so the pricing agreement is
        // reported as skipped rather than passed.
        results.push({ name: 'checkout total matches the server', ok: true, skipped: true });
        console.log('  skip  checkout total matches the server — no API on this host (client flow only)');
    }
} catch (e) {
    failure = { step, error: e.message };
} finally {
    if (failure) {
        mkdirSync(ARTIFACT_DIR, { recursive: true });
        const shot = join(ARTIFACT_DIR, `checkout-smoke-failure-${failure.step}.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        console.log(`\n  screenshot: ${shot}`);
    }
    await browser.close();
}

const skipped = results.filter((r) => r.skipped).length;
const passed = results.filter((r) => r.ok && !r.skipped).length;
if (failure) {
    console.error(`\nSMOKE FAILED at "${failure.step}": ${failure.error}`);
    console.error(`${passed}/${results.length} checks passed against ${target}`);
    process.exit(1);
}
const total = results.length;
console.log(
    skipped === 0
        ? `\nSMOKE OK — ${passed}/${total} checks passed against ${target}`
        : `\nSMOKE OK (partial) — ${passed}/${total} checks passed, ${skipped} skipped ` +
          `(no API at ${host}: client flow only, checkout pricing NOT verified)`,
);
