import React, { useState, useEffect } from 'react';
import {
    Users,
    Search,
    Download,
    Filter,
    Mail,
    Calendar,
    ExternalLink,
    Shield,
    ShieldAlert,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Clock,
    UserCircle,
    MapPin,
    Globe
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';

interface UserProfile {
    id: string;
    full_name?: string;
    email?: string;
    is_vip: boolean;
    sg_coin_balance: number;
    store_credit: number;
    created_at: string;
    last_sign_in_at?: string;
    ip_address?: string;
    signup_source?: string;
    country?: string;
}

const UserManager: React.FC = () => {
    const { addToast } = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10;

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            // Note: We're querying the public.profiles table
            // In a real Supabase setup, you'd have a trigger syncing auth.users to public.profiles
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (err: any) {
            addToast(err.message || 'Failed to fetch users', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        if (users.length === 0) return;

        const headers = ['ID', 'Name', 'Email', 'VIP', 'SGCoin Balance', 'Store Credit', 'Created At', 'Source'];
        const csvRows = [
            headers.join(','),
            ...users.map(u => [
                u.id,
                `"${u.full_name || 'N/A'}"`,
                u.email || 'N/A',
                u.is_vip ? 'Yes' : 'No',
                u.sg_coin_balance,
                u.store_credit,
                new Date(u.created_at).toLocaleDateString(),
                u.signup_source || 'direct'
            ].join(','))
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `coalition_users_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        addToast('User list exported successfully', 'success');
    };

    const filteredUsers = users.filter(u =>
        (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black font-display uppercase tracking-widest text-white flex items-center gap-3">
                        <Users className="w-6 h-6 text-brand-accent" />
                        User Management
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">Monitor signups, metadata, and user activity</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/20 transition-all border border-white/10"
                    >
                        <Download className="w-3 h-3" /> Export CRM List
                    </button>
                    <button
                        onClick={fetchUsers}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-accent transition-all"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Registered</p>
                    <p className="text-2xl font-black text-white">{users.length}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">VIP Members</p>
                    <p className="text-2xl font-black text-purple-500">{users.filter(u => u.is_vip).length}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl font-mono">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">Global Liquidity</p>
                    <p className="text-2xl font-black text-emerald-500">
                        {users.reduce((acc, u) => acc + u.sg_coin_balance, 0).toLocaleString()} <span className="text-xs">SGC</span>
                    </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">Total Credit</p>
                    <p className="text-2xl font-black text-brand-accent">
                        ${users.reduce((acc, u) => acc + u.store_credit, 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or user ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-white/30"
                    />
                </div>
                <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                    <Filter className="w-3 h-3" /> Filters
                </button>
            </div>

            {/* User Table */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">User / Identity</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Security / IP</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Balances</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Signup Date</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-brand-accent mx-auto" />
                                    </td>
                                </tr>
                            ) : currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 uppercase tracking-widest text-xs font-bold">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                currentUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center relative">
                                                    <UserCircle className="w-6 h-6 text-gray-400" />
                                                    {user.is_vip && (
                                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center border-2 border-black">
                                                            <Shield className="w-2 h-2 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-white uppercase tracking-tight text-sm">{user.full_name || 'Anonymous'}</p>
                                                        {user.is_vip && <span className="text-[8px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded uppercase font-black tracking-widest">VIP</span>}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        <Mail className="w-3 h-3" /> {user.email || 'No Email'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-white flex items-center gap-2 font-mono">
                                                    <Globe className="w-3 h-3 text-gray-500" />
                                                    {user.ip_address || '0.0.0.0'}
                                                </p>
                                                <p className="text-[10px] text-gray-500 flex items-center gap-2 uppercase tracking-widest font-bold italic">
                                                    <MapPin className="w-3 h-3" />
                                                    {user.country || 'Unknown'} / {user.signup_source || 'organic'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <p className="text-xs font-black text-emerald-400">{(user.sg_coin_balance || 0).toLocaleString()} SGC</p>
                                                <p className="text-[10px] font-bold text-gray-500">${(user.store_credit || 0).toFixed(2)} USD CREDIT</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-white flex items-center gap-2">
                                                    <Calendar className="w-3 h-3 text-gray-500" />
                                                    {new Date(user.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">
                                                    {new Date(user.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button aria-label="View user details" className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                                <button aria-label="Security actions" className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                                    <ShieldAlert className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/40">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Showing {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            aria-label="Previous page"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-xs font-black text-white px-3 py-1 bg-white/10 rounded-lg border border-white/10">
                            {currentPage}
                        </span>
                        <button
                            aria-label="Next page"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserManager;
