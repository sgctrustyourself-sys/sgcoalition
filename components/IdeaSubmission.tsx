import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Shield, Send, AlertCircle, Loader, MessageSquarePlus } from 'lucide-react';

const IdeaSubmission = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const MIN_COIN_REQUIREMENT = 1000;
    const userV2Balance = user?.v2Balance || 0;
    const canSubmit = userV2Balance >= MIN_COIN_REQUIREMENT;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) {
            addToast(`You need at least ${MIN_COIN_REQUIREMENT.toLocaleString()} SGCoin V2 to submit an idea.`, 'error');
            return;
        }

        if (!title || !content) {
            addToast('Please fill in both title and description.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const slug = `idea-${Date.now()}`;
            const { error } = await supabase
                .from('posts')
                .insert({
                    title,
                    content,
                    slug,
                    category: 'idea',
                    author: user?.displayName || user?.walletAddress?.substring(0, 6) + '...',
                    author_id: user?.walletAddress || user?.uid,
                    is_published: false // Needs admin review
                });

            if (error) throw error;

            addToast('Idea submitted for review! It will appear on the feed once approved.', 'success');
            setIsOpen(false);
            setTitle('');
            setContent('');
        } catch (err: any) {
            addToast(`Failed to submit idea: ${err.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-between p-6 bg-gradient-to-r from-brand-accent/20 to-purple-900/20 border border-brand-accent/30 rounded-2xl group hover:border-brand-accent transition-all mb-12"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MessageSquarePlus className="w-6 h-6 text-brand-accent" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-bold uppercase tracking-tight">Got an idea for the Coalition?</h3>
                        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Submit high-value proposals to the community</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">Requirement</span>
                        <span className="text-sm font-mono font-black">{MIN_COIN_REQUIREMENT.toLocaleString()} SGC V2</span>
                    </div>
                    <div className="px-4 py-2 bg-brand-accent text-white text-[10px] font-black uppercase tracking-widest rounded-sm">
                        Submit Proposal
                    </div>
                </div>
            </button>
        );
    }

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h3 className="text-2xl font-bold uppercase tracking-tighter">Submit Community Proposal</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">High-value ideas only. Posts require admin approval.</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                    Cancel
                </button>
            </div>

            {!canSubmit ? (
                <div className="flex flex-col items-center justify-center p-12 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                    <p className="text-sm font-bold uppercase text-red-300 text-center mb-2">Insufficient SGCoin V2</p>
                    <p className="text-xs text-gray-500 text-center max-w-sm">
                        Submission requires a stake of {MIN_COIN_REQUIREMENT.toLocaleString()} SGCoin V2.
                        Your current balance: {userV2Balance.toLocaleString()} V2.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Idea Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-brand-accent outline-none transition-all"
                            placeholder="What's your vision?"
                            maxLength={100}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Detailed Proposal</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-40 bg-black/50 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-brand-accent outline-none transition-all"
                            placeholder="Describe how this benefits the Coalition economy..."
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-brand-accent uppercase tracking-widest">
                            <Shield className="w-3 h-3" />
                            Gated Submission Active
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-accent hover:text-white transition-all shadow-lg"
                        >
                            {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Publish for Review
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default IdeaSubmission;
