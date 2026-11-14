// scripts/check-stripe-3ds.mjs
//
// Local Stripe test-mode 3DS check under the PRODUCTION CSP.
//
// Why this exists: the config tests prove the header string contains
// hooks.stripe.com, but they cannot prove a browser can mount Stripe.js, open
// the 3DS2 challenge frame, and come back through return_url. This check does.
//
// What it does, without touching the app's cart or database:
//   1. reads the exact Content-Security-Policy value from vercel.json;
//   2. starts a loopback-only HTTP server that sends that value on every page;
//   3. creates a test-mode PaymentIntent with 3DS forced;
//   4. serves a minimal checkout with the real Stripe Payment Element;
//   5. drives the 3DS-required test card 4000 0025 0000 3155 in Chromium;
//   6. asserts a frame from hooks.stripe.com appears, completes the challenge,
//      and lands on /return with redirect_status=succeeded;
//   7. fails on any CSP report that blocked js/hooks/api .stripe.com.
//
// It is deliberately not the full cart flow: the money-path smoke test already
// covers pricing and order writes without paying. This check owns the one thing
// that requires a real payment: Stripe.js + the 3DS frame under the deployed
// policy.
//
// Usage:
//   npm run check:stripe-3ds
//   STRIPE_3DS_HEADED=1 npm run check:stripe-3ds   # watch the browser
//
// Requires VITE_STRIPE_PUBLISHABLE_KEY (pk_test_…) and STRIPE_SECRET_KEY
// (sk_test_…), normally from .env.local. It REFUSES live keys. Missing/bad keys
// exit 2; a failed checkout or CSP assertion exits 1; success exits 0.
//
// Chromium is Playwright's; one-time install: npx playwright install chromium.
// Failure screenshots go to .checkout-smoke-artifacts/ (already gitignored).

import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import Stripe from 'stripe';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT_DIR = join(ROOT, '.checkout-smoke-artifacts');
const TEST_CARD = '4000002500003155';

// Load local values without overriding an explicitly exported environment.
dotenv.config({ path: join(ROOT, '.env.local'), quiet: true });
dotenv.config({ path: join(ROOT, '.env'), quiet: true });

const publishableKey = (
    process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    ''
).trim();
const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();

function missingConfig(message) {
    console.error(`stripe-3ds: ${message}`);
    console.error('  Set test-mode keys in .env.local, then re-run `npm run check:stripe-3ds`.');
    process.exit(2);
}

if (!publishableKey) missingConfig('VITE_STRIPE_PUBLISHABLE_KEY is not set.');
if (!secretKey) missingConfig('STRIPE_SECRET_KEY is not set.');
if (!publishableKey.startsWith('pk_test_') || !/^(sk|rk)_test_/.test(secretKey)) {
    missingConfig('refusing to run with live keys; both keys must be test-mode (pk_test_/sk_test_).');
}

const stripe = new Stripe(secretKey);

// ── Production CSP ─────────────────────────────────────────────────────────
function productionCsp() {
    let config;
    try {
        config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    } catch (error) {
        missingConfig(`could not read vercel.json: ${error instanceof Error ? error.message : String(error)}`);
    }
    const headerEntries = (config.headers || []).flatMap((entry) => entry.headers || []);
    const csp = headerEntries.find((header) => header.key === 'Content-Security-Policy')?.value || '';
    if (!csp) missingConfig('vercel.json has no Content-Security-Policy header.');

    const required = [
        ['script-src', /script-src[^;]*https:\/\/js\.stripe\.com/],
        ['frame-src js.stripe.com', /frame-src[^;]*https:\/\/js\.stripe\.com/],
        ['frame-src hooks.stripe.com', /frame-src[^;]*https:\/\/hooks\.stripe\.com/],
        ['connect-src api.stripe.com', /connect-src[^;]*https:\/\/api\.stripe\.com/],
    ];
    for (const [label, pattern] of required) {
        if (!pattern.test(csp)) missingConfig(`production CSP is missing ${label}; this check would not be meaningful.`);
    }
    return csp;
}

const csp = productionCsp();

// ── Test-mode PaymentIntent ────────────────────────────────────────────────
console.log('stripe-3ds: creating a test-mode PaymentIntent with 3DS forced...');
let paymentIntent;
try {
    paymentIntent = await stripe.paymentIntents.create({
        amount: 1000,
        currency: 'usd',
        payment_method_types: ['card'],
        payment_method_options: { card: { request_three_d_secure: 'any' } },
        description: 'Local production-CSP 3DS check',
        metadata: { purpose: 'csp-3ds-check' },
    });
} catch (error) {
    console.error(`stripe-3ds: PaymentIntent creation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
}
if (!paymentIntent.client_secret) {
    console.error('stripe-3ds: PaymentIntent returned no client_secret.');
    process.exit(2);
}

// ── Loopback server with the production header ─────────────────────────────
const cspReports = [];

const readBody = async (req) => {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 64 * 1024) return '';
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
};

const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const jsLiteral = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const checkoutHtml = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stripe 3DS CSP check</title>
  <style>
    body { background: #0a0a0a; color: #e5e5e5; font-family: system-ui, sans-serif; padding: 32px; }
    main { max-width: 480px; margin: 0 auto; }
    #payment-element { background: #111; padding: 16px; border-radius: 8px; margin: 20px 0; }
    button { width: 100%; padding: 14px; border: 0; border-radius: 8px; font-weight: 700; cursor: pointer; }
    #message { color: #f87171; white-space: pre-wrap; }
  </style>
  <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
  <main>
    <h1>Stripe 3DS CSP check</h1>
    <p>Test mode only. Card ${TEST_CARD} requires 3DS.</p>
    <form id="payment-form">
      <div id="payment-element"></div>
      <button id="submit" type="submit">Pay $10.00</button>
      <p id="message" role="alert"></p>
    </form>
  </main>
  <script>
    (() => {
      const stripe = Stripe(${jsLiteral(publishableKey)});
      const elements = stripe.elements({ clientSecret: ${jsLiteral(paymentIntent.client_secret)} });
      const paymentElement = elements.create('payment', { layout: 'tabs' });
      paymentElement.mount('#payment-element');
      paymentElement.on('loaderror', (event) => {
        document.getElementById('message').textContent = 'Payment Element failed to load: ' + (event.error?.message || 'unknown');
      });
      document.getElementById('payment-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('submit');
        button.disabled = true;
        const message = document.getElementById('message');
        message.textContent = '';
        try {
          const { error } = await stripe.confirmPayment({
            elements,
            redirect: 'always',
            confirmParams: { return_url: location.origin + '/return' },
          });
          if (error) {
            message.textContent = error.message || 'Payment failed.';
            button.disabled = false;
          }
        } catch (error) {
          message.textContent = error instanceof Error ? error.message : String(error);
          button.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;

const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const headers = {
        'Content-Security-Policy': csp,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    };

    if (req.method === 'POST' && url.pathname === '/api/csp-report') {
        const raw = await readBody(req);
        try {
            const report = JSON.parse(raw)['csp-report'];
            if (report) {
                cspReports.push({
                    directive: report['effective-directive'] || report['violated-directive'] || '',
                    blocked: report['blocked-uri'] || '',
                    document: report['document-uri'] || '',
                });
            }
        } catch {
            // A malformed report is not the checkout's problem.
        }
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== 'GET') {
        res.writeHead(405, { ...headers, 'Content-Type': 'text/plain' });
        res.end('Method not allowed');
        return;
    }

    if (url.pathname === '/') {
        res.writeHead(200, headers);
        res.end(checkoutHtml());
        return;
    }

    if (url.pathname === '/return') {
        const status = url.searchParams.get('redirect_status') || 'missing';
        const passed = status === 'succeeded';
        res.writeHead(200, headers);
        res.end(`<!doctype html><html><body>
          <h1 id="result">${passed ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_NOT_SUCCEEDED'}</h1>
          <p>redirect_status: <code>${htmlEscape(status)}</code></p>
        </body></html>`);
        return;
    }

    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    res.end('Not found');
});

await new Promise((resolve, reject) => {
    server.once('error', reject);
    // `localhost` (not 127.0.0.1) is Stripe's documented local return_url host.
    // It still resolves to loopback; nothing is exposed off-machine.
    server.listen(0, 'localhost', resolve);
});
const { port } = server.address();
const origin = `http://localhost:${port}`;

// ── Browser drive ──────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(read, timeoutMs, message) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = await read();
        if (value) return value;
        if (Date.now() > deadline) throw new Error(message);
        await sleep(150);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

/** True when the frame is the hooks.stripe.com challenge or a child of it. */
function underHooks(frame) {
    for (let current = frame; current; current = current.parentFrame()) {
        if (current.url().includes('hooks.stripe.com')) return true;
    }
    return false;
}

async function clickChallenge(page) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        for (const frame of page.frames()) {
            if (!underHooks(frame)) continue;
            for (const name of [/complete authentication/i, /authorize/i, /complete/i, /approve/i]) {
                const button = frame.getByRole('button', { name }).first();
                if ((await button.count().catch(() => 0)) === 0) continue;
                if (!(await button.isVisible().catch(() => false))) continue;
                await button.click();
                return true;
            }
        }
        await page.waitForTimeout(200);
    }
    return false;
}

let browser;
let page;
let failure = null;
const diagnostics = { cspConsole: [], failedStripeRequests: [], pageErrors: [] };

try {
    browser = await chromium.launch({ headless: !process.env.STRIPE_3DS_HEADED });
    const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
    page = await context.newPage();
    page.setDefaultTimeout(30_000);

    const hooksRequests = [];

    page.on('request', (request) => {
        if (request.url().startsWith('https://hooks.stripe.com/')) hooksRequests.push(request.url());
    });
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        if (/content security policy|refused to/i.test(message.text())) diagnostics.cspConsole.push(message.text());
    });
    page.on('requestfailed', (request) => {
        if (/^https:\/\/(?:[^/]+\.)?(?:js|hooks|api)\.stripe\.com\//.test(request.url())) {
            diagnostics.failedStripeRequests.push(`${request.url()} — ${request.failure()?.errorText || 'failed'}`);
        }
    });
    page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));

    console.log(`stripe-3ds: serving ${origin} with the production CSP`);
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });

    const stripeFrame = page.frameLocator('iframe[title*="Secure payment" i]').first();
    const number = stripeFrame.locator('input[name="number"], input[autocomplete="cc-number"]').first();
    await number.waitFor({ state: 'visible' });
    await number.fill(TEST_CARD);
    await stripeFrame.locator('input[name="expiry"], input[autocomplete="cc-exp"]').first().fill('12 / 34');
    await stripeFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]').first().fill('123');
    const country = stripeFrame.locator('select[name="country"]').first();
    if ((await country.count()) > 0) await country.selectOption('US').catch(() => {});
    const postal = stripeFrame.locator('input[name="postalCode"], input[autocomplete="postal-code"]').first();
    if ((await postal.count()) > 0) await postal.fill('21201').catch(() => {});

    await page.getByRole('button', { name: /pay \$10/i }).click();

    const challengeFrame = await waitFor(
        () => page.frames().find((frame) => frame.url().includes('hooks.stripe.com')),
        30_000,
        `3DS challenge frame from hooks.stripe.com never loaded (requests: ${hooksRequests.length})`,
    );
    assert(hooksRequests.length > 0, '3DS challenge frame was found but no hooks.stripe.com request was observed');
    console.log(`stripe-3ds: 3DS challenge frame loaded — ${challengeFrame.url()}`);

    const clicked = await clickChallenge(page);
    assert(clicked, 'could not find a Complete/Authorize control inside the hooks.stripe.com challenge');

    await page.waitForURL(/\/return(?:[?#]|$)/, { timeout: 45_000 });
    const returned = new URL(page.url());
    assert(returned.pathname === '/return', `expected /return, landed on ${returned}`);
    assert(
        returned.searchParams.get('redirect_status') === 'succeeded',
        `return_url did not report success: ${returned.search}`,
    );
    const body = await page.locator('body').innerText();
    assert(body.includes('PAYMENT_SUCCEEDED'), `return page did not render success: ${body.slice(0, 200)}`);

    const confirmed = await stripe.paymentIntents.retrieve(paymentIntent.id);
    assert(confirmed.status === 'succeeded', `Stripe reports PaymentIntent status ${confirmed.status}, not succeeded`);

    await sleep(500); // let any final violation reports reach the local endpoint

    const fatalReports = cspReports.filter((report) => {
        const directive = String(report.directive || '');
        const blocked = String(report.blocked || '');
        return /^(script-src|frame-src|connect-src)/.test(directive)
            && /(?:js|hooks|api)\.stripe\.com/.test(blocked);
    });
    assert(
        fatalReports.length === 0,
        `CSP blocked a checkout-critical Stripe request: ${JSON.stringify(fatalReports)}`,
    );

    console.log('PASS  Payment Element mounted under the production CSP');
    console.log('PASS  3DS challenge frame loaded from hooks.stripe.com');
    console.log('PASS  challenge completed and /return reported redirect_status=succeeded');
    console.log('PASS  no checkout-critical Stripe CSP violations');
    if (diagnostics.failedStripeRequests.length > 0) {
        console.log('note  failed Stripe requests (may include post-navigation aborts):');
        for (const failureText of diagnostics.failedStripeRequests.slice(0, 5)) console.log(`      ${failureText}`);
    }
    if (cspReports.length > 0) {
        console.log(`note  ${cspReports.length} non-Stripe CSP report(s) arrived (left for the dashboard):`);
        for (const report of cspReports.slice(0, 5)) {
            console.log(`      ${report.directive} ${report.blocked}`);
        }
    }
} catch (error) {
    failure = error;
    console.error(`stripe-3ds: FAIL — ${error instanceof Error ? error.message : String(error)}`);
    if (page) {
        console.error(`  page: ${page.url()}`);
        const message = await page.locator('#message').innerText().catch(() => '');
        if (message.trim()) console.error(`  checkout message: ${message.trim()}`);
        for (const frame of page.frames()) console.error(`  frame: ${frame.url() || '(about:blank)'}`);
    }
    for (const message of diagnostics.cspConsole.slice(0, 8)) console.error(`  csp console: ${message}`);
    for (const failed of diagnostics.failedStripeRequests.slice(0, 8)) console.error(`  request failed: ${failed}`);
    for (const message of diagnostics.pageErrors.slice(0, 8)) console.error(`  page error: ${message}`);
} finally {
    try {
        if (page && failure) {
            mkdirSync(ARTIFACT_DIR, { recursive: true });
            const screenshot = join(ARTIFACT_DIR, `stripe-3ds-${Date.now()}.png`);
            await page.screenshot({ path: screenshot, fullPage: true });
            console.error(`  screenshot: ${screenshot}`);
        }
    } catch (screenshotError) {
        console.error(`  screenshot failed: ${screenshotError instanceof Error ? screenshotError.message : String(screenshotError)}`);
    }
    await browser?.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
}

process.exitCode = failure ? 1 : 0;
