import React, { useEffect, useState } from 'react';
import { Plus, Globe, ArrowUpRight, Layers, Shield, Image, Zap, Wand2, Box } from 'lucide-react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import WizardCard from '../components/dashboard/WizardCard';
import { MOCK_WIZARDS } from '../data/mockWizards';
import { fetchUserMiniWizards } from '../services/web3Service';
import { useApp } from '../context/AppContext';
import WizardDetailModal from '../components/dashboard/WizardDetailModal';
import { MiniWizard } from '../types/MiniWizard';

const WizardsDashboard: React.FC = () => {
    const { user } = useApp();
    const walletAddress = user?.walletAddress;
    const [wizards, setWizards] = useState<MiniWizard[]>(MOCK_WIZARDS);
    const [filteredWizards, setFilteredWizards] = useState<MiniWizard[]>(MOCK_WIZARDS);
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
                    const { ethers: e } = await import('ethers');
                    const provider = new e.BrowserProvider(window.ethereum);
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

                {/* Personal Collections & Artifacts */}
                <section className="mt-20 pt-20 border-t border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                        <div>
                            <h2 className="text-3xl font-display font-black uppercase tracking-tighter flex items-center gap-3">
                                <Image className="w-8 h-8 text-purple-400" />
                                Personal Collections &amp; Artifacts
                            </h2>
                            <p className="text-gray-500 font-medium text-sm mt-1">
                                On-chain artwork, wearables, and collections from the Spaz Gang universe.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Featured: Most Significant Collection */}
                        <div className="lg:col-span-3 p-10 rounded-[3rem] border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                                <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:rotate-12 transition-transform">
                                    <Wand2 className="w-12 h-12 text-purple-400" />
                                </div>
                                <div>
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-6 uppercase tracking-[0.3em] font-bold">
                                        <Zap className="w-3 h-3" /> Featured Collection
                                    </div>
                                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 text-white">
                                        Spaz Gang MiniWizards
                                    </h3>
                                    <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-lg">
                                        The most significant collection — the genesis of everything. Community SG Mini
                                        Wizards forged on Polygon, Chapter One of the arcane economy.
                                    </p>
                                    <a
                                        href="https://opensea.io/collection/spazgang-miniwizards"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-8 py-3 bg-purple-500 text-white rounded-full font-black uppercase tracking-widest text-sm hover:bg-purple-400 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                                    >
                                        Open on OpenSea <ArrowUpRight className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* SGMW Items */}
                        {[
                            {
                                id: 'sgmw-item-1',
                                title: 'SGMW Token #6915469788939700255662107688630493008422408564534094781606242049099017748490',
                                label: 'MiniWizard Token',
                                url: 'https://opensea.io/item/polygon/0x2953399124f0cbb46d2cbacd8a89cf0599974963/6915469788939700255662107688630493008422408564534094781606242049099017748490',
                            },
                            {
                                id: 'sgmw-item-2',
                                title: 'SGMW Token #6915469788939700255662107688630493008422408564534094781606242271200366559233',
                                label: 'MiniWizard Token',
                                url: 'https://opensea.io/item/polygon/0x2953399124f0cbb46d2cbacd8a89cf0599974963/6915469788939700255662107688630493008422408564534094781606242271200366559233',
                            },
                            {
                                id: 'sgmw-item-3',
                                title: 'SGMW Token #6915469788939700255662107688630493008422408564534094781606242275598413070337',
                                label: 'MiniWizard Token',
                                url: 'https://opensea.io/item/polygon/0x2953399124f0cbb46d2cbacd8a89cf0599974963/6915469788939700255662107688630493008422408564534094781606242275598413070337',
                            },
                            {
                                id: 'sgmw-item-4',
                                title: 'SGMW Token #25301351943351891415725927464477484049512317528648331027932693967362542541556',
                                label: 'MiniWizard Token',
                                url: 'https://opensea.io/item/polygon/0x2953399124f0cbb46d2cbacd8a89cf0599974963/25301351943351891415725927464477484049512317528648331027932693967362542541556',
                            },
                        ].map((item) => (
                            <div
                                key={item.id}
                                className="p-8 rounded-[2rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group hover:border-purple-500/30 transition-all"
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                    <Image className="w-24 h-24 text-purple-400" />
                                </div>
                                <div className="relative z-10 flex flex-col gap-4">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[9px] mb-4 uppercase tracking-[0.2em] font-bold">
                                        {item.label}
                                    </div>
                                    <h4 className="text-lg font-black uppercase tracking-tight mb-3 leading-tight">
                                        {item.title.split('#')[1]?.slice(0, 20)}…
                                    </h4>
                                    <p className="text-gray-500 text-xs leading-relaxed mb-6 flex-1">
                                        Part of the Spaz Gang MiniWizards collection on Polygon.
                                    </p>
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-2 border border-white/10 text-white rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-white/5 transition-all"
                                    >
                                        View on OpenSea <ArrowUpRight className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        ))}

                        {/* Double OG Trousers - DCL Wearable */}
                        <div className="p-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-900/10 to-purple-600/10 backdrop-blur-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                <Box className="w-24 h-24 text-blue-400" />
                            </div>
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 text-[9px] mb-4 uppercase tracking-[0.2em] font-bold">
                                    DCL Wearable
                                </div>
                                <h4 className="text-lg font-black uppercase tracking-tight mb-3 leading-tight">
                                    About Spaz Gang "Double OG" Trousers
                                </h4>
                                <p className="text-gray-400 text-xs leading-relaxed mb-6 flex-1">
                                    Decentraland wearable 9/5000 — deadstock virtual clothing made to spice up character
                                    style in the virtual world. First pair made in 2020 while live streaming mockups
                                    with my logo.
                                </p>
                                <a
                                    href="https://opensea.io/item/polygon/0xc1dda1e494ea112b97cd298a78e5ad6fb5d4d553/9"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-2 border border-white/10 text-white rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-white/5 transition-all"
                                >
                                    View on OpenSea <ArrowUpRight className="w-3 h-3" />
                                </a>
                            </div>
                        </div>

                        {/* Voxel Collection */}
                        <div className="p-8 rounded-[2rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group hover:border-purple-400/30 transition-all">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                <Box className="w-24 h-24 text-purple-400" />
                            </div>
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-400/20 bg-purple-400/10 text-purple-400 text-[9px] mb-4 uppercase tracking-[0.2em] font-bold">
                                    Voxel Collection
                                </div>
                                <h4 className="text-lg font-black uppercase tracking-tight mb-3 leading-tight">
                                    Spazgang Wizard Voxels V1
                                </h4>
                                <p className="text-gray-400 text-xs leading-relaxed mb-6 flex-1">
                                    Custom voxel collection made while live streaming. Token #4 is my favorite — built
                                    to bring personality to the virtual world.
                                </p>
                                <a
                                    href="https://opensea.io/SG-OG-WIZARD/holdings?collectionSlugs=spazgang-wizard-voxels-v1&amp;view=grid"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-2 border border-white/10 text-white rounded-lg font-black uppercase tracking-widest text-[9px] hover:bg-white/5 transition-all"
                                >
                                    View Holdings <ArrowUpRight className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

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
