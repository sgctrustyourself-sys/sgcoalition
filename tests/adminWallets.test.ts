// tests/adminWallets.test.ts
//
// Unit tests for utils/adminWallets.ts — the single owner of the admin wallet
// allowlist and of the wallet-login message contract shared by the client
// (context/useAuth.ts builds the message) and the server
// (api/_handlers/admin-verify.ts verifies it). These pin the pieces the
// handler test only steps past with a stub (real allowlist membership) and the
// parser's strictness, which is the server's only defense against a crafted
// message.

import { describe, it, expect } from 'vitest';
import {
    ADMIN_WALLETS,
    isAdminWallet,
    buildAdminWalletLoginMessage,
    parseAdminWalletLoginMessage,
    isFreshLoginMessage,
} from '../utils/adminWallets';

const FOUNDER = ADMIN_WALLETS[0];

describe('utils/adminWallets', () => {
    it('carries both founder wallets on one shared list', () => {
        expect(ADMIN_WALLETS.length).toBe(2);
        expect(isAdminWallet(FOUNDER)).toBe(true);
        expect(isAdminWallet(ADMIN_WALLETS[1])).toBe(true);
    });

    it('isAdminWallet matches case-insensitively and rejects strangers', () => {
        expect(isAdminWallet(FOUNDER.toUpperCase())).toBe(true);
        expect(isAdminWallet('0x1111111111111111111111111111111111111111')).toBe(false);
        expect(isAdminWallet('')).toBe(false);
    });

    it('the login message round-trips through build and parse', () => {
        const message = buildAdminWalletLoginMessage(FOUNDER, 1_790_000_000_000);
        expect(parseAdminWalletLoginMessage(message)).toEqual({
            address: FOUNDER.toLowerCase(),
            issuedAt: 1_790_000_000_000,
        });
    });

    it('the parser rejects anything that is not the exact contract shape', () => {
        expect(parseAdminWalletLoginMessage('')).toBeNull();
        expect(parseAdminWalletLoginMessage('please log me in')).toBeNull();
        // right shape, wrong domain — a lookalike site's message must not parse
        expect(
            parseAdminWalletLoginMessage(`Evil site admin login\nAddress: ${FOUNDER}\nIssued: 1790000000000`),
        ).toBeNull();
        // non-numeric timestamp
        expect(parseAdminWalletLoginMessage(`SGCoalition admin login\nAddress: ${FOUNDER}\nIssued: soon`)).toBeNull();
    });

    it('freshness accepts only the window around the issue stamp', () => {
        const now = 1_790_000_000_000;
        expect(isFreshLoginMessage(now - 60_000, now)).toBe(true);
        expect(isFreshLoginMessage(now - 11 * 60_000, now)).toBe(false); // stale
        expect(isFreshLoginMessage(now + 11 * 60_000, now)).toBe(false); // far future
        expect(isFreshLoginMessage(Number.NaN, now)).toBe(false);
    });
});
