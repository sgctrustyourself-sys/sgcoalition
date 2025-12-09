import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, HelpCircle, Wallet, CreditCard, Star, Package, Shield } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string | JSX.Element;
    icon: any;
}

const Help = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    const faqs: FAQItem[] = [
        {
            icon: Package,
            question: "How do I place an order?",
            answer: "Browse our shop, select your size, and click 'Add to Cart'. When ready, click the cart icon in the header and proceed to checkout. We accept card payments, crypto, and store credit."
        },
        {
            icon: Star,
            question: "What is Coalition VIP?",
            answer: (
                <>
                    <p className="mb-3">Coalition VIP is our premium membership ($15/month) with incredible benefits:</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li><strong>$15 Monthly Store Credit</strong> - The membership pays for itself!</li>
                        <li><strong>Free Shipping</strong> on all orders</li>
                        <li><strong>Build Credit</strong> - Works with credit-building cards like Ava</li>
                        <li><strong>VIP Badge</strong> on your profile</li>
                    </ul>
                    <Link to="/membership" className="inline-block mt-4 text-purple-400 hover:text-purple-300 font-bold underline">
                        Learn more about VIP →
                    </Link>
                </>
            )
        },
        {
            icon: CreditCard,
            question: "What payment methods do you accept?",
            answer: (
                <>
                    <p className="mb-3">We accept multiple payment options:</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li><strong>Credit/Debit Cards</strong> via Stripe (most common)</li>
                        <li><strong>Cryptocurrency</strong> (MATIC on Polygon network)</li>
                        <li><strong>Store Credit</strong> (VIP members get $15/month)</li>
                    </ul>
                </>
            )
        },
        {
            icon: Wallet,
            question: "What is SGCoin and how do I earn it?",
            answer: (
                <>
                    <p className="mb-3">SGCoin is our loyalty reward token on the Polygon blockchain. You earn SGCoin automatically on every purchase:</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>Earn <strong>1 SGCoin per $1 spent</strong></li>
                        <li>SGCoin balance shows in your profile</li>
                        <li>Use SGCoin for exclusive perks and future rewards</li>
                    </ul>
                    <p className="mt-3 text-gray-400 text-sm">
                        <strong>💡 Pro tip:</strong> Linking a crypto wallet is optional. You can shop and earn SGCoin without one!
                    </p>
                </>
            )
        },
        {
            icon: Wallet,
            question: "How do I link my crypto wallet? (Optional)",
            answer: (
                <>
                    <p className="mb-3">Linking a wallet lets you view your SGCoin balance on-chain and enables crypto payments:</p>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>Go to your <Link to="/profile" className="text-purple-400 hover:text-purple-300 underline">Profile page</Link></li>
                        <li>Click the "Wallet & SGCoin" tab</li>
                        <li>Click "Link Wallet" and connect MetaMask</li>
                        <li>Make sure you're on the <strong>Polygon Network</strong></li>
                    </ol>
                    <p className="mt-3 text-gray-400 text-sm">
                        <strong>Note:</strong> This is completely optional! You don't need a wallet to shop.
                    </p>
                </>
            )
        },
        {
            icon: Package,
            question: "What is your shipping policy?",
            answer: (
                <>
                    <p className="mb-3">Shipping details:</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li><strong>VIP Members:</strong> FREE standard shipping on all orders</li>
                        <li><strong>Standard Shipping:</strong> $5.99 (5-7 business days)</li>
                        <li><strong>Express Shipping:</strong> $12.99 (2-3 business days)</li>
                        <li><strong>Free Shipping:</strong> Orders over $200</li>
                    </ul>
                    <p className="mt-3">We ship to all US addresses. International shipping coming soon!</p>
                </>
            )
        },
        {
            icon: Shield,
            question: "What is your return policy?",
            answer: "We accept returns within 30 days of delivery for unworn, unwashed items with original tags. Email support@coalitionbrand.com to initiate a return. Note: Items marked as 'Final Sale' or purchased with full store credit are not eligible for return."
        },
        {
            icon: HelpCircle,
            question: "How can I track my order?",
            answer: (
                <>
                    <p className="mb-2">After your order ships, you'll receive a tracking number via email.</p>
                    <p>You can also view all your orders in your <Link to="/profile" className="text-purple-400 hover:text-purple-300 underline">Profile page</Link> under the "Orders" tab.</p>
                </>
            )
        },
        {
            icon: HelpCircle,
            question: "I have another question. How do I contact support?",
            answer: (
                <>
                    <p className="mb-3">We're here to help! Reach us at:</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>Email: <a href="mailto:support@coalitionbrand.com" className="text-purple-400 hover:text-purple-300 underline">support@coalitionbrand.com</a></li>
                        <li>Join our <a href="https://discord.gg/bByqsC5f5V" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Discord community</a></li>
                    </ul>
                </>
            )
        }
    ];

    return (
        <div className="min-h-screen pt-20 pb-20 bg-black text-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
                        <HelpCircle className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-200">Help Center</span>
                    </div>

                    <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4">
                        How Can We Help?
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Find answers to common questions about shopping, VIP membership, payments, and more.
                    </p>
                </div>

                {/* FAQ Accordion */}
                <div className="space-y-4">
                    {faqs.map((faq, index) => {
                        const Icon = faq.icon;
                        const isOpen = openIndex === index;

                        return (
                            <div
                                key={index}
                                className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-purple-500/30 transition-colors"
                            >
                                <button
                                    onClick={() => toggleFAQ(index)}
                                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="bg-purple-500/20 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <span className="font-bold text-white text-lg">{faq.question}</span>
                                    </div>
                                    {isOpen ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    )}
                                </button>

                                {isOpen && (
                                    <div className="px-6 pb-6 pt-2 text-gray-300 leading-relaxed border-t border-white/5">
                                        {typeof faq.answer === 'string' ? (
                                            <p>{faq.answer}</p>
                                        ) : (
                                            faq.answer
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* CTA Section */}
                <div className="mt-16 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-8 text-center">
                    <h3 className="font-display text-2xl font-bold uppercase mb-4">Still Have Questions?</h3>
                    <p className="text-gray-400 mb-6">
                        Our team is here to help. Get in touch and we'll respond as soon as possible.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="mailto:support@coalitionbrand.com"
                            className="px-8 py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-gray-200 transition-all"
                        >
                            Email Support
                        </a>
                        <a
                            href="https://discord.gg/bByqsC5f5V"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-3 border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
                        >
                            Join Discord
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Help;
