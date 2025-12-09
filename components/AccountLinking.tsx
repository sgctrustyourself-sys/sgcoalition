import React, { useState, useEffect } from 'react';
import { Link2, Mail, Wallet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
    getLinkedAccount,
    linkWalletToExistingAccount,
    createAccountAndLinkWallet,
    unlinkWallet,
    type LinkedAccount
} from '../services/accountLinking';
import { linkSocialAccount, getSocialAccount, unlinkSocialAccount, type SocialAccount } from '../services/socialLinking';

const AccountLinking: React.FC = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
    const [loading, setLoading] = useState(true);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkMode, setLinkMode] = useState<'existing' | 'new'>('existing');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Instagram linking state
    const [showInstagramModal, setShowInstagramModal] = useState(false);
    const [instagramUsername, setInstagramUsername] = useState('');
    const [walletAddressForReward, setWalletAddressForReward] = useState('');
    const [confirmFollow, setConfirmFollow] = useState(false);
    const [linkedInstagram, setLinkedInstagram] = useState<SocialAccount | null>(null);
    const [loadingInstagram, setLoadingInstagram] = useState(true);

    const isWalletUser = user?.uid.startsWith('user_eth_');
    const walletAddress = user?.walletAddress;

    useEffect(() => {
        loadLinkedAccount();
    }, [user]);

    const loadLinkedAccount = async () => {
        if (!walletAddress) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const account = await getLinkedAccount(walletAddress);
        setLinkedAccount(account);
        setLoading(false);
    };

    const loadInstagramAccount = async () => {
        setLoadingInstagram(true);
        const account = await getSocialAccount('instagram');
        setLinkedInstagram(account);
        setLoadingInstagram(false);
    };

    useEffect(() => {
        loadInstagramAccount();
    }, [user]);

    const handleLinkExisting = async () => {
        if (!email || !password || !walletAddress) {
            addToast('Please fill in all fields', 'error');
            return;
        }

        setSubmitting(true);
        const result = await linkWalletToExistingAccount(email, password, walletAddress);

        if (result.success) {
            addToast('Wallet linked successfully! Please refresh the page.', 'success');
            setShowLinkModal(false);
            loadLinkedAccount();
            // Reload page to update user context
            setTimeout(() => window.location.reload(), 1500);
        } else {
            addToast(result.error || 'Failed to link wallet', 'error');
        }

        setSubmitting(false);
    };

    const handleCreateNew = async () => {
        if (!email || !password || !confirmPassword || !walletAddress) {
            addToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            addToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            addToast('Password must be at least 6 characters', 'error');
            return;
        }

        setSubmitting(true);
        const result = await createAccountAndLinkWallet(email, password, walletAddress);

        if (result.success) {
            addToast('Account created and linked! Check your email to verify.', 'success');
            setShowLinkModal(false);
            loadLinkedAccount();
            // Reload page to update user context
            setTimeout(() => window.location.reload(), 1500);
        } else {
            addToast(result.error || 'Failed to create account', 'error');
        }

        setSubmitting(false);
    };

    const handleLinkInstagram = async () => {
        if (!instagramUsername.trim()) {
            addToast('Please enter your Instagram username', 'error');
            return;
        }

        if (!walletAddressForReward.trim()) {
            addToast('Please enter your wallet address to receive rewards', 'error');
            return;
        }

        // Basic wallet validation
        if (!walletAddressForReward.startsWith('0x') || walletAddressForReward.length !== 42) {
            addToast('Please enter a valid Ethereum wallet address', 'error');
            return;
        }

        if (!confirmFollow) {
            addToast('Please confirm you follow @sgcoalition', 'error');
            return;
        }

        setSubmitting(true);
        const result = await linkSocialAccount('instagram', instagramUsername, walletAddressForReward);

        if (result.success) {
            addToast('Instagram linked successfully! Admin will send your reward soon.', 'success');
            setShowInstagramModal(false);
            setInstagramUsername('');
            setWalletAddressForReward('');
            setConfirmFollow(false);
            loadInstagramAccount();
        } else {
            addToast(result.error || 'Failed to link Instagram', 'error');
        }

        setSubmitting(false);
    };

    const handleUnlinkInstagram = async () => {
        if (!confirm('Are you sure you want to unlink your Instagram account?')) {
            return;
        }

        const result = await unlinkSocialAccount('instagram');

        if (result.success) {
            addToast('Instagram unlinked successfully', 'success');
            loadInstagramAccount();
        } else {
            addToast(result.error || 'Failed to unlink Instagram', 'error');
        }
    };

    const handleUnlink = async () => {
        if (!walletAddress || !confirm('Are you sure you want to unlink your wallet?')) {
            return;
        }

        setSubmitting(true);
        const result = await unlinkWallet(walletAddress);

        if (result.success) {
            addToast('Wallet unlinked successfully', 'success');
            loadLinkedAccount();
        } else {
            addToast(result.error || 'Failed to unlink wallet', 'error');
        }

        setSubmitting(false);
    };

    if (loading) {
        return (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-800 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Authentication Status */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Link2 size={20} />
                    Account Authentication
                </h3>

                <div className="space-y-3">
                    {/* Wallet Status */}
                    {isWalletUser && walletAddress && (
                        <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Wallet className="text-purple-400" size={20} />
                                <div>
                                    <div className="text-sm font-medium text-white">MetaMask Wallet</div>
                                    <div className="text-xs text-gray-400 font-mono">
                                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                                    </div>
                                </div>
                            </div>
                            <CheckCircle className="text-green-400" size={20} />
                        </div>
                    )}

                    {/* Email Status */}
                    {linkedAccount ? (
                        <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Mail className="text-blue-400" size={20} />
                                <div>
                                    <div className="text-sm font-medium text-white">Email Account</div>
                                    <div className="text-xs text-gray-400">Linked</div>
                                </div>
                            </div>
                            <CheckCircle className="text-green-400" size={20} />
                        </div>
                    ) : isWalletUser ? (
                        <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg border-2 border-yellow-500/20">
                            <div className="flex items-center gap-3">
                                <Mail className="text-gray-500" size={20} />
                                <div>
                                    <div className="text-sm font-medium text-white">Email Account</div>
                                    <div className="text-xs text-yellow-400">Not linked</div>
                                </div>
                            </div>
                            <XCircle className="text-gray-600" size={20} />
                        </div>
                    ) : null}

                    {/* Instagram Status */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border-2 border-purple-500/20">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                            <div>
                                <div className="text-sm font-medium text-white">Instagram</div>
                                <div className="text-xs text-gray-400">Not linked</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-full px-3 py-1">
                                <span className="text-xs font-bold text-yellow-300">+1,000 SGC</span>
                            </div>
                            <XCircle className="text-gray-600" size={20} />
                        </div>
                    </div>
                </div>

                {/* Instagram Link Incentive */}
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-pink-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm text-purple-200 font-bold mb-1">
                                🎁 Link Instagram & Earn 1,000 SGCoin!
                            </p>
                            <p className="text-xs text-purple-300/80 mb-3">
                                Connect your Instagram account and get instant rewards. Show your support for Coalition!
                            </p>
                            <button
                                onClick={() => setShowInstagramModal(true)}
                                disabled={!!linkedInstagram}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                                {linkedInstagram ? 'Instagram Linked' : 'Link Instagram Account'}
                            </button>
                            {linkedInstagram && (
                                <button
                                    onClick={handleUnlinkInstagram}
                                    className="w-full mt-2 text-xs text-gray-400 hover:text-white transition"
                                >
                                    Unlink @{linkedInstagram.username}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Link Email Button */}
                {isWalletUser && !linkedAccount && (
                    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-start gap-3 mb-3">
                            <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm text-yellow-200 font-medium mb-1">
                                    Link an email account to unlock all features
                                </p>
                                <p className="text-xs text-yellow-300/70">
                                    Referral tracking, order history, and more require an email account.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowLinkModal(true)}
                            className="w-full bg-brand-accent hover:bg-brand-accent/80 text-white px-4 py-2 rounded font-bold transition"
                        >
                            Link Email Account
                        </button>
                    </div>
                )}

                {/* Unlink Button */}
                {linkedAccount && (
                    <div className="mt-4">
                        <button
                            onClick={handleUnlink}
                            disabled={submitting}
                            className="text-sm text-red-400 hover:text-red-300 transition disabled:opacity-50"
                        >
                            Unlink Wallet
                        </button>
                    </div>
                )}
            </div>

            {/* Link Modal */}
            {showLinkModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-xl border border-gray-800 max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Link Email Account</h3>

                        {/* Mode Selector */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setLinkMode('existing')}
                                className={`flex-1 py-2 px-4 rounded font-medium transition ${linkMode === 'existing'
                                    ? 'bg-brand-accent text-white'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                    }`}
                            >
                                Link Existing
                            </button>
                            <button
                                onClick={() => setLinkMode('new')}
                                className={`flex-1 py-2 px-4 rounded font-medium transition ${linkMode === 'new'
                                    ? 'bg-brand-accent text-white'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                    }`}
                            >
                                Create New
                            </button>
                        </div>

                        {/* Form */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black/50 border border-gray-700 rounded px-4 py-2 text-white"
                                    placeholder="your@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/50 border border-gray-700 rounded px-4 py-2 text-white"
                                    placeholder="••••••••"
                                />
                            </div>

                            {linkMode === 'new' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-black/50 border border-gray-700 rounded px-4 py-2 text-white"
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowLinkModal(false)}
                                    disabled={submitting}
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={linkMode === 'existing' ? handleLinkExisting : handleCreateNew}
                                    disabled={submitting}
                                    className="flex-1 bg-brand-accent hover:bg-brand-accent/80 text-white px-4 py-2 rounded font-bold transition disabled:opacity-50"
                                >
                                    {submitting ? 'Linking...' : linkMode === 'existing' ? 'Link Account' : 'Create & Link'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Instagram Link Modal */}
            {showInstagramModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-xl border border-pink-500/30 max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <svg className="w-6 h-6 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                            Link Instagram Account
                        </h3>

                        <div className="space-y-4 mb-6">
                            {/* Follow Step */}
                            <div className="bg-black/30 rounded-lg p-4 border border-pink-500/20">
                                <p className="text-sm font-bold text-white mb-2">Step 1: Follow Us</p>
                                <a
                                    href="https://www.instagram.com/sgcoalition"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 text-sm transition"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                    </svg>
                                    Follow @sgcoalition on Instagram →
                                </a>
                            </div>

                            {/* Username Input */}
                            <div>
                                <label className="block text-sm text-purple-200 font-bold mb-2">Step 2: Enter Your Username</label>
                                <input
                                    type="text"
                                    value={instagramUsername}
                                    onChange={(e) => setInstagramUsername(e.target.value)}
                                    className="w-full bg-black/50 border border-pink-500/30 rounded px-4 py-2 text-white placeholder-gray-400 focus:border-pink-500 focus:outline-none"
                                    placeholder="your_instagram_username"
                                />
                                <p className="text-xs text-purple-300/60 mt-1">Without the @ symbol</p>
                            </div>

                            {/* Wallet Address Input - NEW */}
                            <div>
                                <label className="block text-sm text-purple-200 font-bold mb-2">Step 3: Enter Your Wallet Address</label>
                                <input
                                    type="text"
                                    value={walletAddressForReward}
                                    onChange={(e) => setWalletAddressForReward(e.target.value)}
                                    className="w-full bg-black/50 border border-pink-500/30 rounded px-4 py-2 text-white placeholder-gray-400 focus:border-pink-500 focus:outline-none font-mono text-sm"
                                    placeholder="0x..."
                                />
                                <p className="text-xs text-purple-300/60 mt-1">Your MetaMask/Ethereum wallet address (must start with 0x)</p>
                            </div>

                            {/* Confirmation  Checkbox */}
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={confirmFollow}
                                    onChange={(e) => setConfirmFollow(e.target.checked)}
                                    className="mt-1"
                                />
                                <span className="text-sm text-purple-200">
                                    I confirm that I follow <strong>@sgcoalition</strong> on Instagram
                                </span>
                            </label>

                            {/* Reward Info */}
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                <p className="text-sm text-green-300 flex items-center gap-2">
                                    <span className="text-lg">🎁</span>
                                    <span><strong>1,000 SGCoin</strong> reward will be sent to your wallet by admin!</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowInstagramModal(false)}
                                disabled={submitting}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLinkInstagram}
                                disabled={submitting || !instagramUsername.trim() || !confirmFollow}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded font-bold transition disabled:opacity-50"
                            >
                                {submitting ? 'Linking...' : 'Link Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountLinking;
