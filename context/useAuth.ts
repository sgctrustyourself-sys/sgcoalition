// context/useAuth.ts
// Domain hook for Auth
import { useState, useEffect, useCallback } from 'react';
import { UserProfile, AuthProvider, SocialAccount } from '../types';
import { ADMIN_WALLETS } from '../constants';
import { supabase } from '../services/supabase';
import { signOut } from '../services/auth';
import { getStoredReferralCode, trackSignupReferral } from '../utils/referralSystem';

import { safeJsonParse } from '../utils/storage';
const loadWalletActions = () => import('../services/walletActions');
const loadWalletBalances = () => import('../services/walletBalances');

export function useAuth(isSupabaseConfigured: boolean, addToast: any) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isAdminMode, setIsAdminMode] = useState(() => {
        if (typeof window !== 'undefined') return sessionStorage.getItem('coalition_admin_mode') === 'true';
        return false;
    });
    const [chainId, setChainId] = useState<number | null>(null);

    const updateAdminMode = useCallback((val: boolean) => {
        setIsAdminMode(val);
        if (typeof window !== 'undefined') { if (val) sessionStorage.setItem('coalition_admin_mode', 'true'); else sessionStorage.removeItem('coalition_admin_mode'); }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            const ethereum = (window as any).ethereum;
            const handleChainChanged = (hexChainId: string) => setChainId(parseInt(hexChainId, 16));
            ethereum.request({ method: 'eth_chainId' }).then((hexId: string) => setChainId(parseInt(hexId, 16))).catch(() => { });
            ethereum.on('chainChanged', handleChainChanged);
            return () => { ethereum.removeListener('chainChanged', handleChainChanged); };
        }
    }, []);

    const handleSwitchToPolygon = useCallback(async () => {
        try {
            const { switchToPolygon: switchFn } = await loadWalletActions();
            const success = await switchFn();
            if (success && typeof window !== 'undefined' && (window as any).ethereum) {
                const hexId = await (window as any).ethereum.request({ method: 'eth_chainId' });
                setChainId(parseInt(hexId, 16));
            }
            return success;
        } catch (e) { console.error('Switch to Polygon failed:', e); return false; }
    }, []);

    const syncCryptoBalances = useCallback(async (walletAddress: string) => {
        try {
            const { fetchWalletBalanceSnapshot } = await loadWalletBalances();
            const snapshot = await fetchWalletBalanceSnapshot(walletAddress);
            setUser(prev => prev ? {
                ...prev,
                sgCoinBalance: prev.sgCoinBalance || snapshot.sgCoinBalance,
                v2Balance: snapshot.v2Balance,
                totalMigrated: snapshot.totalMigrated
            } : null);
        } catch (err) { console.warn('Background balance sync failed:', err); }
    }, []);

    const refreshBalances = useCallback(async () => {
        if (user?.walletAddress) await syncCryptoBalances(user.walletAddress);
    }, [user?.walletAddress, syncCryptoBalances]);

    useEffect(() => {
        if (!user || (!user.walletAddress && !user.connectedWalletAddress)) return;
        const interval = setInterval(refreshBalances, 60000);
        return () => clearInterval(interval);
    }, [user?.walletAddress, user?.connectedWalletAddress, refreshBalances]);

    // Auth subscription — Supabase onAuthStateChange, session hydration, profile/wallet fetch, admin checks
    useEffect(() => {
        if (!isSupabaseConfigured) return;
        let mounted = true;
        let authSubscription: { unsubscribe: () => void } | null = null;

        const fireSignupReferral = async (userId: string) => {
            const storedCode = getStoredReferralCode();
            if (!storedCode) return;
            await trackSignupReferral(storedCode, userId);
        };

        const handleAuthChange = async (event: string, session: any) => {
            if (!mounted) return;
            console.log('Auth Event:', event);

            if (session?.user) {
                try {
                    const userId = session.user.id;
                    const savedFavorites = safeJsonParse('coalition_favorites_' + userId, []);

                    if (mounted) {
                        setUser(prev => ({
                            uid: userId,
                            displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                            email: session.user.email || null,
                            walletAddress: prev?.walletAddress || null,
                            connectedWalletAddress: prev?.connectedWalletAddress || undefined,
                            sgCoinBalance: prev?.sgCoinBalance || 0,
                            favorites: savedFavorites,
                            isAdmin: prev?.isAdmin || false,
                            socialAccounts: prev?.socialAccounts || []
                        } as any));
                    }

                    const [linkedWalletRes, profileRes, adminRes, socialsRes] = await Promise.all([
                        supabase.from('wallet_accounts').select('wallet_address').eq('user_id', userId).maybeSingle(),
                        supabase.from('profiles').select('is_vip, store_credit, sg_coin_balance').eq('id', userId).maybeSingle(),
                        supabase.from('admin_users').select('role').eq('user_id', userId).maybeSingle(),
                        supabase.from('social_accounts').select('*').eq('user_id', userId)
                    ]);

                    const walletAddress = linkedWalletRes.data?.wallet_address || null;
                    const profile = profileRes.data;
                    let isAdmin = !!adminRes.data;
                    const activeWallet = walletAddress || (typeof window !== 'undefined' && (window as any).ethereum?.selectedAddress);
                    if (!isAdmin && activeWallet && ADMIN_WALLETS.some(w => w.toLowerCase() === activeWallet.toLowerCase())) {
                        isAdmin = true;
                    }

                    if (mounted) {
                        setUser({
                            uid: userId,
                            displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                            email: session.user.email || null,
                            walletAddress,
                            connectedWalletAddress: walletAddress || undefined,
                            walletConnectionMethod: walletAddress ? 'metamask' : undefined,
                            walletConnectedAt: walletAddress ? Date.now() : undefined,
                            sgCoinBalance: profile?.sg_coin_balance || 0,
                            isAdmin,
                            isVIP: profile?.is_vip || false,
                            storeCredit: profile?.store_credit || 0,
                            favorites: savedFavorites,
                            socialAccounts: socialsRes.data || []
                        });

                        if (isAdmin) updateAdminMode(true);
                        if (event === 'SIGNED_IN') { fireSignupReferral(userId); }
                        if (walletAddress) { syncCryptoBalances(walletAddress); }
                    }
                } catch (err) { console.error('Error in auth session handling:', err); }
            } else {
                const metamaskAddress = typeof window !== 'undefined' && (window as any).ethereum?.selectedAddress;
                if (metamaskAddress) {
                    const { formatAddress: formatEthAddress } = await loadWalletActions();
                    const isAdmin = ADMIN_WALLETS.some(w => w.toLowerCase() === metamaskAddress.toLowerCase());
                    if (mounted) {
                        setUser({
                            uid: 'user_eth_' + metamaskAddress,
                            displayName: formatEthAddress(metamaskAddress),
                            email: null, walletAddress: metamaskAddress, connectedWalletAddress: metamaskAddress,
                            isAdmin, sgCoinBalance: 0, favorites: [], isVIP: isAdmin
                        });
                        syncCryptoBalances(metamaskAddress);
                    }
                } else if (mounted) setUser(null);
            }
        };

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            void handleAuthChange(event, session);
        });
        authSubscription = authListener.subscription;

        return () => {
            mounted = false;
            authSubscription?.unsubscribe();
        };
    }, [isSupabaseConfigured, updateAdminMode, syncCryptoBalances]);

    // ---- User-facing auth functions ----
    const login = useCallback(async (provider: AuthProvider) => {
        if (provider === AuthProvider.METAMASK) {
            try {
                const { connectWallet, formatAddress: formatEthAddress } = await loadWalletActions();
                const data = await connectWallet();
                if (data) {
                    const isAdmin = ADMIN_WALLETS.map(w => w.toLowerCase()).includes(data.address.toLowerCase());
                    setUser({
                        uid: 'user_eth_' + data.address, displayName: formatEthAddress(data.address), email: null,
                        walletAddress: data.address, sgCoinBalance: parseFloat(data.sgCoinBalance || '0'),
                        v2Balance: parseFloat(data.v2Balance || '0'),
                        totalMigrated: parseFloat((data.totalMigratedV1 || '').replace(/,/g, '') || '0'),
                        isAdmin, favorites: [], isVIP: isAdmin
                    });
                }
            } catch (err) { console.error('MetaMask login error:', err); addToast('Failed to connect wallet.', 'error'); }
        }
    }, [addToast]);
    const loginUser = login;
    const logout = useCallback(async () => { try { await signOut(); setUser(null); } catch (e) { setUser(null); } }, []);
    const updateUser = useCallback(async (data: Partial<UserProfile>) => {
        if (!user) return;
        setUser({ ...user, ...data });
        if (isSupabaseConfigured && !user.uid.startsWith('user_eth_')) {
            try {
                const updates: any = {};
                if (data.sgCoinBalance !== undefined) updates.sg_coin_balance = data.sgCoinBalance;
                if (data.isVIP !== undefined) updates.is_vip = data.isVIP;
                if (data.storeCredit !== undefined) updates.store_credit = data.storeCredit;
                if (Object.keys(updates).length > 0) await supabase.from('profiles').update(updates).eq('id', user.uid);
            } catch (err) { console.error('Failed to sync user updates:', err); }
        }
    }, [user, isSupabaseConfigured]);
    const loginAdmin = useCallback(async (emailOrPassword: string, password?: string) => {
        const pwd = password || emailOrPassword;
        try {
            const response = await fetch('/api/admin-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
            const data = await response.json();
            if (response.ok && data.token) { sessionStorage.setItem('coalition_admin_token', data.token); updateAdminMode(true); return true; }
        } catch (err) { console.error('Admin login error:', err); }
        if (password) {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email: emailOrPassword, password });
                if (error) throw error;
                if (data.user) {
                    const { data: adminData } = await supabase.from('admin_users').select('role').eq('user_id', data.user.id).maybeSingle();
                    if (adminData) { updateAdminMode(true); return true; }
                    await supabase.auth.signOut();
                }
            } catch (err) { console.error('Supabase admin login error:', err); }
        }
        return false;
    }, [updateAdminMode]);
    const logoutAdmin = useCallback(() => { updateAdminMode(false); }, [updateAdminMode]);
    const toggleFavorite = useCallback((pid: string) => {
        if (!user) return;
        const isFav = user.favorites.includes(pid);
        const newFavs = isFav ? user.favorites.filter(id => id !== pid) : [pid, ...user.favorites];
        setUser({ ...user, favorites: newFavs });
        localStorage.setItem('coalition_favorites_' + user.uid, JSON.stringify(newFavs));
    }, [user]);
    const connectMetaMaskWallet = useCallback(async (address?: string) => {
        if (!user) return;
        try {
            let addr = address;
            if (!addr) { const { connectWallet } = await loadWalletActions(); const data = await connectWallet(); if (!data) return; addr = data.address; }
            const isAdmin = addr && ADMIN_WALLETS.map(w => w.toLowerCase()).includes(addr.toLowerCase());
            setUser({ ...user, walletAddress: addr!, connectedWalletAddress: addr!, walletConnectionMethod: 'metamask', walletConnectedAt: Date.now(), isAdmin: user.isAdmin || !!isAdmin });
            if (isSupabaseConfigured && !user.uid.startsWith('user_eth_')) {
                await supabase.from('wallet_accounts').upsert({ user_id: user.uid, wallet_address: addr, method: 'metamask' }, { onConflict: 'user_id' });
            }
        } catch (e) { console.error('Connect wallet error:', e); }
    }, [user, isSupabaseConfigured]);
    const connectManualWallet = useCallback(async (address?: string) => {
        if (!user || address === undefined) return;
        setUser({ ...user, connectedWalletAddress: address, walletConnectionMethod: 'manual', walletConnectedAt: Date.now() });
    }, [user]);
    const disconnectWallet = useCallback(async () => {
        if (user) setUser({ ...user, connectedWalletAddress: undefined, walletConnectionMethod: undefined, walletConnectedAt: undefined });
    }, [user]);
    const linkSocialAccount = useCallback(async (platform: SocialAccount['platform'], username: string) => {
        if (!user) return;
        try { await supabase.from('social_accounts').insert([{ user_id: user.uid, platform, username, verified: false }]); addToast('Linked!', 'success'); }
        catch (err) { addToast('Link failed.', 'error'); }
    }, [user, addToast]);
    const unlinkSocialAccount = useCallback(async (p: SocialAccount['platform']) => {
        if (!user) return { success: false };
        try { await supabase.from('social_accounts').delete().eq('user_id', user.uid).eq('platform', p); setUser(prev => prev ? { ...prev, socialAccounts: prev.socialAccounts?.filter(a => a.platform !== p) } : null); return { success: true }; }
        catch (err) { return { success: false }; }
    }, [user]);
    const submitCustomInquiry = useCallback(async (data: any) => {
        try { const d: any = { ...data, status: 'new' }; if (user?.uid && !user.uid.startsWith('user_eth_')) d.user_id = user.uid; await supabase.from('custom_inquiries').insert([d]); addToast('Submitted!', 'success'); }
        catch (err) { addToast('Failed.', 'error'); }
    }, [user, addToast]);
    const submitPurchaseRequest = useCallback(async (data: any) => {
        try { await supabase.from('sgcoin_purchase_requests').insert([{ ...data, user_id: user?.uid, status: 'pending' }]); addToast('Submitted!', 'success'); }
        catch (err) { addToast('Failed.', 'error'); }
    }, [user, addToast]);

    return {
        user, setUser, isAdminMode, updateAdminMode,
        chainId, switchToPolygon: handleSwitchToPolygon,
        login, loginUser, logout, updateUser, loginAdmin, logoutAdmin,
        toggleFavorite,
        connectMetaMaskWallet, connectManualWallet, disconnectWallet,
        syncCryptoBalances, refreshBalances,
        linkSocialAccount, unlinkSocialAccount, submitCustomInquiry, submitPurchaseRequest,
    };
}
