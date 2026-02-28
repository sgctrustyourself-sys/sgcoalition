/**
 * SGCoin API utilities for fetching live data
 */

import { SGCOIN_V2_CONTRACT_ADDRESS } from '../constants';

export const fetchSGCoinData = async () => {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SGCOIN_V2_CONTRACT_ADDRESS}`);
        const data = await response.json();

        if (data.pairs && data.pairs.length > 0) {
            const pair = data.pairs[0];
            return {
                price: parseFloat(pair.priceUsd),
                priceChange24h: pair.priceChange.h24,
                volume24h: pair.volume.h24,
                marketCap: pair.fdv, // FDV is a better proxy for Market Cap for new tokens
                liquidity: pair.liquidity.usd,
                holders: 0 // DexScreener doesn't provide holder count, would need Covalent/PolygonScan for this
            };
        }
        return getMockData();
    } catch (error) {
        console.error('Error fetching SGCoin data:', error);
        return getMockData();
    }
};

const getMockData = () => ({
    price: 0.0001,
    priceChange24h: 0.95,
    volume24h: 0,
    marketCap: 1000,
    holders: 1,
    liquidity: 4
});

export const fetchRecentTrades = async (currentPrice: number) => {
    // Mock recent trades - replace with actual API call
    return [
        { time: Date.now() - 60000, price: currentPrice * 0.98, amount: 1000 },
        { time: Date.now() - 120000, price: currentPrice * 1.02, amount: 500 },
        { time: Date.now() - 180000, price: currentPrice, amount: 750 }
    ];
};
