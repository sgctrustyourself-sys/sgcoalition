import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, MessageCircle, Twitter } from 'lucide-react';
import Newsletter from './Newsletter';

const Footer = () => {
    return (
        <footer className="bg-black text-white py-20 border-t border-white/10 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl -translate-y-1/2 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-12 relative z-10">
                <div className="col-span-1 md:col-span-1">
                    <h3 className="font-display text-2xl font-bold uppercase mb-6 tracking-widest">Coalition</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Crafted in Baltimore, Maryland.<br />
                        Built for the resilient.
                    </p>
                    <p className="text-gray-600 text-xs mt-6">© 2024 Coalition Brand.</p>
                </div>

                <div>
                    <h4 className="font-bold uppercase mb-6 text-xs tracking-[0.2em] text-gray-400">Newsletter</h4>
                    <p className="text-gray-500 text-xs mb-4">Sign up for exclusive drops and community updates.</p>
                    <Newsletter />
                </div>

                <div>
                    <h4 className="font-bold uppercase mb-6 text-xs tracking-[0.2em] text-gray-400">Support</h4>
                    <ul className="space-y-3 text-sm text-gray-500">
                        <li><Link to="/about" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">About Us</Link></li>
                        <li><Link to="/privacy" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Privacy Policy</Link></li>
                        <li><Link to="/terms" className="hover:text-white hover:text-glow transition-all uppercase text-xs font-bold tracking-wide">Terms of Service</Link></li>
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
