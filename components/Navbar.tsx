import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, Shield, Hexagon, User, Heart, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AuthProvider } from '../types';
import SearchBar from './SearchBar';

const Navbar = () => {
    const { cart, setCartOpen, user, login, logout, isAdminMode, logoutAdmin } = useApp();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <nav className={`sticky top-0 z-[60] w-full transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center">
                            <Link to="/" className="font-display text-3xl font-bold tracking-widest uppercase text-white hover:text-glow transition-all">
                                Coalition
                            </Link>
                        </div>

                        {/* Search Bar - Desktop */}
                        <div className="hidden md:block flex-1 max-w-md mx-8">
                            <SearchBar showSuggestions={true} />
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center space-x-10">
                            <Link to="/" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:text-glow transition-all">Home</Link>
                            <Link to="/shop" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:text-glow transition-all">Shop</Link>
                            <Link to="/membership" className="text-xs font-bold uppercase tracking-widest text-purple-400 hover:text-purple-300 hover:text-glow transition-all flex items-center gap-1"><Star className="w-3 h-3" />VIP</Link>
                            <Link to="/help" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:text-glow transition-all">Help</Link>
                            {user && <Link to="/profile" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:text-glow transition-all">Profile</Link>}

                            {/* Admin Dashboard Link (only show when in admin mode) */}
                            {isAdminMode && (
                                <Link to="/admin" className="flex items-center px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-colors bg-purple-900/50 text-purple-200 border border-purple-500/30 hover:bg-purple-900 hover:border-purple-500">
                                    <Shield className="w-3 h-3 mr-1.5" />
                                    Admin
                                </Link>
                            )}

                            {/* Admin Mode Indicator (only show when in admin mode) */}
                            {isAdminMode && (
                                <button
                                    onClick={logoutAdmin}
                                    className="flex items-center px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-colors bg-red-900/50 text-red-200 border border-red-500/30 hover:bg-red-900 hover:border-red-500"
                                    title="Exit Admin Mode"
                                >
                                    <Shield className="w-3 h-3 mr-1.5" />
                                    Exit
                                </button>
                            )}

                            {!user ? (
                                <div className="flex items-center space-x-4 pl-4 border-l border-white/10">
                                    <Link to="/login" className="text-xs font-bold uppercase tracking-widest text-white hover:text-glow transition-all">
                                        Login
                                    </Link>
                                    <button onClick={() => login(AuthProvider.METAMASK)} className="text-xs font-bold uppercase tracking-widest border border-white/20 px-4 py-2 hover:bg-white hover:text-black transition-all flex items-center gap-2" title="Connect Wallet">
                                        <Hexagon className="w-3 h-3" /> Connect
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-6 pl-4 border-l border-white/10">
                                    <div className="flex items-center text-brand-accent">
                                        <Hexagon className="w-4 h-4 mr-2 fill-current" />
                                        <span className="text-sm font-bold font-mono">{user.sgCoinBalance.toLocaleString()}</span>
                                    </div>
                                    <button onClick={logout} className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors" title="Logout">Logout</button>
                                </div>
                            )}

                            <button onClick={() => setCartOpen(true)} className="relative p-2 text-white hover:text-glow transition-all" title="Open Cart">
                                <ShoppingBag className="w-5 h-5" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-brand-accent text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full shadow-lg shadow-blue-500/50">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center space-x-4">
                            <button onClick={() => setCartOpen(true)} className="relative p-2 text-white" title="Open Cart">
                                <ShoppingBag className="w-5 h-5" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-brand-accent text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                            <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} className="text-white" title="Toggle Menu">
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-black/95 backdrop-blur-xl border-b border-white/10 p-6 space-y-6 shadow-2xl absolute w-full">
                        <Link to="/" className="block text-lg font-display font-bold uppercase tracking-widest text-white" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                        <Link to="/shop" className="block text-lg font-display font-bold uppercase tracking-widest text-white" onClick={() => setMobileMenuOpen(false)}>Shop</Link>
                        <Link to="/membership" className="block text-lg font-display font-bold uppercase tracking-widest text-purple-400" onClick={() => setMobileMenuOpen(false)}>VIP Membership</Link>
                        <Link to="/help" className="block text-lg font-display font-bold uppercase tracking-widest text-white" onClick={() => setMobileMenuOpen(false)}>Help</Link>

                        {!user ? (
                            <div className="pt-6 border-t border-white/10 space-y-4">
                                <Link to="/login" className="block w-full text-center py-3 border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all" onClick={() => setMobileMenuOpen(false)}>
                                    Login
                                </Link>
                                <button onClick={() => { login(AuthProvider.METAMASK); setMobileMenuOpen(false); }} className="w-full py-3 bg-brand-accent text-white font-bold uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2" title="Connect Wallet">
                                    <Hexagon className="w-4 h-4" /> Connect Wallet
                                </button>
                            </div>
                        ) : (
                            <div className="pt-6 border-t border-white/10 space-y-4">
                                <div className="flex items-center justify-between text-brand-accent mb-4">
                                    <span className="text-sm font-bold uppercase tracking-widest text-gray-400">Balance</span>
                                    <div className="flex items-center">
                                        <Hexagon className="w-4 h-4 mr-2 fill-current" />
                                        <span className="text-lg font-bold font-mono">{user.sgCoinBalance.toLocaleString()}</span>
                                    </div>
                                </div>
                                <Link to="/profile" className="block w-full text-center py-3 border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all" onClick={() => setMobileMenuOpen(false)}>
                                    Profile
                                </Link>
                                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full py-3 bg-red-900/50 text-red-200 border border-red-500/30 font-bold uppercase tracking-widest hover:bg-red-900 transition-all" title="Logout">
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </nav>
        </>
    );
};

export default Navbar;
