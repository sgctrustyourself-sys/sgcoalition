import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    PenTool, Shirt, Package, Building, SprayCan, Music, TrendingUp, ArrowRight,
    Instagram, Twitter, Youtube, MessageCircle as MessageCircleIcon, Mail,
    ArrowUpRight, Loader,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { supabase } from '../services/supabase';
import { BlogPost } from '../types';
import { blogFallbackPosts, normalizeBlogRows, filterBlogPostsByCategory } from '../data/blogPosts';
import Newsletter from '../components/Newsletter';
import Seo from '../components/Seo';
import { ABOUT_PAGE_TITLE, ABOUT_PAGE_DESCRIPTION, BRAND_SAME_AS_LINKS } from '../constants';
import { SITE_NAME } from '../utils/seo';

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
// + Read More → /blog/:slug), toned for the lighter About-page surface.
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
                <Loader className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="text-center py-12 border border-gray-100 rounded-2xl">
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
                    className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-300 hover:shadow-xl transition-all flex flex-col"
                >
                    {post.coverImage && (
                        <div className="aspect-[16/9] overflow-hidden bg-gray-50">
                            <img
                                src={post.coverImage}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                    )}
                    <div className="p-6 flex-grow">
                        <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest mb-3">
                            <span className="px-2 py-0.5 bg-black text-white rounded-sm">{post.category}</span>
                            <span className="text-gray-500">{format(safeDate(post.publishedAt || post.createdAt), 'MMM dd, yyyy')}</span>
                        </div>
                        <h3 className="text-lg font-bold uppercase tracking-tight mb-3 group-hover:underline line-clamp-2">{post.title}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-black">Read More →</span>
                    </div>
                </Link>
            ))}
        </div>
    );
};

// JSON-LD AboutPage structured data so the React route matches the
// structured-data graph of the static about.html mirror (both include
// the expanded sameAs array). Dumped as dangerouslySetInnerHTML so React
// doesn't escape the JSON. Crawlers running JS on /about now see the
// same Organization sameAs signal as the no-JS /about.html mirror.
// `@id` is the canonical ENTITY identifier (vs `url` which is the page URL).
// Crawlers identity-match via @id, so a future BlogPosting or BreadcrumbList node
// that references this AboutPage will dedupe to the same entity graph node
// (corresponding @id on the static /about.html mirror keeps both surfaces locked).
// description + sameAs are sourced from constants.ts so this structured-data
// graph stays in lock-step with public/about.html (which mirrors the same
// values — see ABOUT_PAGE_TITLE / ABOUT_PAGE_DESCRIPTION / BRAND_SAME_AS_LINKS).
const ABOUT_PAGE_LD = {
    '@context': 'https://schema.org',
    '@id': 'https://sgcoalition.xyz/about',
    '@type': 'AboutPage',
    name: `About ${SITE_NAME}`, // derives from SITE_NAME (utils/seo.ts) so the brand name stays in lock-step with ABOUT_PAGE_TITLE
    description: ABOUT_PAGE_DESCRIPTION,
    url: 'https://sgcoalition.xyz/about',
    mainEntity: {
        '@type': 'Organization',
        name: 'Coalition',
        description: 'Premium streetwear brand born in Baltimore. Quality, community, and the hustle.',
        url: 'https://sgcoalition.xyz',
        logo: 'https://sgcoalition.xyz/images/logo.png',
        sameAs: [...BRAND_SAME_AS_LINKS],
    },
};

const Story = () => {
    return (
        <div className="bg-white w-full overflow-hidden">
            {/* Title + description + canonical + JSON-LD must mirror public/about.html. */}
            {/* All three SEO strings are sourced from constants.ts (ABOUT_PAGE_TITLE / */}
            {/* ABOUT_PAGE_DESCRIPTION / BRAND_SAME_AS_LINKS) so a single edit propagates. */}
            {/* Seo injects + cleans up the JSON-LD via `data-seo-jsonld="true"`. */}
            <Seo
                title={ABOUT_PAGE_TITLE}
                description={ABOUT_PAGE_DESCRIPTION}
                canonicalPath="/about"
                jsonLd={ABOUT_PAGE_LD}
            />
            {/* Hero Section */}
            <div className="relative h-[80vh] w-full bg-black flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-60">
                    <img 
                        src="/story-hero.png" 
                        alt="Gmoneyworld Hero" 
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="relative z-10 text-center px-4">
                    <h1 className="font-display text-6xl md:text-9xl font-bold text-white uppercase tracking-tighter mb-4 animate-fade-in">
                        Gmoneyworld
                    </h1>
                    <p className="text-gray-300 text-lg md:text-2xl font-medium tracking-widest uppercase">
                        More Than A Brand. It's A Movement.
                    </p>
                </div>
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
            </div>

            {/* Emotional Origin Story */}
            <section className="py-24 px-4 max-w-4xl mx-auto text-center">
                <h2 className="font-display text-4xl font-bold uppercase mb-8">The Origin</h2>
                <p className="text-xl md:text-3xl font-medium leading-relaxed text-gray-900 mb-12">
                    Coalition was born from <span className="text-brand-accent">loss</span>. 
                    <br /><br />
                    After losing my best friend and blood cousin, the world stopped. 
                    Grief turned into a need for an outlet. That outlet became a promise.
                    <br /><br />
                    To keep going. To build something that lasts. To turn pain into power.
                </p>
                <div className="w-24 h-1 bg-black mx-auto"></div>
            </section>

            {/* Founder Background */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h3 className="font-display text-3xl font-bold uppercase mb-6">The Grind</h3>
                        <p className="text-lg text-gray-700 leading-loose mb-6">
                            Started in a basement with nothing but a vision. 
                            I taught myself to sew, learned the tech, and built this site line by line.
                        </p>
                        <p className="text-lg text-gray-700 leading-loose">
                            Between balancing life pressure, making music, and hustling for better days, 
                            Coalition became the proof that you can build a universe from scratch.
                        </p>
                    </div>
                    <div className="relative h-96 bg-black rounded-lg overflow-hidden shadow-2xl transform rotate-2 hover:rotate-0 transition-all duration-500">
                        {/* Placeholder for Founder Image or abstract grind visual - using Mission graphic as fallback/accent */}
                        <img 
                            src="/story-mission.png" 
                            alt="The Grind" 
                            className="w-full h-full object-cover opacity-80 hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute bottom-0 left-0 p-6">
                            <p className="text-white font-bold text-xl uppercase tracking-widest">Built From Nothing</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission Graphic Section */}
            <section className="relative py-32 bg-black text-white overflow-hidden">
                <div className="absolute inset-0 opacity-40">
                     <img 
                        src="/story-mission.png" 
                        alt="Mission Graphic" 
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
                    <h2 className="font-display text-5xl md:text-7xl font-bold uppercase mb-8">Resilience</h2>
                    <p className="text-xl md:text-2xl font-light leading-relaxed text-gray-300">
                        Crosses for the burdens we carry. Angels for the ones watching over us.
                        <br />
                        <span className="text-white font-bold mt-4 block">
                            Gmoneyworld is about surviving everything and creating something bigger.
                        </span>
                    </p>
                </div>
            </section>

            {/* What Gets Made Here */}
            <section className="py-24 px-4 max-w-5xl mx-auto">
                <h2 className="font-display text-4xl font-bold uppercase mb-12 text-center">What Gets Made Here</h2>
                <div className="grid md:grid-cols-3 gap-10">
                    <div>
                        <h3 className="text-2xl font-display font-bold uppercase mb-3">By Hand, Every Time</h3>
                        <p className="text-lg text-gray-700 leading-loose">
                            Every piece from our drops is hand-crafted, start to finish. Production runs are kept small on purpose — the labor lives in the build, not the marketing.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-2xl font-display font-bold uppercase mb-3">Limited Means Limited</h3>
                        <p className="text-lg text-gray-700 leading-loose">
                            When a run sells out, it doesn't quietly restock. The limited-edition tag is a promise — once it's claimed, it's claimed for good.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-2xl font-display font-bold uppercase mb-3">The Ladder</h3>
                        <p className="text-lg text-gray-700 leading-loose">
                            Handcrafted standard drops start at $75. The Above as Below Set runs $120 — that's $30 less than the sum of its parts. The Chrome Hearts Wallet sits at $450 as the collection's ceiling.
                        </p>
                    </div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="py-24 px-4 max-w-5xl mx-auto">
                <h2 className="font-display text-4xl font-bold uppercase mb-16 text-center">The Journey</h2>
                
                <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                    
                    {/* Timeline Item 1 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-900 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <PenTool className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Inception</div>
                            <div className="text-gray-700 text-sm">First logo sketches. The vision takes shape.</div>
                        </div>
                    </div>

                    {/* Timeline Item 2 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-black text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Shirt className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">First Drop</div>
                            <div className="text-gray-700 text-sm">The first hoodie. Physical manifestation of the brand.</div>
                        </div>
                    </div>

                    {/* Timeline Item 3 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-brand-accent text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Package className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Validation</div>
                            <div className="text-gray-700 text-sm">First orders shipping out. The community begins to grow.</div>
                        </div>
                    </div>

                    {/* Timeline Item 4 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-800 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Building className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Expansion</div>
                            <div className="text-gray-700 text-sm">New office space. Moving out of the basement.</div>
                        </div>
                    </div>

                     {/* Timeline Item 5 */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-900 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <SprayCan className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">The Grind</div>
                            <div className="text-gray-700 text-sm">Stash cans and late nights. Hustling for the vision.</div>
                        </div>
                    </div>

                     {/* Timeline Item 6 */}
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-purple-600 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Music className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Soundtrack</div>
                            <div className="text-gray-700 text-sm">Music dropping. The culture expands beyond clothes.</div>
                        </div>
                    </div>                    {/* Timeline Item 7 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-black text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Comeback</div>
                            <div className="text-gray-700 text-sm">Rebuilds and resilience. Stronger than ever.</div>
                        </div>
                    </div>

                    {/* Timeline Item 8 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-brand-accent text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Shirt className="w-5 h-5" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded border border-gray-100 shadow-sm">
                            <div className="font-bold text-gray-900 uppercase tracking-wide mb-1">Above as Below</div>
                            <div className="text-gray-700 text-sm">The matching tee and shorts land as a coordinated drop. $75 per piece, $120 for the set, never restocked.</div>
                        </div>
                    </div>

                </div>
            </section>

            {/* Connect — social links, lifted onto the About page so the brand
                channels are visible AFTER the story but BEFORE the conversion
                funnels (Newsletter + Join The Movement CTA). Mirrors the
                gradient-chip pattern used in the global Footer so visitors
                recognise the brand vocabulary across both surfaces. */}
            <section className="py-16 px-4 max-w-5xl mx-auto border-t border-gray-100">
                <div className="text-center mb-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">Connect</p>
                    <h2 className="font-display text-3xl md:text-4xl font-bold uppercase mb-2">Follow The Movement</h2>
                    <p className="text-sm text-gray-600">Drops, behind-the-scenes, the grind — across every channel.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <a href="https://www.instagram.com/sgcoalition" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center justify-center bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-gray-200 text-gray-900 px-5 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-pink-500/50 group-hover:bg-pink-900/10 transition-all">
                            <Instagram className="w-4 h-4 mr-2 text-pink-500" /> Instagram
                        </div>
                    </a>
                    <a href="https://twitter.com/sgcoalition" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center justify-center bg-gradient-to-r from-sky-900/20 to-blue-900/20 border border-gray-200 text-gray-900 px-5 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-sky-500/50 group-hover:bg-sky-900/10 transition-all">
                            <Twitter className="w-4 h-4 mr-2 text-sky-500" /> X / Twitter
                        </div>
                    </a>
                    <a href="https://www.youtube.com/@sgctrustyourself" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center justify-center bg-gradient-to-r from-red-900/20 to-rose-900/20 border border-gray-200 text-gray-900 px-5 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-red-500/50 group-hover:bg-red-900/10 transition-all">
                            <Youtube className="w-4 h-4 mr-2 text-red-500" /> YouTube
                        </div>
                    </a>
                    <a href="https://www.reddit.com/r/SGCoalition/" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center justify-center bg-gradient-to-r from-orange-900/20 to-amber-900/20 border border-gray-200 text-gray-900 px-5 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-orange-500/50 group-hover:bg-orange-900/10 transition-all">
                            <MessageCircleIcon className="w-4 h-4 mr-2 text-orange-500" /> Reddit
                        </div>
                    </a>
                    <a href="https://discord.gg/bByqsC5f5V" target="_blank" rel="noopener noreferrer" className="group">
                        <div className="flex items-center justify-center bg-gradient-to-r from-indigo-900/20 to-blue-900/20 border border-gray-200 text-gray-900 px-5 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-indigo-500/50 group-hover:bg-indigo-900/10 transition-all">
                            <MessageCircleIcon className="w-4 h-4 mr-2 text-indigo-500" /> Discord
                        </div>
                    </a>
                    <a href="mailto:admin@sgcoalition.xyz" className="group">
                        <div className="flex items-center justify-center bg-white border border-gray-200 text-gray-900 px-5 py-3 rounded-sm text-xs font-bold uppercase tracking-wide group-hover:border-brand-accent transition-all">
                            <Mail className="w-4 h-4 mr-2 text-brand-accent" /> Email
                        </div>
                    </a>
                </div>
            </section>

            {/* From The Blog — 3 most-recent posts embedded inline so visitors
                who finish the Story see the freshest thinking without clicking
                away. Uses the AboutRecentPosts helper above (live fetch with
                static fallback). Mirrors the /blog card shape at lighter weight. */}
            <section className="py-16 px-4 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">From The Blog</p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold uppercase">Latest Updates</h2>
                    </div>
                    <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-700 hover:text-black transition-colors">
                        View All <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </div>
                <AboutRecentPosts />
            </section>

            {/* Drop-list invite: most natural moment to convert voice-believers
                into subscribers, just before the final call-to-action. */}
            <section className="py-20 px-4 max-w-4xl mx-auto">
                <Newsletter source="about" variant="block" />
            </section>

            {/* Brand Message / Footer Callout */}
            <section className="py-32 bg-brand-black text-white text-center px-4">
                <div className="max-w-3xl mx-auto">
                    <h2 className="font-display text-4xl md:text-6xl font-bold uppercase mb-8">
                        Turn Losses Into Movement
                    </h2>
                    <p className="text-xl text-gray-400 mb-12">
                        Unity. Creativity. Rising from the struggle.
                    </p>
                    <Link to="/shop" className="inline-flex items-center bg-white text-black px-8 py-4 font-bold uppercase tracking-widest hover:bg-brand-accent hover:text-white transition-all duration-300">
                        Join The Movement <ArrowRight className="ml-2 w-5 h-5" />
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default Story;
