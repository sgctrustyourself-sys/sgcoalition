import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Zap, ExternalLink } from 'lucide-react';
import { useTutorial } from '../../context/TutorialContext';
import { QUICKSWAP_SWAP_URL } from '../../constants';

const Welcome: React.FC = () => {
    const navigate = useNavigate();
    const { goToStep } = useTutorial();

    const handleStart = () => {
        goToStep(1);
        navigate('/tutorial/metamask');
    };

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-black">
            <div className="max-w-4xl mx-auto">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 mb-6">
                        <Rocket className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="font-display text-5xl font-bold uppercase mb-4 text-white">
                        Welcome to SGCoin Setup
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        This guide will walk you through creating a MetaMask wallet, funding it, and swapping for SGCoin/GMONEY.
                    </p>
                </div>

                {/* Benefits */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                            <Zap className="w-6 h-6 text-green-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Save 10%</h3>
                        <p className="text-gray-400 text-sm">
                            Get an automatic 10% discount when paying with SGCoin or GMONEY at checkout.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                            <Rocket className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Instant Payments</h3>
                        <p className="text-gray-400 text-sm">
                            Blockchain payments are fast, secure, and confirmed instantly.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                            <ExternalLink className="w-6 h-6 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Full Control</h3>
                        <p className="text-gray-400 text-sm">
                            Your wallet, your keys, your crypto. Complete ownership and control.
                        </p>
                    </div>
                </div>

                {/* What You'll Learn */}
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-8 mb-12 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold text-white mb-6">What You'll Learn</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                1
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Install MetaMask</h4>
                                <p className="text-sm text-gray-400">Set up your crypto wallet</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                2
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Switch to Polygon</h4>
                                <p className="text-sm text-gray-400">Connect to the right network</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                3
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Fund Your Wallet</h4>
                                <p className="text-sm text-gray-400">Add MATIC or USDC</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                4
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Swap on QuickSwap</h4>
                                <p className="text-sm text-gray-400">Exchange for SGCoin/GMONEY</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                5
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Use at Checkout</h4>
                                <p className="text-sm text-gray-400">Pay and save 10%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={handleStart}
                        className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-bold text-lg shadow-[0_0_30px_rgba(34,197,94,0.4)]"
                    >
                        Start Tutorial
                    </button>
                    <a
                        href={QUICKSWAP_SWAP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-8 py-4 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition font-bold text-lg flex items-center justify-center gap-2"
                    >
                        Skip to QuickSwap
                        <ExternalLink className="w-5 h-5" />
                    </a>
                </div>

                {/* Estimated Time */}
                <p className="text-center text-gray-400 mt-8">
                    ⏱️ Estimated time: 10-15 minutes
                </p>
            </div>
        </div>
    );
};

export default Welcome;
