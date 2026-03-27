import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp, Sparkles } from 'lucide-react';

interface ConceptProps {
    id: string;
    title: string;
    description: string;
    votes: number;
    color: string;
}

const ConceptCard: React.FC<ConceptProps> = ({ title, description, votes: initialVotes, color }) => {
    const [votes, setVotes] = useState(initialVotes);
    const [hasVoted, setHasVoted] = useState(false);

    const handleVote = () => {
        if (!hasVoted) {
            setVotes(prev => prev + 1);
            setHasVoted(true);
        }
    };

    return (
        <div className="relative group p-6 rounded-3xl bg-white/[0.03] border border-white/5 overflow-hidden hover:border-white/10 transition-all">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <Sparkles className="w-12 h-12 rotate-12" />
            </div>

            <div className="relative z-10">
                <h3 className="font-display text-lg font-black uppercase tracking-tight mb-2">{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-6 h-10 line-clamp-2">
                    {description}
                </p>

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleVote}
                    disabled={hasVoted}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${hasVoted
                        ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-default'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300 hover:text-white'
                        }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                        {hasVoted ? 'Signal Received' : 'Upvote Concept'}
                    </span>
                    <div className="flex items-center gap-2 font-mono font-bold">
                        <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
                        {votes.toLocaleString()}
                    </div>
                </motion.button>
            </div>

            {/* Progress Bar Visual */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                <motion.div
                    className={`h-full ${color.replace('text-', 'bg-')} opacity-50`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (votes / 5000) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </div>
        </div>
    );
};

export default ConceptCard;
