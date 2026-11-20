import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, Instagram, Youtube, Music2, AtSign } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
    submitApplication,
    getMyApplication,
    TRUST_CIRCLE_FLAT_RATE,
    type TrustCircleApplication,
} from '../services/trustCircle';

// Brand-voice application form for the Trust Circle (branding team).
// Copy is intentionally informal — "Trust Yourself" energy, not legalese.
const TrustCircle: React.FC = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [existing, setExisting] = useState<TrustCircleApplication | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [form, setForm] = useState({
        whyJoin: '',
        whatYouCreate: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        x: '',
        audienceSize: '',
        portfolioUrl: '',
    });

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        getMyApplication(user.uid).then((app) => {
            setExisting(app);
            setLoading(false);
        });
    }, [user]);

    if (!user) {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4 text-center">
                <Award className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h1 className="font-display text-3xl font-bold uppercase mb-3">Sign in to apply</h1>
                <p className="text-gray-500">The Trust Circle is for the ones who rep the brand — sign in to show us what you've got.</p>
                <Link to="/login" className="inline-block mt-6 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                    Sign In
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-64 bg-gray-200 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (existing?.status === 'pending') {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h1 className="font-display text-3xl font-bold uppercase mb-3">Application already under review</h1>
                <p className="text-gray-500">
                    We've got your application. The brand team reviews every one — you'll hear back here.
                    In the meantime, keep stacking those commissions with The Trusted Few.
                </p>
                <Link to="/profile" className="inline-block mt-6 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                    Back to my profile
                </Link>
            </div>
        );
    }
    if (submitted) {
        return (
            <div className="pt-24 pb-20 max-w-2xl mx-auto px-4 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h1 className="font-display text-3xl font-bold uppercase mb-3">Application received</h1>
                <p className="text-gray-500">
                    That's it. We review every application personally — give us a little time.
                    You'll stay a member of The Trusted Few meanwhile, so your code keeps earning.
                </p>
                <Link to="/profile" className="inline-block mt-6 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                    Back to my profile
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await submitApplication(
            {
                whyJoin: form.whyJoin,
                whatYouCreate: form.whatYouCreate,
                platforms: ['instagram', 'tiktok', 'youtube', 'x'].filter((p) => (form as Record<string, string>)[p]),
                handles: {
                    instagram: form.instagram || undefined,
                    tiktok: form.tiktok || undefined,
                    youtube: form.youtube || undefined,
                    x: form.x || undefined,
                },
                audienceSize: form.audienceSize || undefined,
                portfolioUrl: form.portfolioUrl || undefined,
            },
            user.uid,
        );
        if (result.success) {
            setSubmitted(true);
            addToast('Application received — we review every one personally.', 'success');
        } else {
            addToast(result.error || 'Failed to submit. Please try again.', 'error');
        }
    };

    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    return (
        <div className="pt-24 pb-20 max-w-2xl mx-auto px-4">
            <div className="text-center mb-10">
                <Award className="w-14 h-14 text-purple-500 mx-auto mb-4" />
                <h1 className="font-display text-4xl font-bold uppercase mb-3">Join the Trust Circle</h1>
                <p className="text-gray-500 max-w-lg mx-auto">
                    The Coalition brand team. Flat {TRUST_CIRCLE_FLAT_RATE}% commission on every sale you bring,
                    free product on drops, early access. This isn't a signup sheet — it's a handshake.
                    Tell us why you deserve a seat.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
                <div>
                    <label htmlFor="whyJoin" className="block text-sm font-bold text-gray-800 mb-1.5">Why do you want in?</label>
                    <textarea
                        id="whyJoin"
                        required
                        rows={3}
                        value={form.whyJoin}
                        onChange={set('whyJoin')}
                        placeholder="What does Coalition mean to you? Why the Trust Circle?"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label htmlFor="whatYouCreate" className="block text-sm font-bold text-gray-800 mb-1.5">What do you create?</label>
                    <textarea
                        id="whatYouCreate"
                        required
                        rows={2}
                        value={form.whatYouCreate}
                        onChange={set('whatYouCreate')}
                        placeholder="Fits? Content? Photography? Art? Show your lane."
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="instagram" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <Instagram className="w-4 h-4" /> Instagram handle
                        </label>
                        <input id="instagram" value={form.instagram} onChange={set('instagram')} placeholder="@you" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="tiktok" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <Music2 className="w-4 h-4" /> TikTok handle
                        </label>
                        <input id="tiktok" value={form.tiktok} onChange={set('tiktok')} placeholder="@you" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="youtube" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <Youtube className="w-4 h-4" /> YouTube
                        </label>
                        <input id="youtube" value={form.youtube} onChange={set('youtube')} placeholder="channel URL or @handle" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="x" className="block text-sm font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                            <AtSign className="w-4 h-4" /> X / Twitter
                        </label>
                        <input id="x" value={form.x} onChange={set('x')} placeholder="@you" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="audienceSize" className="block text-sm font-bold text-gray-800 mb-1.5">Audience size</label>
                        <input id="audienceSize" value={form.audienceSize} onChange={set('audienceSize')} placeholder="e.g. 10k on TikTok" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div>
                        <label htmlFor="portfolioUrl" className="block text-sm font-bold text-gray-800 mb-1.5">Link to your work</label>
                        <input id="portfolioUrl" type="url" value={form.portfolioUrl} onChange={set('portfolioUrl')} placeholder="https://…" className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-4 rounded-lg font-bold uppercase tracking-widest transition"
                >
                    Submit Application
                </button>
                <p className="text-xs text-gray-400 text-center">
                    We auto-attach your order history and referral stats — no need to list them.
                </p>
            </form>
        </div>
    );
};

export default TrustCircle;
