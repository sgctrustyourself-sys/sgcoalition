import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Star, ArrowRight, ShieldCheck, Zap, Scissors, Eye, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Local branded hero imagery
const heroImg = "/story-hero.png";

const SGCoalitionPortal = () => {
    const { user } = useApp();

    return (
        <div className="bg-[#050505] text-white min-h-screen font-sans selection:bg-orange-500/30 overflow-x-hidden">

            {/* Ambient Cyber-Luxe Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-500/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/5 blur-[120px] rounded-full animate-pulse delay-[2000ms]" />
                <div className="absolute inset-0 bg-[url('/images/patterns/carbon-fibre.svg')] bg-repeat opacity-[0.05] mix-blend-overlay" />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-[60] border-b border-white/5 backdrop-blur-xl bg-black/40">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-display font-black tracking-tighter text-2xl uppercase">SGCoalition</span>
                    </Link>
                    <div className="flex items-center gap-10 text-[10px] uppercase tracking-[0.4em] font-bold">
                        <Link to="/sgminiwizards" className="text-gray-400 hover:text-purple-400 transition-colors">Wizards</Link>
                        <Link to="/migrate" className="text-orange-500 hover:text-orange-400 transition-colors flex items-center gap-2">
                            <span className="relative">
                                Migration
                                <span className="absolute -top-1 -right-4 w-1 h-1 bg-orange-500 rounded-full animate-ping" />
                            </span>
                        </Link>
                        <a href="https://shop.sgcoalition.xyz" className="bg-white text-black px-6 py-2.5 rounded-full hover:bg-orange-500 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg font-black tracking-widest">Shop Drops</a>
                    </div>
                </div>
            </nav>

            <main className="pt-32 relative z-10">

                {/* Hero Section: The Refined Collision */}
                <section className="px-6 mb-40">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/5 text-orange-500 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold"
                            >
                                <Sparkles className="w-3 h-3" /> Digital-Physical Synthesis
                            </motion.div>
                            <h1 className="text-8xl md:text-[10rem] font-black uppercase tracking-[calc(-0.05em)] mb-8 leading-[0.75] font-display">
                                Luxe<br />
                                <span className="bg-gradient-to-r from-orange-500 to-purple-600 bg-clip-text text-transparent italic">Evolve</span>
                            </h1>
                            <p className="text-xl md:text-2xl text-gray-400 font-light max-w-lg mb-12 leading-relaxed">
                                Bridging the gap between <span className="text-white font-medium">high-end fashion</span> and <span className="text-white font-medium">on-chain equity</span>.
                            </p>
                            <div className="flex flex-wrap gap-6">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-xs flex items-center gap-3 rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.1)] transition-shadow hover:shadow-[0_15px_40px_rgba(255,255,255,0.2)]"
                                >
                                    View Lookbook <Eye className="w-4 h-4" />
                                </motion.button>
                                <Link to="/migrate">
                                    <motion.button
                                        whileHover={{ scale: 1.02, borderColor: 'rgba(249,115,22,0.5)' }}
                                        whileTap={{ scale: 0.98 }}
                                        className="px-10 py-5 border border-white/10 text-white font-black uppercase tracking-widest text-xs flex items-center gap-3 backdrop-blur-md rounded-full bg-white/5 transition-all"
                                    >
                                        SGC Migration <Zap className="w-4 h-4 text-orange-500" />
                                    </motion.button>
                                </Link>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-purple-600/10 blur-[120px] rounded-full" />
                            <div className="relative z-10 p-2 border border-white/10 rounded-3xl backdrop-blur-sm bg-white/5 shadow-2xl overflow-hidden group">
                                <img
                                    src={heroImg}
                                    alt="Cyber-Luxe Fashion"
                                    className="w-full h-[650px] object-cover rounded-2xl group-hover:scale-105 transition-transform duration-1000"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute bottom-8 left-8 right-8 transform translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                                    <div className="bg-black/80 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex justify-between items-center">
                                        <div>
                                            <span className="text-[10px] text-orange-500 uppercase tracking-widest block mb-1 font-bold">New Arrival</span>
                                            <div className="text-xl font-black uppercase tracking-tight">V2 Genesis Hoodie</div>
                                        </div>
                                        <div className="text-orange-500">
                                            <ArrowRight className="w-6 h-6" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* SGC Utility Layer: Glass-morphic Infrastructure */}
                <section className="py-32 px-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-12 mb-24 text-center md:text-left">
                            <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85] font-display">
                                Utility<br />
                                <span className="text-gray-600">Infrastructure</span>
                            </h2>
                            <div className="md:text-right">
                                <div className="inline-block px-4 py-2 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm mb-4">
                                    <span className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">5% MATIC Action Fee</span>
                                </div>
                                <p className="text-gray-400 max-w-sm md:ml-auto text-lg font-light">
                                    No entry tax. No hidden costs. Pure fuel for the <span className="text-white">Coalition ecosystem</span>.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                {
                                    title: "Merch Burn",
                                    desc: "Convert $SGCOIN directly into limited edition drops and physical assets.",
                                    icon: <ShoppingBag className="w-8 h-8 text-orange-500" />
                                },
                                {
                                    title: "Royal Tiers",
                                    desc: "Genesis and Supporter tiers unlock exclusive digital-to-wardrobe access.",
                                    icon: <Star className="w-8 h-8 text-purple-500" />
                                },
                                {
                                    title: "Brand Equity",
                                    desc: "Leveraged by the inventory and hardware value of Baltimore manufacturing.",
                                    icon: <ShieldCheck className="w-8 h-8 text-blue-500" />
                                }
                            ].map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ y: -10 }}
                                    className="p-12 rounded-[2rem] border border-white/5 bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.05] transition-all duration-500 group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="mb-8 p-4 rounded-2xl bg-black/40 w-fit border border-white/5 group-hover:border-white/20 transition-colors">
                                        {item.icon}
                                    </div>
                                    <h3 className="text-3xl font-black uppercase tracking-tight mb-4 font-display">{item.title}</h3>
                                    <p className="text-gray-400 text-lg leading-relaxed group-hover:text-gray-200 transition-colors">{item.desc}</p>
                                    <div className="mt-12 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-500 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                                        Activate <ArrowRight className="w-4 h-4" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* The Manufacturing Loop */}
                <section className="py-40 px-6 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] bg-gradient-to-r from-orange-500/5 to-purple-600/5 blur-[120px] rounded-full pointer-events-none" />
                    <div className="max-w-5xl mx-auto rounded-[3rem] border border-white/10 p-16 md:p-32 relative overflow-hidden bg-white/[0.02] backdrop-blur-md text-center">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.05]">
                            <Scissors className="w-64 h-64" />
                        </div>
                        <div className="relative z-10">
                            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-10 font-display italic">
                                Built for the <span className="text-orange-500">Coalition</span>
                            </h2>
                            <p className="text-gray-400 text-xl leading-relaxed mb-16 max-w-3xl mx-auto font-light">
                                "We are bridging the gap between digital scarcity and physical reality. SGCoalition isn't just a project—it's a manufacturing loop where your tokens have tangible weight."
                            </p>
                            <div className="flex flex-col items-center gap-8">
                                <a href="https://shop.sgcoalition.xyz/transparency" className="group flex items-center gap-3 text-sm font-bold uppercase tracking-[0.4em] text-white hover:text-orange-500 transition-all">
                                    <span className="border-b border-white/20 group-hover:border-orange-500 pb-2">Audit Transparency</span>
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            <footer className="py-32 px-6 border-t border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
                    <div>
                        <div className="font-display font-black text-4xl uppercase mb-4 tracking-tighter">SGCoalition</div>
                        <p className="text-gray-500 text-sm tracking-[0.2em] uppercase font-bold">Bridging Worlds. Defining Fragments.</p>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-end gap-12 text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500">
                        <Link to="/about" className="hover:text-white transition-colors">Our Story</Link>
                        <Link to="/shop" className="hover:text-white transition-colors">Archive</Link>
                        <a href="#" className="hover:text-white transition-colors border-t border-orange-500/50 pt-2">V2 Mainnet</a>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-20 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between gap-8 text-[9px] uppercase tracking-widest text-gray-700 font-bold">
                    <span>© 2026 SGCoalition | Crafted in Baltimore</span>
                    <div className="flex gap-8">
                        <a href="#">Security</a>
                        <a href="#">Governance</a>
                        <a href="#">Terms</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default SGCoalitionPortal;
