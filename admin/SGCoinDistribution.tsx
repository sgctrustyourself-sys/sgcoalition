import React, { useState, useEffect } from 'react';
import { Hexagon, Send, Search, Users, TrendingUp } from 'lucide-react';
import { UserProfile } from '../types';
import { useToast } from '../context/ToastContext';

const SGCoinDistribution = () => {
    const { addToast } = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        // Load users from localStorage (in production, this would be from Supabase)
        const loadedUsers = JSON.parse(localStorage.getItem('users') || '[]');
        setUsers(loadedUsers);
    }, []);

    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        return (
            user.displayName?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query) ||
            user.walletAddress?.toLowerCase().includes(query)
        );
    });

    const handleSendSGCoin = () => {
        if (!selectedUser || !amount || parseFloat(amount) <= 0) {
            addToast('Please select a user and enter a valid amount', 'warning');
            return;
        }

        const sgCoinAmount = parseFloat(amount);

        // Update user's balance
        const updatedUsers = users.map(u => {
            if (u.uid === selectedUser.uid) {
                return {
                    ...u,
                    sgCoinBalance: (u.sgCoinBalance || 0) + sgCoinAmount
                };
            }
            return u;
        });

        // Save to localStorage
        localStorage.setItem('users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);

        // Log the transaction
        const transactions = JSON.parse(localStorage.getItem('sgcoin_transactions') || '[]');
        transactions.push({
            id: `tx_${Date.now()}`,
            userId: selectedUser.uid,
            amount: sgCoinAmount,
            type: 'admin_grant',
            note: note || 'Admin distribution',
            timestamp: Date.now(),
            adminNote: note
        });
        localStorage.setItem('sgcoin_transactions', JSON.stringify(transactions));

        addToast(`Successfully sent ${sgCoinAmount} SGCoin to ${selectedUser.displayName || selectedUser.email}`, 'success');

        // Reset form
        setSelectedUser(null);
        setAmount('');
        setNote('');
    };

    const totalSGCoinDistributed = users.reduce((sum, user) => sum + (user.sgCoinBalance || 0), 0);
    const usersWithBalance = users.filter(u => (u.sgCoinBalance || 0) > 0).length;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-2">SGCoin Distribution</h2>
                <p className="text-gray-400 text-sm">Send SGCoin directly to user accounts</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-400 mb-1">Total Users</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <Hexagon className="w-6 h-6 text-green-500" />
                    </div>
                    <p className="text-sm text-gray-400 mb-1">Total SGCoin Distributed</p>
                    <p className="text-2xl font-bold">{totalSGCoinDistributed.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="w-6 h-6 text-purple-500" />
                    </div>
                    <p className="text-sm text-gray-400 mb-1">Users with Balance</p>
                    <p className="text-2xl font-bold">{usersWithBalance}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Selection */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Select User</h3>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, email, or wallet..."
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* User List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No users found</p>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.uid}
                                    onClick={() => setSelectedUser(user)}
                                    className={`w-full text-left p-4 rounded-lg border transition ${selectedUser?.uid === user.uid
                                        ? 'bg-blue-500/10 border-blue-500/20'
                                        : 'bg-black/30 border-white/10 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold">{user.displayName || 'Anonymous'}</p>
                                            <p className="text-sm text-gray-400">{user.email || user.walletAddress}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-brand-accent">
                                                <Hexagon className="w-4 h-4 fill-current" />
                                                <span className="font-bold">{(user.sgCoinBalance || 0).toLocaleString()}</span>
                                            </div>
                                            {!user.walletAddress && (
                                                <span className="text-xs text-yellow-500">No MetaMask</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Send Form */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Send SGCoin</h3>

                    {selectedUser ? (
                        <div className="space-y-4">
                            {/* Selected User Info */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <p className="text-sm text-gray-400 mb-1">Sending to:</p>
                                <p className="font-bold text-lg">{selectedUser.displayName || 'Anonymous'}</p>
                                <p className="text-sm text-gray-400">{selectedUser.email || selectedUser.walletAddress}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <p className="text-sm text-gray-400">Current Balance:</p>
                                    <div className="flex items-center gap-1 text-brand-accent font-bold">
                                        <Hexagon className="w-4 h-4 fill-current" />
                                        {(selectedUser.sgCoinBalance || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div>
                                <label className="block text-sm font-bold mb-2">Amount (SGCoin)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Enter amount..."
                                    min="0"
                                    step="1"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Note Input */}
                            <div>
                                <label className="block text-sm font-bold mb-2">Note (Optional)</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Reason for distribution..."
                                    rows={3}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none resize-none"
                                />
                            </div>

                            {/* Warning for non-MetaMask users */}
                            {!selectedUser.walletAddress && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                    <p className="text-yellow-500 text-sm font-bold mb-1">⚠️ No MetaMask Connected</p>
                                    <p className="text-xs text-gray-400">
                                        This user can spend SGCoin on the site but cannot convert to cash until they connect a MetaMask wallet.
                                    </p>
                                </div>
                            )}

                            {/* Send Button */}
                            <button
                                onClick={handleSendSGCoin}
                                disabled={!amount || parseFloat(amount) <= 0}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                                Send {amount || '0'} SGCoin
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Hexagon className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                            <p>Select a user to send SGCoin</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SGCoinDistribution;
