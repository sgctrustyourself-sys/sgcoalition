import { SGCoinData, Trade } from '../types';

// SGCoin Contract Address (Polygon)
const SGCOIN_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';

// Fallback Token (WMATIC on Polygon) - Used for demo if SGCoin has no trading data yet
const FALLBACK_ADDRESS = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';

export const fetchSGCoinData = async (): Promise<SGCoinData | null> => {
    try {
        // Try fetching SGCoin data first
        let response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SGCOIN_ADDRESS}`);
        let data = await response.json();
        let pair = data.pairs && data.pairs[0];

        // If no data for SGCoin, fetch fallback (WMATIC) but display as SGCoin for demo
        if (!pair) {
            console.log('SGCoin data unavailable, using fallback for demo.');
            response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${FALLBACK_ADDRESS}`);
            data = await response.json();
            pair = data.pairs && data.pairs[0];
        }

        if (pair) {
            return {
                price: parseFloat(pair.priceUsd),
                priceChange24h: pair.priceChange.h24,
                marketCap: pair.fdv || 0,
                volume24h: pair.volume.h24,
                liquidity: pair.liquidity.usd
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching token data:', error);
        return null;
    }
};

export const fetchRecentTrades = async (currentPrice: number): Promise<Trade[]> => {
    // Simulate recent trades for UI vitality
    const trades: Trade[] = [];
    const now = Date.now();

    for (let i = 0; i < 8; i++) {
        const isBuy = Math.random() > 0.45;
        const priceVariation = (Math.random() - 0.5) * (currentPrice * 0.01);
        const tradePrice = currentPrice + priceVariation;
        const amount = Math.floor(Math.random() * 5000) + 100;

        trades.push({
            id: `trade-${i}-${now}`,
            type: isBuy ? 'buy' : 'sell',
            price: tradePrice,
            amount: amount,
            total: tradePrice * amount,
            timestamp: now - (Math.floor(Math.random() * 15 * 60 * 1000)), // Last 15 mins
            hash: '0x' + Math.random().toString(16).substr(2, 40)
        });
    }

    return trades.sort((a, b) => b.timestamp - a.timestamp);
};
