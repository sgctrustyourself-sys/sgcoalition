import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { BlogComment } from '../types';
import { MessageSquare, Send, User, Loader, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface CommentsSectionProps {
    postId: string;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ postId }) => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [comments, setComments] = useState<BlogComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchComments();
    }, [postId]);

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('post_comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (data) {
                setComments(data.map(c => ({
                    id: c.id,
                    postId: c.post_id,
                    userId: c.user_id,
                    userName: c.user_name,
                    content: c.content,
                    createdAt: c.created_at
                })));
            }
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            addToast('Please login to join the conversation.', 'warning');
            return;
        }

        if (!newComment.trim()) return;

        setIsSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('post_comments')
                .insert({
                    post_id: postId,
                    user_id: user.walletAddress || user.uid,
                    user_name: user.displayName || user.walletAddress?.substring(0, 8) + '...',
                    content: newComment.trim()
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setComments(prev => [...prev, {
                    id: data.id,
                    postId: data.post_id,
                    userId: data.user_id,
                    userName: data.user_name,
                    content: data.content,
                    createdAt: data.created_at
                }]);
            }
            setNewComment('');
            addToast('Comment added!', 'success');
        } catch (err: any) {
            addToast(`Failed to post comment: ${err.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('Remove this comment?')) return;

        try {
            const { error } = await supabase
                .from('post_comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;
            setComments(prev => prev.filter(c => c.id !== commentId));
            addToast('Comment removed.', 'success');
        } catch (err: any) {
            addToast(`Delete failed: ${err.message}`, 'error');
        }
    };

    return (
        <div className="mt-20 space-y-12">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                <MessageSquare className="w-6 h-6 text-brand-accent" />
                <h3 className="text-2xl font-bold uppercase tracking-tighter">
                    Community Discussion <span className="text-gray-600 ml-2">({comments.length})</span>
                </h3>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleSubmit} className="relative group">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={user ? "Share your thoughts on this update..." : "Please login to join the discussion"}
                    disabled={!user || isSubmitting}
                    className="w-full h-32 bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-sm outline-none focus:border-brand-accent transition-all resize-none disabled:opacity-50"
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-4">
                    {!user && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            Login Required
                        </span>
                    )}
                    <button
                        type="submit"
                        disabled={!user || !newComment.trim() || isSubmitting}
                        className="p-3 bg-brand-accent text-white rounded-xl hover:scale-105 transition-all disabled:opacity-0 group-hover:disabled:opacity-20"
                    >
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </form>

            {/* Comments List */}
            <div className="space-y-8">
                {isLoading ? (
                    <div className="flex flex-col items-center py-10">
                        <Loader className="w-6 h-6 text-gray-700 animate-spin" />
                    </div>
                ) : comments.length > 0 ? (
                    comments.map(comment => (
                        <div key={comment.id} className="flex gap-6 group">
                            <div className="flex-shrink-0 w-12 h-12 bg-white/[0.05] border border-white/5 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-gray-600" />
                            </div>
                            <div className="flex-grow space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black uppercase tracking-tight">{comment.userName}</span>
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                            {format(new Date(comment.createdAt), 'MMM dd, HH:mm')}
                                        </span>
                                    </div>
                                    {(user?.walletAddress === comment.userId || user?.uid === comment.userId) && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-500 transition-all"
                                            title="Remove Comment"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-600">No discussion yet. Be the first to chime in.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommentsSection;
