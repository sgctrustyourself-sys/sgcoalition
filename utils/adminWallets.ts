// utils/adminWallets.ts
//
// THE single owner of the admin wallet allowlist and of the wallet-login
// message contract.
//
// Two sides consume this module and must agree byte-for-byte:
//   • the client builds the login message and signs it
//     (context/useAuth.ts > loginAdminWallet via services/walletActions.ts);
//   • the server parses and verifies it
//     (api/_handlers/admin-verify.ts, the login side of the admin gate).
//
// The list used to live in constants.ts only, which made "admin wallet" a
// purely CLIENT-side concept — it gated UI state and the server had no idea
// such a wallet existed. Membership is checked server-side now, and this
// module is what both sides share, so a rotation is a one-line change here
// instead of a drift between two copies. constants.ts re-exports
// ADMIN_WALLETS so existing client imports keep working.

/** Wallets whose signature unlocks the admin dashboard. */
export const ADMIN_WALLETS = [
    '0x0f4a0466c2a1d3fa6ed55a20994617f0533fbf74', // Founder
    '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4', // Founder Secondary / Treasury
] as const;

/** Case-insensitive membership check — addresses arrive checksummed or not. */
export function isAdminWallet(address: string): boolean {
    const normalized = String(address || '').toLowerCase();
    return ADMIN_WALLETS.some((wallet) => wallet.toLowerCase() === normalized);
}

// ---------------------------------------------------------------------------
// The login message contract
// ---------------------------------------------------------------------------

/**
 * A signed login message is accepted this long either side of its issue stamp.
 * This is the CAPTURE-before-use bound: a signature snatched while unused is
 * dead after ten minutes. Replay AFTER use is what the Nonce line and its
 * table close (see generateLoginNonce) — the two defenses cover the two
 * halves. The far side is bounded too, so a message stamped far in the future
 * can never mint an ever-valid login.
 */
export const ADMIN_WALLET_LOGIN_MAX_AGE_MS = 10 * 60 * 1000;

const LOGIN_MESSAGE_RE = /^SGCoalition admin login\nAddress: (0x[0-9a-fA-F]{40})\nIssued: (\d{13})\nNonce: ([0-9a-f]{32})$/;

/**
 * A fresh random nonce for one login attempt (16 bytes, lowercase hex). The
 * signed message carries it, and admin-verify SPENDS it in
 * admin_login_nonces with one atomic INSERT before issuing a bearer — so a
 * captured signature is redeemable exactly once, the table's primary key
 * rejecting the second spend.
 */
export function generateLoginNonce(): string {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The message a wallet signs to log in. The address and nonce are lowercased
 * so the signed bytes are deterministic — signature recovery matches exact
 * bytes. Each call MUST carry a fresh generateLoginNonce(): reusing one makes
 * the second login fail as a replay of the first.
 */
export function buildAdminWalletLoginMessage(address: string, issuedAt: number, nonce: string): string {
    return `SGCoalition admin login\nAddress: ${String(address).toLowerCase()}\nIssued: ${issuedAt}\nNonce: ${String(nonce).toLowerCase()}`;
}

/**
 * Strict parser — anything not matching the contract byte-for-byte is
 * rejected, so a crafted message cannot smuggle fields past the server. The
 * Nonce line is REQUIRED (the old three-line shape does not parse): accepting
 * a message without one would let a replay skip the nonce table entirely.
 */
export function parseAdminWalletLoginMessage(message: string): { address: string; issuedAt: number; nonce: string } | null {
    const match = LOGIN_MESSAGE_RE.exec(String(message || ''));
    if (!match) return null;
    return { address: match[1].toLowerCase(), issuedAt: Number(match[2]), nonce: match[3] };
}

/** Whether the issue stamp is inside the acceptance window. */
export function isFreshLoginMessage(issuedAt: number, now: number = Date.now()): boolean {
    return Number.isFinite(issuedAt) && Math.abs(now - issuedAt) <= ADMIN_WALLET_LOGIN_MAX_AGE_MS;
}
