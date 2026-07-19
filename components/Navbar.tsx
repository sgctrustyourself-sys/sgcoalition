import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingBag, Menu, X, Shield, Hexagon, Star, ChevronDown, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AuthProvider } from '../types';
import SearchBar from './SearchBar';
import { PRODUCT_IDS } from '../constants/productIds';

const Navbar = () => {
    const { cart, setCartOpen, user, login, logout, isAdminMode, logoutAdmin, products } = useApp();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isResourcesOpen, setIsResourcesOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    // Wallets dropdown sub-section: show ONLY the one featured live wallet
    // (Coalition Above as Below 1/1). The full archive + past drops now
    // live on the dedicated `/wallets` page; a single Explore link in the
    // dropdown is the one-click path. The full `walletProducts` list is
    // still computed for the mobile menu (which doesn't gate to a single
    // item) and as a cheap predicate for the Active pill.
    const FEATURED_WALLET_ID = PRODUCT_IDS.FEATURED_WALLET;
    const walletProducts = useMemo(() => {
        const list = (products || []).filter(
            (p) => p.category === 'wallet' || /wallet/i.test(p.name)
        );
        list.sort((a, b) => {
            if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
            const aDate = a.archived ? (a.soldAt || '') : (a.releasedAt || '');
            const bDate = b.archived ? (b.soldAt || '') : (b.releasedAt || '');
            if (aDate && bDate && aDate !== bDate) return aDate > bDate ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        return list;
    }, [products]);
    const featuredWallet = useMemo(
        () => (products || []).find((p) => p.id === FEATURED_WALLET_ID),
        [products]
    );

    // Hoisted close handlers used by every Link inside the Resources
    // dropdown and the mobile hamburger menu. One closure per render
    // instead of ~15 inline ones.
    const closeResources = () => setIsResourcesOpen(false);
    const closeMobile = () => setMobileMenuOpen(false);

    // Active-state detection for the dropdown section header. The Shop
    // page accepts `category=wallets` (plural) as the canonical alias;
    // match both singular and plural so direct links AND theme-filter
    // links both light up the pill. Non-/shop URLs with category=wallet
    // also light up (no extra guard; matches the user's spec).
    const activeCategory = searchParams.get('category');
    const isWalletFilterActive = activeCategory === 'wallet' || activeCategory === 'wallets';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <>
            <nav className={`sticky top-0 z-[60] w-full transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center">
                            <Link to="/" className="font-display text-4xl font-bold tracking-tighter uppercase text-white hover:text-glow transition-all">
                                COALITION
                            </Link>
                        </div>

                        {/* Search Bar - Desktop */}
                        <div className="hidden md:block flex-1 max-w-md mx-8">
                            <SearchBar showSuggestions={true} />
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center space-x-10 h-full">
                            <Link to="/" className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${isActive('/') ? 'text-white text-glow underline underline-offset-8 decoration-brand-accent decoration-2' : 'text-gray-400 hover:text-white hover:text-glow'}`}>HOME</Link>
                            <Link to="/shop" className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${isActive('/shop') ? 'text-white text-glow underline underline-offset-8 decoration-brand-accent decoration-2' : 'text-gray-400 hover:text-white hover:text-glow'}`}>SHOP</Link>
                            <Link to="/blog" className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${isActive('/blog') ? 'text-white text-glow underline underline-offset-8 decoration-brand-accent decoration-2' : 'text-gray-400 hover:text-white hover:text-glow'}`}>BLOG</Link>
                            <Link to="/membership" className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${isActive('/membership') ? 'text-purple-300 text-glow underline underline-offset-8 decoration-purple-500 decoration-2' : 'text-purple-400 hover:text-purple-300 hover:text-glow'}`}>
                                <Star className="w-3 h-3" />
                                VIP
                            </Link>

                            {/* Resources Dropdown */}
                            <div
                                className="relative h-full flex items-center"
                                onMouseEnter={() => setIsResourcesOpen(true)}
                                onMouseLeave={() => setIsResourcesOpen(false)}
                            >
                                <button className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${isActive('/help') || isActive('/inquire') ? 'text-white text-glow underline underline-offset-8 decoration-white/30 decoration-2' : 'text-gray-400 hover:text-white hover:text-glow'}`}>
                                    RESOURCES
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isResourcesOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isResourcesOpen && (
                                    <div className="absolute top-full left-0 w-80 bg-black/90 backdrop-blur-xl border border-white/10 py-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                        <Link to="/help" onClick={closeResources} className={`block px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive('/help') ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>HELP CENTER</Link>
                                        <Link to="/migrate" onClick={closeResources} className={`block px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive('/migrate') ? 'text-yellow-500 bg-white/5' : 'text-yellow-600/80 hover:text-yellow-500 hover:bg-white/5'}`}>MIGRATE TO V2</Link>
                                        <Link to="/tutorial" onClick={closeResources} className={`block px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive('/tutorial') ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>GUIDE</Link>
                                        <Link to="/giveaway/nf-tee" onClick={closeResources} className={`block px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive('/giveaway') ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>GIVEAWAY</Link>
                                        {isAdminMode && (
                                            <Link to="/brain" onClick={closeResources} className={`block px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive('/brain') ? 'text-purple-300 bg-white/5' : 'text-purple-400 hover:text-purple-300 hover:bg-white/5'}`}>COALITION BRAIN</Link>
                                        )}
                                        <Link to="/inquire" onClick={closeResources} className={`block px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive('/inquire') ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>CUSTOM INQUIRY</Link>
                                        <Link to="/live-orders" onClick={closeResources} className={`block px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive('/live-orders') ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>RECENTLY ORDERED</Link>
                                        {walletProducts.length > 0 && (
                                            <>
                                                <div className="h-px border-t border-white/10 my-2 mx-4" />
                                                <div className="px-4 py-1 flex items-center justify-between">
                                                    <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isWalletFilterActive ? 'text-brand-accent' : 'text-gray-500'}`}>Wallets & Hardware</span>
                                                    {isWalletFilterActive && (
                                                        <span className="text-[10px] bg-brand-accent/20 text-brand-accent border border-brand-accent/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.15em]">Active</span>
                                                    )}
                                                </div>
                                                {featuredWallet && (
                                                    <Link
                                                        to={`/product/${featuredWallet.id}`}
                                                        onClick={closeResources}
                                                        className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-all"
                                                    >
                                                        <div className="w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-white/5 border border-white/10">
                                                            {featuredWallet.images && featuredWallet.images[0] && (
                                                                <img
                                                                    src={featuredWallet.images[0]}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider truncate text-gray-300">{featuredWallet.name}</span>
                                                            <span className="text-[9px] tracking-wider text-gray-500">${featuredWallet.price}</span>
                                                        </div>
                                                    </Link>
                                                )}
                                                <Link
                                                    to="/wallets"
                                                    onClick={closeResources}
                                                    className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-accent hover:bg-white/5 transition-all"
                                                >
                                                    <Wallet className="w-3.5 h-3.5" />
                                                    Explore Custom Wallets
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <Link to="/ecosystem" className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${isActive('/ecosystem') ? 'text-white text-glow underline underline-offset-8 decoration-brand-accent decoration-2' : 'text-brand-accent hover:text-white hover:text-glow'}`}>ECOSYSTEM</Link>


                            {user && (
                                <Link
                                    to="/profile"
                                    className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${isActive('/profile') ? 'text-white text-glow underline underline-offset-8 decoration-brand-accent decoration-2' : 'text-gray-400 hover:text-white hover:text-glow'}`}
                                >
                                    MY PROFILE
                                </Link>
                            )}

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
                                <div className="flex items-center pl-4 border-l border-white/5 space-x-6">
                                    <span className="text-gray-800 font-light select-none ml-4">|</span>
                                    <Link to="/login" className="text-[11px] font-bold uppercase tracking-[0.2em] text-white hover:text-glow transition-all">
                                        LOGIN
                                    </Link>
                                </div>
                            ) : !user.walletAddress && !user.connectedWalletAddress ? (
                                <div className="flex items-center space-x-4 pl-4 border-l border-white/10">
                                    <button
                                        onClick={() => navigate('/membership')}
                                        className="text-[10px] font-bold uppercase tracking-wider text-brand-accent hover:text-white transition-all flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-accent/10 border border-brand-accent/30"
                                    >
                                        <Hexagon className="w-3.5 h-3.5" />
                                        Connect Wallet
                                    </button>
                                    <button onClick={logout} className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-red-500 transition-colors" title="Logout">LOGOUT</button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-6 pl-4 border-l border-white/10">
                                    {/* V1 Balance - Red */}
                                    <div className="flex items-center text-red-400">
                                        <Hexagon className="w-4 h-4 mr-2 fill-current" />
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-red-500/60">V1</span>
                                            <span className="text-sm font-bold font-mono">{user.sgCoinBalance?.toLocaleString() || '0'}</span>
                                        </div>
                                    </div>
                                    {/* V2 Balance - Green */}
                                    <div className="flex items-center text-green-400">
                                        <Hexagon className="w-4 h-4 mr-2 fill-current" />
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-green-500/60">V2</span>
                                            <span className="text-sm font-bold font-mono">{(user.v2Balance || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <button onClick={logout} className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-red-500 transition-colors" title="Logout">LOGOUT</button>
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
                        <Link to="/" className="block text-lg font-display font-bold uppercase tracking-widest text-white" onClick={closeMobile}>Home</Link>
                        <Link to="/shop" className="block text-lg font-display font-bold uppercase tracking-widest text-white" onClick={closeMobile}>Shop</Link>
                        <Link to="/blog" className="block text-lg font-display font-bold uppercase tracking-widest text-white" onClick={closeMobile}>Blog</Link>
                        <Link to="/membership" className="block text-lg font-display font-bold uppercase tracking-widest text-purple-400" onClick={closeMobile}>VIP</Link>
                        <Link to="/ecosystem" className="block text-lg font-display font-bold uppercase tracking-widest text-brand-accent" onClick={closeMobile}>Ecosystem</Link>
                        <div className="pt-4 space-y-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Resources</p>
                            <Link to="/migrate" className="block text-md font-bold uppercase tracking-widest text-yellow-500" onClick={closeMobile}>Migrate to V2</Link>
                            <Link to="/help" className="block text-md font-bold uppercase tracking-widest text-gray-400" onClick={closeMobile}>Help Center</Link>
                            <Link to="/giveaway/nf-tee" className="block text-md font-bold uppercase tracking-widest text-white" onClick={closeMobile}>Giveaway Portal</Link>
                            {isAdminMode && (
                                <Link to="/brain" className="block text-md font-bold uppercase tracking-widest text-purple-400" onClick={closeMobile}>Coalition Brain</Link>
                            )}
                            <Link to="/inquire" className="block text-md font-bold uppercase tracking-widest text-gray-400" onClick={closeMobile}>Custom Inquiry</Link>                                        {walletProducts.length > 0 && (
                                                <>
                                                    <div className="flex items-center justify-between pt-2">
                                                        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isWalletFilterActive ? 'text-brand-accent' : 'text-gray-500'}`}>Wallets & Hardware</p>
                                                        {isWalletFilterActive && (
                                                            <span className="text-[10px] bg-brand-accent/20 text-brand-accent border border-brand-accent/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.15em]">Active</span>
                                                        )}
                                                    </div>
                                                    {featuredWallet && (
                                                        <Link
                                                            to={`/product/${featuredWallet.id}`}
                                                            onClick={closeMobile}
                                                            className="flex items-center gap-3 text-md font-bold uppercase tracking-widest text-gray-300"
                                                        >
                                                            <span className="truncate">{featuredWallet.name}</span>
                                                            <span className="text-xs font-mono text-gray-500 ml-auto">${featuredWallet.price}</span>
                                                        </Link>
                                                    )}
                                                    <Link
                                                        to="/wallets"
                                                        onClick={closeMobile}
                                                        className="flex items-center gap-2 text-md font-bold uppercase tracking-widest text-brand-accent"
                                                    >
                                                        <Wallet className="w-4 h-4" />
                                                        Explore Custom Wallets
                                                    </Link>
                                                </>
                                            )}
                        </div>

                        {!user ? (
                            <div className="pt-6 border-t border-white/10 space-y-4">
                                <Link to="/login" className="block w-full text-center py-3 border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all" onClick={closeMobile}>
                                    Login
                                </Link>
                            </div>
                        ) : !user.walletAddress && !user.connectedWalletAddress ? (
                            <div className="pt-6 border-t border-white/10 space-y-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Wallet Disconnected</p>
                                <button
                                    onClick={() => { navigate('/membership'); setMobileMenuOpen(false); }}
                                    className="block w-full text-center py-4 bg-brand-accent/10 border border-brand-accent/40 text-brand-accent font-bold uppercase tracking-widest hover:bg-brand-accent hover:text-white transition-all"
                                >
                                    Connect Wallet
                                </button>
                                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full py-3 bg-red-900/50 text-red-200 border border-red-500/30 font-bold uppercase tracking-widest hover:bg-red-900 transition-all" title="Logout">
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div className="pt-6 border-t border-white/10 space-y-4">
                                {/* V1 Balance - Red */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-bold uppercase tracking-widest text-red-500/80">V1 Balance</span>
                                    <div className="flex items-center text-red-400">
                                        <Hexagon className="w-4 h-4 mr-2 fill-current" />
                                        <span className="text-lg font-bold font-mono">{user.sgCoinBalance?.toLocaleString() || '0'}</span>
                                    </div>
                                </div>
                                {/* V2 Balance - Green */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-bold uppercase tracking-widest text-green-500/80">V2 Balance</span>
                                    <div className="flex items-center text-green-400">
                                        <Hexagon className="w-4 h-4 mr-2 fill-current" />
                                        <span className="text-lg font-bold font-mono">{(user.v2Balance || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                <Link
                                    to="/profile"
                                    onClick={closeMobile}
                                    className="block w-full text-center py-3 border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                                >
                                    My Profile
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
