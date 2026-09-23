// tests/adminVerify.test.ts
//
// Unit tests for POST /api/admin-verify — the LOGIN side of the admin gate.
// Covers both login methods the handler accepts:
//   - the password path (the shared-secret passphrase, regression-pinned)
//   - the wallet path (a MetaMask signature over the message owned by
//     utils/adminWallets.ts) — each of its guards pinned load-bearing:
//     signature recovery, address binding, freshness, allowlist membership.
//
// Producing a signature from a FOUNDER private key is the one thing a test
// cannot do, so the cases that must end at an allowlisted address substitute
// the recovered address via mock-returns-once on ethers.verifyMessage (a
// pass-through spy by default). Every other wallet case runs REAL signatures
// from throwaway wallets through the real recovery — including the allowlist
// rejection, which is end-to-end real crypto against the real list.
//
// Follows the handler-test conventions of tests/createPaymentIntent.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ethers at the module boundary — pass-through spy on verifyMessage
// ---------------------------------------------------------------------------

vi.mock('ethers', async (importOriginal) => {
    const mod = await importOriginal<typeof import('ethers')>();
    return { ...mod, verifyMessage: vi.fn(mod.verifyMessage) };
});

import { Wallet, verifyMessage } from 'ethers';
import { ADMIN_WALLETS, buildAdminWalletLoginMessage } from '../utils/adminWallets';

const FOUNDER = ADMIN_WALLETS[0];

// Deterministic throwaway keys — the well-known Hardhat dev keys (public test
// material, never a funded wallet). Wallet.createRandom() is deliberately not
// used: it needs crypto.getRandomValues, which the jsdom test environment does
// not provide. Signing itself is deterministic and entropy-free.
const THROWAWAY_A = new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const THROWAWAY_B = new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

// ---------------------------------------------------------------------------
// Request/response harness (same shape as createPaymentIntent.test.ts)
// ---------------------------------------------------------------------------

function makeRes() {
    const res: Record<string, any> = {
        _status: 200,
        _body: null,
        _headers: {} as Record<string, string>,
        setHeader: vi.fn(function (k: string, v: string) { res._headers[k] = v; }),
        status: vi.fn(function (s: number) { res._status = s; return res; }),
        json: vi.fn(function (body: any) { res._body = body; return res; }),
        end: vi.fn(function () { return res; }),
    };
    return res;
}

function makeReq(body: any) {
    return { method: 'POST', body };
}

/** A throwaway wallet signs the login message for `claimedAddress`. */
async function walletSigns(claimedAddress: string, issuedAt: number) {
    const signer = THROWAWAY_A;
    const message = buildAdminWalletLoginMessage(claimedAddress, issuedAt);
    return { message, signature: await signer.signMessage(message) };
}

async function loadHandler() {
    process.env.ADMIN_API_TOKEN = 'test-machine-token';
    process.env.ADMIN_PASSPHRASE = 'test-passphrase';
    const mod = await import('../api/_handlers/admin-verify');
    return mod.default;
}

// =========================================================================
// Tests
// =========================================================================

describe('POST /api/admin-verify', () => {
    let handler: (req: any, res: any) => Promise<void>;

    beforeEach(async () => {
        vi.mocked(verifyMessage).mockClear();
        handler = await loadHandler();
    });

    afterEach(() => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
    });

    // ---- password path (unchanged behaviour) ----------------------------

    it('accepts the configured passphrase and returns the canonical bearer', async () => {
        const res = makeRes();
        await handler(makeReq({ password: 'test-passphrase' }), res);

        expect(res._status).toBe(200);
        expect(res._body).toEqual({ token: 'test-machine-token', success: true });
    });

    it('rejects an unknown passphrase', async () => {
        const res = makeRes();
        await handler(makeReq({ password: 'not-it' }), res);

        expect(res._status).toBe(401);
    });

    it('requires a password or a wallet signature', async () => {
        const res = makeRes();
        await handler(makeReq({}), res);

        expect(res._status).toBe(400);
    });

    it('fails closed with 503 when no credential is configured', async () => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;

        const res = makeRes();
        await handler(makeReq({ password: 'anything' }), res);

        expect(res._status).toBe(503);
    });

    // ---- wallet path ----------------------------------------------------

    it('accepts a founder wallet login and returns the same bearer', async () => {
        // The signature bytes are real (a throwaway key signed the exact
        // message); only the recovery result is substituted, standing in for
        // the founder key no test can hold.
        const { message, signature } = await walletSigns(FOUNDER, Date.now());
        vi.mocked(verifyMessage).mockReturnValueOnce(FOUNDER);

        const res = makeRes();
        await handler(makeReq({ message, signature }), res);

        expect(res._status).toBe(200);
        expect(res._body).toEqual({ token: 'test-machine-token', success: true });
    });

    it('rejects a valid signature from a wallet that is not on the allowlist', async () => {
        // Fully real: the throwaway key signs its OWN address, real recovery
        // returns it, the real allowlist refuses it. Goes red if the allowlist
        // guard is removed.
        const message = buildAdminWalletLoginMessage(THROWAWAY_B.address, Date.now());
        const signature = await THROWAWAY_B.signMessage(message);

        const res = makeRes();
        await handler(makeReq({ message, signature }), res);

        expect(res._status, 'a non-admin wallet must not be able to log in').toBe(401);
        expect(res._body.error).toContain('not authorized');
    });

    it('rejects a founder signature over a message addressed to a stranger', async () => {
        // Recovers to the founder, but the message claims a stranger's
        // address. Goes red if the address-binding guard is removed (the
        // founder recovery would then pass the allowlist outright).
        const stranger = THROWAWAY_B;
        const { message, signature } = await walletSigns(stranger.address, Date.now());
        vi.mocked(verifyMessage).mockReturnValueOnce(FOUNDER);

        const res = makeRes();
        await handler(makeReq({ message, signature }), res);

        expect(res._status, 'the signature must be bound to the claimed address').toBe(401);
        expect(res._body.error).toContain('does not match');
    });

    it('rejects a stale login message even from a founder signature', async () => {
        // Recovers to the founder for a message stamped outside the window.
        // Goes red if the freshness guard is removed (it would then pass the
        // allowlist and mint a token for a replayable message).
        const stale = Date.now() - 11 * 60_000;
        const { message, signature } = await walletSigns(FOUNDER, stale);
        vi.mocked(verifyMessage).mockReturnValueOnce(FOUNDER);

        const res = makeRes();
        await handler(makeReq({ message, signature }), res);

        expect(res._status, 'a stale login message must not mint a token').toBe(401);
        expect(res._body.error).toContain('expired');
    });

    it('rejects a garbage signature without throwing', async () => {
        const { message } = await walletSigns(FOUNDER, Date.now());

        const res = makeRes();
        await handler(makeReq({ message, signature: '0xdeadbeef' }), res);

        expect(res._status).toBe(401);
        expect(res._body.error).toContain('Invalid wallet signature');
    });

    it('rejects a malformed login message', async () => {
        const signer = THROWAWAY_A;
        const message = 'log me in please';
        const signature = await signer.signMessage(message);

        const res = makeRes();
        await handler(makeReq({ message, signature }), res);

        expect(res._status).toBe(400);
        expect(res._body.error).toContain('Malformed wallet login message');
    });
});
