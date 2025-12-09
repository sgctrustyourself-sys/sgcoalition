import React, { useState, useEffect } from 'react';
import { ExternalLink, ArrowDownUp, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { fetchRecentTransactions, formatAddress, getTimeAgo, Transaction } from '../utils/polygonScanApi';

const LiveTransactions = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadTransactions();
        const interval = setInterval(loadTransactions, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const loadTransactions = async () => {
        setIsLoading(true);
        const txs = await fetchRecentTransactions(15);
        setTransactions(txs);
        setIsLoading(false);
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'buy': return 'text-green-400 bg-green-500/10';
            case 'sell': return 'text-red-400 bg-red-500/10';
            default: return 'text-blue-400 bg-blue-500/10';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'buy': return <TrendingUp size={14} />;
            case 'sell': return <TrendingDown size={14} />;
            default: return <ArrowDownUp size={14} />;
        }
    };

    const renderTransaction = (tx: Transaction, index: number) => (
        <div
            key={tx.hash + index}
            className="p-4 hover:bg-gray-800/30 transition group"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 ${getTypeColor(tx.type)}`}>
                        {getTypeIcon(tx.type)}
                        {tx.type}
                    </span>
                    <span className="text-gray-500 text-xs">{getTimeAgo(tx.timestamp)}</span>
                </div>
                <a
                    href={`https://polygonscan.com/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent hover:text-white transition text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100"
                >
                    View <ExternalLink size={12} />
                </a>
            </div>
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                    <span className="font-mono">{formatAddress(tx.from)}</span>
                    <span>→</span>
                    <span className="font-mono">{formatAddress(tx.to)}</span>
                </div>
                <span className="font-mono font-bold text-white">
                    {parseFloat(tx.value).toLocaleString()} SG
                </span>
            </div>
        </div>
    );

    return (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Header */}
            <div
                className="p-6 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 transition flex items-center justify-between"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <ArrowDownUp className="text-purple-400" size={20} />
                    </div>
                    <div>
                        <h3 className="font-display text-xl font-bold uppercase">Live Transactions</h3>
                        <p className="text-xs text-gray-500">Real-time SGCOIN activity on Polygon</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            loadTransactions();
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg transition"
                        disabled={isLoading}
                        aria-label="Refresh transactions"
                    >
                        <RefreshCw className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} size={16} />
                    </button>
                    <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Always Show Last 4 Transactions */}
            <div>
                {transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <ArrowDownUp className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                        <p>No recent transactions</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-gray-800">
                            {transactions.slice(0, 4).map(renderTransaction)}
                        </div>

                        {/* Show More Button */}
                        {transactions.length > 4 && !isExpanded && (
                            <div className="p-4 bg-gray-800/30 border-t border-gray-800 text-center">
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="text-sm text-brand-accent hover:text-white transition font-bold uppercase tracking-wide"
                                >
                                    Show All {transactions.length} Transactions →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Expanded View - Show Remaining Transactions */}
            {isExpanded && transactions.length > 4 && (
                <div className="max-h-96 overflow-y-auto border-t border-gray-800">
                    <div className="divide-y divide-gray-800">
                        {transactions.slice(4).map(renderTransaction)}
                    </div>
                </div>
            )}

            {/* Footer Link */}
            <div className="p-4 bg-gray-800/30 border-t border-gray-800">
                <a
                    href="https://polygonscan.com/token/0x951806a2581c22C478aC613a675e6c898E2aBe21"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-accent hover:text-white transition flex items-center justify-center gap-2"
                >
                    View All Transactions on PolygonScan <ExternalLink size={14} />
                </a>
            </div>
        </div>
    );
};

export default LiveTransactions;
