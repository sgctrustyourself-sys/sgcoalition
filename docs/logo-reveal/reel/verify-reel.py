"""
Pixel gates for the drop-announcement reel (docs/logo-reveal/reel).
Mirrors the verification doctrine from the liquid-logo-reveal skill:
  - slide presence per beat: frame band vs source art WITH the authored Ken Burns
    transform reproduced exactly (identity + motion verified together)
  - pre-rupture (14.2s): glass bead present, carried mark UNREADABLE
  - post-rupture (16.4s): tan lockup landed, matches artwork, stable since 15.0s
Legibility uses normalized cross-correlation (NCC) at quarter resolution, and the
detector is self-validated: the SAME detector must fire on the crisp post-rupture
lockup (control) and miss on the refracted bead.
Run from docs/logo-reveal/reel:  python verify-reel.py
(keep MOTION table in sync with index.html)
"""
import sys
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image

SNAP = "snapshots"
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
_SNAP_FILES = {"0.5": "0.5", "2.7": "2.7", "4.9": "4.9", "7.1": "7.1", "9.3": "9.3",
               "11.6": "11.6", "14.2": "14.2", "14.53": "14.53", "15.0": "15", "16.4": "16.4"}
snap = {k: load(f"{SNAP}/frame-{i:02d}-at-{f}s.png") for i, (k, f) in enumerate(_SNAP_FILES.items())}
slides = {n: Image.open(f"{ASSETS}/y2k-fleece-slide-{n}.png").convert("RGB") for n in range(1, 6)}
lockup_asset = Image.open(f"{ASSETS}/logo-lockup.png").convert("RGBA")

# slide band inside the 1080x1920 frame (slide art sits at y 285..1635)
SLIDE_BOX = (15, 300, 1065, 1620)
# lockup box: left 210..870, top 799.6..1043.6
LOCKUP_BOX = (210, 800, 870, 1044)
# hero bead at rupture: centre (540+79, 960+89) = (619, 1049), 420px + margin
BEAD_BOX = (389, 819, 849, 1279)

# Ken Burns table, mirrored from index.html (t0, x0,x1, y0,y1, s0,s1)
MOTION = {1: (0.0, 0, 0, 0, 0, 1.015, 1.045),
          2: (2.2, -12, 10, 0, 0, 1.03, 1.03),
          3: (4.4, 0, 0, 50, -50, 1.03, 1.03),
          4: (6.6, 0, 0, 0, 0, 1.045, 1.02),
          5: (8.8, 0, 0, -20, 0, 1.02, 1.05)}

def transformed_art(n, t):
    """Reproduce the authored GSAP transform on slide n at time t (element-local,
    transform-origin 50% 50%), rendering the art into the frame-band space."""
    t0, x0, x1, y0, y1, s0, s1 = MOTION[n]
    f = (t - t0) / 2.2
    s = s0 + (s1 - s0) * f
    tx, ty = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
    cx, cy = 540.0, 675.0
    kx, ky = (cx * (s - 1) - tx) / s, (cy * (s - 1) - ty) / s
    # band pixel (bx, by) = slide coord (bx+15, by+15); in_art = out/s + k
    fill = tuple(slides[n].getpixel((0, 0)))
    return slides[n].transform((1050, 1320), Image.AFFINE,
                               (1 / s, 0, 15 / s + kx, 0, 1 / s, 15 / s + ky),
                               resample=Image.BICUBIC, fillcolor=fill)

# ── Act 1 - each slide window shows its own art with the authored motion ──
print("Act 1 - slide presence + authored Ken Burns")
beats = [("0.5", 1), ("2.7", 2), ("4.9", 3), ("7.1", 4), ("9.3", 5)]
for t, n in beats:
    x0, y0, x1, y1 = SLIDE_BOX
    band_gray = gray(crop(snap[t], x0, y0, x1, y1))
    art_gray = gray(np.asarray(transformed_art(n, float(t)), dtype=np.float64))
    c = corr(band_gray, art_gray)
    others = max(abs(corr(band_gray, gray(np.asarray(slides[m], dtype=np.float64)[15:1335, 15:1065])))
                 for m in range(1, 6) if m != n)
    gate(f"slide {n} at {t}s", c > 0.90 and others < 0.60,
         f"corr {c:.3f} vs art+motion (others max {others:.3f})")

# ── Act 2 - pre-rupture state at the hold (14.2s) ─────────────────────────
print("Act 2 - pre-rupture hold (14.2s)")
hold = snap["14.2"]
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
end = snap["16.4"]
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

# ── Act 2 - post-rupture lockup (16.4s) ───────────────────────────────────
print("Act 2 - lockup landed (16.4s)")
r, g, b = lock[..., 0], lock[..., 1], lock[..., 2]
tan = int(((r > 120) & (r < 230) & (g > 90) & (g < 200) & (b > 60) & (b < 180) & (r > g) & (g > b)).sum())
gate("tan lockup landed", tan > 30000,
     f"{tan} tan-range px (master frame at 940px width had 110816; 660px width scales to ~54600)")

lw, lh = lockup_asset.size
art = Image.new("RGBA", (lw, lh), GROUND + (255,))
art.alpha_composite(lockup_asset)
art = art.convert("RGB").resize((lx1 - lx0, ly1 - ly0))
c_lock = corr(gray(lock), gray(np.asarray(art, dtype=np.float64)))
gate("lockup matches official artwork", c_lock > 0.8, f"corr {c_lock:.3f}")

diff = float(np.abs(crop(snap["15.0"], lx0, ly0, lx1, ly1) - lock).mean())
gate("lockup still after landing", diff < 6.0,
     f"mean abs diff 15.0s -> 16.4s {diff:.2f} (grain static; fields freeze at 16.43s)")

# ── verdict ───────────────────────────────────────────────────────────────
fails = [n for n, ok, _ in results if not ok]
print()
if fails:
    print(f"FAILED {len(fails)} gate(s): {', '.join(fails)}")
    sys.exit(1)
print(f"ALL {len(results)} GATES PASSED")
