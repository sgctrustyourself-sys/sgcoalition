import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, User, Link2, type LucideIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MAIN_SHARING_LINK, MAIN_SHARING_LABEL } from '../utils/sharingLinks';

const MobileBottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { cart, setCartOpen } = useApp();

    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    interface NavItem {
        icon: LucideIcon;
        label: string;
        path?: string;
        badge?: number;
        action?: () => void;
        // External destinations (the portfolio linktree) render as anchors,
        // not router buttons — they leave the app for a different origin.
        href?: string;
    }

    const navItems: NavItem[] = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: ShoppingBag, label: 'Shop', path: '/shop' },
        { icon: ShoppingCart, label: 'Cart', path: '/cart', badge: cartItemCount, action: () => setCartOpen(true) },
        { icon: User, label: 'Profile', path: '/profile' },
        // The main sharing link: the linktree carries the portfolio next to
        // the shop, so it is the one URL that answers "where is everything
        // you make" — reachable here on every screen.
        { icon: Link2, label: 'Links', href: MAIN_SHARING_LINK },
    ];

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 z-50">
            <div className="flex items-center justify-around h-16 px-2">
                {navItems.map(({ icon: Icon, label, path, badge, action, href }) => {
                    const active = path !== undefined && isActive(path);
                    const inner = (
                        <>
                            <div className="relative">
                                <Icon
                                    size={24}
                                    className={active ? 'stroke-2' : 'stroke-1.5'}
                                />
                                {badge !== undefined && badge > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                        {badge > 99 ? '99+' : badge}
                                    </span>
                                )}
                            </div>
                            <span className={`text-xs mt-1 ${active ? 'font-semibold' : 'font-normal'}`}>
                                {label}
                            </span>
                        </>
                    );
                    const className = `flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${active ? 'text-white' : 'text-gray-400'}`;
                    if (href !== undefined) {
                        return (
                            <a
                                key={label}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={className}
                                aria-label={`Portfolio and all links (opens ${MAIN_SHARING_LABEL})`}
                            >
                                {inner}
                            </a>
                        );
                    }
                    return (
                        <button
                            key={label}
                            onClick={() => action ? action() : navigate(path as string)}
                            className={className}
                            aria-label={label}
                        >
                            {inner}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
