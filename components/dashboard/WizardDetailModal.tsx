import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Zap,
    Flame,
    Shield,
    Sparkles,
    TrendingUp,
    Activity,
    Lock,
    Unlock,
    ChevronRight,
    Sword,
    Scroll,
    ArrowUpRight
} from 'lucide-react';
import { MiniWizard } from '../../types/MiniWizard';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

interface WizardDetailModalProps {
    wizard: MiniWizard;
    isOpen: boolean;
    onClose: () => void;
    onUpgrade: (wizardId: string) => void;
}

const WizardDetailModal: React.FC<WizardDetailModalProps> = ({ wizard, isOpen, onClose, onUpgrade }) => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [isUpgrading, setIsUpgrading] = useState(false);

    if (!isOpen) return null;

    const upgradeCost = wizard.level * 100;
    const canAfford = (user?.sgCoinBalance || 0) >= upgradeCost;

    const handleUpgrade = async () => {
        if (!canAfford) {
            addToast(`Insufficient SGC. You need ${upgradeCost} SGC.`, 'error');
            return;
        }

        setIsUpgrading(true);
        // Simulate Arcane Pulse
        await new Promise(resolve => setTimeout(resolve, 1500));
        onUpgrade(wizard.id);
        setIsUpgrading(false);
        addToast(`${wizard.name} has ascended to Level ${wizard.level + 1}!`, 'success');
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        x: isUpgrading ? [0, -2, 2, -2, 2, 0] : 0
                    }}
                    transition={{
                        x: isUpgrading ? { repeat: Infinity, duration: 0.1 } : { duration: 0.3 }
                    }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-6xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.15)] grid grid-cols-1 lg:grid-cols-2"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        title="Close details"
                        aria-label="Close"
                        className="absolute top-8 right-8 z-10 p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>

                    {/* Left Side: Visuals */}
                    <div className="relative h-[400px] lg:h-full bg-black flex items-center justify-center overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
                        {/* Dynamic Background Glow */}
                        <div className={`absolute inset-0 bg-gradient-to-br opacity-20 ${wizard.element === 'Fire' ? 'from-orange-600/40 to-red-900/40' :
                            wizard.element === 'Ice' ? 'from-blue-600/40 to-cyan-900/40' :
                                'from-purple-600/40 to-indigo-900/40'
                            }`} />

                        <motion.img
                            layoutId={`wizard-img-${wizard.id}`}
                            src={wizard.image}
                            alt={wizard.name}
                            className="relative z-10 w-[80%] h-[80%] object-contain drop-shadow-[0_0_50px_rgba(168,85,247,0.3)]"
                        />

                        {/* Particle Overlay (Mock) */}
                        <div
                            className="absolute inset-0 z-0 bg-repeat opacity-20 mix-blend-overlay"
                            style={{ backgroundImage: "url('/images/patterns/noise.svg')" }}
                        />
                    </div>

                    {/* Right Side: Details & Actions */}
                    <div className="p-10 lg:p-16 flex flex-col h-full overflow-y-auto scrollbar-hide">
                        <div className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${wizard.element === 'Fire' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                                    wizard.element === 'Ice' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                        'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                    }`}>
                                    {wizard.element} Element
                                </span>
                                {wizard.isLegacy && (
                                    <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                        Legacy Asset
                                    </span>
                                )}
                            </div>
                            <h2 className="text-5xl lg:text-6xl font-display font-black uppercase tracking-tighter mb-4">{wizard.name}</h2>
                            <p className="text-gray-500 text-lg font-medium leading-relaxed max-w-md">
                                A powerful artifact from the Arcane Era, recently rediscovered within the Coalition archives.
                            </p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-10">
                            <StatBox label="Current Level" value={wizard.level} icon={<TrendingUp className="text-purple-400" />} />
                            <StatBox label="Arcane Power" value={wizard.power} icon={<Zap className="text-yellow-400" />} />
                            <StatBox label="Rarity Score" value="Top 12%" icon={<Sparkles className="text-blue-400" />} />
                            <StatBox label="Metadata Status" value="Verified" icon={<Shield className="text-emerald-400" />} />
                        </div>

                        {/* Upgrade Section */}
                        <div className="mt-auto space-y-6">
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                    <Flame size={80} />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-xl font-bold uppercase tracking-tight mb-2 flex items-center gap-2">
                                        Arcane Ascension
                                        <Sparkles className="w-5 h-5 text-brand-accent h-5 w-5" />
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-6">Infuse SGCOIN to permanently increase this Wizard's level and power stats.</p>

                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Upgrade Cost</span>
                                            <span className="text-2xl font-black text-white">{upgradeCost} SGC</span>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Target Level</span>
                                            <span className="text-2xl font-black text-brand-accent italic">LVL {wizard.level + 1}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleUpgrade}
                                        disabled={isUpgrading}
                                        className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs transition-all transform active:scale-95 ${isUpgrading ? 'bg-white/10 text-gray-400 cursor-not-allowed' :
                                            canAfford ? 'bg-white text-black hover:bg-brand-accent hover:text-white shadow-xl hover:shadow-brand-accent/20' :
                                                'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
                                            }`}
                                    >
                                        {isUpgrading ? (
                                            <>
                                                <Activity className="w-5 h-5 animate-spin" />
                                                Infusing Mana...
                                            </>
                                        ) : canAfford ? (
                                            <>
                                                Ascend Wizard <Flame className="w-5 h-5" />
                                            </>
                                        ) : (
                                            <>
                                                Insufficient SGC <Lock className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
                                <span className="flex items-center gap-2"><Scroll className="w-3 h-3" /> View On PolygonScan</span>
                                <span className="flex items-center gap-2"><ArrowUpRight className="w-3 h-3" /> External Link</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const StatBox = ({ label, value, icon }: any) => (
    <div className="p-6 bg-white/5 border border-white/5 rounded-2xl group hover:border-white/20 transition-all">
        <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-black/40 rounded-xl border border-white/5 group-hover:bg-white/10 transition-colors">
                {icon}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-700" />
        </div>
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
    </div>
);

export default WizardDetailModal;
