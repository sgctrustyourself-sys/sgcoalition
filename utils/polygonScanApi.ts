// PolygonScan API integration for SGCOIN
// Token: 0x951806a2581c22C478aC613a675e6c898E2aBe21

import { SGCOIN_V1_CONTRACT_ADDRESS, SGCOIN_V2_CONTRACT_ADDRESS, QUICKSWAP_LP_ADDRESS, QUICKSWAP_V3_LP_ADDRESS, SGCOIN_BURN_ADDRESS } from '../constants';

const POLYGONSCAN_API_KEY = import.meta.env.VITE_POLYGONSCAN_API_KEY || 'I4WCIAFNGZWXSKX8NQV87ZF4IC43KJ4YVD';
const SGCOIN_CONTRACT = SGCOIN_V2_CONTRACT_ADDRESS;
const POLYGONSCAN_API = 'https://api.etherscan.io/v2/api';

export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    type: 'transfer' | 'buy' | 'sell' | 'liquidity';
}

// Fetch recent token transfers
export const fetchRecentTransactions = async (limit = 20): Promise<Transaction[]> => {
    try {
        const url = `${POLYGONSCAN_API}?chainid=137&module=account&action=tokentx&contractaddress=${SGCOIN_CONTRACT}&page=1&offset=${limit}&sort=desc&apikey=${POLYGONSCAN_API_KEY}`;

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

/**
 * Fetches burn activity (migration and direct burns) for SGC V1 and V2
 */
export const fetchBurnActivity = async (limit = 10): Promise<any[]> => {
    const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

    try {
        // Fetch V1 transfers to Burn Address or DEAD address
        // Using action=tokentx for V1
        const v1BurnUrl = `${POLYGONSCAN_API}?chainid=137&module=account&action=tokentx&contractaddress=${SGCOIN_V1_CONTRACT_ADDRESS}&offset=50&sort=desc&apikey=${POLYGONSCAN_API_KEY}`;

        const response = await fetch(v1BurnUrl);
        const data = await response.json();

        if (data.status === '1' && data.result) {
            const activities = data.result
                .filter((tx: any) =>
                    tx.to.toLowerCase() === SGCOIN_BURN_ADDRESS.toLowerCase() ||
                    tx.to.toLowerCase() === DEAD_ADDRESS.toLowerCase()
                )
                .map((tx: any) => ({
                    type: tx.to.toLowerCase() === SGCOIN_BURN_ADDRESS.toLowerCase() ? 'migration' : 'burn',
                    txHash: tx.hash,
                    amount: (parseInt(tx.value) / 1e9).toString(), // V1 is 9 decimals
                    address: tx.from,
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    blockNumber: parseInt(tx.blockNumber)
                }))
                .slice(0, limit);

            return activities;
        }
        return [];
    } catch (error) {
        console.error('[PolygonScan API] Error fetching burn activity:', error);
        return [];
    }
};

// Determine if transaction is buy, sell, transfer, or liquidity add
const determineTransactionType = (tx: any): 'transfer' | 'buy' | 'sell' | 'liquidity' => {
    // Simple heuristic: if 'to' is a DEX router, it's likely a buy/sell
    const dexAddresses = [
        '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'.toLowerCase(), // QuickSwap V2 Router
        '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'.toLowerCase(), // SushiSwap Router
    ];

    // Liquidity Pair Addresses (transfers to these are often adds)
    const lpAddresses = [
        QUICKSWAP_LP_ADDRESS.toLowerCase(),
        QUICKSWAP_V3_LP_ADDRESS.toLowerCase(),
    ];

    const toAddr = tx.to.toLowerCase();
    const fromAddr = tx.from.toLowerCase();

    if (lpAddresses.includes(toAddr)) return 'liquidity';

    if (dexAddresses.includes(fromAddr)) return 'buy';
    if (dexAddresses.includes(toAddr)) return 'sell';

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
