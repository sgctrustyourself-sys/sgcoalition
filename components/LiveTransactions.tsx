import React, { useState, useEffect } from 'react';
import { ExternalLink, ArrowDownUp, TrendingUp, TrendingDown, RefreshCw, Activity, Layers } from 'lucide-react';
import { fetchRecentTransactions, formatAddress, getTimeAgo, Transaction } from '../utils/polygonScanApi';
import { SGCOIN_V2_CONTRACT_ADDRESS } from '../constants';

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
            case 'buy': return 'text-green-400 bg-green-500/5 border-green-500/20';
            case 'sell': return 'text-red-400 bg-red-500/5 border-red-500/20';
            case 'liquidity': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]';
            default: return 'text-purple-400 bg-purple-500/5 border-purple-500/20';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'buy': return <TrendingUp size={12} />;
            case 'sell': return <TrendingDown size={12} />;
            case 'liquidity': return <Layers size={12} />;
            default: return <ArrowDownUp size={12} />;
        }
    };

    const renderTransaction = (tx: Transaction, index: number) => (
        <div
            key={tx.hash + index}
            className="p-6 hover:bg-white/[0.03] transition-all group border-b border-white/5 last:border-0"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 border ${getTypeColor(tx.type)}`}>
                        {getTypeIcon(tx.type)}
                        {tx.type === 'liquidity' ? 'Liquidity Added' : tx.type}
                    </span>
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{getTimeAgo(tx.timestamp)}</span>
                </div>
                <a
                    href={`https://polygonscan.com/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-white transition-all text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 uppercase font-black tracking-widest"
                >
                    Oracle Link <ExternalLink size={10} />
                </a>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-gray-400 text-xs">
                    <span className="font-mono bg-white/5 px-2 py-1 rounded border border-white/5">{formatAddress(tx.from)}</span>
                    <ArrowDownUp size={12} className="text-gray-600 rotate-90" />
                    <span className="font-mono bg-white/5 px-2 py-1 rounded border border-white/5">{formatAddress(tx.to)}</span>
                </div>
                <span className="font-display font-black text-xl text-white tracking-widest uppercase">
                    {parseFloat(tx.value).toLocaleString()} <span className="text-gray-600">SGC</span>
                </span>
            </div>
        </div>
    );

    return (
        <div className="bg-black rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative">

            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-500/5 via-transparent to-orange-500/5 pointer-events-none" />

            {/* Header */}
            <div
                className="p-10 border-b border-white/10 cursor-pointer hover:bg-white/2 transition-all flex items-center justify-between relative z-10"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/10 to-orange-500/10 border border-white/10 flex items-center justify-center">
                        <Activity className="text-orange-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-display text-2xl font-black uppercase tracking-tighter">Live Transmission</h3>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.3em]">Synched with Polygon Mainnet</p>
                    </div>
                </div>
                <div className="flex items-center gap-5">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            loadTransactions();
                        }}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full border border-white/10 transition-all font-bold"
                        disabled={isLoading}
                        title="Refresh Transmission"
                    >
                        <RefreshCw className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} size={16} />
                    </button>
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full border border-white/10 transition-transform ${isExpanded ? 'rotate-180 bg-white/5' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Transaction List */}
            <div className="relative z-10">
                {transactions.length === 0 ? (
                    <div className="p-20 text-center text-gray-600">
                        <Activity className="w-12 h-12 mx-auto mb-6 opacity-20" />
                        <p className="text-[10px] uppercase font-black tracking-widest">No Signals Detected</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-white/5">
                            {transactions.slice(0, 4).map(renderTransaction)}
                        </div>

                        {transactions.length > 4 && !isExpanded && (
                            <div className="p-8 bg-white/[0.02] border-t border-white/5 text-center">
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="text-[10px] text-orange-500 hover:text-white transition-all font-black uppercase tracking-[0.4em]"
                                >
                                    Decrypt Extended Activity ({transactions.length}) →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Expanded Content */}
            {isExpanded && transactions.length > 4 && (
                <div className="max-h-[500px] overflow-y-auto border-t border-white/10 relative z-10 custom-scrollbar">
                    <div className="divide-y divide-white/5">
                        {transactions.slice(4).map(renderTransaction)}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="p-8 bg-black border-t border-white/10 relative z-10">
                <a
                    href={`https://polygonscan.com/token/${SGCOIN_V2_CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-gray-500 hover:text-white transition-all flex items-center justify-center gap-3 uppercase font-black tracking-[0.3em]"
                >
                    View Verified Source on PolygonScan <ExternalLink size={12} />
                </a>
            </div>
        </div>
    );
};

export default LiveTransactions;
