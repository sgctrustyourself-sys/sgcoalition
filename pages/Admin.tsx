import React, { useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import ProductManager from '../components/admin/ProductManager';
import OrderManager from '../components/admin/OrderManager';
import GitControl from '../components/admin/GitControl';
import GiveawayManager from '../components/admin/GiveawayManager';
import CustomInquiryManager from '../components/admin/CustomInquiryManager';
import SGCoinRequestManager from '../components/admin/SGCoinRequestManager';
import InstagramLinksManager from '../admin/InstagramLinksManager';
import ReviewManager from '../admin/ReviewManager';
import AnalyticsDashboard from '../admin/AnalyticsDashboard';
import SGCoinDistribution from '../admin/SGCoinDistribution';
import ReferralAnalytics from '../admin/ReferralAnalytics';
import CoalitionSignalManager from '../admin/CoalitionSignalManager';
import { useApp } from '../context/AppContext';

const Admin: React.FC = () => {
    const { user } = useApp();
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'reviews' | 'analytics' | 'referrals' | 'sgcoin-distribution' | 'sgcoin-requests' | 'instagram' | 'git' | 'giveaways' | 'inquiries' | 'signal' | 'settings'>('products');

    const renderContent = () => {
        switch (activeTab) {
            case 'products':
                return <ProductManager />;
            case 'orders':
                return <OrderManager />;
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
            case 'signal':
                return <CoalitionSignalManager />;
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
            {renderContent()}
        </AdminLayout>
    );
};

export default Admin;
