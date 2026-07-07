# Coalition Drop Kit — Reel {{release_slug}} 1/1

A reusable spec for building Coalition vertical-video drop kits — IG Reel, FB cross-post, optional TikTok — for any hand-built process video driving a 1/1 or hard-cap release.

> **Worked example:** *To be added on first reel drop. Until then, treat this file as the master template.*
> **Drop date:** *TBD at clone time*
> **Channels:** Instagram Reel · Facebook Reel cross-post · (optional) TikTok · (optional) X
> **Pair with — [`docs/templates/reel/drop-copy-reel-template.md`](../templates/reel/drop-copy-reel-template.md)** : this file's text counterpart. Same drop date, same `{{ }}` placeholders, same hashtag bank. Always edit the kit + deck together.
>
> **Storyboard preview — [`docs/templates/reel/storyboard-reel-template.html`](../templates/reel/storyboard-reel-template.html)** : 9:16 ASCII cover-frame mock + caption-above-fold mock + video timeline markers + reviewer checklist for non-designers.
>
> **Strategy + audit gate — [`../../README.md#reel--post-recipe-11-process-videos`](../../README.md)** : the operator playbook that captures the *why* of every rule this template captures the *what*. Read this template's tokens through the README's 5-step chain.

---

## Brand specs (apply across every reel)

These stay constant across drops — only the B-roll, the audio, and the cover-frame text change.

| Token | Value |
|---|---|
| Canvas — Reel | 1080 × 1920 (9:16 vertical, mobile-native) |
| Frame rate | 30 fps (IG default; 60 fps only if B-roll was shot that way) |
| Codec | h.264 high profile @ ~10 Mbps |
| Audio | AAC 192 kbps stereo, baked-in track (not a separate stem) |
| Max length | 90 s (IG Reel cap; shorter is better, sweet spot 9–25 s for 1/1 process clips) |
| Palette — base | `#000000` |
| Palette — text | `#FFFFFF` |
| Palette — frame | `#1A1A1A` |
| Palette — stone | `#6B6B6B` |
| Palette — mist | `#C8C8C8` |
| Display font (on-screen text) | Bebas Neue · Anton · Druk Wide |
| Body font (on-screen text) | Inter · Söhne |
| Outer margin (text overlays) | 80–120 px from frame edge |
| Bottom-right safe zone for text | within last 200 px of frame, in middle horizontal band on 1:1 grid crop |

> **Note:** No accent color — the reel's own materials are the only color the cover frame shows. Override this only if the release demands one (e.g., chrome hearts silver).

---

## Source video

For any reel, you start with one CapCut-exported master file. Two CDN URLs if you also serve the raw MP4 to FB / TikTok:

- `reel_master_url` — the 1080×1920 final cut with audio baked in, posted directly to IG Reel
- `reel_raw_url` — optional; the un-burned-text master without on-screen overlay, for FB / TikTok edits that need a different cover frame

**Worked values for the first reel:** filled in on the cloned copy of this file.

**Local master (for direct CapCut upload, alpha-free):**
- `public/videos/{{release_slug}}-1-1-master.mp4`

For the next reel drop, swap this path + URL only.

---

## B-roll inventory (per reel)

The reel is a sequence of B-roll cuts, not a single shot. Aim for 5–8 cuts at 9–25 s total runtime.

| Cut | What it shows | Used for |
|---|---|---|
| 1 — OPENING | Materials laid out (leather, thread, tools) on dark surface. Establishing shot. | First 1–2 s of reel |
| 2 — DETAIL TIGHT | Hands holding the piece / fabric close to lens. | Mid-reel insert |
| 3 — ACTION MID | **Focal action moment — e.g., needle piercing leather, thread under tension, hands stitching.** This is the cover-frame source. | Mid-reel, sync with audio drop |
| 4 — WIDER | Pull back to see the workbench + hands operating. | Mid-late reel |
| 5 — CLOSING | Final or near-final piece framed in product-shot style. | Last 2–3 s before end |

**Worked values for the first reel:** cut list filled in on the cloned copy after the actual B-roll is shot.

> **Action-mid coverage is the priority.** If you only have time to nail one shot, nail cut 3 — it's the cover frame AND the thumbnail AND the source for the 1:1 grid crop. Everything else is supporting footage.

---

## Cover frame (the thumbnail)

The cover frame is what IG / FB show as the reel's static preview in-feed. Mute-thumbs will see only this. So the cover frame is the highest-leverage frame of the entire reel.

### Selection rule

**Use cut 3 (the focal action moment), grabbed at peak tension.** The exact painting moment depends on the material:

| Material / craft | Focal action moment |
|---|---|
| Sewn leather | Needle piercing leather, thread under tension, hands mid-pull |
| Embroidery | Needle emerging from the fabric with visible stitch row |
| Dye work | Brush / sponge mid-stroke on the surface |
| Patch application | Patch being pressed onto the substrate |
| Heat press | Press handle closing, material under clamp |

**Worked values for the first reel:** the specific focal moment is hand-edited in the cloned copy.

### Composition rules

| Rule | Why |
|---|---|
| **Tightest crop possible** — frame fills with hands + material, no workbench visible | Removes context noise; thumb sees only the action |
| **Square-safe composition** — focal action in the middle horizontal band | IG crops to 1:1 in profile grid; if the action lands at top/bottom, it gets lopped off |
| **Single point of action** | Mute-thumbs can't track multiple focal points; one wins |
| **High contrast** — boost the focal subject against background | Most thumbs are scrolled past in <½ sec; high-contrast reads at tiny size |
| **No static finished product flat-lay** | Reads as commerce → IG suppresses in Reels feed |

### On-screen text overlay (cover-frame burn-in)

| Layer | Position | Content |
|---|---|---|
| Background | full-bleed | 1 frame from cut 3 (focal action) |
| Cover text | bottom-right, within last 200 px of frame | `{{cover_text_main}}` |

**Default cover text:** `HANDMADE · 1/1`. Fallbacks (only swap after A/B-testing grid-tap rate):

```
HANDMADE · 1/1
NO FACTORY · 1/1
BUILT · 1/1
```

**Text treatment:**
- All caps, sans-serif Display font (Bebas Neue or Anton).
- White fill. Drop shadow `-2px +2px +8px #000` so it reads on any background.
- Right-aligned so the text "points at" the focal action.

**Worked values for the first reel:** the chosen cover text is hand-edited in the cloned copy.

---

## Audio track

The audio is a co-equal signal with the B-roll. For 1/1 drops we run tracks that:

1. Match the song's *tempo* to the focal-action cut (3) — typically the chorus drops mid-reel.
2. Hold an emotional through-line with the brand voice ("balling like the pacers" = street-hype; "grey wave" = quiet harbor-at-dawn).
3. Are often unreleased or snippet-only on IG, which makes the song hook a discovery lever in the caption.

| Token | What it controls |
|---|---|
| `{{audio_track}}` | Track title — appears in IG's audio credit under the reel |
| `{{audio_artist}}` | Artist handle — credited on the reel + in the caption's first comment |
| `{{audio_status}}` | `release` / `snippet` / `unreleased` — drives whether the song hook can be set as the reel title. **Operator-terminology heuristic, not an IG API field** — IG's audio credit system surfaces track + artist regardless of release status; the three-value set is the operator's lens on whether the audio discovery lever is reliable. If `release`, audio credit fully surfaces and the song hook as title is less critical. If `unreleased` or `snippet`, audio credit is unreliable → song hook earns the title real estate so the snippet is still surfaced twice (caption + title). |

**Worked values for the first reel:**
- `audio_track` = `Balling Like the Pacers`
- `audio_artist` = `1huemoney`
- `audio_status` = `unreleased` (FYI: the track is snippet-only on IG)

### Audio uniqueness rule

**The audio should NOT match the previous reel's audio.** IG and FB both suppress content flagged as duplicate audio — even if the B-roll is new. If the audio IS the value prop (snippet-only unreleased track that the audience needs to be surfaced to), reusing it is justified. Otherwise pick fresh.

This is a SOFT gate during the audit (doesn't fail Post), but if it's wrong the post's velocity will be visibly lower.

---

## Video render pipeline (CapCut → export)

Render the master reel with on-screen text already burned in (so IG doesn't need to render overlays itself):

1. **Project settings — 1080×1920, 30 fps.** Match the export settings below.
2. **Drop the audio track** on the audio timeline first so the B-roll cuts can be sync'd to it. Anchor the focal-action cut (3) to the chorus drop.
3. **Lay B-roll** cuts 1 → 5 in order on the video timeline. Aim for 2–4 s per cut with hard cuts (no dissolves — those read as production-heavy on a 1/1 process reel).
4. **Burn cover text** `{{cover_text_main}}` on the LAST frame of cut 3, exported as a static export step. This is the thumbnail grab — IG will pick the mid-cut frame by default but you can override the thumbnail by saving a custom cover manually after import.
5. **Color grade** — boost contrast on the focal-action cut by ~10%. Don't apply a global filter; the raw material is the value prop.
6. **Export h.264** at 1080×1920, 30 fps, ~10 Mbps. CapCut default is fine. Audio: AAC 192 kbps stereo.

### Export settings (CapCut reference)

| Setting | Value |
|---|---|
| Resolution | 1080 × 1920 |
| Frame rate | 30 fps |
| Codec | h.264 |
| Bitrate | ~10 Mbps (VBR) |
| Audio codec | AAC |
| Audio bitrate | 192 kbps stereo |
| Container | MP4 |
| Color space | Rec. 709 |
| Max length | 90 s |

---

## Templating checklist for the next reel drop

- [ ] Decide on the product / 1/1 / variant (`{{release_slug}}`, `{{x}}`, `{{y}}`).
- [ ] Pick `{{audio_track}}` from `{{audio_artist}}`. Confirm `{{audio_status}}`.
- [ ] If `audio_status` = `unreleased` or `snippet`, the song hook is fair game as the IG caption hook. Otherwise keep the audio in the background and weld the song hook to the series-recognition line.
- [ ] Shoot B-roll cuts 1–5. Cut 3 (focal action) is the priority — that's the cover frame source.
- [ ] Edit in CapCut at 1080×1920 30 fps with the audio anchored to the focal-action cut.
- [ ] Burn `{{cover_text_main}}` on the cover-frame export.
- [ ] Clone this file to `docs/drop-kit-{{release_slug}}.md` + `docs/drop-copy-{{release_slug}}.md` + `docs/storyboard-{{release_slug}}.html`.
- [ ] Replace all `{{ }}` tokens in cloned copies.
- [ ] Render the master MP4.
- [ ] Run the [README audit gate](../../README.md#reel--post-recipe-11-process-videos) before posting.

---

## Asset prep reference

For each reel, the master MP4 lives alongside this template:

- `public/videos/{{release_slug}}-1-1-master.mp4` — 1080×1920, 30 fps, h.264, AAC, ≤ 90 s.

Local copies are produced by CapCut's "Export" with the settings block above.

---

## 🎬 Reel-only templating checks

These are reel-specific additions on top of the README audit gate (linked above):

- [ ] Frame rate of the master MP4 exactly matches IG's expected 30 fps (or 60 fps if shot that way — match what was shot).
- [ ] Audio is baked into the MP4 file, NOT a separate stem (IG does not accept separate audio uploads on Reels).
- [ ] Audio peak loudness sits between -14 LUFS and -10 LUFS so it isn't auto-quieted on mobile.
- [ ] First-frame of the reel is visually interesting (not a black fade-in) — IG's auto-play isn't always from frame 0 of the user-grabbed thumbnail.
- [ ] Cover text `{{cover_text_main}}` is burned into the LAST FRAME of cut 3, separately exported as the static cover image.
- [ ] All visible text on cut 3's frame sits ≥ 200 px from the bottom edge so the IG caption card on mobile doesn't overlap it.
- [ ] No copyrighted audio cut to < 30 s of a longer track (IG's Content ID system demotes the reach on partial-track reels).
