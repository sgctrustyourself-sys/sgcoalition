// tests/sendEmailGate.test.ts
//
// Tests for the anti-relay gate on POST /api/send-email:
//   - anonymous callers may only email the owner notification address
//   - non-owner recipients require Authorization: Bearer <ADMIN_API_TOKEN>
//   - validation (missing fields, malformed recipient) happens before auth
//
// The handler is exercised with a mocked Resend boundary; no real email is
// sent. ADMIN_API_TOKEN is set per-test via the env-stub pattern.
//
// DETERMINISM NOTE: the handler is imported ONCE, statically. It reads every
// env var at request time (isAdminRequest / getOwnerNotificationAddress read
// process.env inside the call), so per-test env changes take effect without
// re-importing. A previous version called vi.resetModules() + dynamic import
// in every test — 12 re-evaluations of the module graph — which intermittently
// blew Vitest's 5s default timeout under full-suite parallel load (the
// "random single-file failure" flake). Do not reintroduce per-test imports.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// vi.mock calls below are hoisted above this import by Vitest, so the mocked
// Resend/@supabase modules are what the handler binds to. mockResendSend must
// be vi.hoisted: the handler constructs `new Resend(...)` at module init, so
// the mock factory runs during the static import — before a plain top-level
// const would be initialized (TDZ).
import sendEmailHandler from '../api/_handlers/send-email';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE importing the handler
// ---------------------------------------------------------------------------

const mockResendSend = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({
    Resend: vi.fn(function (this: any) {
        return { emails: { send: mockResendSend } };
    }),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Env stubs
// ---------------------------------------------------------------------------

const ENV_BACKUP = { ...process.env };
const OWNER_EMAIL = 'owner@example.test';
const ADMIN_TOKEN = 'admin-token-e2e-12345';
const MEMBER_EMAIL = 'member@example.test';

beforeEach(() => {
    mockResendSend.mockReset();
    mockResendSend.mockResolvedValue({ data: { id: 'email_test_id' }, error: null });
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'SG Coalition <noreply@mail.example.test>';
    process.env.ORDER_NOTIFICATION_EMAIL = OWNER_EMAIL;
    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
    delete process.env.ADMIN_PASSPHRASE; // deterministic baseline regardless of test order
    process.env.VITE_APP_URL = 'https://example.test';
});

afterEach(() => {
    process.env = { ...ENV_BACKUP };
});

// ---------------------------------------------------------------------------
// Request/response stubs (same pattern as tests/stripeWebhookReconcile.test.ts)
// ---------------------------------------------------------------------------

function makeReq(body: unknown, headers: Record<string, string> = {}) {
    return {
        method: 'POST',
        headers,
        body,
    } as any;
}

function makeRes() {
    const res: any = {
        statusCode: 0,
        body: undefined,
        headersSent: false,
        setHeader: vi.fn(),
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(b: unknown) {
            res.body = b;
            return res;
        },
        end() {
            return res;
        },
    };
    return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/send-email anti-relay gate', () => {
    it('anonymous + owner recipient -> 200, Resend called once', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(makeReq({ to: OWNER_EMAIL, subject: 's', html: '<p>h</p>' }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ success: true });
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        expect(mockResendSend.mock.calls[0][0].to).toEqual([OWNER_EMAIL]);
    });

    it('anonymous + member recipient -> 403, Resend NOT called', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(makeReq({ to: MEMBER_EMAIL, subject: 's', html: '<p>h</p>' }), res);

        expect(res.statusCode).toBe(403);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('wrong token + member recipient -> 403, Resend NOT called', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(
            makeReq(
                { to: MEMBER_EMAIL, subject: 's', html: '<p>h</p>' },
                { Authorization: `Bearer wrong-token` },
            ),
            res,
        );

        expect(res.statusCode).toBe(403);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('valid admin token + member recipient -> 200, Resend called', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(
            makeReq(
                { to: MEMBER_EMAIL, subject: 's', html: '<p>h</p>' },
                { Authorization: `Bearer ${ADMIN_TOKEN}` },
            ),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        expect(mockResendSend.mock.calls[0][0].to).toEqual([MEMBER_EMAIL]);
    });

    it('ADMIN_PASSPHRASE-only deployment: passphrase as bearer -> 200 for member', async () => {
        process.env.ADMIN_API_TOKEN = ''; // deployment only set the passphrase
        process.env.ADMIN_PASSPHRASE = 'operator-passphrase';
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(
            makeReq(
                { to: MEMBER_EMAIL, subject: 's', html: '<p>h</p>' },
                { Authorization: `Bearer operator-passphrase` },
            ),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it('no admin secrets configured at all -> member still 403, owner still 200', async () => {
        process.env.ADMIN_API_TOKEN = '';
        delete process.env.ADMIN_PASSPHRASE;
        const handler = sendEmailHandler;

        const memberRes = makeRes();
        await handler(
            makeReq(
                { to: MEMBER_EMAIL, subject: 's', html: '<p>h</p>' },
                { Authorization: `Bearer anything` },
            ),
            memberRes,
        );
        expect(memberRes.statusCode).toBe(403);
        expect(mockResendSend).not.toHaveBeenCalled();

        const ownerRes = makeRes();
        await handler(makeReq({ to: OWNER_EMAIL, subject: 's', html: '<p>h</p>' }), ownerRes);
        expect(ownerRes.statusCode).toBe(200);
    });

    it('admin token also works for owner recipient -> 200', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(
            makeReq(
                { to: OWNER_EMAIL, subject: 's', html: '<p>h</p>' },
                { Authorization: `Bearer ${ADMIN_TOKEN}` },
            ),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it('recipient match is case-insensitive against ORDER_NOTIFICATION_EMAIL', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(
            makeReq({ to: '  Owner@Example.Test  ', subject: 's', html: '<p>h</p>' }),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    it('missing fields -> 400 before any auth check, Resend NOT called', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(makeReq({ to: MEMBER_EMAIL }), res);

        expect(res.statusCode).toBe(400);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('malformed recipient -> 400, Resend NOT called', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(makeReq({ to: 'not-an-email', subject: 's', html: '<p>h</p>' }), res);

        expect(res.statusCode).toBe(400);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('GET request -> 405', async () => {
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler({ method: 'GET', headers: {}, body: null } as any, res);

        expect(res.statusCode).toBe(405);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('Resend error -> 500', async () => {
        mockResendSend.mockResolvedValue({ data: null, error: { message: 'boom' } });
        const handler = sendEmailHandler;
        const res = makeRes();
        await handler(makeReq({ to: OWNER_EMAIL, subject: 's', html: '<p>h</p>' }), res);

        expect(res.statusCode).toBe(500);
    });
});
