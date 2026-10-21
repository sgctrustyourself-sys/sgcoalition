// tests/cryptoWatcher.test.ts
//
// Unit tests for the direct-USDC watcher (services/cryptoWatcher.ts):
// validators, base-unit conversion, and the pure on-chain match rule.
// Chain I/O is covered with a stubbed fetch (no network); the HTTP
// handler contract lives in tests/cryptoVerify.test.ts.

import { describe, it, expect, vi } from 'vitest';
import {
    DEFAULT_CRYPTO_WINDOW_HOURS,
    FOUNDER_WALLET_FALLBACK,
    NATIVE_USDC_POLYGON,
    baseUnitsToUsdc,
    evaluateUsdcTransfer,
    fetchUsdcTransfersTo,
    findUsdcTransferByHash,
    isValidAddress,
    isValidTxHash,
    loadMerchantCryptoConfig,
    usdcDollarsToBaseUnits,
} from '../services/cryptoWatcher';

const MERCHANT = FOUNDER_WALLET_FALLBACK;
const HASH = '0x' + 'ab'.repeat(32);

function expectation(overrides: Record<string, unknown> = {}) {
    const now = Date.now();
    return {
        merchantAddress: MERCHANT,
        usdcContract: NATIVE_USDC_POLYGON,
        expectedBaseUnits: BigInt(45_500_000),
        windowStartMs: now - 3_600_000,
        windowEndMs: now + 23 * 3_600_000,
        ...overrides,
    };
}

function transfer(overrides: Record<string, unknown> = {}) {
    return {
        to: MERCHANT,
        contractAddress: NATIVE_USDC_POLYGON,
        valueBaseUnits: '45500000',
        timestampMs: Date.now() - 60_000,
        ...overrides,
    };
}

describe('validators', () => {
    it('accepts a well-formed tx hash', () => {
        expect(isValidTxHash(HASH)).toBe(true);
        expect(isValidTxHash('  ' + HASH + '  ')).toBe(true);
    });

    it('rejects malformed hashes', () => {
        expect(isValidTxHash('0x1234')).toBe(false);
        expect(isValidTxHash('ab'.repeat(32))).toBe(false);
        expect(isValidTxHash('0x' + 'zz'.repeat(32))).toBe(false);
        expect(isValidTxHash(null)).toBe(false);
        expect(isValidTxHash(42)).toBe(false);
    });

    it('validates Polygon addresses', () => {
        expect(isValidAddress(MERCHANT)).toBe(true);
        expect(isValidAddress('0x123')).toBe(false);
        expect(isValidAddress('')).toBe(false);
    });
});

describe('base-unit conversion (USDC has 6 decimals)', () => {
    it('converts dollars to base units with integer math', () => {
        expect(usdcDollarsToBaseUnits(45.5)).toBe(BigInt(45_500_000));
        expect(usdcDollarsToBaseUnits(0)).toBe(BigInt(0));
        expect(usdcDollarsToBaseUnits(0.01)).toBe(BigInt(10_000));
    });

    it('rejects non-finite and negative amounts', () => {
        expect(() => usdcDollarsToBaseUnits(NaN)).toThrow();
        expect(() => usdcDollarsToBaseUnits(-1)).toThrow();
    });

    it('formats base units back to USDC', () => {
        expect(baseUnitsToUsdc(BigInt(45_500_000))).toBe('45.500000');
        expect(baseUnitsToUsdc('1')).toBe('0.000001');
    });
});

describe('evaluateUsdcTransfer (the match rule)', () => {
    it('confirms an exact payment', () => {
        expect(evaluateUsdcTransfer(transfer(), expectation()).verdict).toBe('confirmed');
    });

    it('confirms an overpay', () => {
        const r = evaluateUsdcTransfer(transfer({ valueBaseUnits: '50000000' }), expectation());
        expect(r.verdict).toBe('confirmed');
    });

    it('flags a 1-base-unit underpay as underpaid (no float tolerance)', () => {
        const r = evaluateUsdcTransfer(transfer({ valueBaseUnits: '45499999' }), expectation());
        expect(r.verdict).toBe('underpaid');
    });

    it('matches the merchant address case-insensitively', () => {
        const r = evaluateUsdcTransfer(
            transfer({ to: MERCHANT.toLowerCase() }),
            expectation({ merchantAddress: MERCHANT.toUpperCase() }),
        );
        expect(r.verdict).toBe('confirmed');
    });

    it('rejects a transfer to a different address', () => {
        const r = evaluateUsdcTransfer(
            transfer({ to: '0x000000000000000000000000000000000000dEaD' }),
            expectation(),
        );
        expect(r.verdict).toBe('no_match');
        expect(r.reason).toBe('not_to_merchant');
    });

    it('rejects the wrong token contract (bridged USDC is not accepted)', () => {
        const r = evaluateUsdcTransfer(
            transfer({ contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' }),
            expectation(),
        );
        expect(r.verdict).toBe('no_match');
        expect(r.reason).toBe('unexpected_token');
    });

    it('rejects transfers outside the payment window', () => {
        const exp = expectation();
        expect(evaluateUsdcTransfer(transfer({ timestampMs: exp.windowStartMs - 1 }), exp).reason)
            .toBe('outside_window');
        expect(evaluateUsdcTransfer(transfer({ timestampMs: exp.windowEndMs + 1 }), exp).reason)
            .toBe('outside_window');
    });

    it('treats window boundaries as inclusive', () => {
        const exp = expectation();
        expect(evaluateUsdcTransfer(transfer({ timestampMs: exp.windowStartMs }), exp).verdict)
            .toBe('confirmed');
        expect(evaluateUsdcTransfer(transfer({ timestampMs: exp.windowEndMs }), exp).verdict)
            .toBe('confirmed');
    });
});

describe('fetchUsdcTransfersTo (fail-closed chain reads)', () => {
    const tokentx = (value = '45500000', timeStamp = String(Math.floor(Date.now() / 1000))) => ({
        status: '1',
        message: 'OK',
        result: [{
            hash: HASH,
            from: '0x1111111111111111111111111111111111111111',
            to: MERCHANT,
            contractAddress: NATIVE_USDC_POLYGON,
            value,
            timeStamp,
            blockNumber: '70000000',
        }],
    });

    it('parses explorer transfers', async () => {
        const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => tokentx() }) as any);
        const out = await fetchUsdcTransfersTo({ merchantAddress: MERCHANT, apiKey: 'key', fetchImpl: fetchImpl as any });
        expect(out).toHaveLength(1);
        expect(out[0].hash).toBe(HASH);
        expect(out[0].valueBaseUnits).toBe('45500000');
    });

    it('throws without an API key (never silently unconfigured)', async () => {
        await expect(fetchUsdcTransfersTo({ merchantAddress: MERCHANT, apiKey: '' })).rejects.toThrow();
    });

    it('rejects an invalid merchant address before any network call', async () => {
        const fetchImpl = vi.fn();
        await expect(fetchUsdcTransfersTo({ merchantAddress: 'nope', apiKey: 'k', fetchImpl: fetchImpl as any }))
            .rejects.toThrow('Invalid merchant address');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('treats "No transactions found" as an empty page, not an error', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            json: async () => ({ status: '0', message: 'No transactions found', result: [] }),
        }) as any);
        const out = await fetchUsdcTransfersTo({ merchantAddress: MERCHANT, apiKey: 'k', fetchImpl: fetchImpl as any });
        expect(out).toEqual([]);
    });

    it('throws on other explorer errors (fail closed, no mock fallback)', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            json: async () => ({ status: '0', message: 'Rate limit exceeded', result: null }),
        }) as any);
        await expect(fetchUsdcTransfersTo({ merchantAddress: MERCHANT, apiKey: 'k', fetchImpl: fetchImpl as any }))
            .rejects.toThrow();
    });

    it('throws on network failure', async () => {
        const fetchImpl = vi.fn(async () => { throw new Error('socket hang up'); });
        await expect(fetchUsdcTransfersTo({ merchantAddress: MERCHANT, apiKey: 'k', fetchImpl: fetchImpl as any }))
            .rejects.toThrow('Chain lookup failed');
    });
});

describe('findUsdcTransferByHash', () => {
    it('finds the transfer case-insensitively', async () => {
        const payload = {
            status: '1',
            message: 'OK',
            result: [{
                hash: '0x' + 'ab'.repeat(32).toUpperCase(),
                from: '0x1111111111111111111111111111111111111111',
                to: MERCHANT,
                contractAddress: NATIVE_USDC_POLYGON,
                value: '45500000',
                timeStamp: String(Math.floor(Date.now() / 1000)),
                blockNumber: '70000000',
            }],
        };
        const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => payload }) as any);
        const found = await findUsdcTransferByHash({
            merchantAddress: MERCHANT, apiKey: 'k', txHash: HASH.toLowerCase(), fetchImpl: fetchImpl as any,
        });
        expect(found?.valueBaseUnits).toBe('45500000');
    });

    it('returns null when the hash is absent (awaiting, not a verdict)', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true, json: async () => ({ status: '1', message: 'OK', result: [] }),
        }) as any);
        const found = await findUsdcTransferByHash({
            merchantAddress: MERCHANT, apiKey: 'k', txHash: HASH, fetchImpl: fetchImpl as any,
        });
        expect(found).toBeNull();
    });

    it('rejects a malformed hash before any network call', async () => {
        const fetchImpl = vi.fn();
        await expect(findUsdcTransferByHash({
            merchantAddress: MERCHANT, apiKey: 'k', txHash: '0x123', fetchImpl: fetchImpl as any,
        })).rejects.toThrow('Invalid transaction hash');
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe('loadMerchantCryptoConfig', () => {
    function stubDb(data: unknown, error: unknown = null) {
        return {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({ data, error })),
                    })),
                })),
            })),
        };
    }

    it('reads address + window from the row', async () => {
        const addr = '0x1111111111111111111111111111111111111111';
        const cfg = await loadMerchantCryptoConfig(stubDb({
            id: 1, crypto_merchant_address: addr, crypto_window_hours: 12,
        }));
        expect(cfg).toEqual({
            merchantAddress: addr,
            merchantAddressConfigured: true,
            windowHours: 12,
            usdcContract: NATIVE_USDC_POLYGON,
        });
    });

    it('falls back per-field when columns are absent (pre-migration row)', async () => {
        const cfg = await loadMerchantCryptoConfig(stubDb({ id: 1 }));
        expect(cfg.merchantAddress).toBe(FOUNDER_WALLET_FALLBACK);
        expect(cfg.merchantAddressConfigured).toBe(false);
        expect(cfg.windowHours).toBe(DEFAULT_CRYPTO_WINDOW_HOURS);
    });

    it('rejects an invalid row address but keeps a valid window', async () => {
        const cfg = await loadMerchantCryptoConfig(stubDb({
            id: 1, crypto_merchant_address: 'oops', crypto_window_hours: 6,
        }));
        expect(cfg.merchantAddress).toBe(FOUNDER_WALLET_FALLBACK);
        expect(cfg.merchantAddressConfigured).toBe(false);
        expect(cfg.windowHours).toBe(6);
    });

    it('clamps the window to 1–72h', async () => {
        expect((await loadMerchantCryptoConfig(stubDb({ crypto_window_hours: 200 }))).windowHours).toBe(72);
        expect((await loadMerchantCryptoConfig(stubDb({ crypto_window_hours: 0 }))).windowHours).toBe(1);
        expect((await loadMerchantCryptoConfig(stubDb({ crypto_window_hours: 'twelve' }))).windowHours)
            .toBe(DEFAULT_CRYPTO_WINDOW_HOURS);
    });

    it('returns full defaults on DB failure', async () => {
        const cfg = await loadMerchantCryptoConfig(stubDb(null, new Error('down')));
        expect(cfg.merchantAddress).toBe(FOUNDER_WALLET_FALLBACK);
        expect(cfg.windowHours).toBe(DEFAULT_CRYPTO_WINDOW_HOURS);
    });
});
