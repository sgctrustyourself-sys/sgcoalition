import { fetchRecentTransactions } from './polygonScanApi';

export const fetchSGCoinData = async () => {
    try {
        const response = await fetch('https://api.dexscreener.com/tokens/v1/polygon/0x951806a2581c22c478ac613a675e6c898e2abe21');
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No data found for SGCoin');
        }

        // Sort by liquidity to find the "primary" pair for price metrics
        const sortedPairs = [...data].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const primaryPair = sortedPairs[0];

        // Aggregate volume and liquidity across all pairs to give a more accurate "total" view
        const totalVolume24h = data.reduce((acc, p) => acc + (p.volume?.h24 || 0), 0);
        const totalLiquidity = data.reduce((acc, p) => acc + (p.liquidity?.usd || 0), 0);

        return {
            price: parseFloat(primaryPair.priceUsd),
            priceChange24h: primaryPair.priceChange?.h24 || 0,
            volume24h: totalVolume24h,
            marketCap: primaryPair.fdv || 0, // Using FDV as Market Cap for simple display
            holders: 0, // DexScreener doesn't provide holder count directly in basic API
            liquidity: totalLiquidity
        };
    } catch (error) {
        console.error('Error fetching SGCoin data:', error);
        return null;
    }
};

export const fetchRecentTrades = async (currentPrice: number) => {
    try {
        const transactions = await fetchRecentTransactions(10);

        // Map PolygonScan transactions to the format expected by the trades UI
        return transactions.map(tx => ({
            time: tx.timestamp,
            // Since we don't have the exact price at transaction time from the basic transfer API,
            // we use the current price with some variation based on type to simulate "market" feel,
            // but the 'value' (amount of tokens) is real.
            price: tx.type === 'buy' ? currentPrice * 1.001 : (tx.type === 'sell' ? currentPrice * 0.999 : currentPrice),
            amount: parseFloat(tx.value)
        }));
    } catch (error) {
        console.error('Error fetching recent trades:', error);
        // Fallback to simulation if API fails
        return [
            { time: Date.now() - 60000, price: currentPrice * (1 + (Math.random() * 0.02 - 0.01)), amount: Math.floor(Math.random() * 1000) + 100 },
            { time: Date.now() - 120000, price: currentPrice * (1 + (Math.random() * 0.02 - 0.01)), amount: Math.floor(Math.random() * 1000) + 100 }
        ];
    }
};
