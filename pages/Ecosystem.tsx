import React from 'react';
import { Link } from 'react-router-dom';

const Ecosystem = () => {
    return (
        <div className="bg-black min-h-screen text-white pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-display font-bold uppercase mb-4">
                        The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Ecosystem</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        A decentralized economy powered by SGCoin. Stake, earn, and unlock exclusive rewards.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-8 mb-8">
                        <h2 className="text-2xl font-bold mb-4">SGCoin Price</h2>
                        <p className="text-4xl font-mono text-brand-accent mb-2">$0.000045</p>
                        <p className="text-sm text-gray-400">Live on Polygon Network</p>
                    </div>

                    <div className="text-center">
                        <Link
                            to="/buy-sgcoin"
                            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white font-display font-bold text-xl uppercase tracking-widest py-5 px-12 rounded-full hover:scale-105 transition-transform"
                        >
                            Buy SGCoin
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Ecosystem;
