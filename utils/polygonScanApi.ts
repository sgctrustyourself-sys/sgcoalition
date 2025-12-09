// PolygonScan API integration for SGCOIN
// Token: 0x951806a2581c22C478aC613a675e6c898E2aBe21

const POLYGONSCAN_API_KEY = import.meta.env.VITE_POLYGONSCAN_API_KEY || 'I4WCIAFNGZWXSKX8NQV87ZF4IC43KJ4YVD';
const SGCOIN_CONTRACT = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
const POLYGONSCAN_API = 'https://api.polygonscan.com/api';

export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    type: 'transfer' | 'buy' | 'sell';
}

// Fetch recent token transfers
export const fetchRecentTransactions = async (limit = 20): Promise<Transaction[]> => {
    try {
        const url = `${POLYGONSCAN_API}?module=account&action=tokentx&contractaddress=${SGCOIN_CONTRACT}&page=1&offset=${limit}&sort=desc&apikey=${POLYGONSCAN_API_KEY}`;

        console.log('[PolygonScan API] Fetching transactions...');

        const response = await fetch(url);
        const data = await response.json();

        console.log('[PolygonScan API] Status:', data.status, 'Message:', data.message);
        console.log('[PolygonScan API] Results:', data.result?.length || 0, 'transactions');

        if (data.status === '1' && data.result && Array.isArray(data.result) && data.result.length > 0) {
            const transactions = data.result.map((tx: any) => {
                const value = (parseInt(tx.value) / 1e18).toFixed(0);
                return {
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: value,
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    type: determineTransactionType(tx)
                };
            });

            console.log('[PolygonScan API] Successfully loaded', transactions.length, 'real transactions');
            return transactions;
        }

        console.warn('[PolygonScan API] No data returned, using mock fallback');
        return getMockTransactions();
    } catch (error) {
        console.error('[PolygonScan API] Error:', error);
        return getMockTransactions();
    }
};

// Determine if transaction is buy, sell, or transfer
const determineTransactionType = (tx: any): 'transfer' | 'buy' | 'sell' => {
    // Simple heuristic: if 'to' is a DEX router, it's likely a buy/sell
    const dexAddresses = [
        '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'.toLowerCase(), // QuickSwap
        '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'.toLowerCase(), // SushiSwap
    ];

    const isFromDex = dexAddresses.includes(tx.from.toLowerCase());
    const isToDex = dexAddresses.includes(tx.to.toLowerCase());

    if (isFromDex) return 'buy';
    if (isToDex) return 'sell';
    return 'transfer';
};

// Mock data fallback
const getMockTransactions = (): Transaction[] => {
    const now = Date.now();
    return [
        {
            hash: '0x1234...5678',
            from: '0xabcd...ef01',
            to: '0x2345...6789',
            value: '50000',
            timestamp: now - 120000,
            type: 'buy'
        },
        {
            hash: '0x2345...6789',
            from: '0x3456...789a',
            to: '0x4567...89ab',
            value: '25000',
            timestamp: now - 300000,
            type: 'transfer'
        },
        {
            hash: '0x3456...789a',
            from: '0x5678...9abc',
            to: '0x6789...abcd',
            value: '100000',
            timestamp: now - 600000,
            type: 'sell'
        }
    ];
};

// Format address for display
export const formatAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Get time ago string
export const getTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};
