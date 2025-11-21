import React, { useState } from 'react';
import AdminLayout from '../components/admin/AdminLayout';
import ProductManager from '../components/admin/ProductManager';
import OrderManager from '../components/admin/OrderManager';
import GitControl from '../components/admin/GitControl';
import GiveawayManager from '../components/admin/GiveawayManager';

const Admin: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'git' | 'giveaways' | 'settings'>('products');

    const renderContent = () => {
        switch (activeTab) {
            case 'products':
                return <ProductManager />;
            case 'orders':
                return <OrderManager />;
            case 'git':
                return <GitControl />;
            case 'giveaways':
                return <GiveawayManager />;
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
