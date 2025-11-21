import { SGCoinData } from '../types';

const SGCOIN_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';

export const fetchSGCoinData = async (): Promise<SGCoinData | null> => {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SGCOIN_ADDRESS}`);
        const data = await response.json();

        if (data.pairs && data.pairs.length > 0) {
            // Get the most liquid pair (usually the first one)
            const pair = data.pairs[0];

            return {
                price: parseFloat(pair.priceUsd),
                priceChange24h: pair.priceChange.h24,
                marketCap: pair.fdv, // Fully Diluted Valuation is often used as Market Cap for tokens
                volume24h: pair.volume.h24,
                liquidity: pair.liquidity.usd
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching SGCoin data:', error);
        return null;
    }
};

export const fetchRecentTrades = async (currentPrice: number): Promise<import('../types').Trade[]> => {
    // Simulate recent trades based on current price
    // In a real app, this would query an indexer or API like The Graph
    const trades: import('../types').Trade[] = [];
    const now = Date.now();

    for (let i = 0; i < 15; i++) {
        const isBuy = Math.random() > 0.4; // Slightly more buys
        const priceVariation = (Math.random() - 0.5) * (currentPrice * 0.02);
        const tradePrice = currentPrice + priceVariation;
        const amount = Math.floor(Math.random() * 10000) + 100;

        trades.push({
            id: `trade-${i}`,
            type: isBuy ? 'buy' : 'sell',
            price: tradePrice,
            amount: amount,
            total: tradePrice * amount,
            timestamp: now - (Math.floor(Math.random() * 3600 * 1000)), // Random time in last hour
            hash: '0x' + Math.random().toString(16).substr(2, 40)
        });
    }

    return trades.sort((a, b) => b.timestamp - a.timestamp);
};
