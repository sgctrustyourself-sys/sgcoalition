import React from 'react';
import { Package, ShoppingCart, GitBranch, Gift, Settings, LogOut, Menu, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AdminLayoutProps {
    children: React.ReactNode;
    activeTab: 'products' | 'orders' | 'git' | 'giveaways' | 'settings';
    onTabChange: (tab: 'products' | 'orders' | 'git' | 'giveaways' | 'settings') => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab, onTabChange }) => {
    const { logoutAdmin } = useApp();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const navItems = [
        { id: 'products', label: 'Products', icon: Package },
        { id: 'orders', label: 'Orders', icon: ShoppingCart },
        { id: 'git', label: 'Version Control', icon: GitBranch },
        { id: 'giveaways', label: 'Giveaways', icon: Gift },
        // { id: 'settings', label: 'Settings', icon: Settings },
    ] as const;

    return (
        <div className="min-h-screen bg-black text-white flex font-sans">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl fixed h-full z-20">
                <div className="p-6 border-b border-white/10">
                    <h1 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                        Antigravity <span className="text-brand-accent">Admin</span>
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${activeTab === item.id
                                    ? 'bg-white text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-black' : 'text-gray-400 group-hover:text-white'}`} />
                            <span className="uppercase tracking-wide text-sm">{item.label}</span>
                        </button>
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
                <div className="md:hidden fixed inset-0 z-20 bg-black pt-20 px-4">
                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onTabChange(item.id);
                                    setIsMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-4 rounded-lg border ${activeTab === item.id
                                        ? 'bg-white text-black border-white'
                                        : 'border-white/10 text-gray-400'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="uppercase tracking-wide font-bold">{item.label}</span>
                            </button>
                        ))}
                        <button
                            onClick={logoutAdmin}
                            className="w-full flex items-center gap-3 px-4 py-4 rounded-lg border border-red-500/30 text-red-400 mt-8"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="uppercase tracking-wide font-bold">Logout</span>
                        </button>
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
