import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Plus, X as CloseIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isWalletProduct } from '../utils/walletAddOns';
import Seo from '../components/Seo';

const CROSS = '⊕';
const DASH = '—';
const ELLIPSIS = '…';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Can Coalition custom wallets be one of one?',
    a: 'Yes. Every custom build is individually cut, stitched by hand, and finished to your exact specification. No two custom pieces ever share a serial — one leather, one thread path, one mark.',
  },
  {
    q: 'Does Coalition build out to a bulk wallet?',
    a: 'Typically no. We build drop-by-drop and one-of-one to maintain the standard. Numbered limited runs (e.g. 1/2 or 1/4) can be requested for special projects, but we are not a factory.',
  },
  {
    q: 'How do I start a custom wallet build?',
    a: 'Use the direct inquiry form below for a fast, single-direction build sheet. For larger or multi-piece projects, run the full intake at /inquire. Either way we reply with feasibility, lead time, and pricing within 24—48 hours.',
  },
  {
    q: 'What dictates custom pricing?',
    a: 'Material sourcing (exotic hides vs. full-grain vegetable-tanned are very different propositions), internal layout complexity, hardware choice, and timeline. Rush requests adjust price — we are upfront about the bracket before any work starts.',
  },
  {
    q: 'What makes a Coalition wallet different?',
    a: 'No machine production, no template repeats. Every wallet starts from a single hide, is hand-stitched on a saddle stitch, and ships with a Coalition authenticity card. The patina develops with your carry — the more it gets used, the better it looks.',
  },
];

const WalletQuestion = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  const id = 'faq-answer-' + q.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40);
  return (
    <div className="border-b border-gray-800 py-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="font-display font-bold uppercase text-lg tracking-tight text-gray-300 group-hover:text-white transition">
          {q}
        </span>
        <span className="text-brand-accent ml-4 flex-shrink-0">
          {open ? <CloseIcon className="w-5 h-5" aria-hidden="true" /> : <Plus className="w-5 h-5" aria-hidden="true" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="pt-4 text-gray-400 text-sm leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CustomWallets = () => {
  const { products } = useApp();

  const wallets = useMemo(() => {
    return (products || [])
      .filter((p) => isWalletProduct(p) || (p as any).category === 'wallet' || /wallet/i.test(p.name))
      .sort((a, b) => {
        if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [products]);

  const liveWallets = wallets.filter((w) => !w.archived);
  const archiveWallets = wallets.filter((w) => w.archived);
  const displayWallets = useMemo(
    () => [...liveWallets, ...archiveWallets].slice(0, 8),
    [liveWallets, archiveWallets],
  );
  const liveCount = liveWallets.length;
  const archiveCount = archiveWallets.length;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [direction, setDirection] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !direction.trim()) {
      setError('Please complete every field.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('That email looks off — double-check the format.');
      return;
    }

    setLoading(true);
    try {
      // Payload matches services/customInquiry.ts union + the runtime values
      // pages/CustomInquiry.tsx posts. timeline='no-rush' (always-valid for
      // 'flexible'-timeline intake) + budgetRange='flexible' (always valid).
      const payload = {
        productType: 'wallet' as const,
        customerName: name.trim(),
        customerEmail: email.trim(),
        title: `Quick Custom Wallet Direction — ${direction.trim().slice(0, 60)}`,
        description: direction.trim(),
        budgetRange: 'flexible' as const,
        timeline: 'no-rush' as const,
        referenceImages: [] as string[],
      };

      const response = await fetch('/api/notify-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({} as any));
        throw new Error((errData && errData.error) || 'Failed to submit inquiry');
      }

      setSuccess(true);
      setName('');
      setEmail('');
      setDirection('');
    } catch (err: any) {
      setError((err && err.message) || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-brand-accent/30 font-sans">
      <Seo
        title="Custom Coalition Wallets"
        description={`One-of-one custom wallet builds, hand-finished and signed. No templates — built to your direction, on Coalition leather, in small numbered runs.`}
        canonicalPath="/custom-wallets"
      />

      {/* 1. Hero strip */}
      <section className="relative pt-24 pb-24 px-4 border-b border-white/10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.04] z-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-brand-accent/20 blur-3xl z-0"
        />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <p className="text-brand-accent font-bold uppercase tracking-[0.3em] text-[10px] mb-6 flex items-center gap-2">
              Coalition <span className="text-white">{CROSS}</span> Authentic
            </p>
            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-black uppercase tracking-tighter mb-8 leading-[0.9]">
              Custom Coalition
              <br />
              Wallets
            </h1>
            <p className="text-gray-400 max-w-2xl text-base md:text-lg leading-relaxed mb-10">
              One-of-one custom builds, hand-finished wallets, and plaque-top references built to your direction {DASH} never templated.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                to="/wallets"
                className="w-full sm:w-auto bg-white/5 border border-white/15 text-gray-200 font-black uppercase py-4 px-8 rounded-xl hover:bg-white/10 hover:text-white transition tracking-widest text-xs text-center"
              >
                View All Builds
              </Link>
              <a
                href="#request"
                className="w-full sm:w-auto bg-white text-black font-black uppercase py-4 px-8 rounded-xl hover:bg-gray-200 transition tracking-widest text-xs text-center"
              >
                Request A Custom Build
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Three-stat strip */}
      <section className="border-b border-white/5 bg-black">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 md:divide-x md:divide-white/5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5 }}
              className="px-0 md:px-8"
            >
              <div
                aria-hidden="true"
                className="text-brand-accent text-2xl font-display font-black mb-5 leading-none"
              >
                {CROSS}
              </div>
              <h3 className="font-display text-4xl md:text-5xl font-black mb-2 tracking-tighter text-white">
                1/1
              </h3>
              <p className="font-bold text-[11px] uppercase tracking-widest text-white/80 mb-1">
                Every Build Is Numbered
              </p>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest">
                Unique serials on every drop
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="px-0 md:px-8"
            >
              <div
                aria-hidden="true"
                className="text-brand-accent text-2xl font-display font-black mb-5 leading-none"
              >
                {CROSS}
              </div>
              <h3 className="font-display text-4xl md:text-5xl font-black mb-2 tracking-tighter text-white">
                Direct
              </h3>
              <p className="font-bold text-[11px] uppercase tracking-widest text-white/80 mb-1">
                Requests Received Personally
              </p>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest">
                No automated quotes {DASH} every build is reviewed by hand
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="px-0 md:px-8"
            >
              <div
                aria-hidden="true"
                className="text-brand-accent text-2xl font-display font-black mb-5 leading-none"
              >
                {CROSS}
              </div>
              <h3 className="font-display text-4xl md:text-5xl font-black mb-2 tracking-tighter text-white">
                One Cut
              </h3>
              <p className="font-bold text-[11px] uppercase tracking-widest text-white/80 mb-1">
                One Piece, One Build
              </p>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest">
                Hand-stitched from a single hide {DASH} start to finish
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. Current and archive builds grid */}
      <section className="py-24 px-4 bg-gradient-to-b from-black to-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-accent mb-2">
                The Catalog
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight">
                Current and Archive Builds
              </h2>
              {displayWallets.length > 0 && (
                <p className="text-gray-500 text-xs uppercase tracking-widest mt-2">
                  {liveCount} live {DASH} {archiveCount} sold
                </p>
              )}
            </div>
            <Link
              to="/wallets"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition"
            >
              View All Builds <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>

          {displayWallets.length === 0 ? (
            <div className="border border-dashed border-gray-800 rounded-3xl p-12 text-center bg-black/40">
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                Catalog warming up {DASH} new builds drop soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayWallets.map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  <Link
                    to={`/product/${w.id}`}
                    className={`group relative bg-black border border-gray-900 rounded-2xl overflow-hidden hover:border-gray-600 transition block ${w.archived ? 'opacity-60' : ''}`}
                  >
                    <div className="aspect-square bg-gray-900 overflow-hidden relative">
                      {w.images && w.images[0] ? (
                        <img
                          src={w.images[0]}
                          alt={w.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                          <span className="text-gray-700 font-display text-3xl font-black">{CROSS}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <div className="p-4 bg-black">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider truncate text-gray-200 group-hover:text-white transition">
                        {w.name}
                      </h4>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] font-mono text-gray-400">
                          {w.archived ? 'Sold' : `$${w.price}`}
                        </span>
                        {w.archived && (
                          <span className="text-[9px] bg-white/10 text-gray-500 px-2 py-0.5 rounded-sm font-bold uppercase tracking-widest">
                            Archive
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. CTA + inline quick-build form (POSTs /api/notify-inquiry) */}
      <section id="request" className="py-24 px-4 bg-black border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-accent mb-3">
                The Intake
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tighter mb-6 leading-tight">
                Start with a direction,
                <br />
                not a template.
              </h2>
              <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-6">
                Tell us the pocket size you need, the leather type you prefer, and the stitching colors you envision. Submit the basics here and we{"'"}ll reach back directly to finalize the one-of-one build sheet.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  'Hand-cut from a single hide',
                  'You pick the leather, thread, hardware',
                  `Reply with feasibility + pricing within 24${DASH}48 hours`,
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-gray-300 text-sm">
                    <span className="text-brand-accent mt-0.5 font-bold">{CROSS}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Link
                  to="/inquire?type=wallet"
                  className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-brand-accent hover:text-white transition"
                >
                  Prefer the full 4-step intake? <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8 lg:p-10 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                <h3 className="font-bold text-[11px] uppercase tracking-[0.25em] text-white">
                  Initiate Build Direction
                </h3>
              </div>

              {success ? (
                <div className="text-center py-10">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" aria-hidden="true" />
                  <h4 className="font-display text-2xl font-black uppercase mb-2">
                    Direction Received
                  </h4>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    We{"'"}ll review your direction and email back within 24{DASH}48 hours with next steps. Keep an eye on your inbox.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="text-white text-[11px] font-bold uppercase tracking-widest border-b border-white pb-1 hover:border-brand-accent transition"
                  >
                    Send Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      {error}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="sr-only">Full name</span>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl p-4 text-sm text-white focus:border-brand-accent outline-none transition"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">Email address</span>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black border border-gray-800 rounded-xl p-4 text-sm text-white focus:border-brand-accent outline-none transition"
                        required
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="sr-only">Build direction</span>
                    <textarea
                      rows={4}
                      placeholder={`Briefly describe the build (e.g. bifold, matte black leather, red stitching, 4 card slots)${ELLIPSIS}`}
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                      className="w-full bg-black border border-gray-800 rounded-xl p-4 text-sm text-white focus:border-brand-accent outline-none transition resize-none"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-black uppercase py-4 rounded-xl hover:bg-gray-200 transition tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Sending{ELLIPSIS}
                      </>
                    ) : (
                      <>
                        Send Direction <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-gray-600 text-center uppercase tracking-widest mt-4">
                    No commitment required to initiate quote.
                  </p>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. FAQ accordion */}
      <section className="py-24 px-4 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-accent mb-3">
            Common Questions
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight">
            Custom Wallet Questions
          </h2>
        </div>
        <div className="border-t border-gray-800">
          {FAQS.map((faq) => (
            <WalletQuestion key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default CustomWallets;
