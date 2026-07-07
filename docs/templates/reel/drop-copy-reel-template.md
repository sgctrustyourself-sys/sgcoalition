# Coalition Drop Copy — Reel {{release_slug}} 1/1

Ready-to-paste copy deck paired with [`docs/templates/reel/drop-kit-reel-template.md`](../templates/reel/drop-kit-reel-template.md). Every `{{ }}` token is a portability slot for future reel drops. First reel will be the worked example; until then, treat this file as the master template.

> **Pair with — [`docs/templates/reel/drop-kit-reel-template.md`](../templates/reel/drop-kit-reel-template.md)** : this file's audio + cover-frame + render spec. Same drop date, same `{{ }}` placeholders. Always edit the kit + deck together.
>
> **Storyboard preview — [`docs/templates/reel/storyboard-reel-template.html`](../templates/reel/storyboard-reel-template.html)** : 9:16 ASCII cover-frame mock + caption-above-fold mock + video timeline markers + reviewer checklist for non-designers.
>
> **Strategy + audit gate — [`../../README.md#reel--post-recipe-11-process-videos`](../../README.md)** : the operator playbook that captures the *why* of every rule this template captures the *what*.
>
> **Drop date:** *TBD at clone time*
> **Channels:** Instagram Reel · Facebook Reel cross-post · (optional) TikTok · (optional) X single-post
> **Copy deck version:** *TBD at clone time*

---

## Hashtag bank (canonical)

Tier-1 (always include in the first comment of the IG reel, in this order):

```
#sgcoalition #coalition #trustyourself #unity #gmoneyworld #{{release_hashtag}}
```

**Worked (first reel):** `#sgcoalition #coalition #trustyourself #unity #gmoneyworld #{{release_hashtag}}` (placeholder until first drop)

Tier-2 (rotate 2–3 per reel in first comment, never all at once):

```
#{{release_hashtag}} #{{y}}of{{y}} #wallet #madebyhand #1of1 #processreel
```

**Worked:** `#{{release_hashtag}} #1of1 #wallet #madebyhand #processreel` (placeholder until first drop)

Tier-3 audio tags (drop in if `{{audio_status}}` = `unreleased` or `snippet` — surfaces the audio as a discovery lever):

```
#{{audio_artist_clean}} #{{song_hook_clean}}
```

**Worked:** `#1huemoney #ballinglikethepacers` (placeholders until first drop)

> **Taxonomy rule:** 7–10 hashtags total in the first comment is the proven band on IG Reels. Going to 25+ triggers the spam heuristics and IG demotes the reach. Under 5 sacrifices discovery. Use the bank; do not freestyle.

---

## IG Reel title (the on-screen card text, NOT the caption)

The "title" in IG Reel parlance is the short text that appears under the username in the caption slot. It is what mute-thumbs will read FIRST if they unmute but don't expand the caption.

### Default shape (when `{{audio_status}}` = `release`)

```
Custom Coalition {{item_name}} {{x}}/{{y}}
```

**Worked:** `Custom Coalition Wallet 1/1` (placeholders until first drop)

### Alternate shape (when `{{audio_status}}` = `unreleased` or `snippet`)

If the audio is the value prop (snippet-only, IG won't surface track credit otherwise), the title IS the song hook:

```
{{song_hook_pretty}}
```

**Worked:** `Balling Like the Pacers` (placeholders until first drop)

> **Decision rule:** if the audio is unreleased snippet-only on IG, the song hook as the title is fair game AND earns the real estate the series-recognition title usually takes. Otherwise stick with the default shape so followers recognize this drop as part of the build series.

---

## IG Reel caption — hook line (≤125 chars, lands above the "...more" fold)

The first 125 characters of an IG caption sit above the "...more" cut-off. Mute-thumbs + scrollers decide whether to tap expand based on this line alone.

### Construction rule

`song hook (snake-case into prose) + craft verb + emoji stack, in one breath.`

### Default template

```
{{song_hook_prose}}… {{craft_verb_prose}}.🪡🫡
```

**Worked:** `Balling like the Pacers… stitch by stitch.🪡🫡` (placeholders until first drop)

### Length check

**Target ≤ 125 chars including emoji.** The line above reads at ~52 chars — well inside the window. If your actual line exceeds 80 chars, the song hook is too long — abbreviate. If under 30 chars, you didn't weld enough signal — add a craft verb.

---

## IG Reel caption — body

The body is everything below the hook line. Mirror the closing triptych from the previous reel's caption so the audience sees this drop as part of a series, not a one-off.

### Default template (long form)

```
{{hook_line}}

The next 1/{{y}} Custom Coalition {{item_name}} is coming together from scratch — {{song_hook_prose_2}}, {{craft_verb_prose_2}}. Same no-factory energy as the last build, rebuilt into an everyday carry piece. Hand-cut, hand-finished, red and white Coalition mark, one bag only. No second copy. No factory. No shortcuts. Just the process.

{{cta_line}}
```

**Worked:**
```
Balling like the Pacers… stitch by stitch.🪡🫡

The next 1/1 Custom Coalition Wallet is coming together from scratch — balling like the Pacers, stitch by stitch. Same no-factory energy as the last build, rebuilt into an everyday carry piece. Hand-cut, hand-finished, red and white Coalition mark, one bag only. No second copy. No factory. No shortcuts. Just the process.

Trust Yourself — available now at sgcoalition.xyz
```

**Length:** ~370 chars (within IG's 2,200 cap with breathing room).

### Closing triptych (verbatim, do not paraphrase)

The closing three lines — `No factory. No shortcuts. Just the process. Trust Yourself. — {{shop_url}}` — are the trust signal that holds across reels. Don't abbreviate, don't rephrase, don't drop the period-after-each-clause rhythm. This is what makes the drop read as part of the series.

---

## IG Reel first-comment hashtags

Hashtags in IG Reels belong in the **first comment**, not inline in the caption body. Same-day publishing both looks cluttered and steals real estate from the actual caption text. IG indexes first-comment hashtags identically — no reach penalty.

### Default template (post within 5 sec of going live)

```
#sgcoalition #coalition #trustyourself #unity #gmoneyworld #{{release_hashtag}} #{{audio_artist_clean}} #{{song_hook_clean}} #{{item_handle}} #madebyhand #1of1
```

**Worked:** `#sgcoalition #coalition #trustyourself #unity #gmoneyworld #{{release_hashtag}} #1huemoney #ballinglikethepacers #wallet #madebyhand #1of1` (placeholders until first drop)

> **Taxonomy band:** 7–10 tags is the proven reach. Don't drop under 5 (kills discovery) or over 12 (triggers spam heuristics).

---

## FB cross-post variant (with ≥10% built-in drift)

Instagram reels cross-posted to Facebook Reels need a caption with **at least 10% drift** from the IG version, else Facebook's duplicate-content penalty suppresses the reach. Two swaps minimum: one verb + one emoji.

### Construction rule

Take the IG body and apply two swaps:
1. **Verb swap** — change at least one verb (`coming together` → `pulling together`, `cook up` → `stitch up`)
2. **Emoji swap** — change at least one emoji (`🪡🫡` → `🪡🔥`)

Optionally a third drift: the closer line. `available now` → `live at` is a common swap.

### Default template (already drifted from the IG body above)

```
{{hook_line_drifts}}

The next 1/{{y}} Custom Coalition {{item_name}} is pulling together from scratch — {{song_hook_prose_2}}, {{craft_verb_prose_2_alt}}. Same no-factory energy as the last build, rebuilt into an everyday carry piece. Hand-cut, hand-finished, red and white Coalition mark, one bag only. No second copy. No factory. No shortcuts. Just the process.

{{cta_line_drifts}}
```

**Worked:**
```
Balling like the Pacers… stitch by stitch.🪡🔥

The next 1/1 Custom Coalition Wallet is pulling together from scratch — Pacers tempo, one stitch at a time. Same no-factory energy as the last build, rebuilt into an everyday carry piece. Hand-cut, hand-finished, red and white Coalition mark, one bag only. No second copy. No factory. No shortcuts. Just the process.

Trust Yourself — live at sgcoalition.xyz
```

**Drift audit:** the IG body uses `coming together`; this uses `pulling together`. The IG hook uses `🪡🫡`; this uses `🪡🔥`. The IG closer uses `available now`; this uses `live at`. **Three drift points** is even better than the minimum two — all three change.

> **Hard rule:** if the FB caption drifts < 10% from the IG caption (in word count, voice, or theme), Facebook's content classifier flags it as duplicate and suppresses reach. Don't bypass this.

---

## TikTok variant (optional)

If cross-posting to TikTok as well, the drift from IG should be **even larger** (~25%+) because TikTok's classifier is more aggressive. Take the FB version and apply a third swap: introduce or remove one full sentence.

**Worked example (placeholders):**
```
Ballin' like the pacers… stitch by stitch.🔥

Pulling together the next 1/1 Custom Coalition Wallet — Pacers tempo, one stitch at a time. Same hand-cut, hand-finished, red-and-white Coalition mark energy as the last build. No factory. No shortcuts. Just the process.

Trust Yourself — live at sgcoalition.xyz
```

> **Skip rule:** TikTok is NOT required for every reel. Only add a TikTok variant if the previous reel found non-trivial TikTok conversion (open /admin > Marketing > Top channels and check).

---

## X single-post variant (optional)

If the reel needs an X single-post trail, this is the compressed 280-char version. The X feed isn't a video platform — the post links OUT to the IG reel, doesn't embed it.

**Worked (placeholders):**
```
{{song_hook_prose_2}}, one stitch at a time. 🪡

The next 1/{{y}} Custom Coalition {{item_name}} is coming together — no factory, no shortcuts. Just the process.

🔗 Full reel: sgcoalition.xyz
```

**Length:** ~225 chars.

> **Skip rule:** X is optional for reels. If we're already cross-posting IG + FB + (optional) TikTok in a 48h window, X adds noise without proportional reach. Reserve for collectibility-led drops where the X collector community actively tracks streetwear tags.

---

## Internal Slack / Discord one-liner

For pre-launch announcements in the operator's Slack / Discord channels — fits most embed preview windows (≤ 200 chars):

**Worked (placeholders):**
```
{{song_hook_pretty}}. {{item_name}} 1/1 dropping tonight. {{shop_url}}
```

**Worked:** `Balling Like the Pacers. Custom Coalition Wallet 1/1 dropping tonight. sgcoalition.xyz`

---

## Templating checklist (copy additions)

- [ ] Replace every `{{ }}` token in BOTH the kit + deck in the same edit session.
- [ ] Hook line lands ≤ 125 chars BEFORE the "...more" cut-off.
- [ ] Closing triptych (`No factory. No shortcuts. Just the process. Trust Yourself.`) is verbatim — no paraphrase, no abbreviation, no missing period.
- [ ] First-comment hashtags are between 7 and 10 tags. Strip or expand to fit.
- [ ] FB variant has ≥ 10% drift: one verb swap + one emoji swap minimum.
- [ ] TikTok variant (if used) has ≥ 25% drift: three swaps minimum.
- [ ] All prices verbatim across IG body, FB body, title card — no "$45" in one and "$45.00" in another, no "$45 · 50% off" in caption but "$45" on cover.
- [ ] Re-read every caption aloud once. Streetwear copy that doesn't read as a sentence fails engagement.
- [ ] Cover-frame text `{{cover_text_main}}` is ≤ 4 words, all caps (matches the kit spec exactly).

---

## Per-channel publish order

Suggested sequence on reel-drop day (Eastern time as default — adjust for your audience):

1. **T-3d** — Pin a "drop coming" Story to seed anticipation. Use the existing storyboard Story 1 ("HERO") variant if you also want a Story thread — but DON'T default to a Story sequence for reels; this template is for IG-Reel-first drops.
2. **T-1d** — Pre-render the FB and (optional) TikTok caption with the pre-drifted templates from this deck. Don't drift "freehand" — drift via the template fields.
3. **T-0** — Post the IG Reel at **6–8pm evening window**. Immediately paste the first-comment hashtags (within 5 sec, IG indexes them either way but early-comment timing helps for the velocity signal).
4. **T+1h to T+24h** — Watch the velocity check (1.5 if first-30-min likes < 5: pull and re-cut the cover; if 5–15: ride; if >15: greenlight FB 48h later).
5. **T+48h** — Post the FB Reel with the drifted caption. If the previous reel's velocity was strong, queue this one in-platform ahead of the 48h slot — don't rely on memory.
6. **T+72h (optional)** — Cross-post to TikTok with the heavier drift if the previous reel found non-trivial TikTok conversion.
7. **T+1w** — If the reel didn't sell the unit, run Variant A (scarcity-led) of the IG caption as a fresh post pinning the same reel. Don't re-post the same reel — IG suppresses reused content.
