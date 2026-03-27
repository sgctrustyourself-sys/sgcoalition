import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useApp } from '../context/AppContext';
import { ArrowBigUp, ArrowBigDown, Shield, Loader } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface VotingSystemProps {
    postId: string;
    initialUpvotePower: number;
    initialDownvotePower: number;
}

const VotingSystem: React.FC<VotingSystemProps> = ({ postId, initialUpvotePower, initialDownvotePower }) => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [upvotePower, setUpvotePower] = useState(initialUpvotePower);
    const [downvotePower, setDownvotePower] = useState(initialDownvotePower);
    const [userVote, setUserVote] = useState<number | null>(null);
    const [isVoting, setIsVoting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const hasBlogBackend =
        Boolean(import.meta.env.VITE_SUPABASE_URL) &&
        Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) &&
        !String(import.meta.env.VITE_SUPABASE_URL || '').includes('placeholder');

    useEffect(() => {
        if (!hasBlogBackend) {
            setIsLoading(false);
            return;
        }

        if (user) {
            fetchUserVote();
        } else {
            setIsLoading(false);
        }
    }, [user, postId, hasBlogBackend]);

    const fetchUserVote = async () => {
        try {
            const { data, error } = await supabase
                .from('post_votes')
                .select('vote_type')
                .eq('post_id', postId)
                .eq('user_id', user?.walletAddress || user?.uid)
                .single();

            if (data) {
                setUserVote(data.vote_type);
            }
        } catch (err) {
            // No vote found is fine
        } finally {
            setIsLoading(false);
        }
    };

    const handleVote = async (type: number) => {
        if (!user) {
            addToast('Please login to participate in governance.', 'warning');
            return;
        }

        if (!hasBlogBackend) {
            addToast('Voting is unavailable in local preview.', 'warning');
            return;
        }

        if (isVoting) return;

        // Calculate actual weight (SGCoin V2 balance)
        // Note: 1 SGC = 1 Voting Power
        const weight = user.v2Balance || 0;

        if (weight <= 0) {
            addToast('You need SGCoin V2 to exercise voting power.', 'error');
            return;
        }

        setIsVoting(true);
        try {
            if (userVote === type) {
                // Remove vote
                const { error } = await supabase
                    .from('post_votes')
                    .delete()
                    .eq('post_id', postId)
                    .eq('user_id', user.walletAddress || user.uid);

                if (error) throw error;

                if (type === 1) setUpvotePower(prev => prev - weight);
                else setDownvotePower(prev => prev - weight);
                setUserVote(null);
            } else {
                // Add or change vote
                const { error } = await supabase
                    .from('post_votes')
                    .upsert({
                        post_id: postId,
                        user_id: user.walletAddress || user.uid,
                        vote_type: type,
                        weight: weight
                    }, { onConflict: 'post_id,user_id' });

                if (error) throw error;

                // Optimistic update
                if (userVote === null) {
                    if (type === 1) setUpvotePower(prev => prev + weight);
                    else setDownvotePower(prev => prev + weight);
                } else {
                    // Changing vote
                    if (type === 1) {
                        setUpvotePower(prev => prev + weight);
                        setDownvotePower(prev => prev - weight);
                    } else {
                        setUpvotePower(prev => prev - weight);
                        setDownvotePower(prev => prev + weight);
                    }
                }
                setUserVote(type);
            }
        } catch (err: any) {
            console.error('Voting error:', err);
            addToast(`Failed to register vote: ${err.message}`, 'error');
        } finally {
            setIsVoting(false);
        }
    };

    if (isLoading) return <div className="h-10 w-24 bg-white/5 animate-pulse rounded-lg" />;

    return (
        <div className="flex items-center gap-6 bg-white/[0.03] border border-white/10 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex flex-col items-center">
                <button
                    onClick={() => handleVote(1)}
                    disabled={isVoting}
                    className={`transition-all ${userVote === 1 ? 'text-green-400 scale-125' : 'text-gray-500 hover:text-green-400 hover:scale-110'}`}
                    title="Upvote with SGCoin Power"
                >
                    <ArrowBigUp className={`w-8 h-8 ${userVote === 1 ? 'fill-current' : ''}`} />
                </button>
                <span className="text-xs font-mono font-black mt-1 text-green-400/80">
                    {Math.round(upvotePower).toLocaleString()}
                </span>
            </div>

            <div className="h-12 w-px bg-white/10" />

            <div className="flex flex-col items-center">
                <button
                    onClick={() => handleVote(-1)}
                    disabled={isVoting}
                    className={`transition-all ${userVote === -1 ? 'text-red-400 scale-125' : 'text-gray-500 hover:text-red-400 hover:scale-110'}`}
                    title="Downvote with SGCoin Power"
                >
                    <ArrowBigDown className={`w-8 h-8 ${userVote === -1 ? 'fill-current' : ''}`} />
                </button>
                <span className="text-xs font-mono font-black mt-1 text-red-400/80">
                    {Math.round(downvotePower).toLocaleString()}
                </span>
            </div>

            <div className="hidden sm:flex flex-col ml-4 border-l border-white/5 pl-6">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">
                    <Shield className="w-3 h-3" />
                    Governance Power
                </div>
                <div className="text-sm font-black font-mono">
                    {user ? (user.v2Balance || 0).toLocaleString() : 'READ ONLY'} <span className="text-gray-600 text-[10px] uppercase ml-1">VPU</span>
                </div>
            </div>

            {isVoting && <Loader className="w-4 h-4 text-brand-accent animate-spin ml-2" />}
        </div>
    );
};

export default VotingSystem;
