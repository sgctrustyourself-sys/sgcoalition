import React from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Section } from '../types';
import ProductCard from '../components/ProductCard';
import SmsSignup from '../components/SmsSignup';

const Home = () => {
    const { sections, products, isAdminMode, updateSections, updateSection, isLoading } = useApp();

    const moveSection = (index: number, direction: 'up' | 'down') => {
        const newSections = [...sections];
        if (direction === 'up' && index > 0) {
            [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
        } else if (direction === 'down' && index < newSections.length - 1) {
            [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
        }
        updateSections(newSections);
    };

    const renderSection = (section: Section, index: number) => {
        if (!section.isVisible && !isAdminMode) return null;

        let content = null;
        const isFirst = index === 0;
        const isLast = index === sections.length - 1;

        switch (section.type) {
            case 'hero':
                content = (
                    <div className="relative h-[85vh] w-full flex items-center justify-center bg-black text-white overflow-hidden">
                        {/* Hero Video/Image */}
                        <div className="absolute inset-0 bg-[url('/hero-cinematic.png')] bg-cover bg-center opacity-60"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50"></div>

                        <div className="relative z-10 text-center px-4 max-w-4xl">
                            <h1 className="font-display text-6xl md:text-8xl font-bold uppercase tracking-tighter mb-6 text-glow">
                                {section.title}
                            </h1>
                            <p className="text-lg md:text-2xl text-gray-300 font-light mb-10 tracking-wide max-w-2xl mx-auto">
                                {section.content}
                            </p>
                            <Link to="/shop" className="inline-block bg-white text-black px-10 py-4 text-sm font-bold uppercase tracking-[0.2em] hover:bg-gray-200 hover:scale-105 transition-all duration-300 box-glow">
                                Shop Collection
                            </Link>
                        </div>
                    </div>
                );
                break;
            case 'vip':
                content = (
                    <section className="py-20 px-4 bg-gradient-to-b from-black via-purple-900/10 to-black relative overflow-hidden">
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>

                        <div className="max-w-6xl mx-auto relative z-10">
                            <div className="text-center mb-12">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-4">
                                    <span className="text-xs font-bold uppercase tracking-widest text-purple-300">EXCLUSIVE MEMBERSHIP</span>
                                </div>
                                <h2 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4">
                                    Coalition <span className="text-purple-400">VIP</span>
                                </h2>
                                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                                    The membership that pays for itself. Build credit while you shop.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6 mb-12">
                                {/* Benefit 1 */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-colors group">
                                    <div className="bg-purple-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="font-display text-xl font-bold uppercase mb-2 text-white">$15 Monthly Credit</h3>
                                    <p className="text-gray-400 text-sm">
                                        Get $15 store credit added to your account every month. The membership effectively costs you nothing.
                                    </p>
                                </div>

                                {/* Benefit 2 */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-blue-500/30 transition-colors group">
                                    <div className="bg-blue-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <h3 className="font-display text-xl font-bold uppercase mb-2 text-white">Free Shipping</h3>
                                    <p className="text-gray-400 text-sm">
                                        Enjoy free standard shipping on every single order. No minimums, no exceptions.
                                    </p>
                                </div>

                                {/* Benefit 3 */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-green-500/30 transition-colors group">
                                    <div className="bg-green-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="font-display text-xl font-bold uppercase mb-2 text-white">Build Credit</h3>
                                    <p className="text-gray-400 text-sm">
                                        Works with credit-building cards like Ava. Recurring payments help boost your credit score.
                                    </p>
                                </div>
                            </div>

                            <div className="text-center">
                                <Link
                                    to="/membership"
                                    className="inline-block px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-purple-900/40"
                                >
                                    Join for $15/Month
                                </Link>
                                <p className="mt-4 text-xs text-gray-500">Cancel anytime. No hidden fees.</p>
                            </div>
                        </div>
                    </section>
                );
                break;
            case 'featured':
                if (isLoading && (!products || products.length === 0)) {
                    content = (
                        <section className="py-24 px-4 max-w-7xl mx-auto">
                            <div className="grid md:grid-cols-2 gap-16 items-center animate-pulse">
                                <div className="order-2 md:order-1 space-y-6">
                                    <div className="h-4 bg-gray-800/50 rounded w-1/4"></div>
                                    <div className="h-12 bg-gray-800/50 rounded w-3/4"></div>
                                    <div className="h-24 bg-gray-800/50 rounded w-full"></div>
                                    <div className="flex gap-8">
                                        <div className="h-8 bg-gray-800/50 rounded w-20"></div>
                                        <div className="h-12 bg-gray-800/50 rounded w-40"></div>
                                    </div>
                                </div>
                                <div className="order-1 md:order-2 bg-gray-800/50 aspect-square rounded-lg"></div>
                            </div>
                        </section>
                    );
                    break;
                }

                const featured = products && products.length > 0
                    ? (products.find(p => p.isFeatured) || products[0])
                    : null;

                if (!featured) {
                    content = (
                        <section className="py-24 px-4 max-w-7xl mx-auto">
                            <div className="text-center text-gray-600">
                                <p>No featured products available</p>
                            </div>
                        </section>
                    );
                    break;
                }

                content = (
                    <section className="py-24 px-4 max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div className="order-2 md:order-1">
                                <span className="text-brand-accent font-bold tracking-[0.2em] text-xs uppercase mb-4 block animate-pulse">{section.title}</span>
                                <h2 className="font-display text-5xl font-bold mb-6 text-white uppercase tracking-wide">{featured.name}</h2>
                                <p className="text-gray-400 mb-8 leading-relaxed text-lg font-light">
                                    {featured.description}
                                </p>
                                <div className="flex items-center gap-8">
                                    <span className="text-3xl font-bold text-white font-mono">${featured.price}</span>
                                    <Link to={`/product/${featured.id}`} className="bg-white text-black px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors">
                                        View Product
                                    </Link>
                                </div>
                            </div>
                            <div className="order-1 md:order-2 bg-gray-900 aspect-square relative overflow-hidden border border-white/5 group">
                                <img src={featured.images[0]} alt={featured.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
                            </div>
                        </div>
                    </section>
                );
                break;
            case 'custom_inquiry_cta':
                content = (
                    <section className="py-20 px-4 max-w-7xl mx-auto">
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 border border-purple-500/20">
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]"></div>
                            </div>
                            <div className="relative z-10 grid md:grid-cols-2 gap-12 p-12 md:p-16 items-center">
                                <div className="space-y-6">
                                    <div className="inline-block">
                                        <span className="bg-purple-500/20 text-purple-300 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border border-purple-500/30">
                                            Custom Designs
                                        </span>
                                    </div>
                                    <h2 className="font-display text-4xl md:text-5xl font-bold uppercase text-white leading-tight">
                                        Bring Your Vision to Life
                                    </h2>
                                    <p className="text-gray-300 text-lg leading-relaxed">
                                        Have a unique design in mind? We create custom apparel and 3D printed products tailored to your exact specifications.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                        <Link
                                            to="/custom-inquiry"
                                            className="inline-flex items-center justify-center bg-white text-black px-8 py-4 rounded-lg font-bold uppercase tracking-wider hover:bg-gray-200 transition-all hover:scale-105 shadow-lg"
                                        >
                                            Request Custom Design
                                        </Link>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-purple-500/20 p-3 rounded-lg">
                                                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white mb-2">Custom Apparel</h3>
                                                <p className="text-gray-400 text-sm">Unique pants, shirts, and jackets designed exactly how you want them.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-blue-500/30 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-blue-500/20 p-3 rounded-lg">
                                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white mb-2">3D Printed Products</h3>
                                                <p className="text-gray-400 text-sm">Custom 3D designs and prototypes brought to reality.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-green-500/30 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-green-500/20 p-3 rounded-lg">
                                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white mb-2">Expert Craftsmanship</h3>
                                                <p className="text-gray-400 text-sm">Quality materials and attention to detail in every piece.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                );
                break;
            case 'grid':
                content = (
                    <section className="py-24 px-4 max-w-7xl mx-auto border-t border-white/5">
                        <div className="flex justify-between items-end mb-12">
                            <h2 className="font-display text-4xl font-bold uppercase text-white tracking-wide">{section.title}</h2>
                            <Link to="/shop" className="text-sm font-bold text-gray-400 hover:text-white border-b border-gray-700 hover:border-white pb-1 transition-all uppercase tracking-widest">View All</Link>
                        </div>
                        {isLoading && (!products || products.length === 0) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="bg-gray-800/50 aspect-[3/4] rounded-lg mb-4"></div>
                                        <div className="h-4 bg-gray-800/50 rounded w-3/4 mb-2"></div>
                                        <div className="h-4 bg-gray-800/50 rounded w-1/4"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                                {products.slice(0, 6).map(p => <ProductCard key={p.id} product={p} />)}
                            </div>
                        )}
                    </section>
                );
                break;
            case 'about_teaser':
                content = (
                    <section className="relative py-32 px-4 text-center overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-20 fixed-bg"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black"></div>

                        <div className="relative z-10 max-w-3xl mx-auto">
                            <h2 className="font-display text-4xl md:text-5xl font-bold uppercase mb-8 text-white tracking-wider">{section.title}</h2>
                            <p className="text-gray-400 mb-10 leading-relaxed text-xl font-light">
                                {section.content}
                            </p>
                            <Link to="/about" className="inline-block border border-white/30 text-white px-10 py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-black hover:border-white transition-all duration-300">
                                Read Our Story
                            </Link>
                        </div>
                    </section>
                );
                break;
        }

        return (
            <div key={section.id} className={`relative group ${!section.isVisible ? 'opacity-50 grayscale' : ''}`}>
                {isAdminMode && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-50">
                        <div className="bg-white/95 backdrop-blur shadow-xl border border-gray-200 rounded-lg p-3 flex items-center gap-4">
                            <div className="p-2 bg-gray-100 rounded cursor-move text-gray-400"><GripVertical className="w-4 h-4" /></div>

                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold uppercase text-gray-400 mb-1" htmlFor={`section-title-${section.id}`}>Section Title</label>
                                    <input
                                        id={`section-title-${section.id}`}
                                        value={section.title}
                                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                        className="font-bold text-sm bg-transparent border-b border-gray-200 focus:border-black outline-none transition-colors py-1"
                                        placeholder="Enter section title"
                                    />
                                </div>
                                {(section.type === 'hero' || section.type === 'about_teaser') && (
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold uppercase text-gray-400 mb-1" htmlFor={`section-content-${section.id}`}>Content Text</label>
                                        <input
                                            id={`section-content-${section.id}`}
                                            value={section.content || ''}
                                            onChange={(e) => updateSection(section.id, { content: e.target.value })}
                                            className="text-xs text-gray-600 bg-transparent border-b border-gray-200 focus:border-black outline-none transition-colors truncate focus:text-clip py-1"
                                            placeholder="Enter section content"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pl-4 border-l border-gray-100">
                                <button
                                    onClick={() => updateSection(section.id, { isVisible: !section.isVisible })}
                                    className={`p-2 rounded hover:bg-gray-100 ${!section.isVisible ? 'bg-red-50 text-red-500' : 'text-gray-600'}`}
                                    title={section.isVisible ? "Hide Section" : "Show Section"}
                                    aria-label={section.isVisible ? "Hide Section" : "Show Section"}
                                >
                                    {section.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>

                                <div className="flex flex-col gap-1">
                                    <button onClick={() => moveSection(index, 'up')} disabled={isFirst} className="p-1 hover:bg-gray-100 rounded disabled:opacity-25" title="Move Up" aria-label="Move Up"><ChevronUp className="w-3 h-3" /></button>
                                    <button onClick={() => moveSection(index, 'down')} disabled={isLast} className="p-1 hover:bg-gray-100 rounded disabled:opacity-25" title="Move Down" aria-label="Move Down"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={isAdminMode ? "border-2 border-transparent hover:border-brand-accent/20 transition-colors relative" : ""}>
                    {isAdminMode && !section.isVisible && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 z-10 pointer-events-none">
                            <span className="bg-white px-3 py-1 rounded shadow-sm text-xs font-bold uppercase text-red-500 flex items-center gap-2"><EyeOff className="w-3 h-3" /> Hidden from Public</span>
                        </div>
                    )}
                    {content}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen pb-20">
            {sections.map((s, i) => (
                <React.Fragment key={s.id}>
                    {renderSection(s, i)}
                    {s.type === 'featured' && <SmsSignup />}
                </React.Fragment>
            ))}
            {isAdminMode && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4">
                    <span className="text-sm font-bold">Layout Edit Mode</span>
                    <button onClick={() => alert("To add new sections, development implementation is required.")} className="bg-white text-black rounded-full p-1 hover:bg-gray-200" title="Add Section" aria-label="Add Section">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Home;
