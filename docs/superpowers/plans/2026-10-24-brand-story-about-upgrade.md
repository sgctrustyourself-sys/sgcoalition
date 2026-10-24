# Brand Story About Page Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic origin copy on `/about` with the specific founder narrative from the 10.22.26 blog post — Gerrod Greenwood (gmoney), the Decentraland beginning, the fracture, and the legacy — ending in a soft email capture instead of a hard sell.

**Architecture:** One page edit (`pages/About.tsx`) plus one source-level contract test (`tests/brandStoryAbout.test.ts`). The narrative lives in a typed `STORY_CHAPTERS` array rendered by a single mapped section, so the copy has one home. The existing `Newsletter` component provides the conversion tool; the existing `Seo`, Connect, and "From The Blog" blocks stay untouched.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, `motion/react`, lucide-react, Vitest.

## Global Constraints

- **Route:** `/about` only. Do not add a new route, `STATIC_ROUTES` entry, share card, or structured-data node.
- **Brand voice:** first person, founder-led, direct. Forbidden words: "Sale", "Discount", "Limited Time", "Act Now", "Hurry", "Exclusive".
- **Peaceful Space:** no countdowns, no manufactured scarcity, no celebration chrome. `npm run audit:chrome` must exit 0.
- **Keep:** `Seo` with `ABOUT_PAGE_LD`, `MAIN_SHARING_LINK` in the Connect section (pinned by `tests/sharingLink.test.ts`), the `Newsletter` email capture, the "From The Blog" section, and the hero.
- **Remove:** the generic Timeline section, the "Join The Movement" primary CTA, and the "Started From Nothing" / "Resilience" blocks the new chapters supersede.
- **Test command:** `npx vitest run tests/brandStoryAbout.test.ts`
- **Typecheck:** `npx tsc --noEmit`
- **Audit:** `npm run audit:chrome`

## File Structure

| File | Responsibility |
|---|---|
| `tests/brandStoryAbout.test.ts` | Source-level contract: names the loss, keeps the chapters, keeps the soft capture, bans urgency/forbidden words |
| `pages/About.tsx` | The `/about` page. Add `STORY_CHAPTERS`; replace the middle narrative sections; retitle the product section; wire the soft capture; remove the hard CTA |

---

### Task 1: Replace the generic origin sections with the four-chapter arc

**Files:**
- Create: `tests/brandStoryAbout.test.ts`
- Modify: `pages/About.tsx` (imports, module scope, the middle sections)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `STORY_CHAPTERS: StoryChapter[]` — each `{ id, label, icon, headline, accent?, paragraphs, signoff? }`. Later tasks rely on the rendered ids `#the-loss`, `#the-beginning`, `#the-fracture`, `#the-legacy`.

- [ ] **Step 1: Write the failing contract test**

Create `tests/brandStoryAbout.test.ts` with exactly:

```ts
// tests/brandStoryAbout.test.ts
//
// The /about page is the brand's founder-credibility surface. These assertions
// are source-level on purpose: the narrative must stay specific (Gerrod
// Greenwood, Decentraland, 10.22.26) and must not drift into manufactured
// urgency or the brand's forbidden words. Source-level guards run in a plain
// `npm test` without a build.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..');
const ABOUT = path.join(ROOT, 'pages/About.tsx');
const source = fs.readFileSync(ABOUT, 'utf8');

describe('/about brand story', () => {
    it('names the loss the brand is built from', () => {
        expect(source).toContain('Gerrod Greenwood');
        expect(source.toLowerCase()).toContain('gmoney');
    });

    it('keeps the origin chapters that make the story specific', () => {
        expect(source).toContain('Decentraland');
        expect(source).toContain('10.22.26');
        expect(source.toLowerCase()).toContain('the team fell');
    });

    it('keeps the soft email capture and the portfolio link', () => {
        expect(source).toContain('Newsletter');
        expect(source).toContain('source="about"');
        expect(source).toContain('MAIN_SHARING_LINK');
    });

    it('does not ship manufactured urgency or forbidden words', () => {
        const forbidden = [
            /\bsale\b/i,
            /\bdiscount\b/i,
            /\blimited time\b/i,
            /\bact now\b/i,
            /\bhurry\b/i,
            /\bexclusive\b/i,
            /\bflash sale\b/i,
        ];
        for (const pattern of forbidden) {
            expect(pattern.test(source), `pages/About.tsx must not contain ${pattern}`).toBe(false);
        }
    });
});
```

- [ ] **Step 2: Run it and confirm it fails on the missing narrative**

Run: `npx vitest run tests/brandStoryAbout.test.ts`

Expected: FAIL — `expect(source).toContain('Gerrod Greenwood')` fails against the current page.

- [ ] **Step 3: Update the lucide-react import**

The current import (lines 4–7) is:

```tsx
import {
    PenTool, Shirt, Package, Building, SprayCan, Music, TrendingUp, ArrowRight, ArrowUpRight, Loader, Link2,
    Instagram, Twitter, Youtube, MessageCircle as MessageCircleIcon, Mail, ExternalLink,
} from 'lucide-react';
```

Replace it with:

```tsx
import {
    PenTool, Shirt, Package, TrendingUp, ArrowUpRight, Loader, Link2,
    Instagram, Twitter, Youtube, MessageCircle as MessageCircleIcon, Mail, ExternalLink,
    Globe2, Flame, Heart,
} from 'lucide-react';
```

Why this exact list: `Building`, `SprayCan`, `Music`, and `ArrowRight` are only used by the Timeline / Resilience / "Join The Movement" blocks this plan removes. `Globe2`, `Flame`, and `Heart` are the chapter icons.

- [ ] **Step 4: Add the typed chapter data at module scope**

Insert after the `AboutRecentPosts` component (after its closing `};`, around line 128) and before `const ABOUT_PAGE_LD`:

```tsx
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
```

- [ ] **Step 5: Replace the three middle sections with the chapter renderer**

Delete these three blocks in `pages/About.tsx`:

1. `{/* Emotional Origin Story */}` section (lines 204–232)
2. `{/* Founder Background */}` section (lines 234–273)
3. `{/* Mission Graphic Section - Resilience */}` section (lines 275–307)

In their place — immediately before `{/* What Gets Made Here */}` — insert:

```tsx
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
```

- [ ] **Step 6: Delete the generic Timeline section**

Delete the entire `{/* Timeline Section */}` block (lines 367–414). It is superseded by the chapter arc and contains no unique brand detail.

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/brandStoryAbout.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add pages/About.tsx tests/brandStoryAbout.test.ts
git commit -m "feat(about): tell the founder story from the 10.22.26 post"
```

---

### Task 2: Close with the soft email capture, not a hard sell

**Files:**
- Modify: `pages/About.tsx`
- Modify: `tests/brandStoryAbout.test.ts`

**Interfaces:**
- Consumes: `STORY_CHAPTERS` and the rendered page from Task 1; `Newsletter` props `heading` / `subheading` (already declared in `components/Newsletter.tsx` lines 7–12).
- Produces: no new exports.

- [ ] **Step 1: Extend the test with the conversion contract**

Add this block inside the existing `describe('/about brand story', ...)` in `tests/brandStoryAbout.test.ts`:

```ts
    it('closes with a soft email capture, not a hard sell', () => {
        expect(source).toContain('heading="Stay in touch."');
        expect(source).toContain('No manufactured urgency');
        expect(source).not.toContain('Join The Movement');
    });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/brandStoryAbout.test.ts`

Expected: FAIL — the current page has no `heading="Stay in touch."` and still contains `Join The Movement`.

- [ ] **Step 3: Retitle the product section to "Coalition Today" and add the lead-in**

In the `{/* What Gets Made Here */}` section, change the label text from `What Gets Made Here` to `Coalition Today`, and add this paragraph directly after the existing `<h2>`:

```tsx
<p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mt-6">
    Coalition today is the proof: hand-built in Baltimore, small runs on purpose, no factory, no shortcuts.
    The labor lives in the build, not the marketing.
</p>
```

- [ ] **Step 4: Pass the soft-capture copy to the Newsletter**

Replace:

```tsx
<Newsletter source="about" variant="block" />
```

with:

```tsx
<Newsletter
    source="about"
    variant="block"
    heading="Stay in touch."
    subheading="One email the day a new Coalition piece is ready. No manufactured urgency. No spam."
/>
```

- [ ] **Step 5: Remove the hard CTA and close on the founder's voice**

In the `{/* Brand Message / Footer Callout */}` section, delete the `<motion.a ... href="/shop">Join The Movement ...</motion.a>` block and replace it with:

```tsx
<motion.p
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8, delay: 0.2 }}
    className="text-sm uppercase tracking-[0.3em] text-gray-500"
>
    — SG, 2026
</motion.p>
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run tests/brandStoryAbout.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pages/About.tsx tests/brandStoryAbout.test.ts
git commit -m "feat(about): close the story with a quiet drop-list opt-in"
```

---

### Task 3: Verify the page against the existing guards

**Files:**
- No source edits expected. This task is the release gate.

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean, no output.

- [ ] **Step 2: Peaceful Space audit**

Run: `npm run audit:chrome`

Expected: exits 0 with the clean confirmation line.

- [ ] **Step 3: Focused regression tests**

Run: `npx vitest run tests/brandStoryAbout.test.ts tests/sharingLink.test.ts tests/structuredData.test.ts tests/seoMeta.test.ts`

Expected: all pass. `sharingLink.test.ts` proves the Connect section still uses `MAIN_SHARING_LINK`; `structuredData.test.ts` and `seoMeta.test.ts` prove the page still feeds `ABOUT_PAGE_LD` and does not override its share card.

- [ ] **Step 4: Full suite**

Run: `npm test`

Expected: all pass.

- [ ] **Step 5: Production build**

Run: `npm run build`

Expected: clean build, 0 warnings.

- [ ] **Step 6: Check generated artifacts**

Run: `git status --porcelain`

Expected: only the two source files. If `public/sitemap.xml` or `public/robots.txt` changed despite no route change, revert them:

```bash
git checkout -- public/sitemap.xml public/robots.txt
```

- [ ] **Step 7: Commit any remaining intentional changes**

Only if Step 6 shows uncommitted changes that should ship:

```bash
git add -A
git commit -m "chore(about): verify the story page against the release gates"
```

If the tree is clean, skip this commit.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Plan location |
|---|---|
| Section 1 — The Loss, naming Gerrod Greenwood | Task 1, `the-loss` chapter |
| Section 2 — The Beginning, Decentraland | Task 1, `the-beginning` chapter |
| Section 3 — The Fracture | Task 1, `the-fracture` chapter |
| Section 4 — The Legacy, 10.22.26 | Task 1, `the-legacy` chapter |
| Section 5 — Coalition Today + soft email capture | Task 2 |
| Voice and forbidden words | Global Constraints + Task 1 test + Task 3 audit |
| "What's NOT on the page" | Task 1 removes the timeline; Task 2 removes the hard CTA; the test bans forbidden words |
| No new route / SEO card | Global Constraints + Task 3 `seoMeta.test.ts` |

**Placeholder scan:** No `TBD`, `TODO`, "implement later", or "similar to Task N". Every code step shows the exact code.

**Type consistency:** `StoryChapter` defines `id`, `label`, `icon`, `headline`, `accent?`, `paragraphs`, `signoff?`; the renderer reads exactly those fields. The `Newsletter` component already accepts `heading` and `subheading` (`components/Newsletter.tsx` lines 7–12). The `id` values match the rendered anchor ids.

**Known non-goal:** the page's SEO title/description stay unchanged (`ABOUT_PAGE_TITLE`, `ABOUT_PAGE_DESCRIPTION`), so the prerendered head, JSON-LD, and `STATIC_ROUTES` entry do not need a sync.
