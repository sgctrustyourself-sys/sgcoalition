import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

// Admin wallet address
const ADMIN_WALLET = '0x0F4A0466C2a1d3FA6Ed55a20994617F0533fbf74';

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
    const { user } = useApp();
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkAdminAccess = () => {
            if (requireAdmin) {
                // Check if user is connected with MetaMask and has admin wallet
                if (user && user.walletAddress) {
                    const isAdminWallet = user.walletAddress.toLowerCase() === ADMIN_WALLET.toLowerCase();
                    setIsAdmin(isAdminWallet);
                } else {
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(true);
            }
            setChecking(false);
        };

        checkAdminAccess();
    }, [user, requireAdmin]);

    // Show loading state while checking
    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
                    <p className="text-gray-400">Verifying access...</p>
                </div>
            </div>
        );
    }

    // Show access denied if admin required but user is not admin
    if (requireAdmin && !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center max-w-md px-4">
                    <div className="text-6xl mb-6">🔒</div>
                    <h1 className="text-4xl font-bold mb-4">Admin Access Required</h1>
                    <p className="text-gray-400 mb-8">
                        {!user ? (
                            <>Please connect your MetaMask wallet to access the admin dashboard.</>
                        ) : (
                            <>This wallet address does not have admin privileges.</>
                        )}
                    </p>
                    <a
                        href="/#/"
                        className="inline-block bg-brand-accent text-black px-6 py-3 rounded-lg font-bold hover:bg-brand-accent/90 transition"
                    >
                        Return to Home
                    </a>
                </div>
            </div>
        );
    }

    // Render protected content
    return <>{children}</>;
};

export default ProtectedRoute;
