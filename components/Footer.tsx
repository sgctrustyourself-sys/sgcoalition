import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, MessageCircle, Twitter } from 'lucide-react';
import Newsletter from './Newsletter';

const Footer = () => {
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
                    <p className="text-gray-600 text-xs mt-6">© 2024 Coalition Brand. v1.2</p>
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
                        <li><Link to="/archive" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Archive</Link></li>
                        <li><a href="mailto:support@coalitionbrand.com" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Contact Us</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold uppercase mb-6 text-xs tracking-[0.2em] text-gray-400">Community</h4>
                    <div className="flex flex-col items-start space-y-4">
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
                            href="https://www.reddit.com/r/SGCoalition/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group w-full"
                        >
                            <div className="flex items-center justify-center bg-gradient-to-r from-[#ff4500]/20 to-orange-900/20 border border-white/10 text-white px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-[#ff4500]/50 group-hover:bg-[#ff4500]/20 transition-all">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mr-2 text-[#ff4500]">
                                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.561-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                                </svg>
                                Join Reddit
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
