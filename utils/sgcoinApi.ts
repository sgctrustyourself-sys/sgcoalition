/**
 * SGCoin on-chain price feed — reads directly from QuickSwap V2 & V3 pair
 * contracts via getReserves() / slot0(). DexScreener does not track the
 * SGCOIN/WPOL pair, so this is the only reliable live pricing source.
 *
 * Pair token ordering (alphabetical by address):
 *   token0 = WPOL (0x0d50…)
 *   token1 = SGCOIN (0xd53e…)
 *
 * Price of token1 in token0:
 *   V2: reserve0 / reserve1  (from getReserves)
 *   V3: (sqrtPriceX96 / 2^96)²  (from slot0)
 */

import { SGCoinData } from '../types';
import {
    QUICKSWAP_LP_ADDRESS,
    QUICKSWAP_V3_LP_ADDRESS,
    WPOL_ADDRESS,
    SGCOIN_V2_CONTRACT_ADDRESS,
    POLYGON_RPC_URL,
    V2_TOTAL_SUPPLY,
} from '../constants';

// ---------------------------------------------------------------------------
// Lazy ethers — matches services/web3Service.ts pattern.
// The ~100 KB ethers chunk only downloads when this module is first called.
// ---------------------------------------------------------------------------
let ethersModule: Promise<typeof import('ethers')> | null = null;
const getEthers = () => {
    if (!ethersModule) ethersModule = import('ethers');
    return ethersModule;
};

// Cached RPC provider — reused across 30-second polling intervals
let cachedProvider: any = null;
const getProvider = async () => {
    if (cachedProvider) return cachedProvider;
    const { ethers } = await getEthers();
    cachedProvider = new ethers.JsonRpcProvider(POLYGON_RPC_URL, {
        chainId: 137,
        name: 'polygon',
    }, { staticNetwork: true });
    return cachedProvider;
};

// ---------------------------------------------------------------------------
// Minimal contract ABIs
// ---------------------------------------------------------------------------
const PAIR_V2_ABI = [
    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
];

const POOL_V3_ABI = [
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

const ERC20_BALANCE_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
];

// ---------------------------------------------------------------------------
// Price calculation helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Live POL/USD price feed (DexScreener WPOL pairs)
// Cached for 60 seconds to avoid rate-limiting on 30-second polling.
// ---------------------------------------------------------------------------

const FALLBACK_POL_USD = 0.08;

let cachedPolUsd: { price: number; ts: number } | null = null;

const fetchPolUsdPrice = async (): Promise<number> => {
    const now = Date.now();
    if (cachedPolUsd && now - cachedPolUsd.ts < 60_000) {
        return cachedPolUsd.price;
    }

    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${WPOL_ADDRESS}`);
        const json = await res.json();
        if (json.pairs && json.pairs.length > 0) {
            const price = parseFloat(json.pairs[0].priceUsd);
            if (price > 0) {
                cachedPolUsd = { price, ts: now };
                return price;
            }
        }
    } catch (e) {
        console.warn('[sgcoinApi] POL/USD feed failed, using fallback:', e);
    }

    // Stale cache still beats hardcoded fallback
    if (cachedPolUsd) return cachedPolUsd.price;
    return FALLBACK_POL_USD;
};

// Q96 = 2^96  (used to decode Uniswap V3 sqrtPriceX96)
const Q96_FLOAT = 2 ** 96;

// ---------------------------------------------------------------------------
// Internal: read raw pool data from both pools
// ---------------------------------------------------------------------------

interface RawPoolData {
    v2Wpol: number;
    v2Sgc: number;
    v2PriceWpol: number;
    v3Wpol: number;
    v3Sgc: number;
    v3PriceWpol: number;
}

const readPoolData = async (): Promise<RawPoolData> => {
    const { ethers } = await getEthers();
    const provider = await getProvider();

    // --- V2: getReserves() ------------------------------------------------
    const v2Pair = new ethers.Contract(QUICKSWAP_LP_ADDRESS, PAIR_V2_ABI, provider);
    const v2Reserves = await v2Pair.getReserves();
    // token0=WPOL, token1=SGCOIN
    const v2Wpol = Number(ethers.formatUnits(v2Reserves[0], 18));
    const v2Sgc = Number(ethers.formatUnits(v2Reserves[1], 18));
    const v2PriceWpol = v2Sgc > 0 ? v2Wpol / v2Sgc : 0;

    // --- V3: slot0 + token balances ---------------------------------------
    let v3Wpol = 0;
    let v3Sgc = 0;
    let v3PriceWpol = 0;

    try {
        const v3Pool = new ethers.Contract(QUICKSWAP_V3_LP_ADDRESS, POOL_V3_ABI, provider);
        const wpolContract = new ethers.Contract(WPOL_ADDRESS, ERC20_BALANCE_ABI, provider);
        const sgcContract = new ethers.Contract(SGCOIN_V2_CONTRACT_ADDRESS, ERC20_BALANCE_ABI, provider);

        const [v3Slot0, v3WpolRaw, v3SgcRaw] = await Promise.all([
            v3Pool.slot0(),
            wpolContract.balanceOf(QUICKSWAP_V3_LP_ADDRESS),
            sgcContract.balanceOf(QUICKSWAP_V3_LP_ADDRESS),
        ]);

        v3Wpol = Number(ethers.formatUnits(v3WpolRaw, 18));
        v3Sgc = Number(ethers.formatUnits(v3SgcRaw, 18));

        // Decode sqrtPriceX96 → token1/token0 price ratio.
        // sqrtPriceX96 is a uint160 BigInt (~1e48 max). Number() preserves
        // ~15 sig digits — for SGCOIN/WPOL at ~0.001 WPOL the relative
        // error is ~1e-16, well below any display precision.
        const sqrtPrice = Number(v3Slot0.sqrtPriceX96) / Q96_FLOAT;
        v3PriceWpol = sqrtPrice * sqrtPrice;
    } catch (v3Err) {
        console.warn('[sgcoinApi] V3 pool read failed, using V2 only:', v3Err);
    }

    return { v2Wpol, v2Sgc, v2PriceWpol, v3Wpol, v3Sgc, v3PriceWpol };
};

// ---------------------------------------------------------------------------
// Per-pool liquidity breakdown (exported for TreasuryPage + Ecosystem)
// ---------------------------------------------------------------------------

export interface PoolSnapshot {
    wpol: number;
    sgc: number;
    priceUsd: number;
    tvlUsd: number;
}

export interface PoolBreakdown {
    v2: PoolSnapshot;
    v3: PoolSnapshot | null; // null when V3 read failed or has zero liquidity
    blendedPriceUsd: number;
    combinedTvlUsd: number;
}

/** Per-pool WPOL / SGCOIN reserves + blended price across V2 + V3. */
export const fetchPoolBreakdown = async (): Promise<PoolBreakdown> => {
    const d = await readPoolData();
    const polUsd = await fetchPolUsdPrice();

    const totalWpol = d.v2Wpol + d.v3Wpol;

    // Weighted blended price
    let blendedWpol: number;
    if (totalWpol > 0) {
        blendedWpol = (d.v2PriceWpol * d.v2Wpol + d.v3PriceWpol * d.v3Wpol) / totalWpol;
    } else {
        blendedWpol = d.v2PriceWpol || d.v3PriceWpol || 0;
    }
    const blendedUsd = blendedWpol * polUsd;

    // TVL = total WPOL * 2 (both sides) * POL price
    const combinedTvl = totalWpol * 2 * polUsd;

    return {
        v2: {
            wpol: d.v2Wpol,
            sgc: d.v2Sgc,
            priceUsd: d.v2PriceWpol * polUsd,
            tvlUsd: d.v2Wpol * 2 * polUsd,
        },
        v3: d.v3Wpol > 0 ? {
            wpol: d.v3Wpol,
            sgc: d.v3Sgc,
            priceUsd: d.v3PriceWpol * polUsd,
            tvlUsd: d.v3Wpol * 2 * polUsd,
        } : null,
        blendedPriceUsd: blendedUsd,
        combinedTvlUsd: combinedTvl,
    };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch live SGCoin price + liquidity from QuickSwap V2 & V3 pools.
 * Falls back to mock data on any RPC error so the UI never breaks.
 */
export const fetchSGCoinData = async (): Promise<SGCoinData> => {
    try {
        const d = await readPoolData();
        const polUsd = await fetchPolUsdPrice();

        const totalWpolLiq = d.v2Wpol + d.v3Wpol;
        let priceWpol: number;
        if (totalWpolLiq > 0) {
            priceWpol = (d.v2PriceWpol * d.v2Wpol + d.v3PriceWpol * d.v3Wpol) / totalWpolLiq;
        } else {
            priceWpol = d.v2PriceWpol || d.v3PriceWpol || 0;
        }

        const priceUsd = priceWpol * polUsd;
        const liquidityUsd = totalWpolLiq * 2 * polUsd;
        const marketCap = priceUsd * V2_TOTAL_SUPPLY;

        return {
            price: priceUsd,
            priceChange24h: 0,
            volume24h: 0,
            marketCap,
            liquidity: liquidityUsd,
        };
    } catch (error) {
        console.error('[sgcoinApi] On-chain fetch failed, using mock data:', error);
        return getMockData();
    }
};

// ---------------------------------------------------------------------------
// Mock fallback — kept simple so the UI always renders something
// ---------------------------------------------------------------------------
const getMockData = (): SGCoinData => ({
    price: 0.0001,
    priceChange24h: 0,
    volume24h: 0,
    marketCap: 1000,
    liquidity: 4,
});

// ---------------------------------------------------------------------------
// Recent trades (unchanged — still mock)
// ---------------------------------------------------------------------------
export const fetchRecentTrades = async (currentPrice: number) => {
    return [
        { time: Date.now() - 60000, price: currentPrice * 0.98, amount: 1000 },
        { time: Date.now() - 120000, price: currentPrice * 1.02, amount: 500 },
        { time: Date.now() - 180000, price: currentPrice, amount: 750 },
    ];
};
