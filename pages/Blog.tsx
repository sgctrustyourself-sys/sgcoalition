import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { BlogPost } from '../types';
import { useApp } from '../context/AppContext';
import { Calendar, User, Tag, ArrowBigUp, ArrowBigDown, Loader, Search, Filter } from 'lucide-react';
import { format, isValid } from 'date-fns';
import IdeaSubmission from '../components/IdeaSubmission';
import VotingSystem from '../components/VotingSystem';
import CommentsSection from '../components/CommentsSection';

const safeDate = (dateStr: any) => {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isValid(d) ? d : new Date();
};

const Blog = () => {
    const { user } = useApp();
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    useEffect(() => {
        fetchPosts();
    }, [selectedCategory]);

    const fetchPosts = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('posts')
                .select('*')
                .eq('is_published', true)
                .order('published_at', { ascending: false });

            if (selectedCategory !== 'all') {
                query = query.eq('category', selectedCategory);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (data) {
                setPosts(data.map(p => ({
                    ...p,
                    coverImage: p.cover_image,
                    isPublished: p.is_published,
                    publishedAt: p.published_at,
                    createdAt: p.created_at,
                    updatedAt: p.updated_at,
                    upvotePower: p.upvote_power,
                    downvotePower: p.downvote_power,
                    score: p.upvote_power - p.downvote_power
                })));
            }
        } catch (err) {
            console.error('Error fetching posts:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPosts = posts.filter(post =>
        (post.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.excerpt || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const categories = ['all', 'update', 'community', 'announcement', 'drop'];

    return (
        <div className="min-h-screen pt-32 pb-20 bg-black text-white px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-gray-500">
                        Community <span className="text-brand-accent text-glow">Updates</span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto uppercase tracking-widest font-light">
                        Real-time development news, governance votes, and ecosystem progress.
                    </p>
                </div>

                {/* Idea Submission Section */}
                <IdeaSubmission />

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row gap-6 mb-12 items-center justify-between bg-white/[0.02] border border-white/10 p-6 rounded-2xl backdrop-blur-md">
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm border ${selectedCategory === cat ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="SEARCH UPDATES..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 pl-10 pr-4 py-3 text-[10px] font-bold uppercase tracking-widest focus:border-brand-accent outline-none transition-all rounded-sm"
                        />
                    </div>
                </div>

                {/* Posts Grid */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader className="w-8 h-8 text-brand-accent animate-spin mb-4" />
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Loading the feed...</p>
                    </div>
                ) : filteredPosts.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredPosts.map(post => (
                            <Link
                                key={post.id}
                                to={`/blog/${post.slug}`}
                                className="group bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden hover:border-brand-accent/30 transition-all flex flex-col"
                            >
                                {post.coverImage && (
                                    <div className="aspect-[16/9] overflow-hidden">
                                        <img
                                            src={post.coverImage}
                                            alt={post.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                )}
                                <div className="p-8 flex-grow">
                                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-brand-accent mb-4">
                                        <span className="px-2 py-1 bg-brand-accent/10 rounded-sm">{post.category}</span>
                                        <span className="text-gray-500">{format(safeDate(post.publishedAt || post.createdAt), 'MMM dd, yyyy')}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold uppercase tracking-tight mb-4 group-hover:text-glow transition-all">
                                        {post.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3">
                                        {post.excerpt || (post.content || '').substring(0, 150) + '...'}
                                    </p>

                                    {/* Stats / Governance View */}
                                    <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 text-green-400">
                                                <ArrowBigUp className="w-4 h-4 fill-current" />
                                                <span className="text-xs font-mono font-bold">{Math.round(post.upvotePower).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-red-400">
                                                <ArrowBigDown className="w-4 h-4 fill-current" />
                                                <span className="text-xs font-mono font-bold">{Math.round(post.downvotePower).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Read More &rarr;</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-2xl">
                        <p className="text-gray-500 uppercase tracking-widest font-bold">No updates found matching your criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Blog;
