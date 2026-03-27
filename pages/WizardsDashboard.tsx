import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Globe, ArrowUpRight, Layers, Shield } from 'lucide-react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import WizardCard from '../components/dashboard/WizardCard';
import { MOCK_WIZARDS } from '../data/mockWizards';
import { fetchUserMiniWizards } from '../services/web3Service';
import { useApp } from '../context/AppContext';
import { ethers } from 'ethers';
import WizardDetailModal from '../components/dashboard/WizardDetailModal';
import { MiniWizard } from '../types/MiniWizard';

const WizardsDashboard: React.FC = () => {
    const { user } = useApp();
    const walletAddress = user?.walletAddress;
    const [wizards, setWizards] = useState<any[]>(MOCK_WIZARDS);
    const [filteredWizards, setFilteredWizards] = useState<any[]>(MOCK_WIZARDS);
    const [isLoading, setIsLoading] = useState(false);
    const [filterElement, setFilterElement] = useState<string>('All');
    const [sortBy, setSortBy] = useState<string>('level');
    const [selectedWizard, setSelectedWizard] = useState<MiniWizard | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    useEffect(() => {
        const loadWizards = async () => {
            if (walletAddress) {
                setIsLoading(true);
                try {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const realWizards = await fetchUserMiniWizards(walletAddress, provider);
                    if (realWizards.length > 0) {
                        setWizards([...realWizards, ...MOCK_WIZARDS]);
                    }
                } catch (error) {
                    console.error("Error loading real wizards:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadWizards();
    }, [walletAddress]);

    useEffect(() => {
        let result = [...wizards];
        if (filterElement !== 'All') {
            result = result.filter(w => w.element === filterElement);
        }
        result.sort((a, b) => {
            if (sortBy === 'level') return b.level - a.level;
            if (sortBy === 'power') return b.power - a.power;
            return 0;
        });
        setFilteredWizards(result);
    }, [wizards, filterElement, sortBy]);

    if (!walletAddress) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center mb-6">
                        <Shield className="w-10 h-10 text-purple-400" />
                    </div>
                    <h2 className="text-3xl font-display font-black uppercase tracking-tighter mb-4">Auth Required</h2>
                    <p className="text-gray-500 max-w-sm mb-8">Please connect your arcane wallet to access the MiniWizards dashboard and artifacts.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-4xl font-display font-black uppercase tracking-tighter mb-2">My Arcane Collection</h1>
                        <p className="text-gray-500 font-medium">Manage your {wizards.length} Digital Wizards and legacy assets.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <select
                            value={filterElement}
                            onChange={(e) => setFilterElement(e.target.value)}
                            title="Filter by Element"
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-400 focus:outline-none focus:border-purple-500/30 transition-all"
                        >
                            <option value="All">All Elements</option>
                            <option value="Fire">Fire</option>
                            <option value="Ice">Ice</option>
                            <option value="Void">Void</option>
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            title="Sort by Attribute"
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-400 focus:outline-none focus:border-purple-500/30 transition-all"
                        >
                            <option value="level">Level</option>
                            <option value="power">Power</option>
                        </select>
                        <button className="flex items-center gap-2 px-6 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 text-xs font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all">
                            <Plus size={16} /> Summons New Wizard
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {isLoading ? (
                        [...Array(4)].map((_, i) => (
                            <div key={i} className="h-80 bg-white/5 rounded-[2rem] animate-pulse" />
                        ))
                    ) : (
                        filteredWizards.map((wizard, idx) => (
                            <WizardCard
                                key={wizard.id + idx}
                                wizard={wizard}
                                onClick={() => {
                                    setSelectedWizard(wizard);
                                    setIsDetailModalOpen(true);
                                }}
                            />
                        ))
                    )}
                </div>

                {selectedWizard && (
                    <WizardDetailModal
                        wizard={selectedWizard}
                        isOpen={isDetailModalOpen}
                        onClose={() => setIsDetailModalOpen(false)}
                        onUpgrade={(id) => {
                            setWizards(prev => prev.map(w => w.id === id ? { ...w, level: w.level + 1, power: w.power + 10 } : w));
                        }}
                    />
                )}

                {/* Cross-Chain Relics Section */}
                <section className="mt-20 pt-20 border-t border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                        <div>
                            <h2 className="text-3xl font-display font-black uppercase tracking-tighter flex items-center gap-3">
                                <Layers className="w-8 h-8 text-blue-400" />
                                Trans-Dimensional Relics
                            </h2>
                            <p className="text-gray-500 font-medium text-sm mt-1">External Wizard artifacts manifesting from the WAX Blockchain</p>
                        </div>
                        <a
                            href="https://neftyblocks.com/collection/sgminiwizard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3"
                        >
                            Explorer WAX Collection <ArrowUpRight size={14} />
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="p-8 rounded-[2rem] bg-gradient-to-br from-blue-500/5 to-purple-600/5 border border-white/5 backdrop-blur-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform">
                                <Globe size={60} />
                            </div>
                            <h3 className="text-xl font-bold uppercase tracking-tight mb-4">WAX Origin Chain</h3>
                            <p className="text-sm text-gray-400 leading-relaxed mb-6">
                                The second chain of Wizards, forged on the WAX ecosystem. These ancient spirits maintain a direct metaphysical link to the Coalition.
                            </p>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Status: Manifesting</span>
                                <div className="h-1 w-20 bg-blue-500/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-400 animate-pulse w-[65%]" />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] flex flex-col justify-center items-center text-center group hover:bg-white/5 transition-all cursor-pointer">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Plus className="text-gray-500" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Link External WAX Wallet</span>
                            <span className="text-[10px] text-gray-700 mt-2 uppercase font-bold">Coming Soon to Arcane Interface</span>
                        </div>
                    </div>
                </section>
            </div>
        </DashboardLayout>
    );
};

export default WizardsDashboard;
