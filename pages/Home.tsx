import React from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Section } from '../types';
import ProductCard from '../components/ProductCard';

const Home = () => {
    const { sections, products, isAdminMode, updateSections, updateSection } = useApp();

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
                    <div className="relative h-[80vh] w-full flex items-center justify-center bg-black text-white overflow-hidden">
                        {/* Placeholder for Hero Video/Image */}
                        <div className="absolute inset-0 bg-[url('https://picsum.photos/1920/1080')] bg-cover bg-center opacity-50"></div>
                        <div className="relative z-10 text-center px-4 max-w-3xl">
                            <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-4">
                                {section.title}
                            </h1>
                            <p className="text-lg md:text-xl text-gray-200 font-light mb-8">
                                {section.content}
                            </p>
                            <Link to="/shop" className="inline-block bg-white text-black px-8 py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition">
                                Shop the Collection
                            </Link>
                        </div>
                    </div>
                );
                break;
            case 'featured':
                const featured = products && products.length > 0
                    ? (products.find(p => p.isFeatured) || products[0])
                    : null;

                if (!featured) {
                    content = (
                        <section className="py-16 md:py-24 px-4 max-w-7xl mx-auto">
                            <div className="text-center text-gray-400">
                                <p>No featured products available</p>
                            </div>
                        </section>
                    );
                    break;
                }

                content = (
                    <section className="py-16 md:py-24 px-4 max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="order-2 md:order-1">
                                <span className="text-brand-accent font-bold tracking-widest text-xs uppercase mb-2 block">{section.title}</span>
                                <h2 className="font-display text-4xl font-bold mb-4">{featured.name}</h2>
                                <p className="text-gray-600 mb-6 leading-relaxed">
                                    {featured.description}
                                </p>
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-bold">${featured.price}</span>
                                    <Link to={`/product/${featured.id}`} className="bg-black text-white px-6 py-3 text-xs font-bold uppercase tracking-wide hover:bg-gray-800">
                                        View Product
                                    </Link>
                                </div>
                            </div>
                            <div className="order-1 md:order-2 bg-gray-100 aspect-square relative overflow-hidden">
                                <img src={featured.images[0]} alt={featured.name} className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </section>
                );
                break;
            case 'grid':
                content = (
                    <section className="py-16 px-4 max-w-7xl mx-auto">
                        <div className="flex justify-between items-end mb-8">
                            <h2 className="font-display text-3xl font-bold uppercase">{section.title}</h2>
                            <Link to="/shop" className="text-sm font-bold border-b border-black pb-1">View All</Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                            {products.slice(0, 6).map(p => <ProductCard key={p.id} product={p} />)}
                        </div>
                    </section>
                );
                break;
            case 'about_teaser':
                content = (
                    <section className="bg-brand-black text-white py-20 px-4 text-center">
                        <div className="max-w-2xl mx-auto">
                            <h2 className="font-display text-3xl font-bold uppercase mb-6">{section.title}</h2>
                            <p className="text-gray-400 mb-8 leading-relaxed">
                                {section.content}
                            </p>
                            <Link to="/about" className="text-white border border-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition">
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
                                    <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Section Title</label>
                                    <input
                                        value={section.title}
                                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                        className="font-bold text-sm bg-transparent border-b border-gray-200 focus:border-black outline-none transition-colors py-1"
                                    />
                                </div>
                                {(section.type === 'hero' || section.type === 'about_teaser') && (
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold uppercase text-gray-400 mb-1">Content Text</label>
                                        <input
                                            value={section.content || ''}
                                            onChange={(e) => updateSection(section.id, { content: e.target.value })}
                                            className="text-xs text-gray-600 bg-transparent border-b border-gray-200 focus:border-black outline-none transition-colors truncate focus:text-clip py-1"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pl-4 border-l border-gray-100">
                                <button
                                    onClick={() => updateSection(section.id, { isVisible: !section.isVisible })}
                                    className={`p-2 rounded hover:bg-gray-100 ${!section.isVisible ? 'bg-red-50 text-red-500' : 'text-gray-600'}`}
                                    title={section.isVisible ? "Hide Section" : "Show Section"}
                                >
                                    {section.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>

                                <div className="flex flex-col gap-1">
                                    <button onClick={() => moveSection(index, 'up')} disabled={isFirst} className="p-1 hover:bg-gray-100 rounded disabled:opacity-25"><ChevronUp className="w-3 h-3" /></button>
                                    <button onClick={() => moveSection(index, 'down')} disabled={isLast} className="p-1 hover:bg-gray-100 rounded disabled:opacity-25"><ChevronDown className="w-3 h-3" /></button>
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
            {sections.map((s, i) => renderSection(s, i))}
            {isAdminMode && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4">
                    <span className="text-sm font-bold">Layout Edit Mode</span>
                    <button onClick={() => alert("To add new sections, development implementation is required.")} className="bg-white text-black rounded-full p-1 hover:bg-gray-200">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Home;
