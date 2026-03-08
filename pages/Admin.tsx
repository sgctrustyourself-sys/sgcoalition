import React, { useState, Suspense, lazy } from 'react';
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
const InstagramLinksManager = lazy(() => import('../admin/InstagramLinksManager'));
const ReviewManager = lazy(() => import('../admin/ReviewManager'));
const AnalyticsDashboard = lazy(() => import('../admin/AnalyticsDashboard'));
const SGCoinDistribution = lazy(() => import('../admin/SGCoinDistribution'));
const ReferralAnalytics = lazy(() => import('../admin/ReferralAnalytics'));
const BlogManager = lazy(() => import('./admin/BlogManager'));
const SignalManager = lazy(() => import('../components/admin/SignalManager'));
const UserManager = lazy(() => import('../components/admin/UserManager'));

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
    const [activeTab, setActiveTab] = useState<'command-center' | 'products' | 'orders' | 'blog' | 'reviews' | 'analytics' | 'referrals' | 'sgcoin-distribution' | 'sgcoin-requests' | 'instagram' | 'git' | 'giveaways' | 'inquiries' | 'signals' | 'users' | 'settings'>('command-center');

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
            case 'instagram':
                return <InstagramLinksManager />;
            case 'git':
                return <GitControl />;
            case 'giveaways':
                return <GiveawayManager />;
            case 'inquiries':
                return <CustomInquiryManager />;
            case 'sgcoin-requests':
                return <SGCoinRequestManager adminWalletAddress={user?.walletAddress || ''} />;
            case 'signals':
                return <SignalManager />;
            case 'users':
                return <UserManager />;
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
