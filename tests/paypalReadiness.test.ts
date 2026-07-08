// tests/paypalReadiness.test.ts
//
// Structural readiness contract for the LIVE PayPal order checkout path.
// This test does NOT exercise the PayPal SDK or run a real capture against
// api-m.paypal.com. Instead it locks the in-place wiring so a future commit
// cannot silently regress live readiness:
//
// 1. The Vercel router exposes the expected API routes (`paypal-order` and
//    `complete-order` - both are required for PayPal checkout to work).
// 2. The Supabase migration that adds PayPal payment columns + idempotency
//    indexes is on disk and contains the expected DDL.
// 3. The PayPal server-side order handler is in place and reaches the PayPal
//    REST API for both create and capture.
// 4. The order-write handler is in place and re-verifies the PayPal capture
//    before persisting an order.
// 5. The Checkout page renders the PayPal button container + creates/captures
//    a PayPal order in the SDK onApprove hook.
//
// Run: `npx.cmd vitest run tests/paypalReadiness.test.ts`
//
// If any of these assertions fails, ENV-var liftoff is NOT safe - a future
// commit silently broke the wiring required for live PayPal checkout.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

function readText(relativePath: string) {
    const absolute = resolve(ROOT, relativePath);
    return readFileSync(absolute, 'utf8');
}

describe('PayPal LIVE readiness contract', () => {
    describe('Vercel API router', () => {
        it('exposes paypal-order as a POST handler', () => {
            const router = readText('api/[...slug].ts');
            // Accept either the legacy dynamic-import shape (`() => import(...)`)
            // or the modern static-import shape (`paypalOrder` / `completeOrder`)
            // — both register the route in the handlers map. The static shape is
            // what Vercel's serverless bundler needs to keep module-init from
            // failing on routes the test doesn't exercise.
            expect(router).toMatch(/'paypal-order'\s*:\s*(?:paypalOrder|\(\)\s*=>\s*import)/);
        });

        it('exposes complete-order as a POST handler', () => {
            const router = readText('api/[...slug].ts');
            expect(router).toMatch(/'complete-order'\s*:\s*(?:completeOrder|\(\)\s*=>\s*import)/);
        });
    });

    describe('Supabase migration', () => {
        const migrationPath = 'supabase/migrations/20260617_add_paypal_order_fields.sql';

        it('migration file exists', () => {
            expect(existsSync(resolve(ROOT, migrationPath))).toBe(true);
        });

        it('adds the paypal_order_id column to orders', () => {
            const sql = readText(migrationPath);
            expect(sql).toMatch(/paypal_order_id\s+TEXT/i);
            expect(sql).toMatch(/ALTER TABLE[\s\S]+orders/i);
        });

        it('adds the payment_reference column to orders', () => {
            const sql = readText(migrationPath);
            expect(sql).toMatch(/payment_reference\s+TEXT/i);
        });

        it('enforces idempotency via a unique index on paypal_order_id', () => {
            // Mandatory so two syncs of the same PayPal capture do not double-write
            expect(readText(migrationPath)).toMatch(/UNIQUE INDEX[\s\S]+idx_orders_paypal_order_id_unique/i);
        });

        it('enforces idempotency via a unique index on payment_reference for paypal captures', () => {
            const sql = readText(migrationPath);
            expect(sql).toMatch(/UNIQUE INDEX[\s\S]+idx_orders_paypal_capture_id_unique/i);
            expect(sql).toMatch(/payment_method\s*=\s*'paypal'/i);
        });
    });

    describe('paypal-order handler', () => {
        it('routes the create action through PayPal /v2/checkout/orders', () => {
            const handler = readText('api/_handlers/paypal-order.ts');
            expect(handler).toMatch(/action\s*===\s*['"]create['"]/);
            expect(handler).toMatch(/\/v2\/checkout\/orders['"`]/);
            expect(handler).toMatch(/intent\s*:\s*['"]CAPTURE['"]/);
        });

        it('routes the capture action through PayPal /capture endpoint', () => {
            const handler = readText('api/_handlers/paypal-order.ts');
            expect(handler).toMatch(/action\s*===\s*['"]capture['"]/);
            expect(handler).toMatch(/\/v2\/checkout\/orders\/\$\{[^}]+\}\/capture/);
        });

        it('uses client_credentials OAuth for the access token', () => {
            const handler = readText('api/_handlers/paypal-order.ts');
            expect(handler).toMatch(/\/v1\/oauth2\/token/);
            expect(handler).toMatch(/grant_type=client_credentials/);
        });

        it('selects live vs sandbox based on PAYPAL_ENV', () => {
            const handler = readText('api/_handlers/paypal-order.ts');
            expect(handler).toMatch(/PAYPAL_LIVE_API\s*=\s*['"]https:\/\/api-m\.paypal\.com['"]/);
            expect(handler).toMatch(/PAYPAL_SANDBOX_API\s*=\s*['"]https:\/\/api-m\.sandbox\.paypal\.com['"]/);
        });

        it('rejects store-credit pairing with PayPal to prevent abuse', () => {
            const handler = readText('api/_handlers/paypal-order.ts');
            expect(handler).toMatch(/Store credit cannot be combined with PayPal/i);
        });

        it('re-verifies the captured amount matches the order total before the save', () => {
            const handler = readText('api/_handlers/complete-order.ts');
            expect(handler).toMatch(/PayPal capture amount does not match order total/i);
        });

        it('returns 503 when PayPal columns are missing in the orders schema', () => {
            const handler = readText('api/_handlers/complete-order.ts');
            expect(handler).toMatch(/Order schema is missing PayPal payment columns/i);
        });
    });

    describe('Checkout page PayPal wiring', () => {
        it('renders the PayPal button container', () => {
            const checkout = readText('pages/Checkout.tsx');
            expect(checkout).toMatch(/id\s*=\s*['"]paypal-button-container-checkout['"]/);
        });

        it('renders the Pay Later message container', () => {
            const checkout = readText('pages/Checkout.tsx');
            expect(checkout).toMatch(/id\s*=\s*['"]paypal-pay-later-message-checkout['"]/);
        });

        it('uses window.paypal.Buttons for the SDK', () => {
            const checkout = readText('pages/Checkout.tsx');
            expect(checkout).toMatch(/window\.paypal\.Buttons/);
        });

        it('posts action=create to /api/paypal-order inside the SDK createOrder hook', () => {
            const checkout = readText('pages/Checkout.tsx');
            const hook = checkout.match(/createOrder\s*:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*(?:onApprove|onError|onCancel)/);
            expect(hook, 'createOrder hook not found in Checkout.tsx').toBeTruthy();
            expect(hook?.[0]).toMatch(/\/api\/paypal-order/);
            expect(hook?.[0]).toMatch(/action\s*:\s*['"]create['"]/);
        });

        it('writes the order with paypalOrderId + paypalCaptureId from the SDK approve hook', () => {
            const checkout = readText('pages/Checkout.tsx');
            const hook = checkout.match(/onApprove\s*:\s*async\s*\(data[\s\S]*?\},\s*(?:onError|onCancel)/);
            expect(hook, 'onApprove hook not found in Checkout.tsx').toBeTruthy();
            expect(hook?.[0]).toMatch(/paypalOrderId/);
            expect(hook?.[0]).toMatch(/paypalCaptureId/);
        });

        it('disables PayPal when the order total is zero (store-credit-only path)', () => {
            expect(readText('pages/Checkout.tsx')).toMatch(/requiresNoExternalPayment/);
        });
    });

    describe('AppContext paypal flow', () => {
        it('routes paypal orders through /api/complete-order with the verification payload', () => {
            // `/api/complete-order` runs the PayPal capture re-verification server-side
            // before saving. The body MUST include `verification` (the addOrder second arg)
            // so the server has paypalOrderId + paypalCaptureId to verify against PayPal.
            //
            // Locked as a JSON.stringify shortcut `{ order, verification }` rather than a
            // variable-name pattern so a future `paymentVerification = ...` rename does
            // not break the readiness gate for a no-op reason.
            const ctx = readText('context/AppContext.tsx');
            expect(ctx).toMatch(/\/api\/complete-order/);
            expect(ctx).toMatch(/mustUseOrderApi\s*=\s*order\.paymentMethod\s*===\s*['"]paypal['"]/);
            expect(ctx).toMatch(/JSON\.stringify\(\s*\{\s*order\s*,\s*verification\s*[,}]/);
        });
    });

    describe('PayPal SDK bridge', () => {
        it('declares window.paypal in global.d.ts so the SDK call type-checks', () => {
            // Without this declaration, a TypeScript regression on `window.paypal?.Messages`
            // or `window.paypal?.Buttons` would surface as a compile-time break instead
            // of a runtime brand-new-undefined error.
            const decl = readText('global.d.ts');
            expect(decl).toMatch(/paypal/);
        });

        it('locks the PayPal SDK load path: canonical CDN + URL shape + call ordering', () => {
            // Three-part contract:
            //   (a) When index.html embeds a PayPal SDK <script>, its URL must hit the
            //       canonical `sdk/js?client-id=...&components=buttons,messages` shape.
            //   (b) When index.html does NOT embed a script, the SDK must be loaded by
            //       some runtime mechanism that completes BEFORE Checkout.tsx evaluates
            //       the first window.paypal reference.
            //   (c) A regression that drops the SDK load entirely must fail this test -
            //       not pass vacuously because both sides are empty.
            const index = readText('index.html');
            const checkout = readText('pages/Checkout.tsx');
            const firstPaypalRef = checkout.search(/window\.paypal/);
            const scriptTag = index.match(/<script[^>]*paypal\.com[^>]*>/i);

            if (scriptTag) {
                // Lock the URL shape so a wrong CDN / stale path fails the readiness gate.
                // Require BOTH payload hints (sdk/js AND client-id) so a partial match
                // like `<script src="paypal.com/foo?client-id=bar"></script>` fails.
                expect(scriptTag[0]).toMatch(/sdk\/js/i);
                expect(scriptTag[0]).toMatch(/client-id=/i);
                return;
            }

            if (firstPaypalRef !== -1) {
                throw new Error(
                    'PayPal LIVE readiness: window.paypal is referenced in Checkout.tsx '
                    + 'but no PayPal SDK <script> is in index.html. Either add the SDK '
                    + 'script tag (with client-id, components=buttons,messages) or wire '
                    + 'a runtime loader that completes BEFORE Checkout.tsx evaluates '
                    + 'window.paypal.',
                );
            }

            // No script + no reference: vacuous but not a regression - warn so any future
            // commit that ADDS a window.paypal reference without adding the loader is caught.
            console.warn('[paypalReadiness] Neither PayPal SDK <script> in index.html nor '
                + 'window.paypal references in Checkout.tsx - readiness gate is vacuous. '
                + 'If you are removing the PayPal payment method entirely, also remove '
                + 'tests/paypalReadiness.test.ts.');
        });
    });

    // Locked test: 'sends referenceId + expectedTotal in the createOrder payload (dedupe key + tamper guard)' -- chain: file > describe('Checkout createOrder contract') > it(...); reverse pinned in pages/Checkout.tsx LOCK ('Locked by tests/paypalReadiness.test.ts.').
    describe('Checkout createOrder contract', () => {
        it('sends referenceId + expectedTotal in the createOrder payload (dedupe key + tamper guard)', () => {
            // The unique index on orders.paypal_order_id is what stops a double-write when
            // retried. The Checkout hook MUST include referenceId in the body so the
            // server-side reference_id on the PayPal purchase unit is set.
            //
            // expectedTotal is the client-tamper guard: the server re-derives the total
            // from cart cents, then refuses the order if they don't match.
            const checkout = readText('pages/Checkout.tsx');
            const hook = checkout.match(/createOrder\s*:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*(?:onApprove|onError|onCancel)/);
            expect(hook, 'createOrder hook not found').toBeTruthy();
            expect(hook?.[0]).toMatch(/referenceId\s*:/);
            expect(hook?.[0]).toMatch(/paypalOrderSeed\.orderId/);
            expect(hook?.[0]).toMatch(/expectedTotal\s*:/);
            // Pin exact LHS->RHS pairs so a future loosen-up can't pass a stale value.
            expect(hook?.[0]).toMatch(/shipping\s*:\s*shippingCost/);
            // `discountEffective` is the NO-STACK winner. See pages/Checkout.tsx for the exact Shark Tee math.
            // \b boundaries lock the identifiers so a future `discountEffective2` or
            // `cartBonusDollarsFoo` sibling does not silently satisfy this regex.
            expect(hook?.[0]).toMatch(/discount\s*:\s*\bcartBonusDollars\b\s*\+\s*\bdiscountEffective\b/);
        });
    });

    describe('complete-order DB upsert contract', () => {
        it('writes the snake_case paypal_order_id and payment_reference columns on the upsert', () => {
            // The Supabase row uses snake_case columns; if a maintainer renames the
            // write to camelCase the upsert falls through to the legacy fallback,
            // which strips the PayPal IDs into `notes`. Lock the snake_case writes
            // so that retry is real, not a notes-only log line.
            const handler = readText('api/_handlers/complete-order.ts');
            expect(handler).toMatch(/paypal_order_id\s*:\s*confirmation\.paypalOrderId/);
            expect(handler).toMatch(/payment_reference\s*:\s*confirmation\.paypalCaptureId/);
        });
    });
});
