import React from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Shield,
    Zap,
    Flame,
    Settings,
    Search,
    Wand2,
    Crown,
    Globe,
    Layers,
    ArrowUpRight
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const location = useLocation();
    const { user } = useApp();

    const sidebarItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Gallery', path: '/sgminiwizards/dashboard' },
        { icon: <Layers size={20} />, label: 'V1 Legacy', path: '/migrate' },
        { icon: <Globe size={20} />, label: 'WAX Relics', path: 'https://neftyblocks.com/collection/sgminiwizard', isExternal: true },
        { icon: <Shield size={20} />, label: 'Quests', path: '/sgminiwizards/quests' },
        { icon: <Zap size={20} />, label: 'Treasury', path: '/sgminiwizards/treasury' },
    ];

    return (
        <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col z-20">
                <div className="p-8">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                            <Wand2 className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-display font-black tracking-tighter text-xl uppercase">Wizards</span>
                    </Link>
                </div>

                <nav className="flex-grow px-4 space-y-2 mt-8">
                    {sidebarItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        if (item.isExternal) {
                            return (
                                <a
                                    key={item.path}
                                    href={item.path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between px-4 py-3 rounded-xl transition-all group text-gray-500 hover:text-white hover:bg-white/5"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="group-hover:text-blue-400 transition-colors">
                                            {item.icon}
                                        </span>
                                        <span className="text-sm font-bold uppercase tracking-widest">{item.label}</span>
                                    </div>
                                    <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                            );
                        }
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${isActive
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <span className={`${isActive ? 'text-purple-400' : 'group-hover:text-purple-400'} transition-colors`}>
                                    {item.icon}
                                </span>
                                <span className="text-sm font-bold uppercase tracking-widest">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-white/5">
                    <button className="flex items-center gap-4 px-4 py-3 w-full text-gray-500 hover:text-white transition-colors group">
                        <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                        <span className="text-sm font-bold uppercase tracking-widest">Settings</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-grow flex flex-col relative overflow-hidden">
                {/* Topbar */}
                <header className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-10 z-10">
                    <div className="relative w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search Arcane Assets..."
                            className="w-full bg-white/5 border border-white/5 rounded-full py-2.5 pl-12 pr-6 text-sm focus:outline-none focus:border-purple-500/30 focus:bg-white/10 transition-all placeholder:text-gray-600 font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500">SGC Balance</span>
                            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 italic">
                                {user?.sgCoinBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </span>
                        </div>
                        <div className="h-10 w-[1px] bg-white/5" />
                        <button className="px-6 py-2.5 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-purple-600 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg">
                            {user ? 'Connected' : 'Connect Wallet'}
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-grow overflow-y-auto p-10 scrollbar-hide">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {children}
                    </motion.div>
                </div>

                {/* Background Decorations */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none" />
            </main>
        </div>
    );
};

export default DashboardLayout;
