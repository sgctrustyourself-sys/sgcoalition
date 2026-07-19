import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Wallet as WalletIcon, Scissors, Stamp, Package, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Seo from '../components/Seo';
import { PRODUCT_IDS } from '../constants/productIds';

const FEATURES = [
    {
        icon: Scissors,
        title: 'Hand-Cut & Hand-Stitched',
        description: 'Every wallet is cut by hand from a single hide and stitched on a saddle stitch \u2014 no machines, no factories.',
    },
    {
        icon: Stamp,
        title: 'Coalition-Branded Inks & Stamps',
        description: 'Hand-pressed branding using archival inks and steel dies. The mark lasts as long as the leather does.',
    },
    {
        icon: Package,
        title: 'Full-Grain Leather',
        description: 'Vegetable-tanned full-grain leather, sourced for patina. The more you carry it, the better it looks.',
    },
    {
        icon: Sparkles,
        title: 'One-of-One Builds',
        description: 'Most Coalition wallets are 1/1 drops. When a run is numbered (e.g. Grey Wave 1/2), the run is two or four and never repeats.',
    },
    {
        icon: WalletIcon,
        title: 'Six-Card Bifold or Long Wallet',
        description: 'Standard build: 6 card slots, hidden bill compartment, cash sleeve, and a slim profile that fits the front pocket.',
    },
    {
        icon: Check,
        title: 'Signed & Numbered',
        description: 'Each wallet is signed, numbered, and ships with a Coalition authenticity card.',
    },
];

const FEATURED_WALLET_ID = PRODUCT_IDS.FEATURED_WALLET;

const Wallets = () => {
    const { products } = useApp();

    // Memoize the wallet split so the filter+sort only runs when the catalog
    // changes (not on every parent re-render). Matches the Navbar pattern.
    const { featured, otherWallets } = useMemo(() => {
        const list = products || [];
        const featuredProduct = list.find((p) => p.id === FEATURED_WALLET_ID);
        const others = list
            .filter((p) => p.id !== FEATURED_WALLET_ID && (p.category === 'wallet' || /wallet/i.test(p.name)))
            .sort((a, b) => {
                if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
                return a.name.localeCompare(b.name);
            });
        return { featured: featuredProduct, otherWallets: others };
    }, [products]);

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 selection:bg-brand-accent/30">
            <Seo
                title="Premium Wallets"
                description="Hand-built, one-of-one, full-grain leather wallets. Made in-house, drop by drop \u2014 no factory, no shortcuts, just the process."
                canonicalPath="/wallets"
            />
            <div className="max-w-6xl mx-auto">
                {/* Back */}
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition text-xs font-bold uppercase tracking-widest"
                >
                    \u2190 Back to Home
                </Link>

                {/* Hero */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-20"
                >
                    <div className="inline-flex w-16 h-16 bg-gradient-to-br from-brand-accent to-purple-600 rounded-2xl items-center justify-center mb-6 shadow-lg shadow-brand-accent/20 rotate-3">
                        <WalletIcon className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-display text-5xl md:text-7xl font-black uppercase mb-6 tracking-tighter">
                        Coalition Wallets
                    </h1>
                    <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                        Hand-built, one-of-one, full-grain leather wallets. Made in-house, drop by drop \u2014 no factory,
                        no shortcuts, just the process.
                    </p>
                </motion.section>

                {/* Featured: Above as Below 1/1 */}
                {featured && (
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-24 bg-gradient-to-br from-gray-900/80 to-black border border-white/10 rounded-3xl overflow-hidden"
                    >
                        <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
                            <div className="aspect-square bg-black/50 rounded-2xl overflow-hidden border border-white/10">
                                {featured.images?.[0] && (
                                    <img
                                        src={featured.images[0]}
                                        alt={featured.name}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                            <div>
                                <span className="inline-block bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                                    Featured \u00b7 1/1
                                </span>
                                <h2 className="font-display text-3xl md:text-4xl font-black uppercase mb-4 tracking-tight">
                                    {featured.name}
                                </h2>
                                <p className="text-gray-400 mb-6 leading-relaxed">{featured.description}</p>
                                <div className="flex items-baseline gap-3 mb-8">
                                    <span className="text-4xl font-black font-mono text-white">\u0024{featured.price}</span>
                                    <span className="text-gray-500 text-xs uppercase tracking-widest">One of One</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Link
                                        to={`/product/${featured.id}`}
                                        className="bg-white text-black font-black uppercase py-4 px-8 rounded-xl hover:bg-gray-200 transition tracking-widest text-xs flex items-center justify-center gap-2"
                                    >
                                        View This Build <ArrowRight className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to="/inquire"
                                        className="bg-white/5 border border-white/20 text-white font-bold uppercase py-4 px-8 rounded-xl hover:bg-white/10 transition tracking-widest text-xs"
                                    >
                                        Request Custom Build
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* Feature List */}
                <section className="mb-24">
                    <div className="text-center mb-12">
                        <h2 className="font-display text-3xl md:text-5xl font-black uppercase mb-4 tracking-tight">
                            What&apos;s in every Coalition Wallet
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Six non-negotiables. Every build \u2014 past, present, and custom \u2014 holds to the same standard.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-brand-accent/30 transition group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center mb-4 group-hover:bg-brand-accent/20 transition">
                                    <f.icon className="w-6 h-6 text-brand-accent" />
                                </div>
                                <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2">
                                    {f.title}
                                </h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Other builds (live + archived) */}
                {otherWallets.length > 0 && (
                    <section className="mb-24">
                        <div className="flex items-end justify-between mb-8">
                            <div>
                                <h2 className="font-display text-3xl md:text-4xl font-black uppercase mb-2 tracking-tight">
                                    Past Builds
                                </h2>
                                <p className="text-gray-400 text-sm">Live drops first, then the sold archive.</p>
                            </div>
                            <Link
                                to="/shop?category=wallets"
                                className="hidden md:inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition"
                            >
                                Shop All Wallets <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {otherWallets.map((w) => (
                                <Link
                                    key={w.id}
                                    to={`/product/${w.id}`}
                                    className={`group relative bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden hover:border-white/30 transition text-left block ${w.archived ? 'opacity-60' : ''}`}
                                >
                                    <div className="aspect-square bg-black/50 overflow-hidden">
                                        {w.images?.[0] && (
                                            <img
                                                src={w.images[0]}
                                                alt={w.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                            />
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider truncate text-gray-200">
                                            {w.name}
                                        </h4>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs font-mono text-gray-400">
                                                {w.archived ? 'SOLD' : `$${w.price}`}
                                            </span>
                                            {w.archived && (
                                                <span className="text-[9px] bg-white/10 text-gray-500 px-2 py-0.5 rounded-sm font-bold uppercase">
                                                    Sold
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Custom Inquiry CTA */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-brand-accent/10 to-purple-600/10 border border-brand-accent/30 rounded-3xl p-8 md:p-12 text-center"
                >
                    <Sparkles className="w-10 h-10 text-brand-accent mx-auto mb-4" />
                    <h2 className="font-display text-3xl md:text-4xl font-black uppercase mb-4 tracking-tight">
                        Want a Custom Build?
                    </h2>
                    <p className="text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
                        Pick the leather, the thread, the hardware, the layout. Tell us what you want to carry \u2014 we&apos;ll
                        come back with feasibility, pricing, and a timeline within 24\u201348 hours.
                    </p>
                    <Link
                        to="/inquire"
                        className="inline-flex items-center gap-2 bg-white text-black font-black uppercase py-4 px-10 rounded-xl hover:bg-gray-200 transition tracking-widest text-xs"
                    >
                        Start a Custom Inquiry <ArrowRight className="w-4 h-4" />
                    </Link>
                </motion.section>
            </div>
        </div>
    );
};

export default Wallets;
