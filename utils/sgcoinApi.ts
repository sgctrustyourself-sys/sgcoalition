/**
 * SGCoin API utilities for fetching live data
 */

export const fetchSGCoinData = async () => {
    // Mock SGCoin data - replace with actual API call
    return {
        price: 0.000045,
        priceChange24h: 12.5,
        volume24h: 15000,
        marketCap: 450000,
        liquidity: 125000
    };
};

export const fetchRecentTrades = async (currentPrice: number) => {
    // Mock recent trades - replace with actual API call
    return [
        { time: Date.now() - 60000, price: currentPrice * 0.98, amount: 1000 },
        { time: Date.now() - 120000, price: currentPrice * 1.02, amount: 500 },
        { time: Date.now() - 180000, price: currentPrice, amount: 750 }
    ];
};
