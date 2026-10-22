import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, MessageCircle, Twitter, Link2, ShoppingBag } from 'lucide-react';
import Newsletter from './Newsletter';
import { useApp } from '../context/AppContext';
import { MAIN_SHARING_LINK, MAIN_SHARING_LABEL } from '../utils/sharingLinks';
import { showConsentDialog } from '../services/cookieConsent';

const Footer = () => {
    const { isAdminMode } = useApp();

    return (
        <footer className="bg-black text-white py-20 border-t border-white/10 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl -translate-y-1/2 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-12 relative z-10">
                <div className="col-span-1">
                    <h3 className="font-display text-2xl font-bold uppercase mb-6 tracking-widest">Coalition</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                        Crafted in Baltimore, Maryland.<br />
                        Built for the resilient.
                    </p>
                    <div className="mb-6">
                        <h4 className="font-bold uppercase mb-3 text-xs tracking-[0.2em] text-gray-400">Newsletter</h4>
                        <Newsletter />
                    </div>
                    <p className="text-gray-600 text-xs mt-6">© {new Date().getFullYear()} Coalition Brand. v1.3</p>
                </div>

                <div>
                    <h4 className="font-bold uppercase mb-6 text-xs tracking-[0.2em] text-gray-400">Quick Links</h4>
                    <ul className="space-y-3 text-sm text-gray-500">
                        <li><Link to="/shop" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Shop</Link></li>
                        <li><Link to="/membership" className="hover:text-purple-400 text-purple-500 hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">VIP Membership</Link></li>
                        <li><Link to="/ecosystem" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide text-brand-accent">Ecosystem</Link></li>
                        <li><Link to="/inquire" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Custom Inquiry</Link></li>
                        <li><Link to="/about" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">About Us</Link></li>
                        <li><Link to="/help" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Help</Link></li>
                        {isAdminMode && (
                            <li><Link to="/brain" className="hover:text-purple-400 text-purple-500 hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Coalition Brain</Link></li>
                        )}
                        <li><Link to="/archive" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Archive</Link></li>
                        <li><Link to="/privacy" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Privacy Policy</Link></li>
                        <li><button type="button" onClick={showConsentDialog} className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide text-left">Cookie Settings</button></li>
                        <li><a href="mailto:sgctrustyourself@gmail.com" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Contact Us</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold uppercase mb-6 text-xs tracking-[0.2em] text-gray-400">Community</h4>
                    <div className="flex flex-col items-start space-y-4">
                        {/* The main sharing link, first in the column because it
                            is the one that carries everything: the linktree
                            holds the portfolio next to the shop, so it is the
                            same URL the brand prints for "link in bio". */}
                        <a
                            href={MAIN_SHARING_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Portfolio and all links (opens ${MAIN_SHARING_LABEL})`}
                            className="group w-full"
                        >
                            <div className="flex items-center justify-center bg-gradient-to-r from-brand-accent/20 to-white/5 border border-brand-accent/30 text-white px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-brand-accent/60 group-hover:bg-brand-accent/20 transition-all">
                                <Link2 className="w-4 h-4 mr-2 text-brand-accent" />
                                Portfolio &amp; Links
                            </div>
                        </a>
                        <a
                            href="https://www.instagram.com/sgcoalition"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group w-full"
                        >
                            <div className="flex items-center justify-center bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-white/10 text-white px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-pink-500/50 group-hover:bg-pink-900/20 transition-all">
                                <Instagram className="w-4 h-4 mr-2 text-pink-500" />
                                Instagram
                            </div>
                        </a>
                        <a
                            href="https://whop.com/sgcoalition-five/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group w-full"
                        >
                            <div className="flex items-center justify-center bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-white/10 text-white px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-blue-500/50 group-hover:bg-blue-900/20 transition-all">
                                <ShoppingBag className="w-4 h-4 mr-2 text-blue-400" />
                                Shop on Whop
                            </div>
                        </a>
                        <a
                            href="https://discord.gg/bByqsC5f5V"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group w-full"
                        >
                            <div className="flex items-center justify-center bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-white/10 text-white px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-blue-500/50 group-hover:bg-blue-900/20 transition-all">
                                <MessageCircle className="w-4 h-4 mr-2 text-blue-500" />
                                Join Discord
                            </div>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
