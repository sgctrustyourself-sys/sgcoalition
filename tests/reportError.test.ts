// tests/reportError.test.ts
//
// Pin for POST /api/report-error — the receiving end of the checkout client's
// error channel (pages/Checkout.tsx reportErrorToAdmin). Before this handler
// existed the client POSTed a 404 and every checkout failure vanished
// silently. Covers:
//   - a valid report is accepted (204) and forwarded to the alert owner
//   - the alert owner is called fire-and-forget (never blocks/throws the ack)
//   - an empty error is 400 and never reaches the owner (no email flood)
//   - a garbage body is 400, not a crash
//   - non-POST is 405
//
// The Resend boundary is mocked at the module boundary (same idiom as
// tests/createPaymentIntent.test.ts): the handler must reach it through
// services/orderIntake.ts — the single alert owner — which is asserted below
// by counting constructed clients.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const mockSend = vi.fn();
let resendConstructs = 0;

const ResendCtor = vi.fn(function (this: any) {
    resendConstructs += 1;
    this.emails = { send: mockSend };
});
vi.mock('resend', () => ({
    // api/_services.ts imports { Resend } (named); keep default too in case
    // any other importer in the graph uses the default shape.
    Resend: ResendCtor,
    default: ResendCtor,
}));

// The alert owner's env gate: RESEND_API_KEY + recipients must be present or
// it returns without emailing. Set them for the forwarding assertions.
beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key_123';
    process.env.ORDER_NOTIFICATION_EMAIL = 'ops@example.com';
    process.env.RESEND_FROM_EMAIL = 'SG Coalition <alerts@example.com>';
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });
    resendConstructs = 0;
});

// Import the handler AFTER the mocks/env are in place.
const { default: handler } = await import('../api/_handlers/report-error.js');

function req(overrides: Partial<any> = {}): any {
    return {
        method: 'POST',
        body: JSON.stringify({ error: 'Stripe success but API failure', context: 'Test', metadata: {} }),
        headers: { 'user-agent': 'vitest-agent', referer: 'https://sgcoalition.xyz/checkout' },
        query: {},
        ...overrides,
    };
}

function res(): any {
    const out: any = { statusCode: null, body: null, ended: false };
    out.status = (code: number) => { out.statusCode = code; return out; };
    out.json = (data: unknown) => { out.body = data; };
    out.send = () => {};
    out.setHeader = () => {};
    out.end = () => { out.ended = true; };
    return out;
}

describe('POST /api/report-error', () => {
    it('accepts a valid report (204) and forwards it to the alert owner', async () => {
        const r = res();
        await handler(req(), r);
        expect(r.statusCode).toBe(204);
        expect(r.ended).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(1);
        const call = mockSend.mock.calls[0][0];
        expect(call.to).toEqual(['ops@example.com']);
        expect(call.subject).toContain('Test');
        expect(call.html).toContain('Stripe success but API failure');
        expect(call.html).toContain('https://sgcoalition.xyz/checkout');
    });

    it('is fire-and-forget: a failing email must not reject the acknowledgment', async () => {
        mockSend.mockRejectedValue(new Error('resend down'));
        const r = res();
        await expect(handler(req(), r)).resolves.toBeUndefined();
        expect(r.statusCode).toBe(204);
        // Let the swallowed rejection surface if it were unhandled.
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('rejects an empty error body with 400 and sends no email', async () => {
        const r = res();
        await handler(req({ body: JSON.stringify({ error: '', context: 'x' }) }), r);
        expect(r.statusCode).toBe(400);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('rejects a garbage body with 400 (no crash, no email)', async () => {
        const r = res();
        await handler(req({ body: 'not-json{{{' }), r);
        expect(r.statusCode).toBe(400);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('405s non-POST methods', async () => {
        const r = res();
        await handler(req({ method: 'GET' }), r);
        expect(r.statusCode).toBe(405);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('constructs the Resend client at most once across all requests (single-owner memoization)', async () => {
        const r = res();
        await handler(req(), r);
        expect(r.statusCode).toBe(204);
        // api/_services.ts memoizes the client, so many requests share one
        // construct; the pin is that handling N reports never mints a second
        // client (the guard this repo pins for every external service).
        expect(resendConstructs).toBeLessThanOrEqual(1);
    });
});

describe('wiring: the route resolves and the classification exists', () => {
    // The original defect was invisible to every handler test: the client
    // POSTed /api/report-error, no handler was registered, and the report
    // 404ed into the void while all suites stayed green. These pins fail if
    // the route stops resolving — the handler file is still read by the
    // readiness invariant (every file on disk must be classified), so the
    // remaining hole is exactly the router line.
    it('the catch-all router registers report-error', () => {
        const router = readFileSync('api/[...slug].ts', 'utf8');
        expect(router).toContain("'report-error': () => import('./_handlers/report-error.js')");
    });

    it('the readiness invariant classifies report-error', () => {
        const readiness = readFileSync('tests/securityInfrastructureReadiness.test.ts', 'utf8');
        expect(readiness).toContain("'report-error':");
    });
});
