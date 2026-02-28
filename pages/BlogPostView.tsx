import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { BlogPost } from '../types';
import { Calendar, User, ArrowLeft, Loader, Share2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import VotingSystem from '../components/VotingSystem';
import CommentsSection from '../components/CommentsSection';

const BlogPostView = () => {
    const { slug } = useParams<{ slug: string }>();
    const [post, setPost] = useState<BlogPost | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (slug) fetchPost();
    }, [slug]);

    const fetchPost = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error) throw error;
            if (data) {
                setPost({
                    ...data,
                    upvotePower: data.upvote_power,
                    downvotePower: data.downvote_power,
                    score: data.upvote_power - data.downvote_power
                });
            }
        } catch (err) {
            console.error('Error fetching post:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader className="w-8 h-8 text-brand-accent animate-spin" />
            </div>
        );
    }

    if (!post) {
        return (
            <div className="min-h-screen pt-32 text-center bg-black">
                <h2 className="text-3xl font-bold uppercase mb-8">Update Not Found</h2>
                <Link to="/blog" className="text-brand-accent uppercase tracking-widest font-bold">&larr; Back to Communtiy Feed</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-32 pb-20 bg-black text-white px-4">
            <div className="max-w-4xl mx-auto">
                {/* Back Button */}
                <Link to="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors uppercase tracking-widest text-[10px] font-bold mb-12">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Community Feed
                </Link>

                {/* Article Header */}
                <header className="mb-12">
                    <div className="flex items-center gap-3 text-brand-accent font-black uppercase tracking-widest text-[11px] mb-6">
                        <span className="px-3 py-1 bg-brand-accent/10 border border-brand-accent/20 rounded-sm">{post.category}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-400">{format(new Date(post.publishedAt || post.createdAt), 'MMMM dd, yyyy')}</span>
                    </div>
                    <h1 className="font-display text-4xl md:text-6xl font-bold uppercase tracking-tighter mb-8 leading-tight">
                        {post.title}
                    </h1>

                    <div className="flex flex-wrap items-center justify-between gap-6 py-6 border-y border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Posted By</span>
                                <span className="text-sm font-bold uppercase">{post.author}</span>
                            </div>
                        </div>

                        {/* Interactive Voting */}
                        <VotingSystem
                            postId={post.id}
                            initialUpvotePower={post.upvotePower}
                            initialDownvotePower={post.downvotePower}
                        />
                    </div>
                </header>

                {/* Cover Image */}
                {post.coverImage && (
                    <div className="mb-12 rounded-3xl overflow-hidden border border-white/5">
                        <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-auto object-cover max-h-[500px]"
                        />
                    </div>
                )}

                {/* Content */}
                <article className="prose prose-invert prose-brand max-w-none">
                    <div
                        className="text-gray-300 text-lg leading-relaxed space-y-8 font-light"
                        dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }}
                    />
                </article>

                {/* Comments Section */}
                <CommentsSection postId={post.id} />

                {/* Footer / Share */}
                <footer className="mt-20 pt-12 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-3">
                        {post.tags?.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                #{tag}
                            </span>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            alert('Link copied to clipboard!');
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 transition-colors rounded-sm text-[10px] font-bold uppercase tracking-widest border border-white/10"
                    >
                        <Share2 className="w-4 h-4" />
                        Share Update
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default BlogPostView;
