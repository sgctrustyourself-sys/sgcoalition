import React, { useState, useEffect } from 'react';
import { Youtube, Instagram, Upload, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';
import { uploadScreenshot, validateImage } from '../../services/giveawayUpload';
import { supabase } from '../../services/supabase';
import { YoutubeGiveawayEntry } from '../../types';

interface YoutubeGiveawayFormProps {
    giveawayId: string;
    onSuccess: () => void;
}

const YoutubeGiveawayForm: React.FC<YoutubeGiveawayFormProps> = ({ giveawayId, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        instagramUsername: '',
        youtubeHandle: '',
        shirtSize: ''
    });

    const [files, setFiles] = useState<{
        sub: File | null;
        comment: File | null;
        story: File | null;
        bonus: File[];
    }>({
        sub: null,
        comment: null,
        story: null,
        bonus: []
    });

    const [previews, setPreviews] = useState<{
        sub: string;
        comment: string;
        story: string;
        bonus: string[];
    }>({
        sub: '',
        comment: '',
        story: '',
        bonus: []
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [points, setPoints] = useState(0);

    // Calculate points in real-time
    useEffect(() => {
        let total = 0;
        if (files.sub) total += 3;
        if (files.comment) total += 2;
        if (files.story) total += 2;
        total += files.bonus.length; // 1pt each
        setPoints(total);
    }, [files]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'sub' | 'comment' | 'story' | 'bonus') => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        if (type === 'bonus') {
            const newFiles = Array.from(selectedFiles).slice(0, 5); // Limit to 5 bonus
            setFiles(prev => ({ ...prev, bonus: [...prev.bonus, ...newFiles].slice(0, 5) }));
            
            newFiles.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviews(prev => ({ ...prev, bonus: [...prev.bonus, reader.result as string].slice(0, 5) }));
                };
                reader.readAsDataURL(file);
            });
        } else {
            const file = selectedFiles[0];
            const validation = validateImage(file);
            if (!validation.valid) {
                setError(validation.error || 'Invalid image');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviews(prev => ({ ...prev, [type]: reader.result as string }));
                setFiles(prev => ({ ...prev, [type]: file }));
            };
            reader.readAsDataURL(file);
        }
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.name || !formData.email || !formData.youtubeHandle || !formData.shirtSize) {
            setError('Please fill in all required fields and select your size.');
            return;
        }

        if (!files.sub || !files.comment) {
            setError('Please upload proof of Subscription and Comment to enter.');
            return;
        }

        setLoading(true);

        try {
            // Check for duplicate entry
            const { data: existing } = await supabase
                .from('giveaway_entries')
                .select('id')
                .eq('giveaway_id', giveawayId)
                .eq('email', formData.email)
                .single();

            if (existing) {
                setError('An entry with this email already exists for this giveaway.');
                setLoading(false);
                return;
            }

            // Upload essential images
            const subUrl = await uploadScreenshot(files.sub, 'yt_sub', giveawayId);
            const commentUrl = await uploadScreenshot(files.comment, 'yt_comment', giveawayId);
            
            let storyUrl = '';
            if (files.story) {
                storyUrl = await uploadScreenshot(files.story, 'story_share', giveawayId);
            }

            // Upload bonus images
            const bonusUrls: string[] = [];
            for (let i = 0; i < files.bonus.length; i++) {
                const url = await uploadScreenshot(files.bonus[i], `bonus_${i}`, giveawayId);
                bonusUrls.push(url);
            }

            // Create entry in database
            const entry: Omit<YoutubeGiveawayEntry, 'id' | 'createdAt' | 'verified'> = {
                giveawayId,
                name: formData.name,
                email: formData.email,
                instagramUsername: formData.instagramUsername.replace('@', ''),
                youtubeHandle: formData.youtubeHandle,
                shirtSize: formData.shirtSize,
                screenshotSubUrl: subUrl,
                screenshotCommentUrl: commentUrl,
                screenshotStoryUrl: storyUrl,
                screenshotBonusUrls: bonusUrls,
                claimedPoints: points
            };

            const { error: dbError } = await supabase
                .from('giveaway_entries')
                .insert([entry]);

            if (dbError) throw dbError;

            onSuccess();
        } catch (err: any) {
            console.error('Submission error:', err);
            setError(err.message || 'Failed to submit entry. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Real-time Points Counter */}
            <div className="bg-white text-black p-4 rounded-xl flex items-center justify-between shadow-2xl shadow-white/5">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Your Entries</p>
                    <h4 className="text-3xl font-black italic tracking-tighter">{points} POINTS</h4>
                </div>
                <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center">
                    <CheckCircle className={`w-5 h-5 ${points > 0 ? 'text-green-500' : 'text-white/20'}`} />
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 ml-1">Full Name</label>
                    <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:border-white focus:bg-white/10 transition-all outline-none"
                        placeholder="John Doe"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 ml-1">Email Address</label>
                    <input 
                        type="email" 
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:border-white focus:bg-white/10 transition-all outline-none"
                        placeholder="john@example.com"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 ml-1">Instagram (@optional)</label>
                    <input 
                        type="text" 
                        value={formData.instagramUsername}
                        onChange={(e) => setFormData({...formData, instagramUsername: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:border-white focus:bg-white/10 transition-all outline-none"
                        placeholder="@username"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 ml-1">YouTube Handle *</label>
                    <input 
                        type="text" 
                        required
                        value={formData.youtubeHandle}
                        onChange={(e) => setFormData({...formData, youtubeHandle: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:border-white focus:bg-white/10 transition-all outline-none"
                        placeholder="@yourchannel"
                    />
                </div>
            </div>

            {/* Size Selector */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <label className="block text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-6 flex items-center gap-2">
                    <Info className="w-3 h-3" /> Select Your Size
                </label>
                <div className="grid grid-cols-5 gap-3">
                    {['S', 'M', 'L', 'XL', 'XXL'].map(size => (
                        <button
                            key={size}
                            type="button"
                            onClick={() => setFormData({...formData, shirtSize: size})}
                            className={`py-3 rounded-lg font-black transition-all duration-300 border ${
                                formData.shirtSize === size 
                                ? 'bg-white text-black border-white scale-105 shadow-lg shadow-white/20' 
                                : 'bg-transparent text-white/40 border-white/10 hover:border-white/40'
                            }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            {/* Proof Uploads */}
            <div className="space-y-6">
                <h3 className="block text-[10px] font-black uppercase tracking-[0.4em] text-white/40 ml-1">Upload Proof (Screenshots)</h3>
                
                <div className="grid sm:grid-cols-2 gap-4">
                    <Uploader 
                        label="YouTube Subscription (+3)" 
                        preview={previews.sub} 
                        onChange={(e) => handleFileChange(e, 'sub')}
                    />
                    <Uploader 
                        label="Latest Video Comment (+2)" 
                        preview={previews.comment} 
                        onChange={(e) => handleFileChange(e, 'comment')}
                    />
                    <Uploader 
                        label="IG Story Share (+2)" 
                        preview={previews.story} 
                        onChange={(e) => handleFileChange(e, 'story')}
                    />
                    
                    <div className="relative group">
                        <label className="flex flex-col items-center justify-center aspect-video rounded-2xl border-2 border-dashed border-white/5 hover:border-white/20 transition-all cursor-pointer bg-white/[0.02]">
                            <Upload className="w-6 h-6 text-white/20 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center px-4">
                                {files.bonus.length > 0 ? `${files.bonus.length} Bonus Proofs Added` : 'Upload Bonus Points Proofs (+1 EA)'}
                            </span>
                            <input 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleFileChange(e, 'bonus')}
                            />
                        </label>
                    </div>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-black uppercase py-5 rounded-2xl hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 tracking-[0.2em]"
            >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Finalize Entry'}
            </button>
        </form>
    );
};

const Uploader = ({ label, preview, onChange }: { label: string, preview: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="relative">
        <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">{label}</label>
        <div className="relative group aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all">
            {preview ? (
                <>
                    <img src={preview} alt="Proof" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg text-xs font-black uppercase">Change</label>
                    </div>
                </>
            ) : (
                <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                    <Upload className="w-6 h-6 text-white/10 mb-2" />
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Select Image</span>
                </label>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        </div>
    </div>
);

export default YoutubeGiveawayForm;
