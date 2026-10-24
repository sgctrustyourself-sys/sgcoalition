# Brand Story Page — Founder Credibility Design

**Date:** 2026-10-24  
**Status:** Draft (pending user review)  
**Owner:** Founder / Creative Director  
**Route:** `/story` (brand story / about page)  
**Goal:** Establish founder credibility — the "Built from Loss" story made specific and real. No hard sell.  
**Conversion:** One soft, optional email capture at the end ("stay in touch"), using existing `/api/marketing-subscribe` infrastructure. No urgency, no countdown, no forbidden words.

---

## Source Material

The narrative is anchored in the existing blog post **"The Legacy Continues: sgcoin & The Power Back in Our Hands"** (`data/blogPosts.ts`, slug `sgcoin-legacy-message`, published 10.22.26), author "SG".

Key facts pulled from that post:
- **The loss:** Founder's fallen cousin, Gerrod Greenwood ("gmoney"). The brand is named to make him "worth the most in value or money in my eyes."
- **The beginning:** ~2020, Decentraland / Sandbox — streaming, giveaways, first NFT clothing pieces, community friends (skipthecrux, peterparker, trapkingplays, skrilla). "That was a part of my life I would never take back."
- **The fracture:** Friends drifted apart. The crypto team fell apart. Whales controlled everything ("1 vote = however much money is in your account"). The coin tanked.
- **The turn:** 10.22.26 — continuing the legacy of gmoney, "putting the power back in the people's hands." "This isn't about chasing a number. This isn't about getting rich."
- **The present:** Coalition — hand-built in Baltimore, 1/1 wallets and streetwear, SGCoin rewards, community governance, long-term greedy.

---

## Narrative Arc (5 Sections)

### Section 1 — The Loss (Hero)
**Headline:** `BUILT FROM LOSS.`  
**Sub-headline:** Named directly — Gerrod Greenwood / gmoney. The brand is a continuation, not a company launch.  
**Body:** One short paragraph — the brand exists to carry a name forward. Direct, founder-led, poetic but factual.  
**Visual:** Oversized Oswald display type, Arcane Purple gradient accent, atmospheric background blur. No product shot — text and space carry the section.

### Section 2 — The Beginning (~2020)
**Headline:** `THE STARTING DAYS`  
**Body:** Decentraland, streaming, giveaways, first NFT clothing pieces. Founder as maker, not corporate voice. A specific friend or two can be named lightly (from the blog post) to make it feel lived-in.  
**Visual:** Glass card with custom SVG illustration (abstract atmosphere, purple/blue gradient, noise overlay). No stock photography.

### Section 3 — The Fracture
**Headline:** `THE TEAM FELL APART`  
**Body:** Friends drifted. Whales controlled the community. Coin tanked. Honest, not bitter — "I hold no ill will toward any of them." This is where most brands would hide; Coalition says it out loud.  
**Visual:** Darker glass card, single accent line. Minimal, quiet.

### Section 4 — The Legacy (10.22.26)
**Headline:** `10.22.26`  
**Body:** The pivot — honoring gmoney, putting power back in people's hands. "This isn't about chasing a number. This isn't about getting rich." The mission hasn't changed.  
**Visual:** Branded gradient text (Blended purple→blue→purple), subtle motion entrance.

### Section 5 — The Brand Now + Soft Conversion
**Headline:** `COALITION TODAY`  
**Body:** Hand-built in Baltimore. 1/1 wallets and streetwear. SGCoin rewards. Community governance. Long-term greedy.  
**Conversion tool:** One email capture — "Stay in touch. No manufactured urgency." — posting to existing `/api/marketing-subscribe`. Optional, low-pressure, no "act now" language.  
**Visual:** Final full-width section, ends on the founder's voice ("— SG, 2026"). No "Shop Now" button.

---

## Voice & Tone (per BRAND_GUIDELINES.md §3)

| Attribute | Application |
|-----------|-------------|
| **Direct** | "Built from loss." Not "We were founded after experiencing loss." |
| **Founder-led** | First person ("I"), personal voice. "— SG, 2026" sign-off. |
| **Cryptic but clear** | "Turn Losses Into Movement" explained through the cousin story, not a generic slogan. |
| **No manufactured urgency** | No countdowns, no "HURRY," no "only 3 left." |

**Forbidden words (do not use):** Sale, Discount, Limited Time, Act Now, Hurry, Exclusive (unless genuinely 1/1).

**Copy patterns:** Headlines `UPPERCASE`, `font-black`, `tracking-tighter`. Body sentence case, `text-gray-300`/`text-gray-400`, `leading-relaxed`. Labels `UPPERCASE`, `text-[10px]`, `tracking-widest`.

---

## Visual Treatment (per BRAND_GUIDELINES.md §2)

- **Mode:** Dark mode first. Void Black `#050505` primary background.
- **Typography:** Oswald `font-black` for display/headlines; Inter for body.
- **Gradients:** Arcane Purple (primary CTAs/accents), Electric Blue (secondary), Blended (brand hero).
- **Glassmorphism:** Standard glass panel / elevated glass card for section containers.
- **Motion:** Staggered entrance 80–100ms per element, `spring`/`easeOut`, respects `prefers-reduced-motion`.
- **Imagery:** No stock photography. Custom SVG illustrations or abstract atmospheric graphics only.
- **Layout:** Single-column narrative, `max-w-6xl mx-auto`, generous whitespace. Mobile-first.

---

## Conversion Tool — Email Capture (Soft)

**Placement:** End of Section 5, after the founder sign-off.  
**Copy:** "Stay in touch." / email input / submit button (secondary/outline style, not primary).  
**Infrastructure:** Existing `/api/marketing-subscribe` handler + `utils/trafficAttribution.ts` for UTM/referrer capture.  
**Validation:** Client-side required-field check; server handles opt-in.  
**Success state:** Quiet confirmation ("Thanks — you're on the list."), no confetti, no celebration chrome (Peaceful Space compliant).  
**Not a CTA button:** No "Shop Now," no "Buy Now," no urgency.

---

## What's NOT on the Page

- No "Shop Now" / "Buy Now" primary CTA
- No countdown timer or drop countdown
- No flash-sale / urgency language
- No newsletter popup or aggressive capture
- No product grid or catalog links (keep it story-first)
- No stock photography

---

## Components to Build / Reuse

| Component | Source | Notes |
|-----------|--------|-------|
| `PageStory` | New | Page wrapper, section orchestration |
| `StorySection` | New | Reusable section container with staggered motion |
| `StoryHero` | New | Section 1 — oversized headline + sub-headline |
| `StoryEmailCapture` | New | Section 5 conversion tool → `/api/marketing-subscribe` |
| `Seo` | Existing | `components/Seo.tsx` — route-specific title/description/OG |
| `AnnouncementBar` | Existing | Keep the quiet brand line, no promo bar |

---

## Success Metrics (Founder Credibility Goal)

- Time on page > 60 seconds (reads the story)
- Email capture opt-ins (soft conversion, secondary)
- No bounce increase vs. other informational pages
- Qualitative: founder voice feels present, not corporate

---

## Resolved Decisions (2026-10-24)

1. **Route:** `/story` — confirmed.
2. **Conversion tool:** Email capture as proposed — confirmed.
3. **Specific names:** Gerrod Greenwood is kept as the emotional anchor of the loss. The blog post's friend names may be referenced lightly but must not dilute the focus on Gerrod Greenwood.

Spec approved by the founder on 2026-10-24. Implementation plan follows.