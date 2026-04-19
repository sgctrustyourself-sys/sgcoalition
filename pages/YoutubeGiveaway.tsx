import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    Youtube, 
    Instagram, 
    MessageCircle, 
    Bell, 
    CheckCircle, 
    Lock, 
    Clock, 
    Trophy,
    Loader2 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, Giveaway } from '../types';
import { supabase } from '../services/supabase';
import YoutubeGiveawayForm from '../components/giveaway/YoutubeGiveawayForm';
import GiveawayCountdown from '../components/giveaway/GiveawayCountdown';

// Helper component for point list
const PointAction = ({ icon, title, points, desc, href }: { icon: React.ReactNode, title: string, points: string, desc: string, href?: string }) => {
    const content = (
        <div className="flex items-center justify-between group cursor-pointer">
            <div className="flex gap-5 items-center">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all duration-500 shadow-lg shadow-white/0 group-hover:shadow-white/10">
                    {icon}
                </div>
                <div>
                    <h4 className="font-black uppercase text-sm tracking-tight group-hover:translate-x-1 transition-transform">{title}</h4>
                    <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">{desc}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="h-px w-8 bg-white/5 group-hover:w-12 transition-all duration-500" />
                <span className="font-mono font-bold text-white text-sm group-hover:text-glow">{points}</span>
            </div>
        </div>
    );

    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="block outline-none">
                {content}
            </a>
        );
    }
    return content;
};

const YoutubeGiveaway = () => {
    const navigate = useNavigate();
    const { products } = useApp();
    const [prizeProduct, setPrizeProduct] = useState<Product | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [giveawayData, setGiveawayData] = useState<Giveaway | null>(null);
    const [portalStatus, setPortalStatus] = useState<'upcoming' | 'active' | 'ended'>('active');
    const [loading, setLoading] = useState(true);

    // Fetch Giveaway Details for Timing
    useEffect(() => {
        const fetchGiveaway = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('giveaways')
                .select('*')
                .eq('id', 'giveaway_nf_tee_01')
                .maybeSingle();

            if (!error && data) {
                setGiveawayData({
                    ...data,
                    startDate: data.start_date,
                    endDate: data.end_date
                });
            } else {
                // Fallback for demo/safety: Start now, end in 7 days
                const now = new Date();
                const end = new Date();
                end.setDate(now.getDate() + 7);
                
                setGiveawayData({
                    id: 'giveaway_nf_tee_01',
                    title: 'NF-TEE Access Portal',
                    prize: 'Coalition NF-Tee',
                    description: '',
                    startDate: now.toISOString(),
                    endDate: end.toISOString(),
                    status: 'active',
                    requirements: [],
                    maxEntriesPerUser: 1,
                    entries: [],
                    createdAt: Date.now()
                });
            }
            setLoading(false);
        };

        fetchGiveaway();
    }, []);

    // Look up the actual prize product (Coalition NF-Tee)
    useEffect(() => {
        if (products && products.length > 0) {
            const tee = products.find(p => p.id === 'Coalition_NF_Tee');
            if (tee) setPrizeProduct(tee);
        }
    }, [products]);

    // Force Purge Gleam Script Remnants (just in case)
    useEffect(() => {
        const cleanup = () => {
            document.querySelectorAll('[id*="gleam"], [class*="gleam"]').forEach(el => el.remove());
        };
        cleanup();
        const interval = setInterval(cleanup, 2000); 
        return () => clearInterval(interval);
    }, []);

    if (submitted) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
                <div className="max-w-md animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-white/20">
                        <CheckCircle className="w-12 h-12 text-black" />
                    </div>
                    <h1 className="font-display text-4xl font-black uppercase mb-4 tracking-tighter">ACCESS GRANTED</h1>
                    <p className="text-gray-500 mb-10 text-sm leading-relaxed uppercase font-bold tracking-widest text-balance">
                        Your entry proof has been uploaded to the Coalition server. 
                        We will verify your actions and announce the winner on YouTube.
                    </p>
                    <button 
                        onClick={() => navigate('/ecosystem')}
                        className="bg-white/10 hover:bg-white/20 border border-white/10 px-8 py-4 rounded-xl font-black uppercase text-xs tracking-[0.3em] transition-all"
                    >
                        Return to Ecosystem
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 font-sans selection:bg-white selection:text-black">
            {/* Background Atmosphere */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <button
                    onClick={() => navigate('/ecosystem')}
                    className="flex items-center gap-2 text-gray-500 hover:text-white mb-12 transition-all duration-300 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-widest">Back to Ecosystem</span>
                </button>

                <div className="grid lg:grid-cols-2 gap-16 items-start mb-20">
                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="h-[2px] w-8 bg-white/20" />
                            <div className="bg-white/10 px-3 py-1 uppercase font-black text-[10px] tracking-[0.2em] text-white/80 border border-white/5">
                                Limited Drop Giveaway
                            </div>
                        </div>

                        <h1 className="font-display text-5xl md:text-6xl font-black uppercase leading-[0.9] tracking-tighter">
                            THE <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-400 to-gray-600">NF-TEE</span> <br/>
                            ACCESS
                        </h1>
                        
                        <p className="text-gray-400 text-lg leading-relaxed font-medium">
                            Enter the next phase of the Coalition. We're giving away the premier "Trust Yourself" NF-Tee — your direct bridge to our physical and digital ecosystem.
                        </p>

                        {prizeProduct && (
                            <div className="relative group mt-10 rounded-2xl p-px bg-gradient-to-b from-white/20 to-transparent">
                                <div className="rounded-2xl overflow-hidden bg-gray-950 relative">
                                    <img 
                                        src={prizeProduct.images?.[0] || ''} 
                                        alt={prizeProduct.name}
                                        className="w-full aspect-[4/5] object-cover object-center group-hover:scale-110 transition duration-1000 ease-in-out saturate-[0.8] group-hover:saturate-100"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/99 via-transparent to-transparent opacity-80" />
                                    <div className="absolute bottom-8 left-8">
                                        <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-white/50 mb-1">Active Prize</p>
                                        <h3 className="font-display font-black uppercase tracking-tight text-3xl">{prizeProduct.name}</h3>
                                        <div className="mt-3 flex items-center gap-4">
                                            <span className="text-xl font-bold font-mono tracking-tighter">${prizeProduct.price}.00</span>
                                            <div className="h-1 w-1 bg-white/30 rounded-full" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-white/60">Limited 1/1</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-12 py-4">
                        <section>
                            <h2 className="font-display text-xs font-black uppercase tracking-[0.4em] text-white/40 mb-8 flex items-center gap-4">
                                <span>01</span>
                                <div className="h-px flex-1 bg-white/10" />
                                <span>Entry Rewards</span>
                            </h2>

                            <div className="space-y-8">
                                <PointAction 
                                    icon={<Youtube className="w-5 h-5 text-red-500" />} 
                                    title="YouTube Subscription" 
                                    points="+3" 
                                    desc="Official SGCoalition Channel"
                                    href="https://www.youtube.com/@sgctrustyourself"
                                />
                                <PointAction 
                                    icon={<MessageCircle className="w-5 h-5 text-blue-400" />} 
                                    title="Recent Engagement" 
                                    points="+2" 
                                    desc="Comment & Like on Latest Drop"
                                    href="https://www.youtube.com/@sgctrustyourself"
                                />
                                <PointAction 
                                    icon={<Instagram className="w-5 h-5 text-pink-500" />} 
                                    title="Social Amplification" 
                                    points="+2" 
                                    desc="Share to Story & Tag @sgcoalition"
                                    href="https://www.instagram.com/sgcoalition"
                                />
                                <PointAction 
                                    icon={<Bell className="w-5 h-5 text-white" />} 
                                    title="Archive Mastery" 
                                    points="+1 EA" 
                                    desc="Engage on older videos for bonus"
                                    href="https://www.youtube.com/@sgctrustyourself"
                                />
                            </div>
                        </section>

                        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                <Youtube className="w-20 h-20 text-white" />
                            </div>
                            <h3 className="font-black uppercase text-sm mb-2 font-display italic text-glow">Strategy Note</h3>
                            <p className="text-[10px] text-gray-500 leading-relaxed uppercase font-bold tracking-widest text-balance">
                                Proof screenshots are verified manually. Multiple engagement on older videos stack entries up to 10 points. 
                            </p>
                        </section>
                    </div>
                </div>

                {giveawayData && (
                    <div className="mb-20">
                        <GiveawayCountdown 
                            startDate={giveawayData.startDate} 
                            endDate={giveawayData.endDate} 
                            onStatusChange={setPortalStatus}
                        />
                    </div>
                )}

                <div id="enter" className="mb-24 pt-12 border-t border-white/5">
                    <div className="flex flex-col items-center mb-12 text-center">
                        <h2 className="font-display text-4xl font-black uppercase tracking-[0.05em] mb-4 italic">Access Portal</h2>
                        <p className="text-gray-500 text-xs max-w-sm font-bold uppercase tracking-widest">Verify your actions and confirm your shirt size below.</p>
                    </div>
                    
                    <div className="max-w-2xl mx-auto relative">
                        {portalStatus === 'active' ? (
                            <YoutubeGiveawayForm 
                                giveawayId="giveaway_nf_tee_01" 
                                onSuccess={() => {
                                    setSubmitted(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }} 
                            />
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center backdrop-blur-md">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                                    <Lock className="w-8 h-8 text-gray-700" />
                                </div>
                                <h3 className="font-display font-black uppercase text-xl mb-3 tracking-tighter">
                                    {portalStatus === 'upcoming' ? 'Access Pending' : 'Access Revoked'}
                                </h3>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest leading-relaxed">
                                    {portalStatus === 'upcoming' 
                                        ? 'The submission portal is currently locked. Check the timer above for opening time.' 
                                        : 'This giveaway has concluded. Submissions are no longer being accepted.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mb-24">
                    <h2 className="font-display text-xs font-black uppercase tracking-[0.4em] text-white/40 mb-12 flex items-center gap-4 text-center justify-center">
                        <div className="h-px w-24 bg-white/10" />
                        <span>The Vision</span>
                        <div className="h-px w-24 bg-white/10" />
                    </h2>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="group relative rounded-2xl overflow-hidden aspect-[16/10] border border-white/5 bg-gray-950">
                            <img src="/story-hero.png" alt="Coalition Story Hero" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale group-hover:grayscale-0 opacity-40 group-hover:opacity-100" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <div className="absolute bottom-6 left-6">
                                <p className="font-display font-black uppercase text-xl italic tracking-tighter">Crafted in Baltimore</p>
                            </div>
                        </div>
                        <div className="group relative rounded-2xl overflow-hidden aspect-[16/10] border border-white/5 bg-gray-950">
                            <img src="/story-mission.png" alt="Coalition Mission" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale group-hover:grayscale-0 opacity-40 group-hover:opacity-100" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <div className="absolute bottom-6 left-6">
                                <p className="font-display font-black uppercase text-xl italic tracking-tighter">The Movement</p>
                            </div>
                        </div>
                    </div>
                </div>
                    
                <div className="mt-12 text-center text-gray-600 text-[10px] uppercase font-bold tracking-[0.3em]">
                    Coalition Access Protocol • Private Secure Cloud
                </div>
            </div>
        </div>
    );
};

export default YoutubeGiveaway;
