import React from 'react';
import { Activity, Package, ShoppingCart, GitBranch, Gift, LogOut, Menu, X, MessageSquare, Coins, Star, BarChart3, TrendingUp, Instagram, Megaphone, Users, Brain, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AdminLayoutProps {
    children: React.ReactNode;
    activeTab: 'command-center' | 'products' | 'orders' | 'blog' | 'reviews' | 'analytics' | 'referrals' | 'sgcoin-distribution' | 'sgcoin-requests' | 'instagram' | 'git' | 'giveaways' | 'inquiries' | 'signals' | 'images' | 'users' | 'brain' | 'settings';
    onTabChange: (tab: 'command-center' | 'products' | 'orders' | 'blog' | 'reviews' | 'analytics' | 'referrals' | 'sgcoin-distribution' | 'sgcoin-requests' | 'instagram' | 'git' | 'giveaways' | 'inquiries' | 'signals' | 'images' | 'users' | 'brain' | 'settings') => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, onTabChange }) => {
    const { logoutAdmin } = useApp();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const navGroups: Array<{ label: string; items: Array<{ id: typeof activeTab; label: string; icon: React.ComponentType<{ className?: string }> }> }> = [
        {
            label: 'Commerce',
            items: [
                { id: 'products', label: 'Products', icon: Package },
                { id: 'orders', label: 'Orders', icon: ShoppingCart },
                { id: 'reviews', label: 'Reviews', icon: Star },
            ]
        },
        {
            label: 'Content',
            items: [
                { id: 'blog', label: 'Blog Manager', icon: MessageSquare },
                { id: 'images', label: 'Image Manager', icon: ImageIcon },
            ]
        },
        {
            label: 'Community',
            items: [
                { id: 'giveaways', label: 'Giveaways', icon: Gift },
                { id: 'inquiries', label: 'Custom Inquiries', icon: MessageSquare },
                { id: 'instagram', label: 'Instagram Links', icon: Instagram },
                { id: 'signals', label: 'Signal Broadcast', icon: Megaphone },
                { id: 'users', label: 'User Directory', icon: Users },
            ]
        },
        {
            label: 'Finance',
            items: [
                { id: 'sgcoin-distribution', label: 'SGCoin Distribution', icon: Coins },
                { id: 'sgcoin-requests', label: 'SGCoin Requests', icon: Coins },
                { id: 'referrals', label: 'Referral Analytics', icon: TrendingUp },
            ]
        },
        {
            label: 'System',
            items: [
                { id: 'command-center', label: 'Command Center', icon: Activity },
                { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                { id: 'git', label: 'Version Control', icon: GitBranch },
                { id: 'brain', label: 'Coalition Brain', icon: Brain },
            ]
        },
    ];

    return (
        <div className="min-h-screen bg-black text-white flex font-sans">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl fixed h-full z-20">
                <div className="p-6 border-b border-white/10">
                    <h1 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                        Antigravity <span className="text-brand-accent">Admin</span>
                    </h1>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                    {navGroups.map((group) => (
                        <div key={group.label}>
                            <div className="px-3 pb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-600">
                                    {group.label}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => onTabChange(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === item.id
                                            ? 'bg-white text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        title={item.label}
                                    >
                                        <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-black' : 'text-gray-400 group-hover:text-white'}`} />
                                        <span className="uppercase tracking-wide text-xs font-semibold">{item.label}</span>
                                        {activeTab === item.id && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={logoutAdmin}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="uppercase tracking-wide text-sm font-bold">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black border-b border-white/10 z-30 flex items-center justify-between px-4">
                <h1 className="font-display text-lg font-bold uppercase tracking-wider">Admin</h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-20 bg-black/95 backdrop-blur-lg pt-20 px-4 overflow-y-auto">
                    <nav className="pb-8 space-y-6">
                        {navGroups.map((group) => (
                            <div key={group.label}>
                                <div className="px-1 pb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-600">
                                        {group.label}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                onTabChange(item.id);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all border ${activeTab === item.id
                                                ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                                                : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-black' : ''}`} />
                                            <span className="uppercase tracking-wide font-bold text-sm">{item.label}</span>
                                            {activeTab === item.id && (
                                                <span className="ml-auto w-2 h-2 rounded-full bg-black"></span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="pt-6 border-t border-white/10">
                            <button
                                onClick={logoutAdmin}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                <span className="uppercase tracking-wide font-bold text-sm">Logout</span>
                            </button>
                        </div>
                    </nav>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 md:ml-64 min-h-screen bg-black pt-20 md:pt-0">
                <div className="max-w-7xl mx-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
