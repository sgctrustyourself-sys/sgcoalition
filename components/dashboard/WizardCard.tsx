import React from 'react';
import { motion } from 'framer-motion';
import { MiniWizard } from '../../types/MiniWizard';
import { Zap, Flame, Shield, Sparkles } from 'lucide-react';

interface WizardCardProps {
    wizard: MiniWizard;
    onClick?: () => void;
}

const WizardCard: React.FC<WizardCardProps> = ({ wizard, onClick }) => {
    const getElementIcon = (element: string) => {
        switch (element) {
            case 'Fire': return <Flame className="w-4 h-4 text-orange-500" />;
            case 'Ice': return <Sparkles className="w-4 h-4 text-blue-400" />;
            case 'Void': return <Zap className="w-4 h-4 text-purple-500" />;
            default: return <Shield className="w-4 h-4 text-gray-400" />;
        }
    };

    const getElementColor = (element: string) => {
        switch (element) {
            case 'Fire': return 'from-orange-500/20 to-red-600/20 border-orange-500/30';
            case 'Ice': return 'from-blue-400/20 to-cyan-500/20 border-blue-400/30';
            case 'Void': return 'from-purple-500/20 to-indigo-600/20 border-purple-500/30';
            default: return 'from-gray-500/20 to-gray-700/20 border-gray-500/30';
        }
    };

    return (
        <motion.div
            whileHover={{ y: -10, scale: 1.02 }}
            onClick={onClick}
            className={`relative group cursor-pointer p-1 rounded-[2rem] bg-gradient-to-br ${getElementColor(wizard.element)} border backdrop-blur-xl overflow-hidden`}
        >
            {/* Holographic Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out" />

            <div className="bg-[#0A0A0A]/80 rounded-[1.8rem] p-5 h-full flex flex-col">
                {/* Image Container */}
                <div className="relative aspect-square rounded-2xl mb-5 overflow-hidden bg-black/40 border border-white/5">
                    <img
                        src={wizard.image || 'https://via.placeholder.com/400?text=Arcane+Wizard'}
                        alt={wizard.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest">
                        {getElementIcon(wizard.element)}
                        {wizard.element}
                    </div>

                    {wizard.isLegacy && (
                        <div className="absolute top-3 left-3 px-3 py-1 bg-purple-600 rounded-full text-[8px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                            Legacy
                        </div>
                    )}
                </div>

                {/* Core Info */}
                <div className="mb-4">
                    <h3 className="text-xl font-display font-black uppercase tracking-tighter mb-1 truncate">{wizard.name}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Tier</span>
                        <span className="text-[10px] uppercase font-black text-white px-2 py-0.5 bg-white/5 rounded-md border border-white/10">Initiate</span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-white/5">
                    <div>
                        <div className="text-[8px] uppercase tracking-widest font-black text-gray-600 mb-1">Level</div>
                        <div className="text-lg font-black tracking-tight">{wizard.level}</div>
                    </div>
                    <div>
                        <div className="text-[8px] uppercase tracking-widest font-black text-gray-600 mb-1">Power</div>
                        <div className="text-lg font-black tracking-tight text-purple-400">{wizard.power}</div>
                    </div>
                </div>

                {/* Progress Bar (simplified XP) */}
                <div className="h-1 w-full bg-white/5 rounded-full mt-4 overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(wizard.level % 10) * 10}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default WizardCard;
