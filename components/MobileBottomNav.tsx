import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

const MobileBottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { cart } = useApp();

    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const navItems = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: ShoppingBag, label: 'Shop', path: '/shop' },
        { icon: ShoppingCart, label: 'Cart', path: '/cart', badge: cartItemCount },
        { icon: User, label: 'Profile', path: '/profile' },
    ];

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 z-50">
            <div className="flex items-center justify-around h-16 px-2">
                {navItems.map(({ icon: Icon, label, path, badge }) => {
                    const active = isActive(path);
                    return (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${active ? 'text-white' : 'text-gray-400'
                                }`}
                            aria-label={label}
                        >
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
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
