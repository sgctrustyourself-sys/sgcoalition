import React from 'react';
import { Lightbulb } from 'lucide-react';
import ConceptCard from './ConceptCard';

const CONCEPTS = [
    {
        id: 'c1',
        title: 'Cyber Hoodie v2',
        description: 'Enhanced AR marker integration with new "Void Black" colorway and haptic feedback pockets.',
        votes: 3420,
        color: 'text-purple-500'
    },
    {
        id: 'c2',
        title: 'Neon Deck',
        description: 'Physical skateboard deck with embedded NFC chip linked to a digital skate park asset.',
        votes: 1250,
        color: 'text-pink-500'
    },
    {
        id: 'c3',
        title: 'SGC Ledger',
        description: 'Custom branded hardware wallet with pre-loaded SGC assets and exclusive boot animation.',
        votes: 890,
        color: 'text-blue-500'
    }
];

const FeedbackLoop = () => {
    return (
        <section className="mb-32">
            <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                    <Lightbulb className="text-yellow-400" />
                </div>
                <div>
                    <h2 className="font-display text-4xl font-black uppercase tracking-tighter">R&D Pipeline</h2>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">Signal Demand. Shape the Future.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {CONCEPTS.map(concept => (
                    <ConceptCard key={concept.id} {...concept} />
                ))}
            </div>
        </section>
    );
};

export default FeedbackLoop;
