import React, { useState, Suspense, lazy, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout';
import { useApp } from '../context/AppContext';
import { AdminTab, isAdminTab } from '../components/admin/adminTabs';

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
const MarketingManager = lazy(() => import('../components/admin/MarketingManager'));
const OutreachTracker = lazy(() => import('../components/admin/OutreachTracker'));

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


const Admin: React.FC = () => {
    const { user } = useApp();
    const [searchParams, setSearchParams] = useSearchParams();
    // ?tab=<id> is the source of truth, not just a mount-time seed: every tab
    // has a URL, so /admin?tab=orders can be bookmarked, pasted to another
    // admin, or opened in a new tab and still land on Orders. Derived from the
    // location rather than mirrored into state, which also makes Back/Forward
    // step through the tabs the admin actually visited.
    const requestedTab = searchParams.get('tab');
    const activeTab: AdminTab = isAdminTab(requestedTab) ? requestedTab : 'command-center';

    const setActiveTab = useCallback((tab: AdminTab) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);
            // ?q= is an OrderManager search seed, not tab state — never carry it
            // across a tab switch.
            next.delete('q');
            return next;
        });
    }, [setSearchParams]);

    // ?q=<search> seeds OrderManager's search box (e.g. an order id from a
    // webhook alert email). Applied on mount via sessionStorage; OrderManager
    // owns the value afterwards.
    const [qApplied, setQApplied] = useState(false);
    useEffect(() => {
        if (qApplied) return;
        const q = searchParams.get('q');
        if (q) {
            sessionStorage.setItem('admin_order_search', q);
        }
        // Only ?q= is consumed — clean it so a refresh can't re-apply a stale
        // search. ?tab= stays in the URL so the open tab remains addressable.
        if (q) {
            const next = new URLSearchParams(searchParams);
            next.delete('q');
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
            case 'marketing':
                return <MarketingManager />;
            case 'outreach':
                return <OutreachTracker />;
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
            case 'instagram':
                return <InstagramLinksManager />;
            case 'git':
                return <GitControl />;
            case 'giveaways':
                return <GiveawayManager />;
            case 'inquiries':
                return <CustomInquiryManager />;
            default:
                return <ProductManager />;
        }
    };

    return (
        <AdminLayout activeTab={activeTab}>
            <Suspense fallback={<LoadingSpinner />}>
                {renderContent()}
            </Suspense>
        </AdminLayout>
    );
};

export default Admin;
