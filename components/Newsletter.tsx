import React, { useState } from 'react';
import { ArrowRight, BellRing } from 'lucide-react';

export type NewsletterSource = 'home' | 'shop' | 'about' | 'footer';
export type NewsletterVariant = 'inline' | 'block';

interface NewsletterProps {
    source?: NewsletterSource;
    variant?: NewsletterVariant;
    heading?: string;
    subheading?: string;
}

// Defaults are tuned to each page so the same component reads as Founder-voice
// on the storefront, never as marketing boilerplate.
const DEFAULT_HEADINGS: Record<NewsletterSource, { heading: string; subheading: string }> = {
    home: {
        heading: 'Be told first.',
        subheading: 'New drops every few weeks. We send one email the day they go live. No marketing, no listicles, no spam.',
    },
    shop: {
        heading: 'Be told about new drops the day they go live.',
        subheading: 'One email per drop. No marketing, no spam.',
    },
    about: {
        heading: 'Carry this with you.',
        subheading: 'Hold a spot on the drop list. We send a single email when a new Coalition piece is ready to ship. No marketing, no spam.',
    },
    footer: {
        heading: '',
        subheading: 'One email per drop.',
    },
};

const EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const Newsletter: React.FC<NewsletterProps> = ({
    source = 'footer',
    variant = 'inline',
    heading,
    subheading,
}) => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'already'>('idle');
    const [error, setError] = useState<string | null>(null);

    const copy = {
        heading: heading ?? DEFAULT_HEADINGS[source].heading,
        subheading: subheading ?? DEFAULT_HEADINGS[source].subheading,
    };

    const validateEmail = (value: string) => EMAIL_REGEX.test(String(value).toLowerCase());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (status === 'submitting') return;
        setError(null);

        const trimmed = email.trim().toLowerCase();
        if (!trimmed) {
            setError('Please enter your email above.');
            return;
        }
        if (!validateEmail(trimmed)) {
            setError('That email address does not look right.');
            return;
        }

        setStatus('submitting');
        try {
            const response = await fetch('/api/subscribe-drop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed, source }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || 'Could not subscribe. Please try again.');
            }
            setStatus(payload?.alreadySubscribed ? 'already' : 'success');
        } catch (err: any) {
            setError(err?.message || 'Could not subscribe. Please try again.');
            setStatus('idle');
        }
    };

    // Success / already-on-list branch - both confirm the user with copy that
    // matches the variant's tone, no spam affirmation either way.
    if (status === 'success' || status === 'already') {
        const successCopy = status === 'success'
            ? "You're on the list."
            : "You're already on the list.";

        if (variant === 'block') {
            return (
                <div className="w-full bg-black border border-white/10 rounded-lg p-8 md:p-10 text-left">
                    <BellRing className="w-6 h-6 text-brand-accent mb-3" />
                    <p className="text-white font-display text-2xl md:text-3xl font-bold uppercase tracking-wide mb-2">{successCopy}</p>
                    <p className="text-gray-400 text-sm">
                        {status === 'success'
                            ? "We'll send one email the day each new drop goes live."
                            : "Your email is already on the drop list; no duplicate confirmation was sent."}
                    </p>
                </div>
            );
        }
        return <div className="text-brand-accent font-bold py-4">{successCopy}</div>;
    }

    if (variant === 'block') {
        return (
            <div className="w-full bg-gradient-to-br from-black via-purple-900/20 to-blue-900/20 border border-white/10 rounded-lg p-8 md:p-10">
                <div className="flex flex-col items-start text-left mb-6">
                    <span className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-4">
                        <BellRing className="w-3.5 h-3.5 text-brand-accent" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">The Drop List</span>
                    </span>
                    <h3 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mb-3">
                        {copy.heading}
                    </h3>
                    {copy.subheading && (
                        <p className="text-gray-400 text-base leading-relaxed max-w-xl">
                            {copy.subheading}
                        </p>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-xl" noValidate>
                    <div
                        className={`flex border border-white/15 bg-black/40 rounded-md overflow-hidden transition-colors ${
                            error ? 'border-red-500' : 'focus-within:border-white/60'
                        }`}
                    >
                        <input
                            id={`coalition-newsletter-email-${source}`}
                            name="email"
                            type="email"
                            placeholder="ENTER YOUR EMAIL"
                            className="bg-transparent flex-1 px-4 py-3 text-sm outline-none placeholder-gray-500 text-white disabled:opacity-60"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (error) setError(null);
                            }}
                            disabled={status === 'submitting'}
                            aria-label="Email address"
                        />
                        <button
                            type="submit"
                            disabled={status === 'submitting'}
                            className="bg-white text-black px-5 text-xs font-bold uppercase tracking-widest hover:bg-gray-200 disabled:opacity-60 transition-colors"
                        >
                            {status === 'submitting' ? 'Sending' : 'Notify Me'}
                        </button>
                    </div>
                    {error && <p className="text-red-400 text-xs mt-1" role="alert">{error}</p>}
                    <p className="text-gray-500 text-[11px] mt-1 uppercase tracking-wide">
                        One email per drop. Unsubscribe any time.
                    </p>
                </form>
            </div>
        );
    }

    // variant === 'inline' (default; matches the pre-existing Footer slot exactly)
    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2" noValidate>
            <div
                className={`flex border-b pb-2 transition-colors ${
                    error ? 'border-red-500' : 'border-gray-600 focus-within:border-white'
                }`}
            >
                <input
                    id={`coalition-newsletter-email-${source}`}
                    name="email"
                    type="email"
                    placeholder="ENTER YOUR EMAIL"
                    className="bg-transparent w-full outline-none text-sm placeholder-gray-600 text-white disabled:opacity-50"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                    }}
                    disabled={status === 'submitting'}
                    aria-label="Email address"
                />
                <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="text-gray-400 hover:text-white disabled:opacity-50"
                    aria-label="Subscribe to drop notifications"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-1" role="alert">{error}</p>}
            {!error && status === 'idle' && copy.subheading && (
                <p className="text-gray-500 text-[11px] uppercase tracking-wide">{copy.subheading}</p>
            )}
        </form>
    );
};

export default Newsletter;
