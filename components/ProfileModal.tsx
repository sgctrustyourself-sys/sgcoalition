import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../data/badges';
import { UNLOCK_TIERS, getNextUnlock } from '../data/unlocks';
import { X, ShieldCheck, Lock, CheckCircle2, LayoutDashboard, Medal } from 'lucide-react';

interface ProfileModalProps {
    badges: Badge[];
    isOpen: boolean;
    onClose: () => void;
    walletAddress: string;
    sgCoinBalance: any; // Allow number or string format (V1 Balance)
    v2Balance?: any; // V2 Balance
    totalMigrated?: any; // Total amount migrated from V1 to V2
}

const ProfileModal: React.FC<ProfileModalProps> = ({ badges, isOpen, onClose, walletAddress, sgCoinBalance, v2Balance = 0, totalMigrated = 0 }) => {
    const [activeTab, setActiveTab] = useState<'utility' | 'badges'>('utility');

    // Parse balance safely
    const balanceValue = typeof sgCoinBalance === 'string'
        ? parseFloat(sgCoinBalance.replace(/,/g, ''))
        : sgCoinBalance;

    const v2BalanceValue = typeof v2Balance === 'string'
        ? parseFloat(v2Balance.replace(/,/g, ''))
        : v2Balance || 0;

    const totalMigratedValue = typeof totalMigrated === 'string'
        ? parseFloat(totalMigrated.replace(/,/g, ''))
        : totalMigrated || 0;

    const nextUnlock = getNextUnlock(balanceValue);
    const progressToNext = nextUnlock
        ? Math.min(100, (balanceValue / nextUnlock.threshold) * 100)
        : 100;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 m-auto w-full max-w-2xl h-fit max-h-[90vh] bg-gray-900 border border-purple-500/30 rounded-3xl overflow-hidden z-50 shadow-[0_0_50px_rgba(168,85,247,0.2)] flex flex-col"
                    >
                        {/* Header */}
                        <div className="relative h-32 bg-gradient-to-r from-purple-900 via-indigo-900 to-black p-6 flex flex-col justify-end overflow-hidden flex-shrink-0">
                            {/* Background Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />

                            <button
                                onClick={onClose}
                                title="Close Profile"
                                className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition backdrop-blur-md z-20"
                                aria-label="Close Profile"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="relative z-10 flex items-end gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-black border border-purple-500/50 flex items-center justify-center shadow-xl">
                                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 opacity-20" />
                                    <ShieldCheck className="absolute w-8 h-8 text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Identity</h2>
                                    <p className="font-mono text-xs text-purple-300 break-all">{walletAddress}</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex border-b border-gray-800 bg-black/40 px-6 pt-2">
                            <button
                                onClick={() => setActiveTab('utility')}
                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'utility' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Utility
                            </button>
                            <button
                                onClick={() => setActiveTab('badges')}
                                className={`pb-3 px-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'badges' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <Medal className="w-4 h-4" />
                                Badges
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-950/50">

                            {activeTab === 'utility' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {/* --- NEW DUAL-CORE BALANCE SECTION --- */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">

                                        {/* V1 BALANCE (Left Card) - RED */}
                                        <div className="bg-gray-900/50 border border-red-500/30 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-2 opacity-20 text-red-500">
                                                {/* Fire/Burn Icon */}
                                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.45-.398-2.127 0-.41-.091-.83-.281-1.196a1 1 0 00-1.93.18 5.762 5.762 0 00.74 3.06c.408.66.974 1.258 1.678 1.57.172.076.326.175.462.29A4.996 4.996 0 009 16.5a5 5 0 005-5c0-.655-.138-1.278-.388-1.844-.251-.57-.61-1.09-1.05-1.536a1 1 0 00-1.565 1.257 3 3 0 01.378 1.394A3.001 3.001 0 019 13.5a3.001 3.001 0 01-3-3c0-.66.19-1.295.55-1.876.307-.496.536-1.12.78-1.81.24-.68.52-1.396.86-2.083a15.75 15.75 0 01.996-1.867 1 1 0 00-.79-1.31z" clipRule="evenodd" /></svg>
                                            </div>
                                            <span className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Legacy (V1)</span>
                                            <span className="text-xl md:text-2xl font-mono text-white tracking-tight">{balanceValue.toLocaleString()}</span>
                                        </div>

                                        {/* V2 BALANCE (Right Card) - GREEN */}
                                        <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-2 opacity-20 text-green-500">
                                                {/* Hexagon/Token Icon */}
                                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                            </div>
                                            <span className="text-xs font-bold text-green-400 uppercase tracking-wider mb-1">Standard (V2)</span>
                                            <span className="text-xl md:text-2xl font-mono text-white tracking-tight">{v2BalanceValue.toLocaleString()}</span>
                                        </div>

                                        {/* TOTAL MIGRATED (Full Width Bottom Bar) - GOLD */}
                                        <div className="col-span-2 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-lg p-3 flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Total Migrated</span>
                                            <div className="flex items-center gap-2 mr-2">
                                                <span className="text-lg font-mono text-yellow-400 font-bold">{totalMigratedValue.toLocaleString()}</span>
                                                <span className="text-xs text-yellow-600 font-bold">SGC</span>
                                            </div>
                                        </div>

                                    </div>

                                    {/* Next Unlock Section */}
                                    {nextUnlock && (
                                        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/10 border border-purple-500/20 rounded-2xl p-6 mb-6">
                                            <div className="flex justify-between items-center mb-4">
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Next Unlock</p>
                                                    <p className={`text-lg font-bold ${nextUnlock.color}`}>{nextUnlock.title}</p>
                                                    <p className="text-xs text-gray-600 font-mono">{nextUnlock.threshold.toLocaleString()} SGC</p>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progressToNext}%` }}
                                                    transition={{ duration: 1, ease: 'easeOut' }}
                                                    className="absolute top-0 left-0 h-full bg-purple-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {!nextUnlock && (
                                        <div className="p-2 bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-wider rounded text-center border border-green-500/20 mb-6">
                                            All Tiers Unlocked
                                        </div>
                                    )}

                                    {/* Unlock Tiers List */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Features & Perks</h3>
                                        {UNLOCK_TIERS.map((tier) => {
                                            const isUnlocked = balanceValue >= tier.threshold;
                                            return (
                                                <div
                                                    key={tier.id}
                                                    className={`group p-4 rounded-xl border flex items-center gap-4 transition-all duration-300 ${isUnlocked ? 'bg-black/40 border-gray-800 hover:border-purple-500/30' : 'bg-black/20 border-gray-800/50 opacity-60 grayscale'}`}
                                                >
                                                    <div className={`p-3 rounded-lg bg-gray-900 border border-gray-800 transition ${isUnlocked ? tier.color + ' bg-opacity-20' : 'text-gray-600'}`}>
                                                        <tier.icon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h4 className={`font-bold text-sm ${isUnlocked ? 'text-gray-200' : 'text-gray-500'}`}>{tier.title}</h4>
                                                            <span className="font-mono text-xs text-gray-600">{tier.threshold.toLocaleString()} SGC</span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-1">{tier.description}</p>
                                                    </div>
                                                    <div className="pl-2">
                                                        {isUnlocked ? (
                                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <Lock className="w-4 h-4 text-gray-700" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'badges' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        Earned Badges ({badges.length})
                                    </h3>

                                    {badges.length === 0 ? (
                                        <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl">
                                            <p className="text-gray-500">No badges earned yet.</p>
                                            <p className="text-xs text-gray-600 mt-1">Participate in drops to level up.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {badges.map((badge, index) => (
                                                <motion.div
                                                    key={badge.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className="bg-black/40 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-purple-500/30 hover:bg-purple-900/5 transition"
                                                >
                                                    <div className={`p-3 rounded-lg bg-gray-900/50 border border-gray-800 ${badge.color}`}>
                                                        <badge.icon className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className={`font-bold text-sm ${badge.color}`}>{badge.name}</h4>
                                                            {badge.tier === 'legendary' && (
                                                                <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider font-bold">
                                                                    Legendary
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{badge.description}</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProfileModal;
