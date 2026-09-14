import React, { useState, Suspense, lazy, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout';
import { useApp } from '../context/AppContext';

// Lazy load all admin components for code-splitting
const EcosystemCommandCenter = lazy(() => import('../components/admin/EcosystemCommandCenter'));
const ProductManager = lazy(() => import('../components/admin/ProductManager'));
const OrderManager = lazy(() => import('../components/admin/OrderManager'));
const GitControl = lazy(() => import('../components/admin/GitControl'));
const GiveawayManager = lazy(() => import('../components/admin/GiveawayManager'));
const CustomInquiryManager = lazy(() => import('../components/admin/CustomInquiryManager'));
const SGCoinRequestManager = lazy(() => import('../components/admin/SGCoinRequestManager'));
const SGCoinPayoutManager = lazy(() => import('../components/admin/SGCoinPayoutManager'));
const InstagramLinksManager = lazy(() => import('../admin/InstagramLinksManager'));
const ReviewManager = lazy(() => import('../admin/ReviewManager'));
const AnalyticsDashboard = lazy(() => import('../admin/AnalyticsDashboard'));
const SGCoinDistribution = lazy(() => import('../admin/SGCoinDistribution'));
const ReferralAnalytics = lazy(() => import('../admin/ReferralAnalytics'));
const BlogManager = lazy(() => import('./admin/BlogManager'));
const SignalManager = lazy(() => import('../components/admin/SignalManager'));
const BrainManager = lazy(() => import('../components/admin/BrainManager'));
const UserManager = lazy(() => import('../components/admin/UserManager'));
const ImageManager = lazy(() => import('../components/admin/ImageManager'));
const CustomerProfileAdmin = lazy(() => import('../components/admin/CustomerProfileAdmin'));
const TrustCircleManager = lazy(() => import('../components/admin/TrustCircleManager'));
const CouponManager = lazy(() => import('../components/admin/CouponManager'));

// Loading component for Suspense fallback
const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-purple-500/10 rounded-full animate-pulse"></div>
            </div>
        </div>
    </div>
);

// Tabs addressable via ?tab=<id> (deep links from ops emails). Unknown or
// missing values fall back to the default tab.
const VALID_TABS = ['command-center', 'products', 'orders', 'blog', 'reviews', 'analytics', 'referrals', 'sgcoin-distribution', 'sgcoin-requests', 'sgcoin-payouts', 'instagram', 'git', 'giveaways', 'inquiries', 'signals', 'users', 'brain', 'settings', 'images', 'customer-profile', 'trust-circle', 'coupons'] as const;
type Tab = typeof VALID_TABS[number];

const Admin: React.FC = () => {
    const { user } = useApp();
    const [searchParams, setSearchParams] = useSearchParams();
    // ?tab=<id> seeds the tab (deep links from ops emails); after mount the
    // state is authoritative so normal tab clicks keep working.
    const [activeTab, setActiveTab] = useState<Tab>(() => {
        const t = searchParams.get('tab');
        return (t && (VALID_TABS as readonly string[]).includes(t) ? t : 'command-center') as Tab;
    });

    // ?q=<search> seeds OrderManager's search box (e.g. an order id from a
    // webhook alert email). Applied on mount via sessionStorage; OrderManager
    // owns the value afterwards.
    const [qApplied, setQApplied] = useState(false);
    useEffect(() => {
        if (qApplied) return;
        const q = searchParams.get('q');
        const tab = searchParams.get('tab');
        if (q) {
            sessionStorage.setItem('admin_order_search', q);
        }
        // Both params consumed — clean the URL so refreshes don't re-apply a
        // stale search.
        if (q || tab) {
            const next = new URLSearchParams(searchParams);
            next.delete('q');
            next.delete('tab');
            setSearchParams(next, { replace: true });
        }
        setQApplied(true);
    }, [qApplied, searchParams, setSearchParams]);

    const renderContent = () => {
        switch (activeTab) {
            case 'command-center':
                return <EcosystemCommandCenter />;
            case 'products':
                return <ProductManager />;
            case 'orders':
                return <OrderManager />;
            case 'blog':
                return <BlogManager />;
            case 'reviews':
                return <ReviewManager />;
            case 'analytics':
                return <AnalyticsDashboard />;
            case 'referrals':
                return <ReferralAnalytics />;
            case 'sgcoin-distribution':
                return <SGCoinDistribution />;
            case 'sgcoin-requests':
                return <SGCoinRequestManager adminWalletAddress={user?.walletAddress || ''} />;
            case 'sgcoin-payouts':
                return <SGCoinPayoutManager adminUserId={user?.uid || ''} />;
            case 'signals':
                return <SignalManager />;
            case 'brain':
                return <BrainManager />;
            case 'images':
                return <ImageManager />;
            case 'users':
                return <UserManager />;
            case 'customer-profile':
                // Cross-tab deep-link: the CustomerProfileAdmin header has a
                // "View Payouts" button that calls onNavigateToPayouts, which
                // here switches to the sgcoin-payouts tab (so the admin can
                // drill from a customer's profile straight into their
                // withdrawal requests).
                return <CustomerProfileAdmin onNavigateToPayouts={() => setActiveTab('sgcoin-payouts')} />;
            case 'trust-circle':
                return <TrustCircleManager />;
            case 'coupons':
                return <CouponManager />;
            case 'settings':
                return (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                        <p className="text-gray-400">Settings coming soon...</p>
                    </div>
                );
            default:
                return <ProductManager />;
        }
    };

    return (
        <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
            <Suspense fallback={<LoadingSpinner />}>
                {renderContent()}
            </Suspense>
        </AdminLayout>
    );
};

export default Admin;
