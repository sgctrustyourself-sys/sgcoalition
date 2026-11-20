# Handoff — Coalition drop-announcement reel

**Output:** `reel/renders/reel.mp4` — 1080×1920 (vertical, Reels/Story native), 30fps, 17.0s, H.264 yuv420p, ~18 MB, silent by design. 510 frames.

## Structure

Two acts on one continuous ground (`#0d0d10`), one film, no hard cuts into black:

| Reel time | What happens |
|---|---|
| 0.00–2.20 | Slide 1 — hero. Slow push in (1.015→1.045) |
| 2.20–4.40 | Slide 2 — glide right (−12→+10 px @ 1.03) |
| 4.40–6.60 | Slide 3 — vertical drift (y 50→−50 @ 1.03) |
| 6.60–8.80 | Slide 4 — slow pull-back (1.045→1.02) |
| 8.80–11.00 | Slide 5 — CTA. Rise (y −20→0, 1.02→1.05) |
| 10.68–11.00 | CTA dips to ground (veil fade-in — the lights go down before the event) |
| 11.00–14.43 | The liquid: satellites gather, bead drifts carrying the mark, 13-frame hold |
| **14.43** | **Rupture** — collapse 0.2s (power4.in), scatter 1.18s |
| 14.55–17.00 | Lockup lands (back.out 0.5s) and holds, alone, still |

The liquid is a **native 1080×1920 retarget** of the delivered master (`reveal/`), not an embedded
landscape video: timings identical (rupture 3.43s into the mount), satellite table remapped
x·0.5625 / y·1.7778, goo filter and refract displacement scaled with resolution, bead size kept
at the master's 420px so the mark's legibility margin is untouched.

The slides sit fit-to-width (1080/1350 art on a 1920 frame) — honest letterbox, no crop of
caption art. They enter at full opacity (flat-colour stills; a fade-up would read as flicker).
The reel-level fields match the master's three washes and stay on screen the whole 17s so the
film reads as one world; they only drift from 11.0s and freeze at rupture+2s (16.43s).

## Doctrine compliance (bs-hyperframes-liquid-logo-reveal)

- Reveal is **last**; no copy before the rupture (slide art is the scheduled carousel, not reel copy); no line after.
- Mark unreadable before the rupture — verified by measurement, twice (see gates).
- Hold 13 frames ≥ 10; collapse 0.2s ≤ 1/5s; scatter 1.18s ≥ 3× collapse.
- Nothing moves ≥2s after rupture (fields freeze 16.43s; lockup still from 15.05s).
- All turbulence seeded (refract seed 7, grain fixed data-URI); no `Math.random`; stamped tables;
  every animated prop in both `from` and `to`; no `repeat: -1`.

## Gates

- `npx hyperframes@0.8.85 check` — **passed, 0 errors, 0 warnings** (root + liquid sub-comp).
- `python verify-reel.py` (snapshots) — **11/11 PASS**:
  - Act 1: each slide matches its source art *with the authored Ken Burns transform reproduced
    exactly* — corr 0.999–1.000 (cross-slide controls ≤ 0.365).
  - Pre-rupture hold (14.2s): slides cleared (≤0.177), bead present (92,884 bright px),
    mark unreadable — max NCC of lockup art inside bead **0.310** (< 0.35), with the *same
    detector firing 0.998 on the crisp lockup* as a control.
  - Post-rupture: 55,063 tan-range px, structure corr 0.999 vs official artwork,
    still 15.0→16.4s (mean abs diff 1.97).
- Rendered-MP4 spot checks (ffmpeg-extracted frames): slide 3 band corr 0.934 with authored
  motion; final frame tan 54,999 px, corr 0.999.
- ffprobe: h264, 1080×1920, 30/1 fps, 17.000s, 510 frames, yuv420p.

## Rights and colours

Same position as the reveal master: the mark is `public/images/logo.png` (caller-owned, cropped
to measured bbox); fields are pure colour; no audio supplied, so the reel ships silent — add a
licensed bed before publishing if wanted. Colours: ground `#0d0d10`; ice blue
`rgba(126,200,232,.50)`; chrome orange `rgba(255,106,26,.42)`; hot magenta `rgba(255,61,175,.36)`.

## Files

```
reel/
├── index.html                  # root: 5 slides → liquid mount (11.0s) → lockup → grain
├── compositions/liquid.html    # vertical retarget of the master liquid
├── assets/                     # 5 slide PNGs + logo-carried/logo-lockup (copies)
├── renders/reel.mp4            # the deliverable
├── snapshots/                  # beat frames + contact sheets
├── verify-reel.py              # pixel gates (rerun any time; keep MOTION table in sync)
└── HANDOFF.md                  # this file
```

## Honest notes

- Slide PNGs inside the reel are **copies**, not links: if the carousel art is re-rendered, re-copy
  the five PNGs into `reel/assets/` and re-render (`npx hyperframes@0.8.85 render --quality high --fps 30 --output renders/reel.mp4` from `reel/`).
- The mark is still raster; at 660px lockup width it is softer than the 1080p master's 940px. Fine on a phone; a vector would fix it everywhere.
- Silent. The obvious finishing move is a sound design pass: a soft riser under Act 1, the glass tick + low thump on the rupture at 14.43s.
