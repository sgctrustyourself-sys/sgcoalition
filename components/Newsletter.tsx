import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

const Newsletter = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'success'>('idle');
    const [error, setError] = useState<string | null>(null);

    const validateEmail = (email: string) => {
        return String(email)
            .toLowerCase()
            .match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email) {
            setError("Email is required.");
            return;
        }

        if (!validateEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        // Simulate API call
        console.log("Storing email:", email);
        setStatus('success');
    };

    if (status === 'success') {
        return <div className="text-brand-accent font-bold py-4">Welcome to the Coalition.</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2" noValidate>
            <div className={`flex border-b pb-2 transition-colors ${error ? 'border-red-500' : 'border-gray-600 focus-within:border-white'}`}>
                <input
                    type="email"
                    placeholder="ENTER YOUR EMAIL"
                    className="bg-transparent w-full outline-none text-sm placeholder-gray-600 text-white"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null); // Clear error on type
                    }}
                // Remove browser default validation to show custom error if desired, or keep it as first layer
                />
                <button type="submit" className="text-gray-400 hover:text-white"><ArrowRight className="w-5 h-5" /></button>
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </form>
    );
}

export default Newsletter;
