import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const NotFound = () => {
    return (
        <div className="min-h-screen pt-32 pb-16 px-4 flex flex-col items-center justify-center text-center">
            <h1 className="font-display text-9xl font-bold text-gray-200 mb-4">404</h1>
            <h2 className="font-display text-4xl font-bold uppercase mb-6">Page Not Found</h2>
            <p className="text-gray-600 max-w-md mb-8">
                The page you're looking for doesn't exist or has been moved.
                Let's get you back to the good stuff.
            </p>
            <Link
                to="/"
                className="flex items-center bg-black text-white px-8 py-4 font-bold uppercase tracking-widest hover:bg-gray-800 transition"
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
            </Link>
        </div>
    );
};

export default NotFound;
