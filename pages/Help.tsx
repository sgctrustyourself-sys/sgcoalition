import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    HelpCircle,
    ShoppingBag,
    Star,
    CreditCard,
    Wallet,
    Package,
    Shield,
    MessageCircle,
    Mail,
    ExternalLink
} from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string | React.ReactNode;
    icon: any;
}

const FAQAccordion = ({ item, isOpen, onClick }: { item: FAQItem, isOpen: boolean, onClick: () => void }) => {
    const Icon = item.icon;

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
                                {typeof item.answer === 'string' ? <p>{item.answer}</p> : item.answer}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Help = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const faqs: FAQItem[] = [
        {
            icon: ShoppingBag,
            question: "How do I place an order?",
            answer: "Browse our shop, select your size, and click 'Add to Cart'. When ready, click the cart icon in the header and proceed to checkout. We accept card payments, crypto, and store credit."
        },
        {
            icon: Star,
            question: "What is Coalition VIP?",
            answer: "Coalition VIP is our premium membership that offers exclusive benefits including monthly store credit, free shipping, and early access to drops. You can manage your membership in your profile or the dedicated VIP page."
        },
        {
            icon: CreditCard,
            question: "What payment methods do you accept?",
            answer: "We accept all major credit cards, Apple Pay, Google Pay, and cryptocurrency via the Polygon network. Store credit can also be applied at checkout for VIP members."
        },
        {
            icon: Wallet,
            question: "What is SGCoin and how do I earn it?",
            answer: "SGCoin is our digital currency used within the Coalition ecosystem. You can earn it through purchases, participation in community events, and by holding select physical items with digital twins."
        },
        {
            icon: Package,
            question: "How do I link my crypto wallet? (Optional)",
            answer: "Visit your settings or the wallet connect modal in the header. We support MetaMask and other WalletConnect-compatible wallets. This is optional but unlocks Web3-exclusive perks."
        },
        {
            icon: Package,
            question: "What is your shipping policy?",
            answer: "We ship worldwide. US orders typically arrive in 3-5 business days. International shipping times vary by location. VIP members receive complimentary express shipping on all orders."
        },
        {
            icon: Shield,
            question: "What is your return policy?",
            answer: "Returns are accepted within 14 days of receipt for unused items in original packaging. Some limited releases may be final sale. Please check the product description for specific terms."
        },
        {
            icon: MessageCircle,
            question: "How can I track my order?",
            answer: "Once your order ships, you'll receive a confirmation email with a tracking link. You can also view your order history and status in your profile dashboard."
        },
        {
            icon: HelpCircle,
            question: "I have another question. How do I contact support?",
            answer: "Our support team is available 24/7. You can reach us via email at support@coalitionbrand.com or through our community Discord channel."
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500 selection:text-white pt-32 pb-24 relative overflow-hidden">
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
                    {faqs.map((faq, index) => (
                        <FAQAccordion
                            key={index}
                            item={faq}
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
                            href="mailto:support@coalitionbrand.com"
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
