import React from 'react';
import { ABOUT_TEXT } from '../constants';

const About = () => {
    return (
        <div className="pt-20 pb-20 max-w-3xl mx-auto px-4">
            <h1 className="font-display text-5xl font-bold uppercase mb-8 text-center">The Story</h1>
            <div className="prose prose-lg mx-auto text-gray-700 leading-loose">
                <p className="text-xl font-medium text-black mb-8">
                    {ABOUT_TEXT}
                </p>
                <p>
                    Baltimore is a city of grit and grace. We founded Coalition to represent the intersection of street culture and high fashion.
                    Every garment is inspected by hand. We source our fabrics from sustainable mills and finish everything locally.
                </p>
                <div className="my-12 border-l-4 border-brand-accent pl-6 py-2 italic text-xl text-gray-500">
                    "We are not just selling clothes; we are building a currency of culture."
                </div>
                <p>
                    With the integration of SGCoin, we are pioneering the future of loyalty. Ownership in the brand is literal.
                    Hold your coins, unlock exclusive drops, and participate in the future of Coalition.
                </p>
            </div>
        </div>
    );
};

export default About;
