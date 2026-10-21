import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    PenTool, Shirt, Package, Building, SprayCan, Music, TrendingUp, ArrowRight, ArrowUpRight, Loader, Link2,
    Instagram, Twitter, Youtube, MessageCircle as MessageCircleIcon, Mail,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { supabase } from '../services/supabase';
import { BlogPost } from '../types';
import { blogFallbackPosts, normalizeBlogRows, filterBlogPostsByCategory } from '../data/blogPosts';
import Newsletter from '../components/Newsletter';
import Seo from '../components/Seo';
import { ABOUT_PAGE_TITLE, ABOUT_PAGE_DESCRIPTION } from '../constants';
import { MAIN_SHARING_LINK, MAIN_SHARING_LABEL } from '../utils/sharingLinks';
import {
    buildAboutPageJsonLd,
    buildOrganizationJsonLd,
    structuredDataGraph,
} from '../utils/structuredData';

// safeDate is duplicated from pages/Blog.tsx so the About page is self-
// contained (no cross-page util import — the about page renders the same
// shape but inline). If pages/Blog.tsx's safeDate evolves, mirror the
// change here.
const safeDate = (dateStr: any) => {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isValid(d) ? d : new Date();
};

// AboutRecentPosts: 3 most-recent blog posts fetched live from the `posts`
// table (the same source pages/Blog.tsx queries). Falls back to the static
// `blogFallbackPosts` array on network failure or empty result so crawlers + JS-
// disabled visitors see the most-recent 3 entries regardless of backend health.
// Mirrors the /blog card pattern (cover + category chip + date + excerpt
// + Read More → /blog/:slug), toned for the darker About-page surface.
const AboutRecentPosts: React.FC = () => {
    // Lazy initializer: SSR / first paint already shows the 3 fallback
    // posts so crawlers + JS-disabled visitors see real content (not a
    // spinner) during the brief window before `useEffect` upgrades to
    // live posts from the `posts` table. This was the SE gap that almost
    // cost us an SSR-snapshot in Google.
    const [posts, setPosts] = useState<BlogPost[]>(() =>
        filterBlogPostsByCategory(blogFallbackPosts, 'all').slice(0, 3)
    );
    // isLoading starts FALSE because the lazy init already populated `posts`.
    // We only flip it true when the useEffect actually swaps in live data.
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const query = supabase
                    .from('posts')
                    .select('*')
                    .eq('is_published', true)
                    .order('published_at', { ascending: false })
                    .limit(3);
                const { data, error } = await query;
                if (cancelled) return;
                if (error) throw error;
                const rows = normalizeBlogRows(data || []);
                if (rows.length > 0) {
                    setPosts(rows.slice(0, 3));
                } else {
                    setPosts(filterBlogPostsByCategory(blogFallbackPosts, 'all').slice(0, 3));
                }
            } catch (err: any) {
                console.error('AboutRecentPosts fetch failed:', err?.message || err);
                if (!cancelled) {
                    setPosts(filterBlogPostsByCategory(blogFallbackPosts, 'all').slice(0, 3));
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="text-center py-12 border border-white/10 rounded-2xl">
                <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">No updates yet</p>
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-3 gap-6">
            {posts.map(post => (
                <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 hover:bg-white/10 transition-all flex flex-col"
                >
                    {post.coverImage && (
                        <div className="aspect-[16/9] overflow-hidden bg-black/50">
                            <img
                                src={post.coverImage}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                    )}
                    <div className="p-6 flex-grow">
                        <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest mb-3">
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-sm">{post.category}</span>
                            <span className="text-gray-500">{format(safeDate(post.publishedAt || post.createdAt), 'MMM dd, yyyy')}</span>
                        </div>
                        <h3 className="text-lg font-bold uppercase tracking-tight mb-3 group-hover:underline line-clamp-2">{post.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Read More →</span>
                    </div>
                </Link>
            ))}
        </div>
    );
};

// /about structured data: the shared brand Organization node (@id) plus the
// AboutPage that references it, so a crawler dedupes both surfaces to one
// entity instead of reading a per-page copy of the brand. Both nodes come from
// utils/structuredData.ts — the single owner of the JSON-LD graph — and
// scripts/generateSeoArtifacts.mjs mirrors the same builders into
// dist/about/index.html, so the raw HTML carries the graph before React runs.
// Built once at module scope so <Seo>'s head effect keeps a stable identity.
const ABOUT_PAGE_LD = structuredDataGraph([buildOrganizationJsonLd(), buildAboutPageJsonLd()]);

const Story = () => {
    return (
        <div className="bg-[#050505] text-white min-h-screen font-sans selection:bg-purple-500/30 overflow-x-hidden">
            {/* Arcane Background Layers */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-purple-600/5 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse delay-[3000ms]" />
                <div
                    className="absolute inset-0 bg-repeat opacity-[0.03] mix-blend-screen"
                    style={{ backgroundImage: "url('/images/patterns/noise.svg')" }}
                />
            </div>

            {/* SEO */}
            <Seo
                title={ABOUT_PAGE_TITLE}
                description={ABOUT_PAGE_DESCRIPTION}
                canonicalPath="/about"
                jsonLd={ABOUT_PAGE_LD}
            />

            {/* Hero Section */}
            <section className="relative h-[90vh] w-full flex items-center justify-center overflow-hidden pt-20">
                <div className="absolute inset-0">
                    <img
                        src="/story-hero.png"
                        alt="Gmoneyworld Hero"
                        className="w-full h-full object-cover opacity-40"
                    />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                <div className="relative z-10 text-center px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold"
                        >
                            <PenTool className="w-3 h-3" /> The Origin
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-7xl md:text-[12rem] font-black uppercase tracking-tighter leading-[0.65] mb-8 font-display"
                        >
                            Gmoneyworld
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-xl md:text-3xl font-light text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed tracking-widest uppercase"
                        >
                            More Than A Brand. It&apos;s A Movement.
                        </motion.p>
                    </motion.div>
                </div>
            </section>

            {/* Emotional Origin Story */}
            <section className="relative py-24 px-6 max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold mx-auto">
                        <PenTool className="w-3 h-3" /> Chapter One
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-10 font-display">
                        The <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500 bg-clip-text text-transparent italic">Origin</span>
                    </h2>
                    <p className="text-xl md:text-2xl font-light text-gray-300 leading-relaxed mb-6 max-w-3xl mx-auto">
                        Coalition was born from <span className="text-white font-medium">loss</span>.
                    </p>
                    <p className="text-xl md:text-2xl font-light text-gray-300 leading-relaxed mb-6 max-w-3xl mx-auto">
                        After losing my best friend and blood cousin, the world stopped.
                        <br /><br />
                        Grief turned into a need for an outlet. That outlet became a promise.
                    </p>
                    <p className="text-xl md:text-2xl font-light text-gray-300 leading-relaxed max-w-3xl mx-auto">
                        To keep going. To build something that lasts. To turn pain into power.
                    </p>
                    <div className="w-24 h-1 bg-gradient-to-r from-purple-500 to-blue-500 mx-auto mt-12" />
                </motion.div>
            </section>

            {/* Founder Background */}
            <section className="relative py-24 px-6 max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="grid md:grid-cols-2 gap-16 items-center"
                >
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold">
                            <PenTool className="w-3 h-3" /> The Grind
                        </div>
                        <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-6 font-display">
                            Started From <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Nothing</span>
                        </h3>
                        <p className="text-lg text-gray-400 leading-loose mb-6">
                            Started in a basement with nothing but a vision.
                            <br /><br />
                            I taught myself to sew, learned the tech, and built this site line by line.
                        </p>
                        <p className="text-lg text-gray-400 leading-loose">
                            Between balancing life pressure, making music, and hustling for better days,
                            <br /><br />
                            Coalition became the proof that you can build a universe from scratch.
                        </p>
                    </div>
                    <div className="relative h-[500px] md:h-[600px] bg-black rounded-[2rem] overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] transform rotate-2 hover:rotate-0 transition-all duration-700 group">
                        <img
                            src="/story-mission.png"
                            alt="The Grind"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 p-8">
                            <p className="text-white font-black text-2xl md:text-3xl uppercase tracking-widest">Built From Nothing</p>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Mission Graphic Section - Resilience */}
            <section className="relative py-32 px-6 overflow-hidden">
                <div className="absolute inset-0">
                    <img
                        src="/story-mission.png"
                        alt="Mission Graphic"
                        className="w-full h-full object-cover opacity-20"
                    />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold mx-auto">
                            <Music className="w-3 h-3" /> Resilience
                        </div>
                        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-8 font-display">
                            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500 bg-clip-text text-transparent italic">Resilience</span>
                        </h2>
                        <p className="text-xl md:text-2xl font-light text-gray-300 leading-relaxed mb-8">
                            Crosses for the burdens we carry. Angels for the ones watching over us.
                            <br />
                        </p>
                        <p className="text-xl md:text-2xl font-medium text-white leading-relaxed max-w-3xl mx-auto">
                            Gmoneyworld is about surviving everything and creating something bigger.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* What Gets Made Here */}
            <section className="relative py-24 px-6 max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold mx-auto">
                        <Package className="w-3 h-3" /> What Gets Made Here
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter font-display">
                        What Gets Made <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Here</span>
                    </h2>
                </motion.div>
                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: <Shirt className="w-8 h-8" />,
                            color: 'purple',
                            title: 'By Hand, Every Time',
                            desc: 'Every piece from our drops is hand-crafted, start to finish. Production runs are kept small on purpose — the labor lives in the build, not the marketing.',
                        },
                        {
                            icon: <Package className="w-8 h-8" />,
                            color: 'blue',
                            title: 'Limited Means Limited',
                            desc: 'When a run sells out, it doesn&apos;t quietly restock. The limited-edition tag is a promise — once it&apos;s claimed, it&apos;s claimed for good.',
                        },
                        {
                            icon: <TrendingUp className="w-8 h-8" />,
                            color: 'purple',
                            title: 'The Ladder',
                            desc: 'Handcrafted standard drops start at $75. The Above as Below Set runs $120 — that&apos;s $30 less than the sum of its parts. The Chrome Hearts Wallet sits at $450 as the collection&apos;s ceiling.',
                        },
                    ].map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                            className="p-10 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="relative z-10">
                                <div className={`p-4 rounded-2xl bg-${item.color === 'purple' ? 'purple' : 'blue'}-500/10 border border-${item.color === 'purple' ? 'purple' : 'blue'}-500/20 w-fit mb-6 group-hover:scale-110 transition-transform`}>
                                    {React.cloneElement(item.icon as React.ReactElement<any>, { className: `w-8 h-8 text-${item.color === 'purple' ? 'purple' : 'blue'}-400` })}
                                </div>
                                <h3 className="text-2xl font-display font-bold uppercase mb-4">{item.title}</h3>
                                <p className="text-gray-400 text-lg leading-loose">{item.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Timeline Section */}
            <section className="relative py-24 px-6 max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold mx-auto">
                        <TrendingUp className="w-3 h-3" /> The Journey
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter font-display">
                        The <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Journey</span>
                    </h2>
                </motion.div>

                <div className="space-y-10 relative">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-purple-500/30 to-transparent -translate-x-1/2 hidden md:block" />
                    {[
                        { year: 'Inception', icon: PenTool, color: 'purple', desc: 'First logo sketches. The vision takes shape.' },
                        { year: 'First Drop', icon: Shirt, color: 'blue', desc: 'The first hoodie. Physical manifestation of the brand.' },
                        { year: 'Validation', icon: Package, color: 'purple', desc: 'First orders shipping out. The community begins to grow.' },
                        { year: 'Expansion', icon: Building, color: 'blue', desc: 'New office space. Moving out of the basement.' },
                        { year: 'The Grind', icon: SprayCan, color: 'purple', desc: 'Stash cans and late nights. Hustling for the vision.' },
                        { year: 'Soundtrack', icon: Music, color: 'blue', desc: 'Music dropping. The culture expands beyond clothes.' },
                        { year: 'Comeback', icon: TrendingUp, color: 'purple', desc: 'Rebuilds and resilience. Stronger than ever.' },
                        { year: 'Above as Below', icon: Shirt, color: 'blue', desc: 'The matching tee and shorts land as a coordinated drop. $75 per piece, $120 for the set, never restocked.' },
                    ].map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: idx * 0.08 }}
                            className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-8"
                        >
                            <div className={`flex items-center justify-center w-16 h-16 rounded-full border-2 bg-black text-white shadow-[0_0_30px_rgba(0,0,0,0.5)] shrink-0 z-10 bg-${item.color === 'purple' ? 'purple' : 'blue'}-600`}>
                                {React.createElement(item.icon as any, { className: 'w-7 h-7' })}
                            </div>
                            <div className="w-full md:w-[calc(50%-2rem)] p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl">
                                <div className="text-white font-black uppercase tracking-widest text-xl mb-2">{item.year}</div>
                                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Connect — social links */}
            <section className="relative py-16 px-6 max-w-6xl mx-auto border-t border-white/5">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-12"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">Connect</p>
                    <h2 className="text-4xl md:text-5xl font-black uppercase mb-2 font-display">Follow The Movement</h2>
                    <p className="text-sm text-gray-500">Drops, behind-the-scenes, the grind — across every channel.</p>
                </motion.div>
                <div className="flex flex-wrap justify-center gap-4">
                    <a href={MAIN_SHARING_LINK} target="_blank" rel="noopener noreferrer" aria-label={`Portfolio and all links (opens ${MAIN_SHARING_LABEL})`} className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-purple-500/30 group-hover:border-purple-500/30 transition-all">
                            <Link2 className="w-4 h-4 text-purple-400" /> All Links
                        </div>
                    </a>
                    <a href="https://www.instagram.com/sgcoalition" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-pink-900/40 group-hover:border-pink-500/30 transition-all">
                            <Instagram className="w-4 h-4 text-pink-400" /> Instagram
                        </div>
                    </a>
                    <a href="https://twitter.com/sgcoalition" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-900/30 to-blue-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-sky-900/40 group-hover:border-sky-500/30 transition-all">
                            <Twitter className="w-4 h-4 text-sky-400" /> X / Twitter
                        </div>
                    </a>
                    <a href="https://www.youtube.com/@sgctrustyourself" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-900/30 to-rose-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-red-900/40 group-hover:border-red-500/30 transition-all">
                            <Youtube className="w-4 h-4 text-red-400" /> YouTube
                        </div>
                    </a>
                    <a href="https://www.reddit.com/r/SGCoalition/" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-900/30 to-amber-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-amber-900/40 group-hover:border-amber-500/30 transition-all">
                            <MessageCircleIcon className="w-4 h-4 text-orange-400" /> Reddit
                        </div>
                    </a>
                    <a href="https://discord.gg/bByqsC5f5V" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-indigo-900/40 group-hover:border-indigo-500/30 transition-all">
                            <MessageCircleIcon className="w-4 h-4 text-indigo-400" /> Discord
                        </div>
                    </a>
                    <a href="mailto:sgctrustyourself@gmail.com" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-white/10 group-hover:border-white/20 transition-all">
                            <Mail className="w-4 h-4 text-purple-400" /> Email
                        </div>
                    </a>
                </div>
            </section>

            {/* From The Blog — 3 most-recent posts */}
            <section className="relative py-16 px-6 max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12"
                >
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">From The Blog</p>
                        <h2 className="text-4xl md:text-5xl font-black uppercase font-display">Latest Updates</h2>
                    </div>
                    <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                        View All <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </motion.div>
                <AboutRecentPosts />
            </section>

            {/* Newsletter */}
            <section className="relative py-20 px-6 max-w-4xl mx-auto">
                <Newsletter source="about" variant="block" />
            </section>

            {/* Brand Message / Footer Callout */}
            <section className="relative py-32 px-6 text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
                <div className="relative z-10 max-w-3xl mx-auto">
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-5xl md:text-7xl font-black uppercase mb-8 font-display"
                    >
                        Turn Losses Into <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Movement</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className="text-xl text-gray-400 mb-12"
                    >
                        Unity. Creativity. Rising from the struggle.
                    </motion.p>
                    <motion.a
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        href="/shop"
                        className="inline-flex items-center gap-3 bg-white text-black px-10 py-4 font-black uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all duration-300 rounded-lg shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                    >
                        Join The Movement <ArrowRight className="w-5 h-5" />
                    </motion.a>
                </div>
            </section>
        </div>
    );
};

export default Story;