import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ChevronDown,
    HelpCircle,
    ShoppingBag,
    Star,
    CreditCard,
    Wallet,
    Package,
    Shield,
    MessageCircle
} from 'lucide-react';
import Seo from '../components/Seo';
import { HELP_FAQS, type HelpFaq } from '../data/helpFaqs';
import {
    buildFaqPageJsonLd,
    buildOrganizationJsonLd,
    buildWebPageJsonLd,
    structuredDataGraph
} from '../utils/structuredData';

// The FAQ copy lives in data/helpFaqs.ts so the prerendered FAQPage JSON-LD and
// this rendered accordion read the same answers. Icons are presentation only,
// keyed off the FAQ id so reordering the list can't shift the icons.
type FaqIcon = React.ComponentType<{ className?: string }>;

const FAQ_ICONS: Record<string, FaqIcon> = {
    orders: ShoppingBag,
    vip: Star,
    payments: CreditCard,
    sgcoin: Wallet,
    wallet: Package,
    shipping: Package,
    returns: Shield,
    tracking: MessageCircle,
    support: HelpCircle,
};

const FAQAccordion = ({ item, icon: Icon, isOpen, onClick }: { item: HelpFaq, icon: FaqIcon, isOpen: boolean, onClick: () => void }) => {

    return (
        <div className="border border-white/10 rounded-xl overflow-hidden mb-4 bg-[#0A0A0A] hover:border-white/20 transition-all duration-300">
            <button
                onClick={onClick}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <Icon className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="font-bold text-white tracking-wide">{item.question}</span>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                </motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <div className="px-6 pb-6 pt-0 text-gray-400 text-sm leading-relaxed border-t border-white/5 bg-white/[0.01]">
                            <div className="pt-4">
                                <p>{item.answer}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Title + description mirror the /help entry in STATIC_ROUTES
// (scripts/generateSeoArtifacts.mjs) so the prerendered head and the hydrated
// head agree.
const HELP_PAGE_TITLE = 'Coalition | Help Center';
const HELP_PAGE_DESCRIPTION =
    'Answers on orders, shipping, returns, membership and SGCOIN, plus AI-powered support from the Coalition team.';

const Help = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    // Memoized so the structured-data graph keeps one identity across renders —
    // <Seo> re-runs its head effect when the node identity changes.
    const jsonLd = useMemo(
        () =>
            structuredDataGraph([
                buildOrganizationJsonLd(),
                buildWebPageJsonLd({
                    path: '/help',
                    name: HELP_PAGE_TITLE,
                    description: HELP_PAGE_DESCRIPTION,
                }),
                buildFaqPageJsonLd('/help', HELP_FAQS),
            ]),
        []
    );

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500 selection:text-white pt-32 pb-24 relative overflow-hidden">
            <Seo
                title={HELP_PAGE_TITLE}
                description={HELP_PAGE_DESCRIPTION}
                canonicalPath="/help"
                jsonLd={jsonLd}
            />
            {/* Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-purple-900/10 blur-[120px] pointer-events-none" />

            <div className="max-w-3xl mx-auto px-6 relative z-10">
                {/* Header Section */}
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm"
                    >
                        <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200">HELP CENTER</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="font-display text-5xl md:text-6xl font-bold uppercase tracking-tight mb-6"
                    >
                        HOW CAN WE HELP?
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto"
                    >
                        Find answers to common questions about shopping, VIP membership, payments, and more.
                    </motion.p>
                </div>

                {/* FAQ List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {HELP_FAQS.map((faq, index) => (
                        <FAQAccordion
                            key={faq.id}
                            item={faq}
                            icon={FAQ_ICONS[faq.id] ?? HelpCircle}
                            isOpen={openIndex === index}
                            onClick={() => setOpenIndex(openIndex === index ? null : index)}
                        />
                    ))}
                </motion.div>

                {/* Bottom CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-20 p-10 rounded-2xl bg-gradient-to-br from-[#0F0A1F] to-[#0A0A0A] border border-purple-500/20 text-center relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 blur-[80px] group-hover:bg-purple-600/10 transition-colors duration-500" />

                    <h2 className="font-display text-3xl font-bold uppercase mb-4 relative z-10 tracking-wide">
                        STILL HAVE QUESTIONS?
                    </h2>
                    <p className="text-gray-400 text-sm mb-8 relative z-10">
                        Our team is here to help. Get in touch and we'll respond as soon as possible.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                        <a
                            href="mailto:sgctrustyourself@gmail.com"
                            className="w-full sm:w-auto px-8 py-3.5 bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95"
                        >
                            EMAIL SUPPORT
                        </a>
                        <a
                            href="https://discord.gg/coalition"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-8 py-3.5 border border-white/20 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            JOIN DISCORD
                        </a>
                    </div>
                </motion.div>
            </div>

            {/* Subtle Gradient Overlay */}
            <div className="fixed inset-0 bg-gradient-to-t from-black via-transparent to-transparent h-32 bottom-0 pointer-events-none" />
        </div>
    );
};

export default Help;
