import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Menu, X, Shield, Hexagon, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_USERS } from '../context/AppContext';
import { AuthProvider } from '../types';

const Navbar = () => {
    const { cart, user, isCartOpen, setCartOpen, login, logout, isAdminMode, loginAdmin, logoutAdmin } = useApp();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAdminLoginOpen, setAdminLoginOpen] = useState(false);
    const [isUserSelectOpen, setUserSelectOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminError, setAdminError] = useState(false);
    const [keyPressCount, setKeyPressCount] = useState(0);
    const [lastKeyTime, setLastKeyTime] = useState(0);

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    // Keyboard shortcut for admin access (press 'A' 3 times quickly)
    React.useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'a') {
                const now = Date.now();
                if (now - lastKeyTime < 500) {
                    const newCount = keyPressCount + 1;
                    setKeyPressCount(newCount);
                    if (newCount >= 3 && !isAdminMode) {
                        setAdminLoginOpen(true);
                        setKeyPressCount(0);
                    }
                } else {
                    setKeyPressCount(1);
                }
                setLastKeyTime(now);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [keyPressCount, lastKeyTime, isAdminMode]);

    const handleAdminLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const success = loginAdmin(adminPassword);
        if (success) {
            setAdminLoginOpen(false);
            setAdminPassword('');
            setAdminError(false);
        } else {
            setAdminError(true);
        }
    };

    const handleUserSelect = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedUserId) {
            login(AuthProvider.GOOGLE, selectedUserId);
            setUserSelectOpen(false);
            setSelectedUserId('');
        }
    };

    return (
        <>
            <nav className="sticky top-0 z-[60] glass-panel w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center">
                            <Link to="/" className="font-display text-2xl font-bold tracking-wider uppercase text-brand-black">
                                Coalition
                            </Link>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center space-x-8">
                            <Link to="/" className="text-sm font-medium hover:text-brand-accent transition">Home</Link>
                            <Link to="/shop" className="text-sm font-medium hover:text-brand-accent transition">Shop</Link>
                            <Link to="/about" className="text-sm font-medium hover:text-brand-accent transition">Story</Link>
                            <Link to="/ecosystem" className="text-sm font-medium hover:text-brand-accent transition">Ecosystem</Link>
                            {user && <Link to="/profile" className="text-sm font-medium hover:text-brand-accent transition">Profile</Link>}

                            {/* Admin Dashboard Link (only show when in admin mode) */}
                            {isAdminMode && (
                                <Link to="/admin" className="flex items-center px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide transition-colors bg-purple-600 text-white hover:bg-purple-700">
                                    <Shield className="w-4 h-4 mr-1.5" />
                                    Admin Dashboard
                                </Link>
                            )}

                            {/* Admin Mode Indicator (only show when in admin mode) */}
                            {isAdminMode && (
                                <button
                                    onClick={logoutAdmin}
                                    className="flex items-center px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide transition-colors bg-red-500 text-white hover:bg-red-600"
                                >
                                    <Shield className="w-4 h-4 mr-1.5" />
                                    Exit Admin
                                </button>
                            )}

                            {!user ? (
                                <div className="flex space-x-2">
                                    <button onClick={() => setUserSelectOpen(true)} className="text-xs bg-black text-white px-3 py-1.5 rounded-sm hover:bg-gray-800">
                                        Login
                                    </button>
                                    <button onClick={() => login(AuthProvider.METAMASK)} className="text-xs border border-gray-300 px-3 py-1.5 rounded-sm hover:bg-gray-50 flex items-center">
                                        <Hexagon className="w-3 h-3 mr-1" /> Connect
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center text-brand-accent">
                                        <Hexagon className="w-4 h-4 mr-1 fill-current" />
                                        <span className="text-sm font-bold">{user.sgCoinBalance.toLocaleString()}</span>
                                    </div>
                                    <button onClick={logout} className="text-xs text-gray-500 hover:text-red-500">Logout</button>
                                </div>
                            )}

                            <button onClick={() => setCartOpen(true)} className="relative p-2">
                                <ShoppingBag className="w-5 h-5" />
                                {cartCount > 0 && (
                                    <span className="absolute top-0 right-0 bg-brand-accent text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center">
                            <button onClick={() => setCartOpen(true)} className="p-2 mr-2 relative">
                                <ShoppingBag className="w-5 h-5" />
                                {cartCount > 0 && (
                                    <span className="absolute top-0 right-0 bg-brand-accent text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                            <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-4 shadow-xl">
                        <Link to="/" className="block font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                        <Link to="/shop" className="block font-medium" onClick={() => setMobileMenuOpen(false)}>Shop</Link>
                        <Link to="/about" className="block font-medium" onClick={() => setMobileMenuOpen(false)}>Story</Link>
                        <Link to="/ecosystem" className="block font-medium" onClick={() => setMobileMenuOpen(false)}>Ecosystem</Link>
                        {user && <Link to="/profile" className="block font-medium" onClick={() => setMobileMenuOpen(false)}>Profile</Link>}
                        {!user ? (
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <button onClick={() => { setMobileMenuOpen(false); setUserSelectOpen(true); }} className="w-full text-left text-sm font-bold text-brand-black">Login via Google</button>
                                <button onClick={() => login(AuthProvider.METAMASK)} className="w-full text-left text-sm font-bold text-brand-accent">Connect Web3</button>
                            </div>
                        ) : (
                            <button onClick={logout} className="w-full text-left text-sm text-red-500 pt-4 border-t border-gray-100">Logout</button>
                        )}
                        <button onClick={() => { setMobileMenuOpen(false); setAdminLoginOpen(true); }} className="w-full text-left text-xs text-gray-400 pt-4 uppercase tracking-widest">Admin Access</button>
                    </div>
                )}
            </nav>

            {/* Admin Login Modal */}
            {isAdminLoginOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-sm relative">
                        <button onClick={() => setAdminLoginOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
                        <h2 className="font-display text-2xl font-bold uppercase mb-6 text-center">Admin Access</h2>
                        <form onSubmit={handleAdminLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    className={`w-full border p-3 focus:outline-none ${adminError ? 'border-red-500' : 'border-gray-300 focus:border-black'}`}
                                    placeholder="Enter admin password"
                                    autoFocus
                                />
                                {adminError && <p className="text-red-500 text-xs mt-1">Incorrect password.</p>}
                            </div>
                            <button type="submit" className="w-full bg-black text-white py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                                Login
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* User Selection Modal */}
            {isUserSelectOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md relative">
                        <button onClick={() => setUserSelectOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
                        <h2 className="font-display text-2xl font-bold uppercase mb-2 text-center">Sign In</h2>
                        <p className="text-sm text-gray-500 text-center mb-6">Choose a test account</p>
                        <form onSubmit={handleUserSelect} className="space-y-3">
                            {MOCK_USERS.map((mockUser) => (
                                <label
                                    key={mockUser.uid}
                                    className={`block border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedUserId === mockUser.uid
                                        ? 'border-black bg-gray-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-start">
                                        <input
                                            type="radio"
                                            name="user"
                                            value={mockUser.uid}
                                            checked={selectedUserId === mockUser.uid}
                                            onChange={(e) => setSelectedUserId(e.target.value)}
                                            className="mt-1 mr-3"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <User className="w-4 h-4 mr-2 text-gray-400" />
                                                    <span className="font-bold text-sm">{mockUser.displayName}</span>
                                                </div>
                                                <div className="flex items-center text-brand-accent">
                                                    <Hexagon className="w-3 h-3 mr-1 fill-current" />
                                                    <span className="text-xs font-bold">{mockUser.sgCoinBalance.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{mockUser.email}</p>
                                        </div>
                                    </div>
                                </label>
                            ))}
                            <button
                                type="submit"
                                disabled={!selectedUserId}
                                className="w-full bg-black text-white py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition disabled:bg-gray-300 disabled:cursor-not-allowed mt-6"
                            >
                                Sign In
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
