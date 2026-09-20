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
//                             checks are then reported as skipped, never passed.
//
// It never types card details, and it never submits a payment: the run stops
// one step before a shopper would start paying, and where check 7 does click a
// manual confirm it has already blocked every order write, so nothing it clicks
// can reach the server. What it proves, in order:
//   1. /shop renders product links
//   2. a purchasable product page offers Add to bag (and a size, when the
//      product has sizes). It is chosen from the sellable listings, so a
//      sold-out leader is not mistaken for a broken shop.
//   2b. each sold-out state is covered rather than skipped: an archived piece
//      offers NO Add to bag, states Claimed or Archived, and points at "Request
//      similar style"; a plain stock-out piece (not archived, nothing left)
//      keeps a disabled Add to bag, states Archived, and still routes out.
//      Each is reported as skipped only when the shop lists none of that kind.
//   3. the quantity stepper exists, starts at 1, and steps up when stock allows
//   4. /cart prices the line at exactly quantity x unit price
//   5. stepping down returns it to 1 without deleting the line
//   6. /checkout renders payment UI and its displayed Total equals the server's
//      /api/pricing-preview totalCents — the client/server money agreement
//   7. a checkout attempt the server already recorded resolves to that order
//      instead of writing a second one. Driven with NO stored order: the order
//      write is blocked at the network layer (which is also what keeps the
//      attempt alive — the same state a write that never answered leaves
//      behind), the server's "already recorded" answer is supplied locally, and
//      the branch's destination page is never loaded. That is what keeps this
//      check incapable of creating an order, sending an email or consuming the
//      voucher. Needs the API (a target with no /api reports it as skipped).
//
// Exit codes: 0 all checks passed, 1 a check failed, 2 the target is missing or
// refused. A failure screenshot lands in .checkout-smoke-artifacts/ (gitignored).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
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
// browser request. The environment wins (CI passes SMOKE_BYPASS_TOKEN or
// VERCEL_AUTOMATION_BYPASS_SECRET), then .env / .env.local are consulted so a
// locally-stored secret works without exporting it by hand — this is a plain
// node script, so Vite's own .env loading does not apply to it.
function bypassTokenFromDotEnv() {
    for (const file of ['.env', '.env.local']) {
        let contents;
        try {
            contents = readFileSync(join(__dirname, '..', file), 'utf8');
        } catch {
            continue; // absent is normal (CI has no .env)
        }
        for (const line of contents.split(/\r?\n/)) {
            const match = line.match(/^\s*(?:export\s+)?(SMOKE_BYPASS_TOKEN|VERCEL_AUTOMATION_BYPASS_SECRET)\s*=\s*(.*)$/);
            if (!match) continue;
            const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2').trim();
            if (value) return value;
        }
    }
    return '';
}

const bypassToken = (
    process.env.SMOKE_BYPASS_TOKEN ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    bypassTokenFromDotEnv() ||
    ''
).trim();
// Two shapes on purpose. A browser gets BOTH headers: set-bypass-cookie makes
// Vercel plant the _vercel_jwt cookie, so every later navigation and XHR from
// the page is authenticated too. A plain fetch must send the bypass header
// ALONE — asking Vercel to set a cookie answers 307, and following that redirect
// from Node fails outright, which the API probe would then swallow as "no API
// reachable": a false negative that hides a real outage behind an auth quirk.
const bypassHeaders = bypassToken
    ? { 'x-vercel-protection-bypass': bypassToken, 'x-vercel-set-bypass-cookie': 'true' }
    : {};
const bypassProbeHeaders = bypassToken
    ? { 'x-vercel-protection-bypass': bypassToken }
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

/** Poll `read` until it answers something truthy, or fail with `message`. */
async function waitFor(read, timeoutMs, message) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = await read();
        if (value) return value;
        if (Date.now() > deadline) throw new Error(message);
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
}

/** The checkout's own attempt record — what a retry resolves to reuse. */
const readAttemptRecord = (page) => page.evaluate(() => {
    try {
        const raw = localStorage.getItem('coalition_checkout_attempt');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
});

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

// Evidence for the settled-attempt check (step 7): the attempt lookups it
// answered, and the order writes, error reports and destination navigations it
// stopped. Nothing here leaves the browser.
const attemptProbes = [];
const blockedWrites = [];
const settledDestinations = [];

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
const apiAvailable = await fetch(`${target}/api/payment-settings`, { headers: bypassProbeHeaders })
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
    // dist/shop/index.html prerendered page (no React root on the page until hydration), while Vercel's
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
    // The grid renders progressively, so reading links the instant the first
    // card appears captures a partial list — an early read of this shop has
    // returned a single link where a settled page lists all 30. Wait for more
    // than one card, bounded and tolerant of a genuinely tiny catalog, so the
    // classification below can actually see both the sellable and sold-out
    // states instead of reporting a skip on every run.
    await page
        .waitForFunction(() => document.querySelectorAll('a[href*="/product/"]').length > 1, null, {
            timeout: 5000,
        })
        .catch(() => {});
    const productHrefs = await page.evaluate(() => [
        ...new Set(
            [...document.querySelectorAll('a')]
                .map((a) => a.getAttribute('href'))
                .filter((href) => /\/product\//.test(href || '')),
        ),
    ]);
    await check('shop lists a product', () => (productHrefs.length ? `${productHrefs.length} listed` : null));

    // ---- 2. product page offers a bag button, and a size ------------------
    // Both sellable and sold-out states get exercised, because both are real and
    // only one is sellable. A sold-out piece legitimately renders NO working Add
    // to bag — ProductDetails either disables the button (plain stock-out: the
    // item ran out, button is greyed) or replaces the whole CTA with a "Request
    // similar style" control plus an Archived/Claimed status (archived piece).
    // Taking the first link and demanding a buy control failed at random whenever
    // the shop led with an archived drop, while merely skipping those pages left
    // the sold-out state untested.
    //
    // Sold-out pieces are identified from the LISTING, not by probing product
    // pages one at a time: the shop's ordering is not a contract, so a fixed
    // slice of the list sometimes contained none and the check reported a skip
    // on every run. Two listing signals cover the two sold-out states:
    //
    //   - Archived (archived && soldAt): ProductCard overlays the card with a
    //     "Claimed" chip. Walk up from that chip to the nearest ancestor holding
    //     the card's link — depends on neither Tailwind classes nor the anchor
    //     wrapping the overlay (it does not).
    //   - Plain stock-out (!archived && totalStock === 0): the card still renders
    //     its Quick Add / Add to bag button, but disabled. The button is found by
    //     role/text within the card, and its disabled state is the signal.
    //
    // The live shop currently lists archived pieces but no plain stock-out ones;
    // each branch reports skipped only when its kind is genuinely absent, rather
    // than passing blindly. The plain-stock-out branch is the less-exercised one
    // and is flagged as such.
    step = 'product';
    // Two sold-out states live on the listing, detected two ways:
    //   - archived pieces: ProductCard overlays the card with a "Claimed" chip.
    //   - plain stock-out (!archived && totalStock===0): the card's Quick Add /
    //     Add to bag button is rendered disabled.
    const { archivedHrefs, stockoutHrefs } = await page.evaluate(() => {
        const archived = new Set();
        const claimed = [...document.querySelectorAll('span')].filter(
            (span) => (span.textContent || '').trim().toLowerCase() === 'claimed',
        );
        for (const span of claimed) {
            let node = span;
            while (node && !node.querySelector('a[href*="/product/"]')) node = node.parentElement;
            const href = node?.querySelector('a[href*="/product/"]')?.getAttribute('href');
            if (href) archived.add(href);
        }

        const stockout = new Set();
        // Each product card's primary call-to-action is a button whose text matches
        // "Quick Add" / "Add to bag" / "Add to cart". For a plain stock-out card
        // that button is present but disabled (aria-disabled or the disabled attr),
        // which is the listing-level signal for !archived && totalStock===0.
        const cards = document.querySelectorAll('a[href*="/product/"]');
        for (const link of cards) {
            const href = link.getAttribute('href');
            if (!href || !href.includes('/product/')) continue;
            const card = link.closest('article, div.group, section, li') || link.parentElement?.closest('article, div, section, li') || link;
            const addBtns = [...card.querySelectorAll('button')].filter(
                (b) => /add to (bag|cart)|quick add/i.test((b.textContent || '').trim()) ||
                    (b.getAttribute('aria-label') && /add to (bag|cart)|quick add/i.test(b.getAttribute('aria-label') || '')),
            );
            if (addBtns.length && addBtns.every((b) => b.disabled || b.getAttribute('aria-disabled') === 'true')) {
                stockout.add(href);
            }
        }

        return { archivedHrefs: [...archived], stockoutHrefs: [...stockout] };
    });

    const soldOutHrefs = [...archivedHrefs, ...stockoutHrefs];

    // Find something sellable. Bounded: a shop where the first ten sellable
    // listings all lack a working buy button is a real failure, not a reason to
    // crawl the whole catalogue.
    const sellable = productHrefs.filter((href) => !soldOutHrefs.includes(href)).slice(0, 10);
    let productHref = null;
    for (const href of sellable) {
        await page.goto(target + href, { waitUntil: 'load' });
        const bag = page.getByRole('button', { name: /add to (bag|cart)/i }).first();
        const hasBag = await bag
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true)
            .catch(() => false);
        if (hasBag) {
            productHref = href;
            break;
        }
    }
    assert(productHref, `no purchasable product among ${sellable.length} sellable listings`);

    // ---- 2b. archived sold-out piece: no buy button, explicit status, escape ----
    // A sold-out archived piece offers NO Add to bag at all — ProductDetails swaps
    // in an aria-label="Request similar style" control and an Archived/Claimed
    // status. Skipped only when the shop lists no archived piece at all.
    if (archivedHrefs.length) {
        await page.goto(target + archivedHrefs[0], { waitUntil: 'load' });
        await check('archived sold-out product offers no buy button and states why', async () => {
            const bagButtons = await page.getByRole('button', { name: /add to (bag|cart)/i }).count();
            assert(bagButtons === 0, `archived sold-out product still rendered ${bagButtons} buy button(s)`);
            // The status renders just after the boot signal, so wait for it rather
            // than reading the instant the page is interactive.
            const status = await page
                .getByText(/^(Claimed|Archived)$/i)
                .first()
                .waitFor({ state: 'visible', timeout: 15000 })
                .then(() => true)
                .catch(() => false);
            assert(status, 'archived sold-out product shows no Claimed/Archived status');
            const cta = await page
                .getByRole('button', { name: /request similar style/i })
                .first()
                .waitFor({ state: 'visible', timeout: 15000 })
                .then(() => true)
                .catch(() => false);
            assert(cta, 'archived sold-out product offers no "Request similar style" path');
            return `${archivedHrefs[0]} — ${archivedHrefs.length} of ${productHrefs.length} listed archived`;
        });
    } else {
        results.push({ name: 'archived sold-out product offers no buy button and states why', ok: true, skipped: true });
        console.log(
            '  skip  archived sold-out product offers no buy button and states why — the shop lists no archived product',
        );
    }

    // ---- 2c. plain stock-out piece: buy button present but disabled, status Archived ----
    // A plain stock-out product (!archived, totalStock===0) is NOT the same surface
    // as an archived piece: the Add to bag button still renders, greyed/disabled,
    // because the product is still in the catalogue — it just has nothing left. The
    // detail page states "Archived" as the availability label and "Request a similar
    // custom" as the detail, and the button is disabled. Skipped only when the shop
    // lists no such product at all.
    if (stockoutHrefs.length) {
        await page.goto(target + stockoutHrefs[0], { waitUntil: 'load' });
        await check('plain stock-out product disables the buy button and states why', async () => {
            const bag = page.getByRole('button', { name: /add to (bag|cart)/i }).first();
            const present = await bag.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
            assert(present, 'plain stock-out product did not render an Add to bag button at all');
            const disabled = await bag.isDisabled();
            assert(disabled, 'plain stock-out product rendered a working Add to bag button');
            // Availability label is "Archived" for both sold-out states (the detail
            // page treats a stockout the same as a manual archive from the shopper's
            // POV — it is not for sale).
            const status = await page
                .getByText(/^(Claimed|Archived)$/i)
                .first()
                .waitFor({ state: 'visible', timeout: 15000 })
                .then(() => true)
                .catch(() => false);
            assert(status, 'plain stock-out product shows no Claimed/Archived status');
            // The detail line for a plain stock-out is "Request a similar custom".
            const detail = await page.locator('body').innerText();
            assert(
                detail.includes('Request a similar custom'),
                `plain stock-out product detail did not include "Request a similar custom"; saw: ${detail.slice(0, 200)}`,
            );
            // There must still be a way out — a "Request similar style" path exists
            // (archived pieces swap the button for it; stock-out pieces keep a disabled
            // button but the page must not leave the shopper at a dead end).
            const cta = await page
                .getByRole('button', { name: /request similar style/i })
                .first()
                .waitFor({ state: 'visible', timeout: 15000 })
                .then(() => true)
                .catch(() => false);
            assert(cta, 'plain stock-out product offers no "Request similar style" path');
            return `${stockoutHrefs[0]} — ${stockoutHrefs.length} of ${productHrefs.length} listed plain stock-out`;
        });
    } else {
        results.push({ name: 'plain stock-out product disables the buy button and states why', ok: true, skipped: true });
        console.log(
            '  skip  plain stock-out product disables the buy button and states why — the shop lists no plain stock-out product',
        );
    }

    // Continue the money path on the product that actually sells.
    await page.goto(target + productHref, { waitUntil: 'load' });
    const addToBag = page.getByRole('button', { name: /add to (bag|cart)/i }).first();
    await addToBag.waitFor({ state: 'visible' });
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
    const SETTLED_CHECK = 'a recorded attempt resolves instead of writing a second order';
    const SETTLED_ORDER = 'ORD-SMOKE-SETTLED';
    const NOTICE_KEY = 'coalition_smoke_settled_notice';
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

        // ---- 7. a settled attempt resolves instead of writing again --------
        // The "already recorded" branch (pages/Checkout.tsx) only fires when the
        // server says the attempt this browser already sent produced an order —
        // which on a real deployment means a real order exists. This drives the
        // branch with NO stored order at all:
        //
        //   • every order write is BLOCKED at the network layer. That is also
        //     what keeps the attempt alive: the first confirm fails before the
        //     server records anything, so the record it minted survives — the
        //     same state a write that landed but never answered leaves behind.
        //   • the server's answer to "is this attempt recorded?" is then supplied
        //     locally, so the branch is reached without a stored order existing.
        //   • /api/report-error is blocked too (the deliberate failure would
        //     otherwise email the owner), and the branch's destination is held
        //     and then answered with a stub, so that page's own recovery write
        //     never runs either and the notice stays on screen to be asserted.
        //
        // So this check cannot create an order, send an email or touch the
        // voucher — and it proves that about itself before clicking anything.
        step = 'settled-attempt';
        await page.route(/\/api\/complete-order(\?|$)/, async (route) => {
            blockedWrites.push(route.request().postData() || '');
            await route.abort();
        });
        // Nothing is asserted about this one: its block is proven live by the
        // pre-click probe below, which is what has to hold before any click.
        await page.route(/\/api\/report-error(\?|$)/, (route) => route.abort());
        await page.route(/\/api\/order-attempt(\?|$)/, async (route) => {
            let probe = {};
            try {
                probe = JSON.parse(route.request().postData() || '{}');
            } catch {
                // recorded unreadable so the check reports what it actually sent
            }
            attemptProbes.push(probe);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ recorded: true, orderNumber: SETTLED_ORDER }),
            });
        });
        // The branch's destination is recorded, held briefly and then answered
        // with a stub. Held, because it is the OUTGOING page that shows the
        // "already recorded" notice and the checkout leaves for it in the same
        // tick; answered with a stub, because loading the real confirmation page
        // would start that page's own recovery write — a different path with a
        // different reason to exist. (Aborting it instead replaces the document
        // with an error page, and takes any chance of capturing the notice with
        // it.)
        const DESTINATION_HOLD_MS = 3000;
        await page.route(/\/order\/success(\?|$)/, async (route) => {
            settledDestinations.push(route.request().url());
            await new Promise((resolve) => setTimeout(resolve, DESTINATION_HOLD_MS));
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>settled destination</title>held for the check',
            });
        });

        // Prove the blocks are live BEFORE any confirm is clicked: a route that
        // stopped matching (a renamed path) must refuse the run, not click a
        // button that could write a real order or email the owner.
        const isBlocked = (path) => page.evaluate(async (url) => {
            try {
                await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                return false;
            } catch {
                return true;
            }
        }, path);
        assert(await isBlocked('/api/complete-order'),
            'refusing to run: the order-write block is not active, so a confirm could place a real order');
        assert(await isBlocked('/api/report-error'),
            'refusing to run: the error-report block is not active, so the deliberate failure could email the owner');

        // The manual method is selected BEFORE the form is filled: with card
        // selected, the first shipping field typed creates a real Stripe
        // PaymentIntent (a debounced effect), and a smoke run must create none.
        const moreOptions = page.getByRole('button', { name: /more payment options/i }).first();
        if ((await moreOptions.count()) && (await moreOptions.getAttribute('aria-expanded')) !== 'true') {
            await moreOptions.click({ timeout: 10000 });
        }
        let manualMethod = null;
        for (const candidate of [
            { method: 'crypto', radio: /pay with crypto/i },
            { method: 'cashapp', radio: /cash app/i },
        ]) {
            const radio = page.getByRole('radio', { name: candidate.radio }).first();
            if ((await radio.count()) > 0) {
                await radio.check({ timeout: 10000 });
                manualMethod = candidate.method;
                break;
            }
        }

        if (!manualMethod) {
            // Nothing to drive: the owner turned both manual methods off. Reported
            // as a skip, never as a pass.
            results.push({ name: SETTLED_CHECK, ok: true, skipped: true });
            console.log(`  skip  ${SETTLED_CHECK} — this deployment offers no manual payment method to confirm`);
        } else {
            await check(SETTLED_CHECK, async () => {
                const confirm = page.getByRole('button', { name: /i have sent the payment/i }).first();
                await confirm.waitFor({ state: 'visible', timeout: 20000 });
                // Filled so validateShipping() lets the confirm through. Its
                // preview and zip reads are debounced and the attempt
                // fingerprint includes shipping cost, so they are given a moment
                // to settle: a fingerprint still moving between the two confirms
                // below would mint a different attempt instead of reusing one.
                for (const [placeholder, value] of Object.entries({
                    'Email Address': 'smoke+settled-attempt@example.com',
                    'Full Name': 'Settled Attempt Smoke',
                    'Address': '1 Smoke Test Way',
                    'City': 'New York',
                    'State / Province': 'NY',
                    'ZIP / Postal Code': '10001',
                    'Country': 'United States',
                })) {
                    await page.getByPlaceholder(placeholder, { exact: true }).first().fill(value);
                }
                await page.waitForTimeout(1500);

                // First confirm: a fresh attempt, whose write is blocked — so the
                // attempt it minted is still in place for the retry to reuse.
                assert(!(await readAttemptRecord(page)), 'an attempt record already existed before the first confirm');
                const writesBeforeFirst = blockedWrites.length;
                await confirm.click();
                await waitFor(() => blockedWrites.length > writesBeforeFirst, 20000,
                    'the first confirm never attempted the order write — is this target configured with a database?');
                const attempt = await waitFor(() => readAttemptRecord(page), 10000,
                    'the failed confirm left no attempt record behind for a retry to reuse');
                assert(attempt.id, `the attempt record carries no usable id: ${JSON.stringify(attempt)}`);
                assert(attemptProbes.length === 0, 'a brand-new attempt was probed before it had been sent anywhere');
                const writesAfterFirst = blockedWrites.length;

                // The notice the branch shows lives in the document the
                // navigation is leaving, so it is captured IN that page — into
                // sessionStorage, which survives the navigation — instead of
                // being queried from outside after the page has gone.
                await page.evaluate((key) => {
                    sessionStorage.removeItem(key);
                    new MutationObserver(() => {
                        const line = (document.body ? document.body.innerText : '')
                            .match(/[^\n]*already recorded[^\n]*/i);
                        if (line) sessionStorage.setItem(key, line[0].trim().slice(0, 160));
                    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
                }, NOTICE_KEY);

                // Second confirm: the retry the timeout copy tells the shopper to
                // make. Playwright waits for the button to come back from
                // 'Processing...' — the state the first failure leaves it in.
                await confirm.click();
                const probe = await waitFor(() => attemptProbes[attemptProbes.length - 1], 20000,
                    'the retry never asked the server whether its attempt was already recorded');
                assert(probe.id === attempt.id,
                    `the retry asked about ${probe.id} instead of the recorded attempt ${attempt.id}`);
                assert(probe.customerEmail === 'smoke+settled-attempt@example.com',
                    `the lookup did not carry the buyer it belongs to: ${JSON.stringify(probe)}`);
                // Which way the branch went is decided by the first thing it does
                // once the server has answered: leave for the order it recorded,
                // or write one. Racing the two is what makes the failure name the
                // defect — a second order for one purchase — rather than whatever
                // the page happened to do next.
                const outcome = await waitFor(() => {
                    if (settledDestinations.length) return 'resolved';
                    if (blockedWrites.length > writesAfterFirst) return 'wrote';
                    return null;
                }, 20000, 'the retry neither resolved to the recorded order nor wrote one');
                assert(outcome === 'resolved',
                    'the settled retry wrote a second order instead of resolving to the one already recorded'
                    + ` (${blockedWrites.length - writesAfterFirst} write(s) for one purchase)`);
                const destination = settledDestinations[0];
                assert(/\/order\/success/.test(destination),
                    `the settled branch sent the shopper to ${destination} instead of their order`);
                // The captured notice and the order number the branch resolved
                // are read once the branch has actually left the checkout, which
                // is what makes both of them durable evidence rather than a race.
                await page.waitForURL(/\/order\/success(\?|$)/, { timeout: 20000 });
                const captured = await page.evaluate((key) => ({
                    notice: sessionStorage.getItem(key),
                    orderNumber: sessionStorage.getItem('orderNumber'),
                }), NOTICE_KEY);
                assert(captured.notice && /already recorded/i.test(captured.notice),
                    `the checkout never told the shopper the purchase was already recorded (captured: ${captured.notice})`);
                assert(captured.orderNumber === SETTLED_ORDER,
                    `the checkout did not carry the recorded order forward (orderNumber = ${captured.orderNumber})`);
                return `${manualMethod}: reused ${attempt.id} → ${SETTLED_ORDER}`
                    + ` (${blockedWrites.length} write(s) stopped, none from the retry)`;
            });
        }
    } else {
        // Only reachable for a loopback target with SMOKE_SKIP_API=1: the static
        // preview has no serverless functions, so the pricing agreement is
        // reported as skipped rather than passed.
        results.push({ name: 'checkout total matches the server', ok: true, skipped: true });
        console.log('  skip  checkout total matches the server — no API on this host (client flow only)');
        // Step 7 sits behind the same API — without /api there are no payment
        // settings and no manual-method surface to drive — so it is reported as
        // skipped too. Left out of the report, a green run would read as if the
        // settled branch had been checked when it never ran.
        results.push({ name: SETTLED_CHECK, ok: true, skipped: true });
        console.log(`  skip  ${SETTLED_CHECK} — no API on this host (client flow only)`);
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
// Name every skipped check rather than assuming the only possible skip is the
// API one, and keep the API reason explicit where it applies.
const skippedNames = results.filter((r) => r.skipped).map((r) => r.name);
let skipNote = '';
if (skippedNames.includes('checkout total matches the server')) {
    skipNote = ` — checkout pricing NOT verified (no API at ${host})`;
}
if (skippedNames.length > 1 && skippedNames.includes('checkout total matches the server')) {
    skipNote += `; the other skips name their own reason above`;
}
if (failure) {
    console.error(`\nSMOKE FAILED at "${failure.step}": ${failure.error}`);
    console.error(`${passed}/${results.length} checks passed against ${target}`);
    process.exit(1);
}
const total = results.length;
console.log(
    skipped === 0
        ? `\nSMOKE OK — ${passed}/${total} checks passed against ${target}`
        : `\nSMOKE OK (partial) — ${passed}/${total} checks passed, ${skipped} skipped: ` +
          `${skippedNames.join('; ')}${skipNote}`,
);
