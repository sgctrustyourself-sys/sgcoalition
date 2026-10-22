// tests/sgcoinMigration.test.ts
//
// The migration maths is integer-exact, and the page is wired to it. These
// tests pin the parts that can silently disagree with the chain:
//
//   - the V1 -> V2 raw-unit scale (1e9 raw V1 -> 1e12 raw V2)
//   - amount parsing: 9 decimals max, no floats, no exponents
//   - the ratio a past event actually used
//   - approvals are exact-amount, never an unlimited allowance
//   - every Polygon RPC we call is allowed by the CSP (a host missing from
//     connect-src is refused by the browser before it leaves the page, which
//     is how the on-chain reads broke in production once already)

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    MIGRATION_RATIO_BIG,
    fetchMigrationEvents,
    formatV1,
    formatV1ForDisplay,
    formatV2,
    formatV2ForDisplay,
    parseV1Amount,
    ratioFromEvent,
    v1RawToV2Raw,
    v2RawToV1Raw,
} from '../services/sgcoinMigration';
import { MIGRATION_RATIO, POLYGON_RPC_URLS, SGCOIN_MIGRATOR_ADDRESS } from '../constants';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const V1_UNIT = 1_000_000_000n;      // 1 V1 in raw units (9 decimals)
const V2_UNIT = 1_000_000_000_000_000_000n; // 1 V2 in raw units (18 decimals)

describe('migration amount maths', () => {
    it('scales raw V1 to raw V2 at exactly 1,000,000:1', () => {
        expect(v1RawToV2Raw(V1_UNIT)).toBe(V2_UNIT / 1_000_000n);
        expect(formatV2(v1RawToV2Raw(V1_UNIT * 1_000_000n))).toBe('1');
        expect(formatV2(v1RawToV2Raw(V1_UNIT))).toBe('0.000001');
    });

    it('round-trips raw amounts', () => {
        const raw = 900_000_000n * V1_UNIT; // 900M V1 -> 900 V2
        expect(formatV2(v1RawToV2Raw(raw))).toBe('900');
        expect(v2RawToV1Raw(v1RawToV2Raw(raw))).toBe(raw);
    });

    it('keeps the ratio as the constant the UI advertises', () => {
        expect(MIGRATION_RATIO_BIG).toBe(BigInt(MIGRATION_RATIO));
        expect(ratioFromEvent(V1_UNIT * 1_000_000n, V2_UNIT)).toBe(1_000_000);
        expect(ratioFromEvent(0n, V2_UNIT)).toBeNull();
    });
});

describe('amount parsing', () => {
    it('parses whole and fractional amounts', () => {
        expect(parseV1Amount('1000000')).toEqual({ ok: true, raw: 1_000_000n * V1_UNIT });
        expect(parseV1Amount('1000000.5')).toEqual({ ok: true, raw: 1_000_000n * V1_UNIT + 500_000_000n });
        expect(parseV1Amount('1,000,000.25')).toEqual({ ok: true, raw: 1_000_000n * V1_UNIT + 250_000_000n });
        expect(parseV1Amount('0.000000001')).toEqual({ ok: true, raw: 1n });
    });

    it('rejects what the contract would reject', () => {
        expect(parseV1Amount('').ok).toBe(false);
        expect(parseV1Amount('0').ok).toBe(false);
        expect(parseV1Amount('abc').ok).toBe(false);
        expect(parseV1Amount('-5').ok).toBe(false);
        expect(parseV1Amount('1e6').ok).toBe(false);
        expect(parseV1Amount('1.0000000001').ok).toBe(false); // 10 decimals
    });

    it('explains why an amount was rejected', () => {
        expect(parseV1Amount('1.0000000001').error).toMatch(/9 decimals/);
        expect(parseV1Amount('').error).toMatch(/amount/i);
    });

    it('formats for display without losing precision', () => {
        expect(formatV1(1_000_000n * V1_UNIT)).toBe('1000000');
        expect(formatV1(1n)).toBe('0.000000001');
        expect(formatV1ForDisplay(1_234_567n * V1_UNIT)).toBe('1,234,567');
        expect(formatV2ForDisplay(v1RawToV2Raw(900_000_000n * V1_UNIT))).toBe('900');
    });
});

describe('migration history reads', () => {
    const fakeProvider = (getLogs: () => Promise<any[]>) => ({
        getBlockNumber: async () => 1_000,
        getBlock: async () => ({ timestamp: 1_700_000_000 }),
        getCode: async () => '0x60',
        getLogs,
    });

    it('returns an empty list when the chain really has no events', async () => {
        const records = await fetchMigrationEvents({
            provider: fakeProvider(async () => []) as any,
            fromBlock: 1,
            toBlock: 1_000,
        });
        expect(records).toEqual([]);
    });

    it('reports a failed read instead of pretending nothing was migrated', async () => {
        await expect(
            fetchMigrationEvents({
                provider: fakeProvider(async () => { throw new Error('exceed maximum block range'); }) as any,
                fromBlock: 1,
                toBlock: 1_000,
            })
        ).rejects.toThrow();
    });
});

describe('migration wiring', () => {
    const page = read('pages/MigrationPage.tsx');
    const service = read('services/sgcoinMigration.ts');

    it('approves the exact amount, never an unlimited allowance', () => {
        const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(page).toContain('approveExactAmount');
        expect(service).toContain('approve(SGCOIN_MIGRATOR_ADDRESS, amountRaw)');
        expect(code(page)).not.toMatch(/MaxUint256/);
        expect(code(service)).not.toMatch(/MaxUint256/);
    });

    it('reads the amounts back from the Migrated event', () => {
        expect(service).toContain("event Migrated(address indexed user, uint256 v1Amount, uint256 v2Amount, string tier)");
        expect(service).toContain('MIGRATED_EVENT_TOPIC');
    });

    it('targets the live migrator contract', () => {
        expect(service).toContain('SGCOIN_MIGRATOR_ADDRESS');
        expect(SGCOIN_MIGRATOR_ADDRESS).toBe('0xc6c1EB54E5Ed966C0B48154d6e22eaA8a4c4C536');
    });

    it('allows every Polygon RPC it calls through the CSP', () => {
        const csp = JSON.parse(read('vercel.json')).headers[0].headers.find(
            (header: { key: string }) => header.key === 'Content-Security-Policy'
        ).value;

        for (const url of POLYGON_RPC_URLS) {
            const host = new URL(url).host;
            expect(csp, `${host} is missing from connect-src`).toContain(host);
        }
    });

    it('does not resurrect the broken single-call history reader', () => {
        expect(read('services/web3Service.ts')).not.toContain('fetchRecentMigrations');
    });
});
