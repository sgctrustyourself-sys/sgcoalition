import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

// Admin wallet address
// Admin wallet address
// const ADMIN_WALLET = '0x0F4A0466C2a1d3FA6Ed55a20994617F0533fbf74'; // Moved to constants.ts

/**
 * ProtectedRoute component that guards routes requiring admin access
 * Uses MetaMask wallet address for authentication
 * 
 * @param children - The component to render if access is granted
 * @param requireAdmin - Whether the route requires admin privileges
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAdmin = false
}) => {
    const { user, isAdminMode, loginAdmin } = useApp();
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [loginError, setLoginError] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        const checkAdminAccess = () => {
            if (requireAdmin) {
                // Check if user is connected as admin OR if legacy admin mode is enabled
                if ((user && user.isAdmin) || isAdminMode) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(true);
            }
            setChecking(false);
        };

        checkAdminAccess();
    }, [user, isAdminMode, requireAdmin]);

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setLoginError(false);
        try {
            const success = await loginAdmin(adminPassword);
            if (!success) setLoginError(true);
        } catch (err) {
            setLoginError(true);
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Show loading state while checking
    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Verifying access...</p>
                </div>
            </div>
        );
    }

    // Show access denied if admin required but user is not admin
    if (requireAdmin && !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black p-4">
                <div className="text-center max-w-lg w-full">
                    <div className="relative inline-block mb-6">
                        <div className="text-6xl animate-pulse">🔒</div>
                        <Shield className="absolute -bottom-2 -right-2 w-8 h-8 text-brand-accent drop-shadow-[0_0_10px_rgba(30,144,255,0.5)]" />
                    </div>

                    <h1 className="text-4xl font-bold mb-4 text-white tracking-tighter uppercase">ADMIN ACCESS REQUIRED</h1>
                    <p className="text-gray-400 mb-8 max-w-md mx-auto text-sm">
                        This area is restricted to authorized personnel. Enter your admin passphrase to unlock the terminal.
                    </p>

                    <div className="bg-white/5 border border-white/10 p-8 rounded-2xl mb-8 backdrop-blur-sm shadow-2xl">
                        <form onSubmit={handleAdminLogin} className="space-y-4">
                            <div className="space-y-1 text-left">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Admin Passphrase</label>
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className={`w-full bg-black/50 border ${loginError ? 'border-red-500' : 'border-white/10'} rounded-xl p-4 text-white placeholder-gray-700 outline-none focus:border-brand-accent/50 transition-all font-mono`}
                                    required
                                    autoFocus
                                />
                                {loginError && (
                                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2 ml-1">
                                        Invalid credentials. Access denied.
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={isLoggingIn}
                                className="w-full bg-brand-accent text-white font-bold uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-brand-accent/80 transition-all shadow-lg shadow-brand-accent/20 flex items-center justify-center gap-2"
                            >
                                {isLoggingIn ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    'Unlock Terminal'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-white/5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3 text-left">Currently Connected:</p>
                            {user?.walletAddress || (typeof window !== 'undefined' && window.ethereum?.selectedAddress) ? (
                                <div className="flex flex-col gap-3">
                                    <div className="bg-black/40 p-4 rounded-xl border border-red-500/20 font-mono text-xs break-all select-all text-red-400 flex items-center justify-between group">
                                        <span>{user?.walletAddress || window.ethereum?.selectedAddress}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-yellow-600 text-[10px] font-bold uppercase tracking-widest py-2 text-left bg-yellow-400/5 px-3 rounded-lg border border-yellow-400/10">
                                    No wallet connected.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-white/5 text-gray-400 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 border border-white/10"
                        >
                            Refresh Session
                        </button>
                        <a
                            href="/"
                            className="bg-white text-black px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-xl"
                        >
                            Return Home
                        </a>
                    </div>

                    <p className="mt-8 text-[10px] text-gray-600 font-bold tracking-widest uppercase">
                        SG COALITION SECURE TERMINAL v2.5
                    </p>
                </div>
            </div>
        );
    }

    // Render protected content
    return <>{children}</>;
};

export default ProtectedRoute;
