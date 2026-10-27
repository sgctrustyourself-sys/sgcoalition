import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Package, ShoppingCart, GitBranch, Gift, LogOut, Menu, X, MessageSquare, Mail, Coins, Star, BarChart3, TrendingUp, Instagram, Megaphone, Users, Brain, Image as ImageIcon, UserCircle2, Banknote, Award, Tag, ClipboardList, Check, Link2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { AdminTab } from './adminTabs';

interface AdminLayoutProps {
    children: React.ReactNode;
    activeTab: AdminTab;
}

// Every sidebar entry is a real link, so the open tab can be bookmarked,
// copied, or opened in a new tab. pages/Admin reads ?tab= back on load.
const tabHref = (tab: AdminTab) => `/admin?tab=${tab}`;

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab }) => {
    const { logoutAdmin } = useApp();
    const { addToast } = useToast();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const menuButtonRef = React.useRef<HTMLButtonElement>(null);
    const menuPanelRef = React.useRef<HTMLDivElement>(null);

    // Escape closes the menu and returns focus to the toggle; while open, Tab
    // cycles through the toggle and the menu's links instead of leaving the
    // overlay for the page hidden underneath.
    useFocusTrap({
        active: isMobileMenuOpen,
        containerRef: menuPanelRef,
        anchorRef: menuButtonRef,
        returnFocusRef: menuButtonRef,
        onEscape: () => setIsMobileMenuOpen(false),
    });

    const navGroups: Array<{ label: string; items: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> }> = [
        {
            label: 'Commerce',
            items: [
                { id: 'products', label: 'Products', icon: Package },
                { id: 'orders', label: 'Orders', icon: ShoppingCart },
                { id: 'reviews', label: 'Reviews', icon: Star },
                { id: 'coupons', label: 'Coupons', icon: Tag },
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
                { id: 'marketing', label: 'Marketing', icon: Mail },
                { id: 'outreach', label: 'Outreach Tracker', icon: ClipboardList },
                { id: 'users', label: 'User Directory', icon: Users },
                { id: 'customer-profile', label: 'Customer Profile', icon: UserCircle2 },
                { id: 'trust-circle', label: 'Trust Circle', icon: Award },
            ]
        },
        {
            label: 'Finance',
            items: [
                { id: 'sgcoin-distribution', label: 'SGCoin Distribution', icon: Coins },
                { id: 'sgcoin-requests', label: 'SGCoin Requests', icon: Coins },
                { id: 'sgcoin-payouts', label: 'SGCoin Payouts', icon: Banknote },
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

    const [copiedTab, setCopiedTab] = React.useState<AdminTab | null>(null);

    // Let the tick revert on its own so the row returns to its resting state
    // without a second click.
    React.useEffect(() => {
        if (!copiedTab) return;
        const timer = window.setTimeout(() => setCopiedTab(null), 1600);
        return () => window.clearTimeout(timer);
    }, [copiedTab]);

    // Presence of navigator.clipboard.writeText is the real gate: browsers
    // expose it only in a secure context, so an insecure origin reports no API
    // here anyway. Where it is missing the button could never succeed, so it is
    // not offered at all.
    const canCopyLink = typeof navigator !== 'undefined'
        && typeof navigator.clipboard?.writeText === 'function';

    // Copies an absolute URL for the tab itself, not whatever happens to be in
    // the address bar, so every row yields the link it names.
    const copyTabLink = async (tab: AdminTab) => {
        if (!canCopyLink) return;
        const url = new URL(tabHref(tab), window.location.href).toString();
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // Denied permission or a dropped document focus. Leave the row in
            // its resting state rather than confirm a copy that did not happen,
            // and say so — a silent failure looks like a dead button.
            addToast('Could not copy the link. Open it from the address bar instead.', 'error');
            return;
        }
        setCopiedTab(tab);
    };

    const copiedLabel = copiedTab
        ? navGroups.flatMap((group) => group.items).find((item) => item.id === copiedTab)?.label
        : null;

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
                                    <div key={item.id} className="flex items-center gap-1">
                                        <Link
                                            to={tabHref(item.id)}
                                            aria-current={activeTab === item.id ? 'page' : undefined}
                                            className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === item.id
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
                                        </Link>
                                        {canCopyLink && (
                                            <button
                                                type="button"
                                                onClick={() => { void copyTabLink(item.id); }}
                                                aria-label={copiedTab === item.id ? `Copied link to ${item.label}` : `Copy link to ${item.label}`}
                                                title={`Copy link to ${item.label}`}
                                                className="shrink-0 p-2 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                            >
                                                {copiedTab === item.id
                                                    ? <Check className="w-3.5 h-3.5 text-green-400" />
                                                    : <Link2 className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
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
                <button
                    ref={menuButtonRef}
                    type="button"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-expanded={isMobileMenuOpen}
                    aria-controls="admin-mobile-menu"
                    aria-label={isMobileMenuOpen ? 'Close admin menu' : 'Open admin menu'}
                    className="p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div
                    id="admin-mobile-menu"
                    ref={menuPanelRef}
                    role="dialog"
                    aria-label="Admin navigation"
                    className="md:hidden fixed inset-0 z-20 bg-black/95 backdrop-blur-lg pt-20 px-4 overflow-y-auto"
                >
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
                                        <div key={item.id} className="flex items-center gap-1">
                                            <Link
                                                to={tabHref(item.id)}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                aria-current={activeTab === item.id ? 'page' : undefined}
                                                className={`flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all border ${activeTab === item.id
                                                    ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                                                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-black' : ''}`} />
                                                <span className="uppercase tracking-wide font-bold text-sm">{item.label}</span>
                                                {activeTab === item.id && (
                                                    <span className="ml-auto w-2 h-2 rounded-full bg-black"></span>
                                                )}
                                            </Link>
                                            {canCopyLink && (
                                                <button
                                                    type="button"
                                                    onClick={() => { void copyTabLink(item.id); }}
                                                    aria-label={copiedTab === item.id ? `Copied link to ${item.label}` : `Copy link to ${item.label}`}
                                                    title={`Copy link to ${item.label}`}
                                                    className="shrink-0 p-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                                >
                                                    {copiedTab === item.id
                                                        ? <Check className="w-4 h-4 text-green-400" />
                                                        : <Link2 className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="pt-6 border-t border-white/10">
                            <button
                                type="button"
                                onClick={logoutAdmin}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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

            {/* Copy feedback for screen readers, which cannot see the tick. */}
            <span role="status" aria-live="polite" className="sr-only">
                {copiedLabel ? `Copied link to ${copiedLabel}` : ''}
            </span>
        </div>
    );
};

export default AdminLayout;
