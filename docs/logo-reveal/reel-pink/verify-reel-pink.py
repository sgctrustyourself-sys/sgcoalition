"""
Pixel gates for the pink-silver drop reel (docs/logo-reveal/reel-pink).
Mirrors the verification doctrine from the liquid-logo-reveal skill:
  - slide presence per beat: frame band vs source art WITH the authored Ken Burns
    transform reproduced exactly (identity + motion verified together)
  - glow band per beat: the letterbox is lit by the slide's own blurred echo,
    reproduced (cover + transform + blur) and correlated — a flat band fails
  - pre-rupture (12.2s): glass bead present, carried mark UNREADABLE
  - post-rupture (14.4s): tan lockup landed, matches artwork, stable since 13.4s
Legibility uses normalized cross-correlation (NCC) at quarter resolution, and the
detector is self-validated: the SAME detector must fire on the crisp post-rupture
lockup (control) and miss on the refracted bead.
Run from docs/logo-reveal/reel-pink:  python verify-reel-pink.py [FRAME_DIR]
(FRAME_DIR defaults to snapshots; point it at extracted MP4 frames to gate the
render. Keep MOTION/GLOW_MOTION tables in sync with index.html.)
"""
import sys
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image, ImageFilter

SNAP = sys.argv[1] if len(sys.argv) > 1 else "snapshots"
ASSETS = "assets"
GROUND = (13, 13, 16)  # #0d0d10

results = []

def gate(name, ok, detail):
    results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: {detail}")

def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)

def gray(a):
    return a @ np.array([0.299, 0.587, 0.114])

def corr(a, b):
    a = a.ravel() - a.mean()
    b = b.ravel() - b.mean()
    d = np.linalg.norm(a) * np.linalg.norm(b)
    return float((a @ b) / d) if d > 1e-9 else 0.0

def crop(a, x0, y0, x1, y1):
    return a[y0:y1, x0:x1]

def max_ncc_val(search_img, tmpl):
    th, tw = tmpl.shape
    t = tmpl - tmpl.mean()
    tn = t / (np.linalg.norm(t) + 1e-9)
    win = sliding_window_view(search_img, (th, tw))
    w = win - win.mean(axis=(2, 3), keepdims=True)
    num = (w * tn).sum(axis=(2, 3))
    den = np.linalg.norm(w, axis=(2, 3)) + 1e-9
    return float((num / den).max())

# ── fixtures ──────────────────────────────────────────────────────────────
# snapshot beats: 5 slide midpoints, the 4 wipe cuts, the approach, the hold,
# the rupture edge, the landed lockup and the end frame (frame-NN-at-Ts.png).
# 6.0 is written 6.02 so the snapshotter's trailing-zero filename quirk stays away.
_SNAP_TIMES = ["1.2", "2.4", "3.3", "4.2", "5.1", "6.02", "6.9", "7.8", "8.9", "10.6", "12.2", "12.53", "13.4", "14.4"]
# wipe cuts and their neighbouring mid-beat samples
WIPES = [("2.4", "1.2", "3.3"), ("4.2", "3.3", "5.1"), ("6.02", "5.1", "6.9"), ("7.8", "6.9", "8.9")]
snap = {t: load(f"{SNAP}/frame-{i:02d}-at-{t}s.png") for i, t in enumerate(_SNAP_TIMES)}
# 1.5x sources scaled to the on-frame 1080x1350 so every geometry below is
# identical to the composition's layout maths
slides = {n: Image.open(f"{ASSETS}/y2k-pink-silver-slide-{n}.png").convert("RGB").resize((1080, 1350), Image.LANCZOS)
          for n in range(1, 6)}
lockup_asset = Image.open(f"{ASSETS}/logo-lockup.png").convert("RGBA")

# slide band inside the 1080x1920 frame (slide art sits at y 285..1635; at max
# Ken Burns scale 1.06 its top edge reaches y 244, so the glow band stops at 235)
SLIDE_BOX = (15, 300, 1065, 1620)
GLOW_BOX = (15, 30, 1065, 235)
# lockup box: left 210..870, top 799.6..1043.6
LOCKUP_BOX = (210, 800, 870, 1044)
# hero bead at the hold: centre (540+79, 960+89) = (619, 1049), 420px + margin
BEAD_BOX = (389, 819, 849, 1279)

# Ken Burns table, mirrored from index.html (t0, dur, x0, x1, y0, y1, s0, s1)
MOTION = {1: (0.0, 2.4, 0, 0, 0, 0, 1.02, 1.06),
          2: (2.4, 1.8, -14, 12, 0, 0, 1.04, 1.04),
          3: (4.2, 1.8, 0, 0, 44, -44, 1.04, 1.04),
          4: (6.0, 1.8, 0, 0, 0, 0, 1.055, 1.025),
          5: (7.8, 2.2, 0, 0, -18, 2, 1.03, 1.06)}
# glow counter-parallax, mirrored from index.html
GLOW_MOTION = {1: (0.0, 2.4, 0, 0, 0, 0, 1.25, 1.31),
               2: (2.4, 1.8, 22, -22, 0, 0, 1.28, 1.28),
               3: (4.2, 1.8, 0, 0, -34, 34, 1.28, 1.28),
               4: (6.0, 1.8, 0, 0, 0, 0, 1.31, 1.25),
               5: (7.8, 2.2, 0, 0, 16, -8, 1.26, 1.30)}

def transformed_art(n, t):
    """Reproduce the authored GSAP transform on slide n at time t (element-local,
    transform-origin 50% 50%), rendering the art into the frame-band space."""
    t0, dur, x0, x1, y0, y1, s0, s1 = MOTION[n]
    f = (t - t0) / dur
    s = s0 + (s1 - s0) * f
    tx, ty = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
    cx, cy = 540.0, 675.0
    kx, ky = (cx * (s - 1) - tx) / s, (cy * (s - 1) - ty) / s
    # band pixel (bx, by) = slide coord (bx+15, by+15); in_art = out/s + k
    fill = tuple(slides[n].getpixel((0, 0)))
    return slides[n].transform((1050, 1320), Image.AFFINE,
                               (1 / s, 0, 15 / s + kx, 0, 1 / s, 15 / s + ky),
                               resample=Image.BICUBIC, fillcolor=fill)

def transformed_glow(n, t):
    """Reproduce the glow band: background cover + the authored scale/translate
    about the frame centre, then the CSS blur(40px) approximated after the
    quarter-res downsample (sigma 10). Heavy blur: small mismatch is fine."""
    t0, dur, x0, x1, y0, y1, s0, s1 = GLOW_MOTION[n]
    f = (t - t0) / dur
    s = s0 + (s1 - s0) * f
    tx, ty = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
    # glow sources are the same 1.5x files, used at native resolution
    art = Image.open(f"{ASSETS}/y2k-pink-silver-slide-{n}.png").convert("RGB")
    # background-size: cover into 1080x1920 -> scale by height, centre-crop x
    k = max(1080 / art.width, 1920 / art.height)
    rw, rh = round(art.width * k), round(art.height * k)
    art = art.resize((rw, rh), Image.LANCZOS)
    x_off = (rw - 1080) // 2  # 228 at 1620x2025
    # transform about (540, 960): in_cover = (out - c)/s + c - t/s
    cx, cy = 540.0, 960.0
    Cx = cx - cx / s - tx / s + x_off
    Cy = cy - cy / s - ty / s
    g = art.transform((1080, 1920), Image.AFFINE,
                      (1 / s, 0, Cx, 0, 1 / s, Cy),
                      resample=Image.BICUBIC, fillcolor=tuple(art.getpixel((0, 0))))
    return g.resize((270, 480), Image.LANCZOS).filter(ImageFilter.GaussianBlur(10))

# ── Act 1 - each slide window shows its own art with the authored motion ──
print("Act 1 - slide presence + authored Ken Burns")
beats = [("1.2", 1), ("3.3", 2), ("5.1", 3), ("6.9", 4), ("8.9", 5)]
for t, n in beats:
    x0, y0, x1, y1 = SLIDE_BOX
    band_gray = gray(crop(snap[t], x0, y0, x1, y1))
    art_gray = gray(np.asarray(transformed_art(n, float(t)), dtype=np.float64))
    c = corr(band_gray, art_gray)
    others = max(abs(corr(band_gray, gray(np.asarray(slides[m], dtype=np.float64)[15:1335, 15:1065])))
                 for m in range(1, 6) if m != n)
    gate(f"slide {n} at {t}s", c > 0.90 and others < 0.60,
         f"corr {c:.3f} vs art+motion (others max {others:.3f})")

# ── Act 1 - leopard wipes: the print must sweep past each cut ─────────────
print("Act 1 - leopard wipes at the cuts")
def plum_count(a):
    """dark-plum rosette pixels (the print's ring colour over rose/pink)"""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r > 60) & (r < 180) & (g > 15) & (g < 90) & (b > 35) & (b < 125) & ((r - g) > 25)
    return int(m.sum())
for t, before, after in WIPES:
    cut = plum_count(crop(snap[t], *SLIDE_BOX))
    nb = plum_count(crop(snap[before], *SLIDE_BOX))
    na = plum_count(crop(snap[after], *SLIDE_BOX))
    gate(f"wipe at {t}s", cut > 25000 and cut > 1.5 * max(nb, na, 1),
         f"plum px at cut {cut} vs neighbouring beats {nb}/{na} (print must sweep, not rest)")

# ── Act 1 - glow bands: the letterbox must be lit by the slide's own echo ──
print("Act 1 - ambient glow bands")
gx0, gy0, gx1, gy1 = GLOW_BOX
for t, n in beats:
    frame_q = snap[t][::4, ::4]  # subsample first so both sides share one grid
    band_gray = gray(frame_q[gy0 // 4:gy1 // 4, gx0 // 4:gx1 // 4])
    glow_q = np.asarray(transformed_glow(n, float(t)).convert("L"), dtype=np.float64)
    glow_gray = glow_q[gy0 // 4:gy1 // 4, gx0 // 4:gx1 // 4]
    c = corr(band_gray, glow_gray)
    gate(f"glow {n} at {t}s", c > 0.40,
         f"letterbox band corr {c:.3f} vs blurred echo (flat band would be ~0)")

# ── Act 2 - pre-rupture state at the hold (13.2s) ─────────────────────────
print("Act 2 - pre-rupture hold (12.2s)")
hold = snap["12.2"]
bx0, by0, bx1, by1 = BEAD_BOX
bead = crop(hold, bx0, by0, bx1, by1)
white = int((bead.min(axis=2) > 180).sum())
gate("glass bead present", white > 60000,
     f"{white} bright px in bead region (expect >60000 of {bead.shape[0]*bead.shape[1]})")

# legibility: quarter-res NCC of the lockup artwork over the bead region.
bead_q = gray(bead)[::4, ::4]
tmpl = gray(np.asarray(lockup_asset.convert("RGB"), dtype=np.float64))
tmpl = np.asarray(Image.fromarray(tmpl.astype(np.uint8)).resize((315, 116), Image.LANCZOS), dtype=np.float64)[::4, ::4]
ncc_bead = max_ncc_val(bead_q, tmpl)
gate("carried mark unreadable at hold", ncc_bead < 0.35,
     f"max NCC of lockup art inside bead {ncc_bead:.3f} (need < 0.35)")

# detector control: the SAME detector must fire on the crisp post-rupture lockup.
# Control template = official artwork composited on ground at its on-frame size.
end = snap["14.4"]
lx0, ly0, lx1, ly1 = LOCKUP_BOX
lock = crop(end, lx0, ly0, lx1, ly1)
ctl_art = Image.new("RGBA", lockup_asset.size, GROUND + (255,))
ctl_art.alpha_composite(lockup_asset)
ctl_art = ctl_art.convert("RGB").resize((660, 244), Image.LANCZOS)
ctl_tmpl = gray(np.asarray(ctl_art, dtype=np.float64))[::4, ::4]
ctl = gray(crop(end, max(0, lx0 - 60), max(0, ly0 - 40), min(1080, lx1 + 60), min(1920, ly1 + 40)))[::4, ::4]
ncc_ctl = max_ncc_val(ctl, ctl_tmpl)
gate("legibility detector validated on real lockup", ncc_ctl > 0.50,
     f"same detector on crisp lockup: max NCC {ncc_ctl:.3f} (need > 0.50)")

# ── Act 2 - post-rupture lockup (15.6s) ───────────────────────────────────
print("Act 2 - lockup landed (14.4s)")
r, g, b = lock[..., 0], lock[..., 1], lock[..., 2]
tan = int(((r > 120) & (r < 230) & (g > 90) & (g < 200) & (b > 60) & (b < 180) & (r > g) & (g > b)).sum())
gate("tan lockup landed", tan > 30000,
     f"{tan} tan-range px (660px lockup on the fleece reel measured 54999)")

lw, lh = lockup_asset.size
art = Image.new("RGBA", (lw, lh), GROUND + (255,))
art.alpha_composite(lockup_asset)
art = art.convert("RGB").resize((lx1 - lx0, ly1 - ly0))
c_lock = corr(gray(lock), gray(np.asarray(art, dtype=np.float64)))
gate("lockup matches official artwork", c_lock > 0.8, f"corr {c_lock:.3f}")

diff = float(np.abs(crop(snap["13.4"], lx0, ly0, lx1, ly1) - lock).mean())
gate("lockup still after landing", diff < 6.0,
     f"mean abs diff 13.4s -> 14.4s {diff:.2f} (grain static; fields freeze at 14.43s)")

# ── verdict ───────────────────────────────────────────────────────────────
fails = [n for n, ok, _ in results if not ok]
print()
if fails:
    print(f"FAILED {len(fails)} gate(s): {', '.join(fails)}")
    sys.exit(1)
print(f"ALL {len(results)} GATES PASSED")
