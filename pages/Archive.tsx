import React from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Package, Clock } from 'lucide-react';

const Archive: React.FC = () => {
    const { products, isLoading } = useApp();

    // Filter for archived products and sort by soldAt (newest first)
    console.log('Archive Page - All Products:', products);
    const archivedProducts = products
        .filter(p => p.archived)
        .sort((a, b) => {
            const dateA = new Date(a.soldAt || a.archivedAt || 0).getTime();
            const dateB = new Date(b.soldAt || b.archivedAt || 0).getTime();
            return dateB - dateA;
        });
    console.log('Archive Page - Archived Products:', archivedProducts);

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="pt-24 pb-16 min-h-screen bg-black">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 uppercase tracking-tighter">
                        The Archive
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        A collection of past releases and 1/1 customs. Gone but not forgotten.
                    </p>
                </div>

                {archivedProducts.length === 0 ? (
                    <div className="text-center py-20 border border-white/10 rounded-2xl bg-white/5">
                        <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">The Archive is Empty</h3>
                        <p className="text-gray-400">No products have been archived yet.</p>
                        <div className="mt-8 p-4 bg-black text-left text-xs font-mono text-green-400 overflow-auto max-h-64">
                            <p className="mb-2 font-bold text-white">DEBUG INFO:</p>
                            <p>Is Loading: {isLoading ? 'YES' : 'NO'}</p>
                            <p>Products Count: {products.length}</p>
                            {JSON.stringify(products.map(p => ({ id: p.id, name: p.name, archived: p.archived })), null, 2)}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {archivedProducts.map((product) => (
                            <div key={product.id} className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-all duration-300">
                                {/* Image */}
                                <div className="aspect-square overflow-hidden relative">
                                    <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 transform group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <span className="bg-white text-black px-4 py-2 font-bold uppercase tracking-widest text-sm">
                                            Sold Out
                                        </span>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="p-6 space-y-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white uppercase font-display mb-1">
                                            {product.name}
                                        </h3>
                                        <p className="text-gray-400 text-sm font-mono">
                                            {product.category}
                                        </p>
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-white/10">
                                        {product.releasedAt && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" /> Released
                                                </span>
                                                <span className="text-gray-300 font-mono">
                                                    {formatDate(product.releasedAt)}
                                                </span>
                                            </div>
                                        )}
                                        {product.soldAt && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500 flex items-center gap-2">
                                                    <Clock className="w-4 h-4" /> Sold Out
                                                </span>
                                                <span className="text-brand-accent font-mono">
                                                    {formatDate(product.soldAt)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Archive;
