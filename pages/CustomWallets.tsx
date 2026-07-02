import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import DropLeadCapture from '../components/DropLeadCapture';
import Seo from '../components/Seo';
import { useApp } from '../context/AppContext';
import { absoluteUrl, buildItemListJsonLd } from '../utils/seo';

const HERO_IMAGE = 'https://i.imgur.com/9NF3LzM.jpg';

const faqs = [
    {
        question: 'Are Coalition custom wallets one of one?',
        answer: 'Most Coalition custom wallets are built as one-of-one pieces. When a wallet is marked 1/1, that exact build, layout, and finish will not be restocked.',
    },
    {
        question: 'Can I request a wallet similar to a sold piece?',
        answer: 'Yes. Archive pieces can be used as direction for a new custom request, but the next build will have its own finish and details.',
    },
    {
        question: 'How do I start a custom wallet order?',
        answer: 'Send a custom inquiry with your color direction, references, budget, and timeline. Coalition will review it and respond with feasibility and next steps.',
    },
];

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
        },
    })),
};

const CustomWallets = () => {
    const { products } = useApp();
    const walletProducts = React.useMemo(
        () => products
            .filter(product => product.category === 'wallet' || product.name.toLowerCase().includes('wallet'))
            .sort((a, b) => {
                const aUnavailable = a.archived || a.soldAt || Object.values(a.sizeInventory || {}).every(count => Number(count || 0) <= 0);
                const bUnavailable = b.archived || b.soldAt || Object.values(b.sizeInventory || {}).every(count => Number(count || 0) <= 0);
                if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1;
                return Date.parse(b.createdAt || b.releasedAt || '') - Date.parse(a.createdAt || a.releasedAt || '');
            }),
        [products]
    );
    const visibleWallets = walletProducts.slice(0, 6);
    const jsonLd = React.useMemo(
        () => [
            buildItemListJsonLd(walletProducts, 'Coalition Custom Wallets', '/custom-wallets'),
            faqJsonLd,
        ],
        [walletProducts]
    );

    return (
        <>
            <Seo
                title="Custom Wallets"
                description="Shop and request Coalition custom wallets: handmade one-of-one wallet builds, process videos, archive pieces, and Baltimore streetwear accessories."
                image={absoluteUrl(HERO_IMAGE)}
                canonicalPath="/custom-wallets"
                jsonLd={jsonLd}
            />
            <div className="min-h-screen bg-black text-white">
                <section className="relative min-h-[76vh] overflow-hidden">
                    <div className="absolute inset-0">
                        <img
                            src={HERO_IMAGE}
                            alt="Coalition Above as Below custom wallet"
                            className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/25" />
                        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />
                    </div>

                    <div className="relative z-10 flex min-h-[76vh] items-center px-4 py-28">
                        <div className="mx-auto w-full max-w-7xl">
                            <div className="max-w-2xl">
                                <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-brand-accent">
                                    Handmade in Baltimore
                                </p>
                                <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight text-white md:text-7xl">
                                    Custom Coalition Wallets
                                </h1>
                                <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-300">
                                    One-of-one wallet builds, hand-finished details, and process-led releases from the Coalition workshop.
                                </p>
                                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                    <Link
                                        to="/shop?category=wallets"
                                        className="inline-flex items-center justify-center gap-2 bg-white px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-brand-accent hover:text-white"
                                    >
                                        Shop Wallets
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                    <Link
                                        to="/inquire"
                                        className="inline-flex items-center justify-center border border-white/20 px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
                                    >
                                        Request Custom
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-y border-white/10 bg-white/[0.02] px-4 py-14">
                    <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
                        {[
                            {
                                icon: Scissors,
                                title: 'Cut and built by hand',
                                copy: 'Each custom starts with a real process, not factory blanks passed off as rare.',
                            },
                            {
                                icon: ShieldCheck,
                                title: 'Archive-backed direction',
                                copy: 'Sold pieces stay visible so new customs can reference the lineage without duplicating the exact build.',
                            },
                            {
                                icon: Sparkles,
                                title: 'One drop at a time',
                                copy: 'Available wallets move through the shop as finished pieces, then become part of the archive.',
                            },
                        ].map(item => {
                            const Icon = item.icon;
                            return (
                                <div key={item.title} className="border border-white/10 bg-black/40 p-6">
                                    <Icon className="mb-5 h-6 w-6 text-brand-accent" />
                                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">{item.title}</h2>
                                    <p className="mt-3 text-sm leading-relaxed text-gray-400">{item.copy}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-4 py-20">
                    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-accent">Wallet Drops</p>
                            <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-white md:text-5xl">
                                Current and Archive Builds
                            </h2>
                        </div>
                        <Link to="/shop?category=wallets" className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 transition hover:text-white">
                            View all wallets
                        </Link>
                    </div>

                    {visibleWallets.length > 0 ? (
                        <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleWallets.map((product, index) => (
                                <ProductCard key={product.id} product={product} priority={index === 0} />
                            ))}
                        </div>
                    ) : (
                        <div className="border border-white/10 bg-white/[0.03] p-8 text-sm text-gray-400">
                            Wallets are loading.
                        </div>
                    )}
                </section>

                <section className="border-y border-white/10 bg-white/[0.02] px-4 py-20">
                    <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-accent">Custom Requests</p>
                            <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-white">
                                Start with a direction, not a template
                            </h2>
                            <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-400">
                                Send the color direction, reference pieces, budget range, and timeline. Wallet requests can reference archive pieces, but every accepted build gets its own finish.
                            </p>
                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <Link
                                    to="/inquire"
                                    className="inline-flex items-center justify-center gap-2 bg-white px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-brand-accent hover:text-white"
                                >
                                    Open Inquiry
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    to="/archive"
                                    className="inline-flex items-center justify-center border border-white/20 px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
                                >
                                    Browse Archive
                                </Link>
                            </div>
                        </div>
                        <DropLeadCapture
                            source="custom_wallets"
                            heading="Get the next wallet drop first"
                            subheading="Wallets are low-quantity by design. Join before the next build lands."
                        />
                    </div>
                </section>

                <section className="mx-auto max-w-5xl px-4 py-20">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-accent">FAQ</p>
                    <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-white">
                        Custom Wallet Questions
                    </h2>
                    <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
                        {faqs.map(item => (
                            <div key={item.question} className="py-6">
                                <div className="flex gap-3">
                                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand-accent" />
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white">{item.question}</h3>
                                        <p className="mt-3 text-sm leading-relaxed text-gray-400">{item.answer}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
};

export default CustomWallets;
