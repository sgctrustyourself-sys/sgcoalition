import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
import {
    calculateSalesMetrics,
    getRevenueOverTime,
    getTopProducts,
    getCustomerStats
} from '../utils/analyticsEngine';

const AnalyticsDashboard = () => {
    const { orders, products } = useApp();

    const metrics = useMemo(() => calculateSalesMetrics(orders), [orders]);
    const revenueData = useMemo(() => getRevenueOverTime(orders, 30), [orders]);
    const topProducts = useMemo(() => getTopProducts(orders, products, 10), [orders, products]);
    const customerStats = useMemo(() => getCustomerStats(orders), [orders]);

    const customerPieData = [
        { name: 'New Customers', value: customerStats.newCustomers, color: '#3b82f6' },
        { name: 'Returning', value: customerStats.returningCustomers, color: '#10b981' }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-2">Analytics Dashboard</h2>
                <p className="text-gray-400 text-sm">Overview of your store performance</p>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<DollarSign className="w-6 h-6" />}
                    label="Total Revenue"
                    value={`$${metrics.totalRevenue.toFixed(2)}`}
                    color="blue"
                />
                <MetricCard
                    icon={<ShoppingCart className="w-6 h-6" />}
                    label="Total Orders"
                    value={metrics.totalOrders.toString()}
                    color="green"
                />
                <MetricCard
                    icon={<TrendingUp className="w-6 h-6" />}
                    label="Avg Order Value"
                    value={`$${metrics.averageOrderValue.toFixed(2)}`}
                    color="purple"
                />
                <MetricCard
                    icon={<Users className="w-6 h-6" />}
                    label="Conversion Rate"
                    value={`${(metrics.conversionRate * 100).toFixed(1)}%`}
                    color="yellow"
                />
            </div>

            {/* Revenue Over Time Chart */}
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Revenue Over Time (Last 30 Days)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                        <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products Chart */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-green-500" />
                        Top Products by Revenue
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topProducts.slice(0, 5)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                            <YAxis dataKey="productName" type="category" stroke="#9ca3af" style={{ fontSize: '11px' }} width={100} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="revenue" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Customer Insights */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-500" />
                        Customer Insights
                    </h3>
                    <div className="flex items-center justify-between mb-6">
                        <ResponsiveContainer width="50%" height={200}>
                            <PieChart>
                                <Pie
                                    data={customerPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {customerPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-400">Total Customers</p>
                                <p className="text-2xl font-bold">{customerStats.totalCustomers}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">New Customers</p>
                                <p className="text-xl font-bold text-blue-500">{customerStats.newCustomers}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Returning</p>
                                <p className="text-xl font-bold text-green-500">{customerStats.returningCustomers}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Repeat Rate</p>
                                <p className="text-xl font-bold text-purple-500">{customerStats.repeatPurchaseRate.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Products Table */}
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Top 10 Products</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-400">Rank</th>
                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-400">Product</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-400">Units Sold</th>
                                <th className="text-right py-3 px-4 text-sm font-bold text-gray-400">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topProducts.map((product, index) => (
                                <tr key={product.productId} className="border-b border-white/5 hover:bg-white/5 transition">
                                    <td className="py-3 px-4 text-sm">#{index + 1}</td>
                                    <td className="py-3 px-4 text-sm font-bold">{product.productName}</td>
                                    <td className="py-3 px-4 text-sm text-right">{product.unitsSold}</td>
                                    <td className="py-3 px-4 text-sm text-right font-bold text-green-500">
                                        ${product.revenue.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

interface MetricCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'blue' | 'green' | 'purple' | 'yellow';
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color }) => {
    const colorClasses = {
        blue: 'from-blue-500/10 to-blue-600/10 border-blue-500/20 text-blue-500',
        green: 'from-green-500/10 to-green-600/10 border-green-500/20 text-green-500',
        purple: 'from-purple-500/10 to-purple-600/10 border-purple-500/20 text-purple-500',
        yellow: 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/20 text-yellow-500'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-6`}>
            <div className="flex items-center justify-between mb-2">
                <div className={colorClasses[color]}>{icon}</div>
            </div>
            <p className="text-sm text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
};

export default AnalyticsDashboard;
