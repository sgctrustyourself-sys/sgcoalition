// services/sgcoinMigration.ts
//
// The SGCOIN V1 -> V2 migration domain.
//
// Everything here is integer-exact. The previous implementation formatted
// amounts through JS floats, so the preview could disagree with what the
// contract actually minted, and it read the migration history with a single
// eth_getLogs call over 5,000,000 blocks - which every public Polygon RPC
// rejects (publicnode caps a log query at 10,000 blocks), so the history
// panel was permanently empty.
//
// Chain facts this file is built against (verified on Polygon mainnet):
//   V1  0x9518...Be21  decimals 9   supply 10,000,000,000,000
//   V2  0xd53e...6ee1e  decimals 18  supply 10,000,000
//   migrator 0xc6c1...C536  owner 0x39451d0e...7387f4
//   every Migrated event ever emitted used tier "Standard" and exactly
//   1,000,000 V1 : 1 V2, so the flat ratio is the contract behaviour, not
//   just marketing copy.
//
// Raw-unit scale: 1 V1 (1e9 raw) -> 1e-6 V2 (1e12 raw) => x1000.

import type { Provider, Signer } from 'ethers';
import {
    MIGRATION_RATIO,
    POLYGON_CHAIN_ID,
    POLYGON_RPC_URLS,
    SGCOIN_BURN_ADDRESS,
    SGCOIN_MIGRATOR_ADDRESS,
    SGCOIN_MIGRATOR_DEPLOY_BLOCK,
    SGCOIN_V1_CONTRACT_ADDRESS,
    SGCOIN_V2_CONTRACT_ADDRESS,
} from '../constants.js';

export const V1_DECIMALS = 9;
export const V2_DECIMALS = 18;

/** 1,000,000 V1 : 1 V2 - flat, for every holder. */
export const MIGRATION_RATIO_BIG = BigInt(MIGRATION_RATIO);

/** raw V1 -> raw V2. Exact: 10^(V2-V1) is divisible by the ratio. */
const RAW_SCALE = (10n ** BigInt(V2_DECIMALS - V1_DECIMALS)) / MIGRATION_RATIO_BIG;

export const MIGRATION_ABI = [
    'function migrate(uint256 amount)',
    'function v1Token() view returns (address)',
    'function v2Token() view returns (address)',
    'function owner() view returns (address)',
    'event Migrated(address indexed user, uint256 v1Amount, uint256 v2Amount, string tier)',
];

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

export const MIGRATED_EVENT_TOPIC =
    '0x84c19c0cbe7ff683ba321044828863b5fc1427c0dfedb486a7cd8a1bf9b00515';

// Lazy-loaded ethers - ~100 KB chunk, only fetched when a migration
// interaction happens.
let ethersModule: Promise<typeof import('ethers')> | null = null;
const getEthers = () => {
    if (!ethersModule) ethersModule = import('ethers');
    return ethersModule;
};

// ---------------------------------------------------------------------------
// Amount maths
// ---------------------------------------------------------------------------

/** raw V1 units -> raw V2 units. */
export function v1RawToV2Raw(v1Raw: bigint): bigint {
    return v1Raw * RAW_SCALE;
}

/** raw V2 units -> raw V1 units (inverse, for the ratio a past event used). */
export function v2RawToV1Raw(v2Raw: bigint): bigint {
    return v2Raw / RAW_SCALE;
}

export interface ParsedAmount {
    ok: boolean;
    raw: bigint;
    error?: string;
}

/**
 * Parse a human V1 amount ("1,000.5", "1000000") into raw units.
 *
 * Rejects anything the contract would reject anyway (more than 9 decimals,
 * negative values, exponent notation) and returns a message the UI can show
 * instead of a raw ethers exception.
 */
export function parseV1Amount(input: string): ParsedAmount {
    const cleaned = (input || '').replace(/,/g, '').trim();

    if (!cleaned) return { ok: false, raw: 0n, error: 'Enter an amount to migrate.' };
    if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') {
        return { ok: false, raw: 0n, error: 'Use numbers only - for example 1000000 or 2500000.75' };
    }
    if (cleaned.startsWith('.')) {
        return { ok: false, raw: 0n, error: 'Use numbers only - for example 1000000 or 2500000.75' };
    }

    const [whole = '0', fraction = ''] = cleaned.split('.');
    if (fraction.length > V1_DECIMALS) {
        return {
            ok: false,
            raw: 0n,
            error: `SGCOIN V1 has ${V1_DECIMALS} decimals - that is more than the token allows.`,
        };
    }

    const raw = BigInt(whole || '0') * (10n ** BigInt(V1_DECIMALS)) + BigInt(fraction.padEnd(V1_DECIMALS, '0') || '0');
    if (raw <= 0n) return { ok: false, raw: 0n, error: 'Enter an amount greater than 0.' };

    return { ok: true, raw };
}

/** raw V1 -> trimmed decimal string (no trailing zeros). */
export function formatV1(raw: bigint): string {
    const negative = raw < 0n;
    const abs = negative ? -raw : raw;
    const whole = (abs / (10n ** BigInt(V1_DECIMALS))).toString();
    const fraction = (abs % (10n ** BigInt(V1_DECIMALS))).toString().padStart(V1_DECIMALS, '0').replace(/0+$/, '');
    return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** raw V2 -> trimmed decimal string (no trailing zeros). */
export function formatV2(raw: bigint): string {
    const negative = raw < 0n;
    const abs = negative ? -raw : raw;
    const whole = (abs / (10n ** BigInt(V2_DECIMALS))).toString();
    const fraction = (abs % (10n ** BigInt(V2_DECIMALS))).toString().padStart(V2_DECIMALS, '0').replace(/0+$/, '');
    return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Display form with thousands separators, trimmed to 6 decimals. */
export function formatV1ForDisplay(raw: bigint): string {
    const value = formatV1(raw);
    const [whole = '0', fraction = ''] = value.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatV2ForDisplay(raw: bigint): string {
    const value = formatV2(raw);
    const [whole = '0', fraction = ''] = value.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const trimmed = fraction.replace(/0+$/, '');
    return trimmed ? `${grouped}.${trimmed}` : grouped;
}

/** The ratio a migration event actually used (V1 tokens per 1 V2 token). */
export function ratioFromEvent(v1Raw: bigint, v2Raw: bigint): number | null {
    if (v2Raw === 0n || v1Raw === 0n) return null;
    const v1 = Number(formatV1(v1Raw));
    const v2 = Number(formatV2(v2Raw));
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || v2 === 0) return null;
    return v1 / v2;
}

/**
 * How many distinct wallets have migrated.
 *
 * A member can migrate more than once, so the number of events is not the
 * number of members. This is the counter the 100-member milestone is
 * measured against, so it is derived from the chain and nothing else.
 */
export function countDistinctMigrators(records: MigrationRecord[]): number {
    const seen = new Set<string>();
    for (const record of records) {
        if (record.user) seen.add(record.user.toLowerCase());
    }
    return seen.size;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const createReadProvider = async () => {
    const { ethers } = await getEthers();
    const errors: string[] = [];

    for (const url of POLYGON_RPC_URLS) {
        try {
            const provider = new ethers.JsonRpcProvider(url, { chainId: POLYGON_CHAIN_ID, name: 'polygon' }, { staticNetwork: true });
            await provider.getBlockNumber();
            return provider;
        } catch (error) {
            errors.push(`${url}: ${(error as Error)?.message || 'failed'}`);
        }
    }

    throw new Error(`No Polygon RPC available. ${errors.join(' | ')}`);
};

/** The wallet's own provider - needed for signing, not for reading history. */
export const getWalletProvider = async () => {
    const { ethers } = await getEthers();
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No Ethereum wallet found in this browser.');
    }
    return new ethers.BrowserProvider(window.ethereum);
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getV1BalanceRaw = async (address: string, provider: Provider): Promise<bigint> => {
    const { ethers } = await getEthers();
    const contract = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, provider);
    return contract.balanceOf(address);
};

export const getV2BalanceRaw = async (address: string, provider: Provider): Promise<bigint> => {
    const { ethers } = await getEthers();
    const contract = new ethers.Contract(SGCOIN_V2_CONTRACT_ADDRESS, ERC20_ABI, provider);
    return contract.balanceOf(address);
};

export const getMigrationAllowance = async (owner: string, provider: Provider): Promise<bigint> => {
    const { ethers } = await getEthers();
    const contract = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, provider);
    return contract.allowance(owner, SGCOIN_MIGRATOR_ADDRESS);
};

export interface MigrationRecord {
    txHash: string;
    blockNumber: number;
    timestamp: number | null;
    user: string;
    v1Raw: bigint;
    v2Raw: bigint;
    tier: string;
}

/**
 * Block the migrator contract was deployed in.
 *
 * Cached in localStorage (and in memory) because the binary search is ~25
 * archive calls and the deploy block never moves.
 */
const DEPLOY_BLOCK_CACHE_KEY = 'coalition_migration_deploy_block';

let deployBlockCache: number | null = null;

export const getMigrationDeployBlock = async (provider: Provider): Promise<number> => {
    if (deployBlockCache !== null) return deployBlockCache;

    if (typeof window !== 'undefined') {
        try {
            const stored = Number(window.localStorage.getItem(DEPLOY_BLOCK_CACHE_KEY));
            if (Number.isFinite(stored) && stored > 0) {
                deployBlockCache = stored;
                return stored;
            }
        } catch { /* storage blocked - fall through to the binary search */ }
    }

    // The known deploy block is one call instead of a ~27-call binary search.
    // It is only trusted when the contract really is deployed there.
    try {
        const code = await provider.getCode(SGCOIN_MIGRATOR_ADDRESS, SGCOIN_MIGRATOR_DEPLOY_BLOCK);
        if (code && code !== '0x') {
            deployBlockCache = SGCOIN_MIGRATOR_DEPLOY_BLOCK;
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(DEPLOY_BLOCK_CACHE_KEY, String(deployBlockCache));
                } catch { /* ignore */ }
            }
            return deployBlockCache;
        }
    } catch { /* archive call refused - fall back to the search */ }

    const latest = await provider.getBlockNumber();
    let low = 0;
    let high = latest;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const code = await provider.getCode(SGCOIN_MIGRATOR_ADDRESS, mid);
        if (code && code !== '0x') high = mid;
        else low = mid + 1;
    }

    deployBlockCache = low;
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(DEPLOY_BLOCK_CACHE_KEY, String(low));
        } catch { /* ignore */ }
    }
    return low;
};

/**
 * Fetch Migrated events.
 *
 * Public Polygon RPCs cap a log query (publicnode: 10,000 blocks, drpc:
 * refuses wide ranges), so the range is walked in chunks and the chunk size
 * adapts to whatever the endpoint allows. `user` narrows the query to one
 * wallet via the indexed topic.
 */
export const fetchMigrationEvents = async (options: {
    user?: string;
    limit?: number;
    provider?: Provider;
    fromBlock?: number;
    toBlock?: number;
} = {}): Promise<MigrationRecord[]> => {
    const { ethers } = await getEthers();
    const provider = options.provider || (await createReadProvider());
    const limit = options.limit ?? 25;

    const latest = await provider.getBlockNumber();
    const toBlock = options.toBlock ?? latest;
    const fromBlock = options.fromBlock ?? await getMigrationDeployBlock(provider);

    const interface_ = new ethers.Interface(MIGRATION_ABI);
    const topics: string[] = [MIGRATED_EVENT_TOPIC];
    if (options.user) {
        topics.push(ethers.getAddress(options.user).toLowerCase());
    }

    const records: MigrationRecord[] = [];
    // 5M blocks per request: Tenderly (the first RPC in the list) accepts a
    // 20M-block range, so a single request usually covers the whole history
    // of the contract. Endpoints with a tighter cap (publicnode: 10,000)
    // reject it and the range halves until it fits.
    let chunkSize = 5_000_000;

    // Walk backwards from the newest block so the panel fills after a couple
    // of requests instead of scanning the contract's whole life first.
    let cursor = toBlock;
    let successfulQueries = 0;

    while (cursor >= fromBlock && chunkSize >= 10_000) {
        const start = Math.max(fromBlock, cursor - chunkSize + 1);
        try {
            const logs = await provider.getLogs({
                address: SGCOIN_MIGRATOR_ADDRESS,
                topics,
                fromBlock: start,
                toBlock: cursor,
            });
            successfulQueries += 1;

            for (const log of logs) {
                try {
                    const parsed = interface_.parseLog({ topics: [...log.topics], data: log.data });
                    if (!parsed) continue;
                    records.push({
                        txHash: log.transactionHash,
                        blockNumber: log.blockNumber,
                        timestamp: null,
                        user: parsed.args.user,
                        v1Raw: parsed.args.v1Amount,
                        v2Raw: parsed.args.v2Amount,
                        tier: String(parsed.args.tier),
                    });
                } catch { /* unparseable log - skip it */ }
            }

            if (records.length >= limit) break;
            cursor = start - 1;
        } catch {
            // The endpoint refused this range: halve it and try again.
            chunkSize = Math.floor(chunkSize / 2);
        }
    }

    // Every range was refused: the read failed. An empty result and a failed
    // read are different facts, and the page must not claim "nothing has been
    // migrated" when it simply could not look.
    if (successfulQueries === 0) {
        throw new Error('Every Polygon log range was refused - the migration history could not be read.');
    }

    records.sort((a, b) => b.blockNumber - a.blockNumber);
    const sliced = records.slice(0, limit);

    // Timestamps are best-effort: one block read per event, failures are fine.
    await Promise.all(
        sliced.map(async (record) => {
            try {
                const block = await provider.getBlock(record.blockNumber);
                record.timestamp = block ? block.timestamp * 1000 : null;
            } catch { /* leave null */ }
        })
    );

    return sliced;
};

/** V1 held by the burn wallet and the dead address - the migrated supply. */
export const getMigratedSupply = async (provider: Provider): Promise<bigint> => {
    const { ethers } = await getEthers();
    const dead = '0x000000000000000000000000000000000000dEaD';
    const contract = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const [burn, deadBalance] = await Promise.all([
        contract.balanceOf(SGCOIN_BURN_ADDRESS),
        contract.balanceOf(dead),
    ]);
    return burn + deadBalance;
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Approve the migrator for EXACTLY the amount being migrated.
 *
 * The old flow approved MaxUint256, which left a standing unlimited
 * allowance on the V1 token for the lifetime of the approval. An exact
 * approval is spent in full by the migration, so nothing is left open.
 */
export const approveExactAmount = async (signer: Signer, amountRaw: bigint): Promise<string> => {
    const { ethers } = await getEthers();
    const token = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, signer);
    const tx = await token.approve(SGCOIN_MIGRATOR_ADDRESS, amountRaw);
    await tx.wait();
    return tx.hash;
};

/** Set the migrator allowance back to zero (undo an unused approval). */
export const revokeApproval = async (signer: Signer): Promise<string> => {
    const { ethers } = await getEthers();
    const token = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, signer);
    const tx = await token.approve(SGCOIN_MIGRATOR_ADDRESS, 0n);
    await tx.wait();
    return tx.hash;
};

export interface MigrationExecution {
    txHash: string;
    blockNumber: number;
    /** Amounts read back from the Migrated event - the truth, not the quote. */
    v1Raw: bigint;
    v2Raw: bigint;
    tier: string;
    gasUsed: bigint | null;
}

export const estimateMigrationGas = async (provider: Provider, amountRaw: bigint): Promise<bigint | null> => {
    const { ethers } = await getEthers();
    try {
        const migrator = new ethers.Contract(SGCOIN_MIGRATOR_ADDRESS, MIGRATION_ABI, provider);
        const estimate = await migrator.migrate.estimateGas(amountRaw);
        return (estimate * 120n) / 100n;
    } catch {
        return null;
    }
};

/**
 * Run the migration and read the real numbers out of the receipt.
 */
export const executeMigration = async (signer: Signer, amountRaw: bigint): Promise<MigrationExecution> => {
    const { ethers } = await getEthers();
    const migrator = new ethers.Contract(SGCOIN_MIGRATOR_ADDRESS, MIGRATION_ABI, signer);
    const interface_ = new ethers.Interface(MIGRATION_ABI);

    const tx = await migrator.migrate(amountRaw);
    const receipt = await tx.wait();

    let v1Raw = amountRaw;
    let v2Raw = v1RawToV2Raw(amountRaw);
    let tier = 'Standard';

    try {
        for (const log of receipt.logs || []) {
            try {
                const parsed = interface_.parseLog({ topics: [...log.topics], data: log.data });
                if (!parsed) continue;
                if (parsed.name === 'Migrated') {
                    v1Raw = parsed.args.v1Amount;
                    v2Raw = parsed.args.v2Amount;
                    tier = String(parsed.args.tier);
                    break;
                }
            } catch { /* not our event */ }
        }
    } catch { /* fall back to the quote */ }

    return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        v1Raw,
        v2Raw,
        tier,
        gasUsed: receipt.gasUsed ? BigInt(receipt.gasUsed) : null,
    };
};
