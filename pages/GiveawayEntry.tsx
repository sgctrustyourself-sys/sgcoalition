import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    Youtube, Instagram, Upload, CheckCircle, AlertCircle,
    Loader2, ArrowLeft, Trophy, Star, Gift, Shirt, ChevronLeft, ChevronRight
} from 'lucide-react';
import { uploadScreenshot, validateImage } from '../services/giveawayUpload';
import { supabase } from '../services/supabase';
import { YoutubeGiveawayEntry } from '../types';
import GiveawayCountdown from '../components/giveaway/GiveawayCountdown';

// Slug → Supabase giveaway ID map
const SLUG_MAP: Record<string, string> = {
    'nf-tee': 'giveaway_nf_tee_01',
};

interface GiveawayData {
    id: string;
    title: string;
    prize: string;
    prize_image?: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
    requirements: string[];
    max_entries_per_user: number;
}

// ─── Sub-components ──────────────────────────────────────────────

const ScreenshotUpload: React.FC<{
    label: string;
    sublabel?: string;
    file: File | null;
    preview: string;
    points?: number;
    required?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, sublabel, file, preview, points, required, onChange }) => (
    <div>
        <div className="flex items-center justify-between mb-2">
            <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-white">
                    {label} {required && <span className="text-red-400">*</span>}
                </label>
                {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
            </div>
            {points && (
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                    +{points} pt{points > 1 ? 's' : ''}
                </span>
            )}
        </div>
        <div className="relative">
            {preview ? (
                <div className="relative group rounded-xl overflow-hidden border border-white/10">
                    <img src={preview} alt={label} className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg font-bold text-xs uppercase">
                            Change
                            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={onChange} className="hidden" />
                        </label>
                    </div>
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-0.5">
                        <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                </div>
            ) : (
                <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/30 hover:bg-white/[0.02] transition group">
                    <Upload className="w-7 h-7 text-gray-600 group-hover:text-gray-400 mb-2 transition" />
                    <span className="text-sm font-bold text-gray-500 group-hover:text-gray-300 transition">Click to upload</span>
                    <span className="text-xs text-gray-600 mt-1">JPG, PNG, WebP — max 15MB</span>
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={onChange} className="hidden" />
                </label>
            )}
        </div>
        {file && (
            <p className="text-[10px] text-gray-600 mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
        )}
    </div>
);

const RequirementRow: React.FC<{ icon: React.ReactNode; label: string; sub: string; points: number }> = ({ icon, label, sub, points }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 flex-shrink-0">
                {icon}
            </div>
            <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-xs text-gray-500">{sub}</p>
            </div>
        </div>
        <span className="text-xs font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full whitespace-nowrap ml-4">
            +{points} pt{points > 1 ? 's' : ''}
        </span>
    </div>
);

// ─── Static constants ────────────────────────────────────────────
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const SHIRT_GALLERY = [
    { src: '/images/products/nf-tee/model-1.jpg', label: 'Look 1' },
    { src: '/images/products/nf-tee/model-2.jpg', label: 'Look 2' },
    { src: '/images/products/nf-tee/model-3.jpg', label: 'Look 3' },
    { src: '/images/products/nf-tee/model-4.jpg', label: 'Look 4' },
];

// ─── Main Page ───────────────────────────────────────────────────

const GiveawayEntry = () => {
    const { id: slugParam } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const giveawayId = slugParam ? (SLUG_MAP[slugParam] ?? slugParam) : '';

    const [giveaway, setGiveaway] = useState<GiveawayData | null>(null);
    const [loadingGiveaway, setLoadingGiveaway] = useState(true);
    const [giveawayError, setGiveawayError] = useState<string | null>(null);
    const [giveawayStatus, setGiveawayStatus] = useState<'upcoming' | 'active' | 'ended'>('upcoming');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        youtubeHandle: '',
        instagramUsername: '',
        shirtSize: '' as string,
    });

    // Required screenshots
    const [subFile, setSubFile] = useState<File | null>(null);
    const [subPreview, setSubPreview] = useState('');
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [commentPreview, setCommentPreview] = useState('');

    // Optional screenshots
    const [storyFile, setStoryFile] = useState<File | null>(null);
    const [storyPreview, setStoryPreview] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submittedPoints, setSubmittedPoints] = useState(0);

    // Gallery state — MUST be declared at top level (Rules of Hooks)
    const [activeImg, setActiveImg] = useState(0);
    const prevImg = () => setActiveImg(i => (i - 1 + SHIRT_GALLERY.length) % SHIRT_GALLERY.length);
    const nextImg = () => setActiveImg(i => (i + 1) % SHIRT_GALLERY.length);

    // Instagram follow screenshot
    const [igFollowFile, setIgFollowFile] = useState<File | null>(null);
    const [igFollowPreview, setIgFollowPreview] = useState('');

    useEffect(() => {
        if (!giveawayId) {
            setGiveawayError('Invalid giveaway link.');
            setLoadingGiveaway(false);
            return;
        }
        const fetchGiveaway = async () => {
            console.log('[GiveawayEntry] Fetching giveaway:', giveawayId);
            const { data, error } = await supabase
                .from('giveaways')
                .select('*')
                .eq('id', giveawayId)
                .single();

            console.log('[GiveawayEntry] Result:', { data, error });

            if (error) {
                console.error('[GiveawayEntry] Supabase error:', error.code, error.message, error.details);
                setGiveawayError(`Error: ${error.message || error.code || 'Failed to load giveaway.'}`);
            } else if (!data) {
                setGiveawayError('Giveaway not found.');
            } else {
                setGiveaway(data as GiveawayData);
                setGiveawayStatus(data.status as 'upcoming' | 'active' | 'ended');
            }
            setLoadingGiveaway(false);
        };
        fetchGiveaway();
    }, [giveawayId]);

    const handleFileChange = async (
        e: React.ChangeEvent<HTMLInputElement>,
        type: 'sub' | 'comment' | 'story'
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            setError('File too large. Max 15MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const preview = reader.result as string;
            if (type === 'sub') { setSubFile(file); setSubPreview(preview); }
            else if (type === 'comment') { setCommentFile(file); setCommentPreview(preview); }
            else if (type === 'igfollow') { setIgFollowFile(file); setIgFollowPreview(preview); }
            else { setStoryFile(file); setStoryPreview(preview); }
        };
        reader.readAsDataURL(file);
        setError(null);
    };

    const calcPoints = () => {
        let pts = 0;
        if (subFile) pts += 1;
        if (commentFile) pts += 1;
        if (igFollowFile) pts += 1;
        if (storyFile) pts += 1;
        return pts;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.name || !formData.email || !formData.youtubeHandle || !formData.instagramUsername || !formData.shirtSize) {
            setError('Please fill in all required fields including your Instagram username.');
            return;
        }
        if (!subFile || !commentFile || !igFollowFile) {
            setError('Please upload all required screenshots (Subscribe, Comment & Instagram Follow).');
            return;
        }

        setLoading(true);

        try {
            // Duplicate check
            const { data: existing } = await supabase
                .from('giveaway_entries')
                .select('id')
                .eq('giveaway_id', giveawayId)
                .eq('email', formData.email)
                .maybeSingle();

            if (existing) {
                setError('You have already entered this giveaway with this email.');
                setLoading(false);
                return;
            }

            // Upload required screenshots
            const [subUrl, commentUrl, igFollowUrl] = await Promise.all([
                uploadScreenshot(subFile, 'sub', giveawayId),
                uploadScreenshot(commentFile, 'comment', giveawayId),
                uploadScreenshot(igFollowFile, 'igfollow', giveawayId),
            ]);

            // Upload optional story screenshot
            let storyUrl: string | null = null;
            if (storyFile) {
                storyUrl = await uploadScreenshot(storyFile, 'story', giveawayId);
            }

            const points = calcPoints();

            const entry: Omit<YoutubeGiveawayEntry, 'id' | 'createdAt'> & { giveaway_id: string } = {
                giveaway_id: giveawayId,
                giveawayId,
                name: formData.name,
                email: formData.email,
                youtubeHandle: formData.youtubeHandle.replace('@', ''),
                instagramUsername: formData.instagramUsername.replace('@', '') || undefined,
                shirtSize: formData.shirtSize,
                screenshotSubUrl: subUrl,
                screenshotCommentUrl: commentUrl,
                screenshotStoryUrl: storyUrl || undefined,
                claimedPoints: points,
                verified: false,
            };

            const { error: dbError } = await supabase
                .from('giveaway_entries')
                .insert([{
                    giveaway_id: entry.giveaway_id,
                    name: entry.name,
                    email: entry.email,
                    youtube_handle: entry.youtubeHandle,
                    instagram_username: entry.instagramUsername || null,
                    shirt_size: entry.shirtSize,
                    screenshot_sub_url: entry.screenshotSubUrl,
                    screenshot_comment_url: entry.screenshotCommentUrl,
                    screenshot_ig_follow_url: igFollowUrl,
                    screenshot_story_url: entry.screenshotStoryUrl || null,
                    claimed_points: entry.claimedPoints,
                    verified: false,
                }]);

            if (dbError) throw new Error(dbError.message || 'Failed to save entry.');

            setSubmittedPoints(points);
            setSuccess(true);

        } catch (err: any) {
            console.error('Submission error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Loading state ──────────────────────────────────────────────
    if (loadingGiveaway) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
        );
    }

    if (giveawayError || !giveaway) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="font-display text-3xl font-bold uppercase mb-2">Not Found</h1>
                    <p className="text-gray-500 mb-6">{giveawayError || 'This giveaway does not exist.'}</p>
                    <Link to="/ecosystem" className="inline-block bg-white text-black px-6 py-3 font-bold uppercase text-sm hover:bg-gray-200 transition rounded-lg">
                        Back to Ecosystem
                    </Link>
                </div>
            </div>
        );
    }

    // ── Success state ──────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
                        <Trophy className="w-12 h-12 text-amber-400" />
                    </div>
                    <h1 className="font-display text-5xl font-bold uppercase tracking-tight mb-3">You're In</h1>
                    <p className="text-gray-400 mb-2">Your entry has been submitted for</p>
                    <p className="font-bold text-white text-lg mb-6">{giveaway.prize}</p>

                    <div className="bg-amber-400/10 border border-amber-400/20 rounded-2xl p-4 mb-8 inline-flex items-center gap-3">
                        <Star className="w-5 h-5 text-amber-400 fill-current" />
                        <span className="font-black text-amber-400 text-lg">{submittedPoints} point{submittedPoints !== 1 ? 's' : ''} claimed</span>
                    </div>

                    <p className="text-gray-500 text-sm mb-8">
                        We'll review your screenshots and announce the winner on or after{' '}
                        <strong className="text-white">{new Date(giveaway.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
                    </p>

                    <button
                        onClick={() => navigate('/ecosystem')}
                        className="w-full bg-white text-black font-bold uppercase py-4 rounded-xl hover:bg-gray-200 transition"
                    >
                        Back to Ecosystem
                    </button>
                </div>
            </div>
        );
    }

    const isEnded = giveawayStatus === 'ended';
    const isUpcoming = giveawayStatus === 'upcoming';
    const canEnter = giveawayStatus === 'active';

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Hero Banner */}
            <div className="relative pt-24 pb-16 px-4 text-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black pointer-events-none" />
                <div className="relative max-w-3xl mx-auto">
                    <button
                        onClick={() => navigate('/ecosystem')}
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-10 transition text-sm font-bold uppercase tracking-wider"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Ecosystem
                    </button>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
                        <Gift className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Official Giveaway</span>
                    </div>

                    <h1 className="font-display text-5xl md:text-6xl font-black uppercase tracking-tight mb-4 italic">
                        {giveaway.title}
                    </h1>
                    <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
                        {giveaway.description}
                    </p>

                    {/* Prize chip */}
                    <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                        <Gift className="w-5 h-5 text-amber-400" />
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Prize</p>
                            <p className="font-bold text-white">{giveaway.prize}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 pb-24 space-y-8">

                {/* ── Shirt Photo Gallery ── */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    {/* Main Image */}
                    <div className="relative group">
                        <img
                            key={activeImg}
                            src={SHIRT_GALLERY[activeImg].src}
                            alt={SHIRT_GALLERY[activeImg].label}
                            className="w-full h-80 md:h-[420px] object-cover object-top transition-opacity duration-300"
                        />
                        {/* Label badge */}
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                            {SHIRT_GALLERY[activeImg].label}
                        </div>
                        {/* Prize label */}
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/30 rounded-full px-3 py-1">
                            <Gift className="w-3 h-3 text-amber-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Prize</span>
                        </div>
                        {/* Prev / Next arrows */}
                        <button
                            onClick={prevImg}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={nextImg}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Thumbnail Strip */}
                    <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide">
                        {SHIRT_GALLERY.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveImg(idx)}
                                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                                    idx === activeImg
                                        ? 'border-white opacity-100 scale-105'
                                        : 'border-transparent opacity-50 hover:opacity-80'
                                }`}
                            >
                                <img src={img.src} alt={img.label} className="w-full h-full object-cover object-top" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Countdown */}
                <GiveawayCountdown
                    startDate={giveaway.start_date}
                    endDate={giveaway.end_date}
                    onStatusChange={setGiveawayStatus}
                />

                {/* Entry Requirements */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                    <h2 className="font-display font-black uppercase text-lg tracking-tighter italic mb-4">
                        How to Enter
                    </h2>
                    <RequirementRow
                        icon={<Youtube className="w-4 h-4" />}
                        label="Subscribe on YouTube"
                        sub="Screenshot your subscription confirmation"
                        points={1}
                    />
                    <RequirementRow
                        icon={<Youtube className="w-4 h-4" />}
                        label="Comment on our latest video"
                        sub="Screenshot showing your comment on the post"
                        points={1}
                    />
                    <RequirementRow
                        icon={<Instagram className="w-4 h-4" />}
                        label="Follow @sgcoalition on Instagram"
                        sub="Screenshot showing you follow our Instagram page"
                        points={1}
                    />
                    <RequirementRow
                        icon={<Instagram className="w-4 h-4" />}
                        label="Share to your Instagram Story (Bonus)"
                        sub="Optional — share a post and screenshot your story"
                        points={1}
                    />
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-bold uppercase tracking-wider text-xs">Max Points</span>
                        <span className="font-black text-amber-400">4 pts</span>
                    </div>
                </div>

                {/* Closed / Upcoming message */}
                {isEnded && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                        <h3 className="font-display font-black uppercase text-xl italic mb-2">Giveaway Ended</h3>
                        <p className="text-gray-500 text-sm">This giveaway has closed. The winner will be announced shortly.</p>
                    </div>
                )}

                {isUpcoming && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <h3 className="font-display font-black uppercase text-xl italic mb-2">Coming Soon</h3>
                        <p className="text-gray-500 text-sm">Entry opens when the countdown hits zero.</p>
                    </div>
                )}

                {/* Entry Form */}
                {canEnter && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Banner */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Personal Info */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
                            <h3 className="font-display font-black uppercase italic tracking-tighter">Your Info</h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                        Full Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-white/30 outline-none transition"
                                        placeholder="Your name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                        Email <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-white/30 outline-none transition"
                                        placeholder="you@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                        YouTube Handle <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.youtubeHandle}
                                        onChange={e => setFormData({ ...formData, youtubeHandle: e.target.value })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-white/30 outline-none transition"
                                        placeholder="@yourchannel"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                        Instagram <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.instagramUsername}
                                        onChange={e => setFormData({ ...formData, instagramUsername: e.target.value })}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-white/30 outline-none transition"
                                        placeholder="@yourusername"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Shirt Size */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                    <Shirt className="w-3.5 h-3.5 inline mr-1 mb-0.5" />
                                    Shirt Size <span className="text-red-400">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {SHIRT_SIZES.map(size => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, shirtSize: size })}
                                            className={`px-4 py-2 rounded-xl border text-sm font-bold uppercase transition ${
                                                formData.shirtSize === size
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Screenshots */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-display font-black uppercase italic tracking-tighter">Upload Screenshots</h3>
                                {calcPoints() > 0 && (
                                    <span className="text-sm font-black text-amber-400">
                                        {calcPoints()} / 4 pts
                                    </span>
                                )}
                            </div>

                            <ScreenshotUpload
                                label="YouTube Subscribe"
                                sublabel="Screenshot showing you're subscribed to the channel"
                                file={subFile}
                                preview={subPreview}
                                points={1}
                                required
                                onChange={e => handleFileChange(e, 'sub')}
                            />
                            <ScreenshotUpload
                                label="YouTube Comment"
                                sublabel="Screenshot of your comment on the latest video"
                                file={commentFile}
                                preview={commentPreview}
                                points={1}
                                required
                                onChange={e => handleFileChange(e, 'comment')}
                            />
                            <ScreenshotUpload
                                label="Follow @sgcoalition on Instagram"
                                sublabel="Screenshot showing you follow our Instagram page"
                                file={igFollowFile}
                                preview={igFollowPreview}
                                points={1}
                                required
                                onChange={e => handleFileChange(e, 'igfollow')}
                            />
                            <ScreenshotUpload
                                label="Instagram Story (Bonus)"
                                sublabel="Share a Coalition post to your story for +1 point"
                                file={storyFile}
                                preview={storyPreview}
                                points={1}
                                onChange={e => handleFileChange(e, 'story')}
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading || !formData.shirtSize}
                            className="w-full bg-white text-black font-black uppercase py-5 rounded-2xl text-sm tracking-widest hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Uploading & Submitting...
                                </>
                            ) : (
                                <>
                                    <Trophy className="w-5 h-5" />
                                    Submit Entry — {calcPoints()} pt{calcPoints() !== 1 ? 's' : ''} / 4
                                </>
                            )}
                        </button>

                        <p className="text-xs text-center text-gray-600">
                            One entry per email. Winner selected randomly from verified entries after the giveaway closes.
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};

export default GiveawayEntry;
