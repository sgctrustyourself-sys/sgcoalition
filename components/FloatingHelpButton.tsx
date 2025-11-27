import React, { useState } from 'react';
import { HelpCircle, X, Rocket, ExternalLink, Wallet, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QUICKSWAP_SWAP_URL } from '../constants';

const FloatingHelpButton: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleNavigate = (path: string) => {
        setIsOpen(false);
        navigate(path);
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] transition-all flex items-center justify-center group"
                title="SGCoin Help"
                aria-label="Open SGCoin Help"
            >
                <HelpCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-white/20 rounded-xl max-w-md w-full p-6 relative shadow-2xl">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded transition"
                            aria-label="Close help modal"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>

                        <h2 className="text-2xl font-bold text-white mb-2">SGCoin Help</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            Need help getting started with SGCoin? Choose an option below:
                        </p>

                        <div className="space-y-3">
                            {/* How to Get SGCoin */}
                            <button
                                onClick={() => handleNavigate('/tutorial/welcome')}
                                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition text-left"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Rocket className="w-5 h-5 text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-sm">How to Get SGCoin</h3>
                                    <p className="text-xs text-gray-400">Complete setup tutorial</p>
                                </div>
                            </button>

                            {/* Swap on QuickSwap */}
                            <a
                                href={QUICKSWAP_SWAP_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                    <ExternalLink className="w-5 h-5 text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-sm">Swap on QuickSwap</h3>
                                    <p className="text-xs text-gray-400">Trade for SGCoin now</p>
                                </div>
                            </a>

                            {/* Create MetaMask */}
                            <button
                                onClick={() => handleNavigate('/tutorial/metamask')}
                                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition text-left"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-orange-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-sm">Create MetaMask Wallet</h3>
                                    <p className="text-xs text-gray-400">Set up your crypto wallet</p>
                                </div>
                            </button>

                            {/* Contact Support */}
                            <a
                                href="mailto:support@sgcoalition.xyz"
                                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition"
                            >
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-sm">Contact Support</h3>
                                    <p className="text-xs text-gray-400">Email us for help</p>
                                </div>
                            </a>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/10">
                            <p className="text-xs text-gray-500 text-center">
                                💡 Save 10% on all purchases when you pay with SGCoin!
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingHelpButton;
