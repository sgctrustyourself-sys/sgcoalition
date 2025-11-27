import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Instagram, Upload, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { uploadAllScreenshots, validateImage } from '../services/giveawayUpload';
import { supabase } from '../services/supabase';
import { InstagramGiveawayEntry } from '../types';

const GiveawayEntry = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        instagramUsername: ''
    });

    // File state
    const [followFile, setFollowFile] = useState<File | null>(null);
    const [likeFile, setLikeFile] = useState<File | null>(null);
    const [storyFile, setStoryFile] = useState<File | null>(null);

    // Preview URLs
    const [followPreview, setFollowPreview] = useState<string>('');
    const [likePreview, setLikePreview] = useState<string>('');
    const [storyPreview, setStoryPreview] = useState<string>('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        type: 'follow' | 'like' | 'story'
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateImage(file);
        if (!validation.valid) {
            setError(validation.error || 'Invalid file');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            const preview = reader.result as string;
            if (type === 'follow') {
                setFollowFile(file);
                setFollowPreview(preview);
            } else if (type === 'like') {
                setLikeFile(file);
                setLikePreview(preview);
            } else {
                setStoryFile(file);
                setStoryPreview(preview);
            }
        };
        reader.readAsDataURL(file);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.name || !formData.email || !formData.instagramUsername) {
            setError('Please fill in all fields');
            return;
        }

        if (!followFile || !likeFile || !storyFile) {
            setError('Please upload all 3 screenshots');
            return;
        }

        if (!id) {
            setError('Invalid giveaway ID');
            return;
        }

        setLoading(true);

        try {
            // Check for duplicate entry
            const { data: existing } = await supabase
                .from('giveaway_entries')
                .select('id')
                .eq('giveaway_id', id)
                .eq('email', formData.email)
                .single();

            if (existing) {
                setError('You have already entered this giveaway with this email');
                setLoading(false);
                return;
            }

            // Upload screenshots
            const { followUrl, likeUrl, storyUrl } = await uploadAllScreenshots(
                followFile,
                likeFile,
                storyFile,
                id
            );

            // Create entry in database
            const entry: Omit<InstagramGiveawayEntry, 'id' | 'createdAt'> = {
                giveawayId: id,
                name: formData.name,
                email: formData.email,
                instagramUsername: formData.instagramUsername.replace('@', ''),
                screenshotFollowUrl: followUrl,
                screenshotLikeUrl: likeUrl,
                screenshotStoryUrl: storyUrl,
                verified: false
            };

            const { error: dbError } = await supabase
                .from('giveaway_entries')
                .insert([entry]);

            if (dbError) {
                console.error('Database error:', dbError);
                throw new Error('Failed to submit entry. Please try again.');
            }

            setSuccess(true);
            setLoading(false);

            // Redirect after 3 seconds
            setTimeout(() => {
                navigate('/ecosystem');
            }, 3000);

        } catch (err: any) {
            console.error('Submission error:', err);
            setError(err.message || 'Failed to submit entry. Please try again.');
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-12 h-12 text-green-400" />
                    </div>
                    <h1 className="font-display text-4xl font-bold uppercase mb-4">
                        Entry Submitted!
                    </h1>
                    <p className="text-gray-400 mb-8">
                        Thank you for entering! We'll review your submission and announce the winner soon.
                    </p>
                    <button
                        onClick={() => navigate('/ecosystem')}
                        className="bg-white text-black px-6 py-3 rounded-lg font-bold uppercase hover:bg-gray-200 transition"
                    >
                        Back to Ecosystem
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <button
                    onClick={() => navigate('/ecosystem')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Ecosystem
                </button>

                <div className="text-center mb-12">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Instagram className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl font-bold uppercase mb-4">
                        Enter Giveaway
                    </h1>
                    <p className="text-gray-400 max-w-xl mx-auto">
                        Complete all requirements and upload screenshots to enter for a chance to win!
                    </p>
                </div>

                {/* Requirements */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                    <h2 className="font-bold text-xl uppercase mb-4">Entry Requirements</h2>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Follow @sgcoalition on Instagram</p>
                                <p className="text-sm text-gray-500">Screenshot your follow confirmation</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Like at least one post</p>
                                <p className="text-sm text-gray-500">Screenshot showing the liked post</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Share one post to your story for 24+ hours</p>
                                <p className="text-sm text-gray-500">Screenshot of your story post</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Entry Form */}
                <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
                    {/* Personal Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                placeholder="John Doe"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                Email *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                placeholder="john@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                            Instagram Username *
                        </label>
                        <input
                            type="text"
                            value={formData.instagramUsername}
                            onChange={(e) => setFormData({ ...formData, instagramUsername: e.target.value })}
                            className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                            placeholder="@yourusername"
                            required
                        />
                    </div>

                    {/* Screenshot Uploads */}
                    <div className="space-y-4">
                        <h3 className="font-bold uppercase text-gray-300">Upload Screenshots *</h3>

                        {/* Follow Screenshot */}
                        <ScreenshotUpload
                            label="Follow Screenshot"
                            file={followFile}
                            preview={followPreview}
                            onChange={(e) => handleFileChange(e, 'follow')}
                        />

                        {/* Like Screenshot */}
                        <ScreenshotUpload
                            label="Like Screenshot"
                            file={likeFile}
                            preview={likePreview}
                            onChange={(e) => handleFileChange(e, 'like')}
                        />

                        {/* Story Screenshot */}
                        <ScreenshotUpload
                            label="Story Screenshot"
                            file={storyFile}
                            preview={storyPreview}
                            onChange={(e) => handleFileChange(e, 'story')}
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-bold uppercase py-4 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Submit Entry'
                        )}
                    </button>

                    <p className="text-xs text-center text-gray-500">
                        By submitting, you agree to our terms and conditions. Winner will be selected randomly from verified entries.
                    </p>
                </form>
            </div>
        </div>
    );
};

// Screenshot Upload Component
const ScreenshotUpload: React.FC<{
    label: string;
    file: File | null;
    preview: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, file, preview, onChange }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
            <div className="relative">
                {preview ? (
                    <div className="relative group">
                        <img
                            src={preview}
                            alt={label}
                            className="w-full h-48 object-cover rounded-lg border border-gray-700"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg">
                            <label className="cursor-pointer bg-white text-black px-4 py-2 rounded font-bold text-sm uppercase">
                                Change
                                <input
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    onChange={onChange}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition">
                        <Upload className="w-8 h-8 text-gray-500 mb-2" />
                        <span className="text-sm text-gray-500">Click to upload</span>
                        <span className="text-xs text-gray-600 mt-1">JPG, PNG, or WebP (Max 5MB)</span>
                        <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={onChange}
                            className="hidden"
                        />
                    </label>
                )}
            </div>
            {file && (
                <p className="text-xs text-gray-500 mt-1">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
            )}
        </div>
    );
};

export default GiveawayEntry;
