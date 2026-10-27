# HANDOFF — pink-silver Y2K drop reel (`reel-pink`)

**Output:** `renders/reel-pink.mp4` — 1080×1920, H.264, yuv420p, 30 fps, 14.600 s
(438 frames), 17.8 MiB, **scored** — AAC stereo 48 kHz Baltimore-club bed
(`assets/bed-club.wav`, 14.600 s, synthesized by `make-bed.py`) — and the fields
and grain breathe with the bed's bass band (audio-reactive pulse).
**Baseline for the pulse A/B:** `renders/reel-pink-flat.mp4` — the scored
render from before the pulse; identical film without the breathing.
**IG cover:** `renders/cover-ig.png` — 1080×1920, the opening frame (hero slide
at its widest push). Nothing here is published; assets only.

## What this is

A drop-announcement reel for the pink-silver (pink crop top) drop, built to beat
the fleece reel (`../reel/renders/reel.mp4`). Same two-act architecture and the
same liquid-reveal doctrine — carousel first, reveal LAST, rupture at
3.43 s local — with six deliberate upgrades (see comparison below).

## Beat map (reel clock)

| t (s) | beat |
|---|---|
| 0.00–2.40 | slide 1 — hero/cover, push-in 1.02→1.06 (the long beat) |
| 2.28–2.52 | leopard wipe (→R) at the cut |
| 2.40–4.20 | slide 2 — detail, pan x −14→12 @1.04 |
| 4.08–4.32 | leopard wipe (←L) at the cut |
| 4.20–6.00 | slide 3 — scarcity panel, tilt y 44→−44 @1.04 |
| 5.88–6.12 | leopard wipe (→R) at the cut |
| 6.00–7.80 | slide 4 — manifesto/BTS, pull-back 1.055→1.025 |
| 7.68–7.92 | leopard wipe (←L) at the cut |
| 7.80–10.00 | slide 5 — CTA, rise y −18→2, push 1.03→1.06 |
| 9.68–10.00 | lights-down veil (ground fades IN, power2.in) |
| 10.00–13.70 | liquid mount (approach time-compressed) |
| 12.00–12.43 | hold — 13 frames, nothing animates |
| **12.4333** | **rupture** — collapse 0.2 s power4.in, scatter to 13.61 |
| 12.55–13.05 | lockup lands, back.out(2.2) 0.5 s |
| 14.43 | fields freeze (rupture + 2 s) |
| 13.61–14.60 | still hold — lockup alone |

## Audio bed — Baltimore-club-style (`make-bed.py` → `assets/bed-club.wav`)

The picture already sat on a 133.33 BPM grid — the four wipe swaps are exactly
1.8 s apart, one bar — so the bed is built on it (beat = 0.45 s, bar = 1.8 s,
first downbeat 0.60 s):

- **Groove 0.60–9.60** — four-on-floor kick (the club pulse), clap on 2 & 4,
  offbeat hats, 55/65.4 Hz sub on 1 & 3, formant "ah" chops on the offbeat of 3.
  Every wipe swap (2.40/4.20/6.00/7.80) gets a chord stab + silver FM bell, and
  the print ribbon whooshes past **panned the way it sweeps** (→R, ←L, →R, ←L).
- **Lights-down duck 9.68–10.00** — gain `1 − x²`, the exact mirror of the
  veil's `power2.in` opacity `x²`: the groove is swallowed as the frame darkens.
- **Riser 10.0–12.0** — noise sweep + pitch gliss + accelerating snare roll
  through the liquid approach; tail decayed to ~12.25.
- **Dead air 12.25–12.43** — the 13-frame hold is silent so the drop owns the cut.
- **Drop at 12.4333 s — sample-exact** (frame 373 = sample 596,800 at 48 kHz):
  sub-drop 95→38 Hz, kick, crash, silver bells, Am9 stab. The post-rupture
  groove restarts on a fresh grid from the rupture itself, silver-bell motif on
  13.33/13.78, fade 14.38–14.60.

Everything is stamped (seeded RNG, fixed tables) — no run-to-run randomness,
same determinism rule as the visual.

## Audio-reactive pulse (the fields and grain breathe with the bass)

The bed's bass band drives a subtle pulse — no further: the fields swell ~4%
(scale 1.045/1.035/1.04), the grain lifts 0.10→0.13. Both are blurred colour
and texture, so it reads as breath, never as an equalizer.

- **Data** — `make-audio-data.py` runs the hyperframes-creative extractor
  (`extract-audio-data.py --fps 30 --bands 8`) on the bed and wraps it as
  `assets/audio-data.js` (`window.HF_AUDIO`), loaded by a plain `<script src>` —
  synchronous, no fetch, so the visual stays a deterministic function of
  `tl.time()`.
- **Mapping** — one `fromTo` per element (scale / opacity) whose `ease` is a
  pure function of progress sampling `bands[0]` (bass). Deterministic on every
  seek — no callbacks, no per-frame `tl.call`, nothing to desync in a render
  worker's arbitrary frame order. Lint stays 0/0.
- **Doctrine windows** — the curve is hard-zeroed before 0.60 s, through the
  12.00–12.43 hold, and after 14.43 (frozen with the fields, rupture + 2 s),
  with tapers into the hold (11.75–12.00) and the freeze (14.20–14.43) so
  nothing pops.

`verify-react.py` proves it two ways (4/4 gates):

- **A/B** — `renders/reel-pink-flat.mp4` is the scored render from before the
  pulse; the two renders differ only by these tweens, so their per-frame
  difference IS the pulse: corr **0.625** vs the time-shifted control
  **−0.081**, loud-bass frames run +0.176 gray over the per-encode h264 floor
  (1.9×). To bake a fresh flat baseline: make `bassEase` return 0, render,
  restore.
- **Doctrine, within the render** — the hold adds no motion over the flat
  baseline (0.266 vs 0.239; the slow field drift through 14.43 is the design's
  own) and the tail after 14.43 is frozen (0.010 both).

## Design decisions

- **Ambient glow bands** — each slide is blurred behind itself (`blur(40px)`
  `saturate(1.15)`, cover, counter-drifting at scale 1.25–1.31). The letterbox is
  lit by its own art instead of flat bands; the art edges are textured noise so a
  flat fill would seam. Scale floor 1.25 keeps the blur's transparent edge fade
  off-frame (the filter runs pre-transform).
- **Cover-forward opening** — slide 1 opens the film, gets 2.4 s (vs 1.8 s for
  the detail slides) and the only push-in.
- **Punchier grid** — 2.4/1.8/1.8/1.8/2.2 s instead of the fleece's flat 2.2 s;
  total 14.6 s vs 17.0 s.
- **Leopard wipes** — no bare hard cuts: at each of the four cuts (2.4/4.2/6.0/
  7.8 s) a feathered ribbon of the print (the same stamped rosette tile on a
  rose band) sweeps past in 0.24 s, alternating left→right / right→left like a
  flicked page; the slide swaps underneath at the sweep's midpoint. One linear
  pass per element (lint stays 0/0).
- **Pink-weighted fields** — hot pink `rgba(255,61,175,.50)`, silver-blue
  `rgba(150,190,232,.42)`, light pink `rgba(255,150,205,.36)`; the washes are
  lifted from the slide art palette. The liquid comp itself is untouched
  (transparent ground, doctrine-exact timings).
- **Shortened ending + full-scatter mount** — the ending was cut from 6.0 s to
  4.6 s (film 16.0 → 14.6 s) by time-compressing the liquid's approach only
  (gather 0.6 s, drift 1.25 s); the money beats are untouched: 13-frame hold,
  0.2 s master-exact collapse, master scatter vectors/durations. Rupture moved
  13.43 → 12.4333 s. The mount (3.7 s) always runs past the full scatter
  (ends 13.61 s reel), so no satellite pops at the mount edge.
- **1.5× slide sources** — 1620×2025 renders scaled by the browser to 1080×1350
  (crisper than 1× on a phone).
- **Leopard rework of the liquid ending** ("rework the bubbles to match the
  leopard shirt") — the liquid was cold ice-chrome from the fleece lineage; it
  is now **silver-on-rose** to match the garment ("Pink leopard print, 3D silver
  puff lettering — Silver on rose"). Bubbles carry warm silver-rose chrome
  (`#fff→#f8f0f5→#ecd4de/#edd8e2→#c6adba/#c9b0be`), each wrapped in the shirt's
  leopard print via a stamped plum-rosette texture (`make-mottle.py` →
  `assets/leopard-mottle.png`, torus-wrapped 512px tile, no RNG — rosette table
  + wrapped distance field; per-bubble `background-position` offsets are
  stamped inline). Occlusion tints warmed to plum. Act-2 fields re-toned to the
  print itself: hot pink / rose-mauve `#d99db1` / plum `#732454` (the liquid is
  the silver; the fields are the rose). The mottle improved the doctrine gate:
  the carried mark reads even less legible (NCC 0.267, was 0.311).

## Verification (all green)

- `npx --yes hyperframes@0.8.85 check` — 0 errors / 0 warnings (lint, runtime,
  layout, motion).
- `verify-reel-pink.py` — **20/20 gates on snapshots AND on extracted MP4
  frames** (`python verify-reel-pink.py [FRAME_DIR]`; keep the MOTION /
  GLOW_MOTION tables in sync with `index.html` if timings change):
  - slide presence ×5 with authored Ken Burns reproduced: corr 0.998–0.999,
    cross-slide ≤ 0.527 (threshold 0.60)
  - leopard wipes ×4: plum pixels spike at each cut (51k–198k on the MP4)
    against 2k–29k at neighbouring beats — the print sweeps through, never rests
  - glow bands ×5 vs reproduced blurred echo: corr 0.845–0.996 (flat band ≈ 0)
  - bead at hold: 82,468 bright px (need > 60,000)
  - carried mark unreadable at hold: NCC 0.267 (need < 0.35); same detector
    fires 0.998 on the crisp lockup (self-validating control)
  - tan lockup landed: 54,920 tan-range px (fleece reel: 54,999)
  - lockup matches artwork: corr 0.998; still after landing: diff 1.09
- ffprobe: h264 1080×1920 30/1 fps, 438 frames, 14.600 s, yuv420p + **aac LC
  stereo 48 kHz, 14.600 s**.
- `verify-react.py` — **4/4 reactivity gates** (A/B against the flat
  baseline + within-render doctrine stillness; see the pulse section).
- `verify-audio.py` — **11/11 gates on the audio extracted from the MP4**
  (`ffmpeg -i renders/reel-pink.mp4 -vn -ac 1 -ar 48000 renders/bed-extract.wav`,
  then `python verify-audio.py`): drop onset within one hop of the rupture
  (12.425 s vs 12.4333 s, 5 ms frames), hold/drop ratio 0.000, duck/groove
  0.150, wipe accents 1.19–1.22× both neighbouring beats, groove floor, tail fade.
- MP4 evidence frames in `renders/mp4frames/`, snapshots in `snapshots/`.

## Versus the fleece reel (`../reel`)

| | fleece (17.0 s) | pink-silver (14.6 s) |
|---|---|---|
| slide sources | 1× (1080×1350) | 1.5× (1620×2025) |
| letterbox | flat ground bands | ambient glow (blurred self-echo) |
| pacing | flat 2.2 s ×5 | 2.4/1.8/1.8/1.8/2.2, cover-forward |
| transitions | hard cuts | leopard-print wipes at every cut |
| ending | 6.0 s (11.0–17.0) | 4.6 s (10.0–14.6), compressed approach |
| scatter | cut at mount edge (3.7 s) | runs to completion (4.8 s mount) |
| fields | ice/orange/magenta | hot pink / rose-mauve / plum (the print) |
| liquid | ice-chrome bubbles | silver-on-rose bubbles in leopard print |
| audio | silent | Baltimore-club bed, drop sample-exact on the rupture (11/11 audio gates) |
| pulse | — | fields + grain breathe with the bass (4/4 react gates, doctrine windows zeroed) |
| gates | 11/11 | 20/20 (adds glow + wipe gates), on MP4 too |
| cover export | — | `renders/cover-ig.png` 1080×1920 |

## Re-render / tweak

```bash
cd docs/logo-reveal/reel-pink
python make-bed.py            # regen assets/bed-club.wav (fully deterministic)
python make-audio-data.py     # regen assets/audio-data.js for the pulse
npx --yes hyperframes@0.8.85 check
npx --yes hyperframes@0.8.85 snapshot --at 1.2,2.4,3.3,4.2,5.1,6.02,6.9,7.8,8.9,10.6,12.2,12.53,13.4,14.4
python verify-reel-pink.py
npx --yes hyperframes@0.8.85 render --quality high --fps 30 --output renders/reel-pink.mp4
# gate the render itself: extract the same beats to renders/mp4frames/ and run
#   python verify-reel-pink.py renders/mp4frames
# gate the audio as well:
#   ffmpeg -y -i renders/reel-pink.mp4 -vn -ac 1 -ar 48000 renders/bed-extract.wav
#   python verify-audio.py
# gate the pulse (A/B against renders/reel-pink-flat.mp4):
#   python verify-react.py
```

Windows quirk: if anything (e.g. the app's file viewer) has `reel-pink.mp4`
open, the render's final rename fails with EPERM and the artifact is lost.
Render to a sibling name and copy over the locked target instead:

```bash
npx --yes hyperframes@0.8.85 render --quality high --fps 30 --output renders/reel-pink-scored.mp4
cp -f renders/reel-pink-scored.mp4 renders/reel-pink.mp4 && rm renders/reel-pink-scored.mp4
```

## Open items

- **The fleece reel is still silent and static** — the same `make-bed.py`
  recipe (retimed to its 14.43 s rupture) and the same pulse recipe would
  score it.
- Registry claims for copy: photo-supported only (interior/fabric claims still
  unanswered). Slides come from `scripts/templates/pink-silver-y2k-grid-slide.html`
  rendered via `scripts/render-pink-silver-y2k.ts --scale 1.5`.
- No publishing, no commits — user does both.
