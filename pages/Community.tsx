import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Instagram, Twitter, Youtube, MessageCircle, Hash, Users, UserPlus, ShoppingBag, Layers } from 'lucide-react';
import LiveOrdersTicker from '../components/LiveOrdersTicker';
import Seo from '../components/Seo';
import { BRAND_SAME_AS_LINKS } from '../constants';
import { SITE_NAME } from '../utils/seo';

// Conditional Discord widget iframe. Operator flips COMMUNITY_DISCORD_WIDGET_ID
// to a real server snowflake to enable live embed without code changes.
const COMMUNITY_DISCORD_WIDGET_ID = '';

const COMMUNITY_PAGE_TITLE = `Community | ${SITE_NAME} | Built in Baltimore, by hand`;
const COMMUNITY_PAGE_DESCRIPTION = 'Join the Coalition community — Discord, Instagram, X, YouTube, and the buyer log. Real conversations, real orders, real builds.';

const DiscordWidgetEmbed = () => {
  if (!COMMUNITY_DISCORD_WIDGET_ID) {
    return (
      <div className="aspect-[16/9] w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.01] flex items-center justify-center">
        <div className="text-center px-6 max-w-md">
          <Hash className="w-10 h-10 text-indigo-400/40 mx-auto mb-4" />
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Live embed</div>
          <p className="text-sm text-gray-400 leading-relaxed">The Discord widget will appear here once the server's widget is enabled. Today the Invite button below is the path in.</p>
        </div>
      </div>
    );
  }
  return <iframe title="Coalition Discord" src={`https://discord.com/widget?id=${COMMUNITY_DISCORD_WIDGET_ID}&theme=dark`} width="100%" height="500" className="w-full rounded-2xl border border-white/10" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts" />;
};

type ChannelCardProps = { href: string; label: string; icon: React.ReactNode; tint: string };
const ChannelCard = ({ href, label, icon, tint }: ChannelCardProps) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
    <div className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06] transition-all h-full">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 ${tint}`}>{icon}</div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-0.5">Channel</div>
          <div className="text-base font-black uppercase tracking-tight text-white">{label}</div>
        </div>
      </div>
      <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0" />
    </div>
  </a>
);

// BRAND_SAME_AS_LINKS index map: 0 Instagram, 1 X/Twitter, 2 YouTube, 3 Reddit.
// Discord (index 4) gets its own dedicated section + invite CTA further up.
const CHANNELS = [
  { href: BRAND_SAME_AS_LINKS[0], label: 'Instagram', icon: <Instagram className="w-5 h-5 text-pink-400" />, tint: 'text-pink-400' },
  { href: BRAND_SAME_AS_LINKS[1], label: 'X / Twitter', icon: <Twitter className="w-5 h-5 text-sky-400" />, tint: 'text-sky-400' },
  { href: BRAND_SAME_AS_LINKS[2], label: 'YouTube', icon: <Youtube className="w-5 h-5 text-red-400" />, tint: 'text-red-400' },
  { href: BRAND_SAME_AS_LINKS[3], label: 'Reddit', icon: <MessageCircle className="w-5 h-5 text-orange-400" />, tint: 'text-orange-400' },
];

const Community = () => (
  <div className="bg-[#050505] text-white min-h-screen font-sans selection:bg-orange-500/30 overflow-x-hidden">
    <Seo title={COMMUNITY_PAGE_TITLE} description={COMMUNITY_PAGE_DESCRIPTION} canonicalPath="/community" />
    <div className="fixed inset-0 pointer-events-none z-0">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/5 via-transparent to-orange-600/5 blur-[120px]" />
    </div>
    <main className="relative z-10">
      <section className="relative min-h-[60vh] md:min-h-[75vh] flex items-center justify-center px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-[10px] mb-10 uppercase tracking-[0.3em] font-bold">
            <Users className="w-3 h-3" /> Community Signal Live
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="text-6xl md:text-[10rem] font-black uppercase tracking-tighter leading-[0.7] mb-12 font-display">
            Built<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-orange-400 bg-clip-text text-transparent italic">Together</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-lg md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
            Coalition is built in a basement with a sewing machine and a laptop. Everyone who joins the conversation shapes what gets made next — <span className="text-white font-medium">five channels, one room, no middleman</span>.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="flex flex-wrap gap-4 justify-center mt-12">
            <a href={BRAND_SAME_AS_LINKS[4]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-indigo-500 text-white font-black uppercase tracking-widest text-xs hover:bg-indigo-400 transition-all shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:shadow-[0_0_50px_rgba(99,102,241,0.4)]">
              <Hash className="w-4 h-4" /> Join the Discord
            </a>
            <Link to="/shop" className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-orange-500 hover:text-white transition-all shadow-[0_20px_40px_rgba(255,255,255,0.05)]">
              <ShoppingBag className="w-4 h-4" /> Shop the Drop
            </Link>
          </motion.div>
        </div>
      </section>

      <LiveOrdersTicker />

      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-orange-500/5 border border-white/5 rounded-[2rem] p-8 md:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Hash className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">Primary Channel</div>
              <h2 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tighter">The Coalition Discord</h2>
            </div>
          </div>
          <p className="text-gray-300 text-base md:text-lg max-w-3xl mb-8 leading-relaxed">
            Drop announcements land here first. Build questions, custom-inquiry coordination, and the conversation behind every release. Quiet by default — the room runs at the speed of the work, not a refresh rate.
          </p>
          <DiscordWidgetEmbed />
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={BRAND_SAME_AS_LINKS[4]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-400 transition-all">Join on Discord <ArrowUpRight className="w-3.5 h-3.5" /></a>
            <Link to="/about" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/10 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Read the origin story <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="mb-12">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">Other Channels</div>
          <h2 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tighter">Five rooms, one brand</h2>
          <p className="text-gray-400 text-sm md:text-base mt-3 max-w-2xl leading-relaxed">Discord is where the conversation lives; the rest is where the work surfaces. All links route through <code className="font-mono text-gray-300">BRAND_SAME_AS_LINKS</code> so the brand kit never drifts.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CHANNELS.map((c) => (<ChannelCard key={c.href} {...c} />))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/signup" className="group block p-6 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06] transition-all">
            <UserPlus className="w-5 h-5 text-orange-400 mb-3" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Initialize identity</div>
            <div className="text-base font-black uppercase tracking-tight text-white group-hover:text-orange-300 transition-colors">Create an account</div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">Save your referral code, claim drops, and pick up the buyer log on return.</p>
          </Link>
          <Link to="/shop" className="group block p-6 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06] transition-all">
            <ShoppingBag className="w-5 h-5 text-purple-400 mb-3" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Current drop</div>
            <div className="text-base font-black uppercase tracking-tight text-white group-hover:text-purple-300 transition-colors">Shop Coalition</div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">Wallets, tees, sets, and the live archive. Every piece is hand-built.</p>
          </Link>
          <Link to="/ecosystem" className="group block p-6 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06] transition-all">
            <Layers className="w-5 h-5 text-indigo-400 mb-3" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Earn layer</div>
            <div className="text-base font-black uppercase tracking-tight text-white group-hover:text-indigo-300 transition-colors">Ecosystem Dashboard</div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">SGCoin rewards, live liquidity, and the on-chain burn trail.</p>
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-40 text-center">
        <p className="font-display text-2xl md:text-4xl font-black uppercase tracking-tighter leading-tight">
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">Losses into movement.</span>
          <br />
          <span className="text-white">The grind keeps going.</span>
        </p>
      </section>
    </main>
  </div>
);

export default Community;
