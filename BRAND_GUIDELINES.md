# Coalition Brand Guidelines

> **Version 1.0** — October 2026  
> **Status:** Living Document — Update with each major drop  
> **Owner:** Founder / Creative Director  
> **Reference:** `linktr.ee/sgcoalition` | `sgcoalition-five.vercel.app`

---

## 1. Brand Essence

### Mission
> **Turn Losses Into Movement**

Built from loss. Gmoneyworld — more than a brand, it's a movement. Quality, community, and the hustle, built by hand in Baltimore.

### Core Values
| Value | Manifestation |
|-------|---------------|
| **Authenticity** | Hand-built, small runs, no factory shortcuts |
| **Resilience** | "Surviving everything and creating something bigger" |
| **Community First** | 30% member discount, referral rewards, governance votes |
| **Transparency** | Open liquidity, open roadmap, open ledger |
| **Craft Over Hype** | "The labor lives in the build, not the marketing" |

### Brand Personality
- **Gritty but refined** — basement origins, premium execution
- **Cryptic but accessible** — arcane language, clear utility
- **Founder-led** — personal voice, not corporate speak
- **Long-term greedy** — build for decades, not quarters

---

## 2. Visual Identity

### 2.1 Color Palette

#### Primary (Dark Mode First)
| Name | Hex | Usage |
|------|-----|-------|
| **Void Black** | `#050505` | Primary background, cards |
| **Deep Void** | `#0a0a0a` | Elevated surfaces, modals |
| **Surface** | `#111111` | Borders, dividers, secondary bg |

#### Accent Gradients
| Name | Gradient | Usage |
|------|----------|-------|
| **Arcane Purple** | `linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)` | Primary CTAs, hero accents, progress bars |
| **Electric Blue** | `linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)` | Secondary CTAs, links, info states |
| **Sunset Orange** | `linear-gradient(135deg, #f97316 0%, #ef4444 100%)` | Warnings, urgency, burn/migration |
| **Emerald Green** | `linear-gradient(135deg, #22c55e 0%, #10b981 100%)` | Success, rewards, staked assets |
| **Blended** | `linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #a855f7 100%)` | Brand hero, blended metrics |

#### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Text Primary** | `#E5E5E5` | Body copy, headings |
| **Text Muted** | `#999999` | Secondary info, timestamps |
| **Text Dim** | `#666666` | Disabled, placeholders |
| **Border Subtle** | `#1A1A1A` | Card borders, dividers |
| **Border Accent** | `#a855f7` | Focus states, active cards |
| **Error** | `#ef4444` | Errors, destructive actions |
| **Warning** | `#f59e0b` | Warnings, pending states |
| **Success** | `#22c55e` | Success, confirmed |

### 2.2 Typography

| Role | Font | Weight | Size Scale |
|------|------|--------|------------|
| **Display** | Oswald | 700 (Black) | `text-7xl` → `text-5xl` → `text-4xl` |
| **Headline** | Oswald | 700 (Black) | `text-3xl` → `text-2xl` → `text-xl` |
| **Body** | Inter | 400 (Regular) | `text-base` → `text-sm` → `text-xs` |
| **Caption/Label** | Inter | 600 (SemiBold) | `text-[10px]` → `text-[9px]` |
| **Monospace** | JetBrains Mono / Inter | 400/700 | Addresses, hashes, prices |

**Scale Rules:**
- Mobile-first: base `16px`, scale up at `md:` (768px) and `lg:` (1024px)
- Line height: `1.1` for display, `1.5` for body, `1.6` for long-form
- Letter spacing: `tracking-tighter` for display, `tracking-widest` + `uppercase` for labels

### 2.3 Glassmorphism System

```css
/* Standard Glass Panel */
.glass-panel {
  background: rgba(5, 5, 5, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* Elevated Glass Card */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  transition: all 0.3s ease;
}
.glass-card:hover {
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transform: translateY(-2px);
}
```

**Variants:**
| Variant | Background | Border | Use Case |
|---------|------------|--------|----------|
| **Standard** | `rgba(5,5,5,0.8)` | `white/5` | Default cards |
| **Elevated** | `white/3` | `white/8` | Featured cards, hover states |
| **Purple Tint** | `purple-500/10` | `purple-500/20` | Crypto, SGCoin |
| **Orange Tint** | `orange-500/10` | `orange-500/20` | Burn, migration |
| **Blue Tint** | `blue-500/10` | `blue-500/20` | V2, migration |

### 2.4 Motion & Animation

**Principles:**
- **Respect prefers-reduced-motion** — all animations have `prefers-reduced-motion: reduce` fallbacks
- **Staggered entrance** — 80-100ms stagger per element
- **Meaningful motion** — every animation communicates state change
- **Spring physics** — `spring` or `easeOut` for organic feel

**Standard Transitions:**
| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| **Fast** | 150ms | `easeOut` | Hover, focus, tap |
| **Standard** | 300ms | `easeOut` | Modal, drawer, card flip |
| **Slow** | 500-800ms | `spring` / `easeOut` | Page enter, hero, section reveal |
| **Stagger** | 80-100ms delay | `easeOut` | Lists, grids, stat grids |

**Key Animations:**
```tsx
// Hero entrance
initial={{ opacity: 0, y: 30 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.8, delay: 0.2 }}

// Staggered grid
transition={{ duration: 0.6, delay: index * 0.1 }}

// Card hover
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.98 }}

// Skew recovery
animation: spin 1s linear infinite
```

### 2.5 Iconography

**Library:** Lucide React (primary)  
**Style:** 2px stroke, 24x24 base, rounded corners  
**Sizing:**
- `w-3 h-3` (12px) — inline with `[10px]` labels
- `w-4 h-4` (16px) — buttons, nav
- `w-5 h-5` (20px) — card icons
- `w-6 h-6` (24px) — section headers
- `w-8 h-8` (32px) — hero, feature blocks
- `w-16 h-16` (64px) — empty states, hero illustrations

**Custom Icons:** SVG in `/public/images/` — hand-drawn aesthetic for hero graphics

### 2.6 Imagery

**Product Photography:**
- Dark background (`#050505`), dramatic lighting
- 3:4 aspect ratio for product cards, 16:9 for hero
- High contrast, texture visible (stitching, leather grain, embroidery)

**Hero Graphics:**
- Abstract, atmospheric (purple/blue gradients, noise overlay)
- Custom SVG illustrations for story sections
- Never stock photography

**Social Share Cards:**
- 1200x630px, JPEG
- Generated via `scripts/generateOgCard.mjs`
- Brand card: wordmark + hero artwork
- Route cards: route-specific headline + gradient

---

## 3. Voice & Tone

### 3.1 Voice Attributes

| Attribute | Do | Don't |
|-----------|-----|-------|
| **Direct** | "Built from loss" | "We were founded after experiencing loss" |
| **Specific** | "12-piece run, sized S–XL" | "Limited quantities available" |
| **Founder-led** | "I taught myself to sew" | "Our team learned manufacturing" |
| **Cryptic but clear** | "Turn Losses Into Movement" | "Transform Your Struggles" |
| **No manufactured urgency** | "12-piece run, once sold, gone forever" | "HURRY! ONLY 3 LEFT!" |

### 3.2 Copy Patterns

**Headlines:** `UPPERCASE`, `font-black`, `tracking-tighter`  
**Labels:** `UPPERCASE`, `text-[10px]`, `tracking-widest`, `font-bold`  
**Body:** Sentence case, `text-gray-300`/`text-gray-400`, `leading-relaxed`  
**CTAs:** `UPPERCASE`, `tracking-widest`, `font-black`, `text-white` on colored bg  

**Forbidden Words:** "Sale", "Discount", "Limited Time", "Act Now", "Hurry", "Exclusive" (unless genuinely 1/1)

### 3.3 Channel Voice

| Channel | Tone | Example |
|---------|------|---------|
| **Website** | Direct, poetic, factual | "Built from loss. More than a brand." |
| **Email** | Personal, founder voice | "I packed this myself this morning." |
| **Twitter/X** | Cryptic, community, drops | "Chapter 2 drops Friday. 12 pieces." |
| **Instagram** | Visual, process, behind-scenes | Photo of stitching + "The grind." |
| **Discord** | Direct, helpful, alpha | "V2 migration live. Link in announcements." |
| **Email Support** | Helpful, no templates | "Hey — I saw your order. Here's what's happening..." |

---

## 4. Component System

### 4.1 Buttons

```tsx
// Primary CTA
className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-gray-200 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"

// Secondary / Outline
className="px-10 py-5 border border-white/20 text-white font-bold text-lg uppercase tracking-widest hover:bg-white/5 transition-all"

// Ghost / Link
className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"

// Destructive
className="px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-full font-black uppercase tracking-widest text-[9px] hover:bg-red-500/30 transition-all"

// Icon Button
className="w-12 h-12 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-all"
```

**States:** All buttons have `hover`, `active` (`scale-95`), `focus-visible`, `disabled` (`opacity-50`, `cursor-not-allowed`)

### 4.2 Cards

```tsx
// Standard Product Card
className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 hover:bg-white/10 transition-all"

// Feature Card (Glass)
className="p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group hover:border-purple-500/20 transition-all"

// Stat Card
className="p-8 rounded-3xl border border-white/5 bg-white/[0.03] backdrop-blur-3xl group hover:border-purple-500/20 transition-all"

// Glass Panel
className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md"
```

### 4.3 Forms

```tsx
// Input
className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/30 focus:bg-white/10 transition-all"

// Select
className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/30 focus:bg-white/10"

// Label
className="block text-sm font-medium mb-1 text-gray-900"
```

### 4.4 Navigation

```tsx
// Main Nav Link
className="text-gray-400 hover:text-orange-400 transition-colors"

// Active Nav
className="bg-purple-600 text-white px-6 py-2.5 rounded-full hover:bg-purple-700 transition-all font-black tracking-widest"

// Mobile Bottom Nav
className="fixed bottom-0 w-full bg-black/40 backdrop-blur-xl border-t border-white/5"
```

### 4.5 Feedback

```tsx
// Toast Success
className="bg-green-500/20 border border-green-500/30 text-green-400"

// Toast Error
className="bg-red-500/20 border border-red-500/30 text-red-400"

// Toast Info
className="bg-purple-500/20 border border-purple-500/30 text-purple-400"

// Loading Skeleton
className="animate-pulse bg-white/5 rounded"
```

---

## 5. Page Templates

### 5.1 Hero Section
```tsx
<section className="relative min-h-[60vh] md:min-h-[80vh] flex items-center justify-center px-6 overflow-hidden">
  {/* Background layers */}
  <div className="absolute inset-0 pointer-events-none z-0">
    <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-purple-600/5 blur-[150px] rounded-full animate-pulse" />
    <div className="absolute bottom-0 left-0 w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse delay-[3000ms]" />
    <div className="absolute inset-0 bg-repeat opacity-[0.03] mix-blend-screen" style={{ backgroundImage: "url('/images/patterns/noise.svg')" }} />
  </div>
  <div className="relative z-10 text-center px-4">
    <motion.div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold">
      <Icon className="w-3 h-3" /> Label
    </motion.div>
    <motion.h1 className="text-7xl md:text-[11rem] font-black uppercase tracking-tighter leading-[0.7] mb-10 font-display">
      Headline<br />
      <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500 bg-clip-text text-transparent italic">Accent</span>
    </motion.h1>
    <motion.p className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto mb-12 leading-relaxed">
      Description
    </motion.p>
    {/* CTA Group */}
  </motion.div>
</section>
```

### 5.2 Section Wrapper
```tsx
<section className="relative py-24 px-6 max-w-6xl mx-auto">
  <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold mx-auto">
      <Icon className="w-3 h-3" /> Section Label
    </motion.div>
    <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-10 font-display">
      Section Title <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent italic">Accent</span>
    </h2>
    {/* Content */}
  </motion.div>
</section>
```

### 5.3 Grid Layouts
```tsx
// 3-column feature grid
<div className="grid md:grid-cols-3 gap-8">
  {items.map((item, idx) => (
    <motion.div key={idx} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: idx * 0.1 }}>
      <Card>...</Card>
    </motion.div>
  )}
</div>

// 2-column asymmetric
<div className="grid md:grid-cols-2 gap-16 items-center">
  <div>Content</div>
  <div>Visual</div>
</div>
```

---

## 6. Crypto & Web3 Specific

### 6.1 Token Display
```tsx
// SGCoin V2 Price
<div className="text-3xl font-black font-display tracking-tight">
  ${price.toFixed(6)}
</div>

// Balance
<div className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 italic">
  {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
</div>

// Address Display
<p className="text-white font-mono text-xs break-all select-all">{address}</p>
<button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
  <Copy className="w-4 h-4 text-gray-400 group-hover:text-orange-300" />
</p>
```

### 6.2 Wallet Connection
```tsx
// Connect Button
<button className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-full hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg font-black tracking-widest">
  Connect Wallet
</button>

// Connected State
<div className="flex flex-col items-end">
  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500">SGC Balance</span>
  <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 italic">{balance}</span>
</div>
```

### 6.3 QuickSwap Integration
```tsx
// Dropdown with Buy/Sell modes
// Pre-selects tokens via URL params:
// Buy: inputCurrency=WPOL&outputCurrency=SGC_V2
// Sell: inputCurrency=SGC_V2&outputCurrency=WPOL
```

---

## 6. WPOL Milestone System

### Milestone Progression
| Milestone | Target | Label | Progress Bar Color |
|-----------|--------|-------|-------------------|
| **Foundation** | 100 WPOL | Foundation Stage | Purple |
| **Growth** | 200 WPOL | Growth Stage | Purple → Blue |
| **Expansion** | 300 WPOL | Expansion Stage | Blue → Purple |
| **Scaling** | 400+ WPOL | Scaling Stage | Gradient |

### Display Rules
- **Primary Metric:** `{liquidity.toFixed(2)} WPOL` (large, gradient text)
- **Next Milestone:** `Math.ceil(liquidity / 100) * 100` WPOL
- **Progress %:** `(liquidity / 100) * 100` (resets each 100)
- **Progress Bar:** Gradient `purple-600 → blue-500 → purple-400`

---

## 7. Accessibility

### 7.1 Color Contrast
| Element | Ratio | Standard |
|---------|-------|----------|
| White text on `#050505` | 15.3:1 | AAA |
| Gray-400 on `#050505` | 7.5:1 | AAA |
| Purple-400 on `#050505` | 4.8:1 | AA Large |
| White on Purple-600 | 4.1:1 | AA |

### 7.2 Motion
- All animations respect `prefers-reduced-motion: reduce`
- `transition: none` for reduced motion users
- No auto-playing video/audio

### 7.3 Focus States
```css
*:focus-visible {
  outline: 2px solid #a855f7;
  outline-offset: 2px;
}
button:focus-visible, a:focus-visible {
  ring: 2px solid #a855f7;
  ring-offset: 2px;
  ring-offset-[#050505];
}
```

### 7.4 ARIA
- All interactive elements have accessible names
- Live regions for dynamic content (`aria-live="polite"`)
- Semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>`, `<button>`, `<a>`

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| **Mobile** | < 640px | Single column, stacked CTAs |
| **Tablet** | 640–1023px | 2-column grids, side-by-side |
| **Desktop** | 1024–1279px | 3-4 column grids |
| **Wide** | 1280px+ | Max-width containers (7xl = 1280px) |

**Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

---

## 8. Performance Budgets

| Metric | Budget | Current |
|--------|--------|---------|
| **Initial JS (gz)** | < 150 KB | ~150 KB |
| **Total JS (gz)** | < 500 KB | ~1.07 MB (chunked) |
| **CSS (gz)** | < 30 KB | ~29 KB |
| **LCP** | < 2.5s | ~1.8s |
| **CLS** | < 0.1 | < 0.05 |
| **FID** | < 100ms | < 50ms |

**Chunk Strategy:**
- `vendor-react` (61 KB) — always
- `vendor-motion` (43 KB) — always
- `vendor-ethers` (148 KB) — wallet connect
- `vendor-recharts` (96 KB) — admin analytics
- `vendor-maps` (52 KB) — `/live-orders`
- `vendor-supabase` (46 KB) — admin/auth
- Route chunks — lazy loaded per page

---

## 9. Asset Guidelines

### 9.1 Logo
| Variant | File | Usage |
|---------|------|-------|
| **Wordmark** | `/images/logo.svg` | Nav, hero, footer |
| **Icon** | `/images/logo-icon.svg` | Favicon, app icon |
| **Animated** | `/images/logo-animated.svg` | Hero, loading |

**Clear Space:** 2x icon height on all sides  
**Minimum Size:** 24px height (digital), 0.5" (print)  
**Don't:** recolor, stretch, add effects, place on busy backgrounds

### 9.2 Favicon
- `/favicon.svg` — SVG (preferred)
- `/favicon.ico` — 32x32 fallback
- `/apple-touch-icon.png` — 180x180

### 9.3 Social Assets
| Platform | Size | File |
|----------|------|------|
| **OG Card** | 1200x630 | `/og/card.jpg` |
| **Route Card** | 1200x630 | `/og/{route}.jpg` |
| **Twitter** | 1200x675 | Auto from OG |
| **Discord** | 1200x630 | Auto from OG |

---

## 10. Governance

### 10.1 Update Process
1. Propose change in `#brand-ops` Discord
2. Design review (Founder + Lead Designer)
3. Update this doc + Figma + Storybook
4. Deploy to staging → review → production

### 10.2 Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-10-21 | Initial codification |

### 10.3 Contacts
| Role | Contact |
|------|---------|
| Founder / Creative Director | `sgctrustyourself@gmail.com` |
| Lead Developer | GitHub: `sgctrustyourself-sys` |
| Community Manager | Discord: `bByqsC5f5V` |

---

## Appendix A: Quick Reference CSS Variables

```css
:root {
  /* Colors */
  --void: #050505;
  --surface: #111111;
  --text-primary: #E5E5E5;
  --text-muted: #999999;
  --accent-purple: #a855f7;
  --accent-blue: #3b82f6;
  --accent-orange: #f97316;
  --accent-green: #22c55e;
  --border-subtle: #1A1A1A;
  --border-accent: #a855f7;
  
  /* Typography */
  --font-display: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  
  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-2xl: 2rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-glow: 0 0 20px rgba(168,85,247,0.3);
  
  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-base: 300ms ease-out;
  --transition-slow: 500ms ease-out;
}
```

---

*End of Brand Guidelines v1.0*