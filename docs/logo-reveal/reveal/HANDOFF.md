# Handoff — Coalition liquid-rupture logo reveal

**Output:** `reveal/renders/reveal.mp4` — 1920×1080, 30fps, 7.0s, H.264, ~4.6 Mbps, silent by design.

## Mark provenance and rights position

- The mark is `public/images/logo.png` — the official Coalition artwork, owned by the caller
  (SG Coalition). No third-party mark appears anywhere in the film.
- The repo holds no vector mark. The film uses the official PNG cropped to its measured
  bounding box (`reveal/assets/logo-carried.png`, `reveal/assets/logo-lockup.png`; crop box
  (34, 169, 483, 335), content 449×166, aspect 2.705, 6px pad).
- Field colours behind the liquid are pure colour — no photography, no environment map, no
  pattern from anywhere else.
- No music bed and no rupture sound were supplied; the film ships silent. If a bed is added
  later it must be licensed for the caller's distribution.

## The four colours

| Role | Value |
|---|---|
| Ground | `#0d0d10` — near-black warm charcoal |
| Field 1 | ice/chrome blue `rgba(126,200,232,0.50)` — the silver of the palette |
| Field 2 | chrome orange `rgba(255,106,26,0.42)` — lifted from the hoodie lettering |
| Field 3 | hot magenta `rgba(255,61,175,0.36)` — the PINK / SILVER lineage |

The liquid itself is near-white (glass), not a brand colour.

## The rupture frame and the three ratios

- **Rupture = frame 103 (3.43s).** Everything before is approach; everything after is consequence.
- Hold before it: 13 frames (3.00–3.43s) — above the 10-frame minimum.
- Collapse: 6 frames (3.43–3.63s) — at the one-fifth-of-a-second limit.
- Scatter: ~33 frames (3.43–4.61s) — over five times the collapse (minimum is 3×).

## Legibility check at rupture-minus-one

- **Pre-rupture (3.2s hold):** correlation between the bead region and the lockup artwork
  = **−0.07** — statistically nothing. The mark is present as a silhouette and unreadable. PASS.
- **Post-rupture (6.4s):** the tan lockup is fully landed (110k tan-range pixels, matching the
  artwork's scaled area) and pixel-stable from 3.7s to end of film. PASS.

## Determinism

- Every `feTurbulence` is seeded (refract seed 7; grain is a fixed data-URI).
- No `Math.random` anywhere; the 15 satellites and their launch vectors are a stamped table.
- Every animated property appears in both `from` and `to`; `immediateRender: false` is set.
- No `repeat: -1`; the fields freeze at rupture+2s so nothing moves after the event.

## Gates

- `npx hyperframes@0.8.85 check` — **passed, 0 errors, 0 warnings** across root + liquid
  sub-composition (layout, motion, contrast, runtime, snapshots all clean; satellite
  off-canvas travel is marked intentional with `data-layout-allow-overflow`).
- Render watched via frame extraction; final frame verified crisp (110k tan-range px).

## Structure

```
reveal/
├── index.html                  # root: fields → liquid mount → lockup → grain
├── compositions/liquid.html    # goo group, satellites, hero bead, rupture + scatter
├── assets/logo-carried.png     # mark cropped to measured bbox (inside bead)
├── assets/logo-lockup.png      # same artwork, lockup role (after rupture)
└── renders/reveal.mp4          # the deliverable
```

The rupture, scatter and lockup timings all live in the two timelines; retime from 3.43s and
keep the three ratios above.

## Honest notes

- The mark is raster, not vector — the checklist's ideal. At 940px lockup width the PNG is
  soft on close inspection. Acceptable at 1080p; get a vector from the original designer
  before using this on a 4K cut.
- The film is silent. A rupture sound (glass tick + low thump) is the obvious finishing move.
