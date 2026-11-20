import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    PenTool, Shirt, Package, TrendingUp, ArrowUpRight, Loader, Link2,
    Instagram, Twitter, Youtube, MessageCircle as MessageCircleIcon, Mail, ExternalLink,
    Globe2, Flame, Heart,
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
const safeDate = (dateStr: string | number | Date | null | undefined) => {
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
            } catch (err) {
                console.error('AboutRecentPosts fetch failed:', err instanceof Error ? err.message : err);
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

type StoryChapter = {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    headline: string;
    accent?: string;
    paragraphs: string[];
    signoff?: string;
};

// The founder narrative, pulled from the 10.22.26 blog post
// ("The Legacy Continues: sgcoin & The Power Back in Our Hands").
// One array owns the copy so a future edit does not have to hunt through JSX.
const STORY_CHAPTERS: StoryChapter[] = [
    {
        id: 'the-loss',
        label: 'The Loss',
        icon: PenTool,
        headline: 'Built From',
        accent: 'Loss',
        paragraphs: [
            'Coalition was born from loss.',
            'I lost my best friend and blood cousin, Gerrod Greenwood \u2014 gmoney. The world stopped. Grief turned into a need for an outlet. That outlet became a promise: to keep going, to build something that lasts, to turn pain into power.',
            'The brand carries his name. Everything built here is measured against it.',
        ],
    },
    {
        id: 'the-beginning',
        label: 'The Beginning',
        icon: Globe2,
        headline: 'The Starting',
        accent: 'Days',
        paragraphs: [
            'Around 2020, the first pieces were made in Decentraland and The Sandbox \u2014 not a factory, a 3D world.',
            'Streaming. Giveaways. Learning contracts the hard way. A community that showed up every day.',
            'That was a part of my life I would never take back.',
        ],
    },
    {
        id: 'the-fracture',
        label: 'The Fracture',
        icon: Flame,
        headline: 'The Team Fell',
        accent: 'Apart',
        paragraphs: [
            'The team scattered. Friends went separate ways. I hold no ill will toward any of them.',
            'The coin tanked. Whales controlled the room \u2014 one vote was worth however much money was in your account. The community was supposed to be built by everyone, with everyone getting a fair say.',
            "It didn't work. So the next version had to.",
        ],
    },
    {
        id: 'the-legacy',
        label: 'The Legacy',
        icon: Heart,
        headline: '10.22.26',
        accent: '',
        paragraphs: [
            'On October 22, 2026, the mission picked back up.',
            "This isn't about chasing a number. This isn't about getting rich. This is about honoring someone who meant everything to me and building something that carries their name into the future.",
            "The coin might have started as an experiment. The migration might have been messy. The team might have scattered. But the mission hasn't changed: put the power back in the people's hands.",
        ],
        signoff: '\u2014 SG, 2026',
    },
];

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

            {/* The Story — four narrative chapters. Each chapter is its own <article>
                so the anchor ids are stable and the copy has one home in STORY_CHAPTERS. */}
            <section id="the-story" className="relative py-24 px-6 max-w-4xl mx-auto space-y-24">
                {STORY_CHAPTERS.map((chapter, index) => (
                    <motion.article
                        key={chapter.id}
                        id={chapter.id}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: index * 0.05 }}
                        className="text-center"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold">
                            <chapter.icon className="w-3 h-3" /> {chapter.label}
                        </div>
                        <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-10 font-display">
                            {chapter.headline}
                            {chapter.accent && (
                                <>
                                    {' '}
                                    <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500 bg-clip-text text-transparent italic">
                                        {chapter.accent}
                                    </span>
                                </>
                            )}
                        </h2>
                        <div className="space-y-6">
                            {chapter.paragraphs.map((paragraph) => (
                                <p
                                    key={paragraph}
                                    className="text-xl md:text-2xl font-light text-gray-300 leading-relaxed max-w-3xl mx-auto"
                                >
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                        {chapter.signoff && (
                            <p className="mt-10 text-sm uppercase tracking-[0.3em] text-gray-500">{chapter.signoff}</p>
                        )}
                        {index < STORY_CHAPTERS.length - 1 && (
                            <div className="w-24 h-1 bg-gradient-to-r from-purple-500 to-blue-500 mx-auto mt-12" />
                        )}
                    </motion.article>
                ))}
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
                        <Package className="w-3 h-3" /> The Brand Now
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter font-display">
                        Coalition <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Today</span>
                    </h2>
                    <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mt-6">
                        Hand-built in Baltimore. Small runs on purpose. No factory, no shortcuts.
                        The labor lives in the build, not the marketing.
                    </p>
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
                                    {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: `w-8 h-8 text-${item.color === 'purple' ? 'purple' : 'blue'}-400` })}
                                </div>
                                <h3 className="text-2xl font-display font-bold uppercase mb-4">{item.title}</h3>
                                <p className="text-gray-400 text-lg leading-loose">{item.desc}</p>
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
                    <a href="https://twitter.com/sgminiwizards" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-900/30 to-blue-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-sky-900/40 group-hover:border-sky-500/30 transition-all">
                            <Twitter className="w-4 h-4 text-sky-400" /> X / Twitter
                        </div>
                    </a>
                    <a href="https://www.youtube.com/@sgctrustyourself" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-900/30 to-rose-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-red-900/40 group-hover:border-red-500/30 transition-all">
                            <Youtube className="w-4 h-4 text-red-400" /> YouTube
                        </div>
                    </a>
                    <a href="https://whop.com/sgcoalition-five" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-white/10 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wide group-hover:bg-pink-900/40 group-hover:border-pink-500/30 transition-all">
                            <ExternalLink className="w-4 h-4 text-purple-400" /> Whop
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
                <Newsletter
                    source="about"
                    variant="block"
                    heading="Stay in touch."
                    subheading="One email the day a new Coalition piece is ready. No manufactured urgency. No spam."
                />
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
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-sm uppercase tracking-[0.3em] text-gray-500"
                    >
                        — SG, 2026
                    </motion.p>
                </div>
            </section>
        </div>
    );
};

export default Story;