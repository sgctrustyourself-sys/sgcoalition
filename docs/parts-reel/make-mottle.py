"""
Generates assets/parts-mottle.png — the stitched-seam texture that wraps the
liquid bubbles (the Coalition 'Parts' wallet's raw-edge, heavy-stitch make).
Deterministic and stamped: no RNG, seam geometry is a fixed grid and every
dash period divides 512 so the tile repeats seamlessly.

Replaces reel-pink's make-mottle.py (leopard rosettes). Same 512px tile
contract, same RGBA/multiply usage in compositions/liquid.html.

Run from docs/parts-reel:  python make-mottle.py
"""
import numpy as np
from PIL import Image, ImageFilter

S = 512
W = 5          # stitch width
DASH = 16      # dash on-length
PER = 32       # dash period (S % PER == 0 keeps the tile seamless)
INK = (23, 26, 32)       # charcoal seam
OXBLOOD = (116, 24, 42)   # wallet-print accent stitch
CREAM = (231, 216, 200)   # warm contrast stitch

POS = [0, 128, 256, 384]   # seam grid lines (wrap-safe at S=512)

yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)


def dist(c, a):
    """Toroidal distance so seams at x=0 wrap across the tile edge."""
    d = np.abs(a - c)
    return np.minimum(d, S - d)


dash = np.zeros(S, dtype=bool)
for k in range(0, S, PER):
    dash[k:k + DASH] = True

# colour index: 0 = nothing, 1 = charcoal seam, 2 = oxblood, 3 = cream
col = np.zeros((S, S), dtype=np.uint8)
yyi, xxi = yy.astype(int) % S, xx.astype(int) % S
for c in POS:
    vert = (dist(c, xx) <= W / 2) & dash[yyi]
    horz = (dist(c, yy) <= W / 2) & dash[xxi]
    col[vert | horz] = 1

# sparse oxblood stitches; these read as the wallet's dark printed detailing
for k in (64, 320):
    m = (dist(0, xx) <= W / 2) & (yy >= k) & (yy < k + DASH)
    col[m] = 2
m = (dist(256, yy) <= W / 2) & (xx >= 192) & (xx < 192 + DASH)
col[m] = 2

# a few cream stitch catches keep the wrapped seams legible on silver bubbles
for k in (192, 448):
    m = (dist(128, xx) <= W / 2) & (yy >= k) & (yy < k + DASH)
    col[m] = 3

out = np.zeros((S, S, 4), np.uint8)
for idx, rgb in ((1, INK), (2, OXBLOOD), (3, CREAM)):
    m = col == idx
    out[m, 0], out[m, 1], out[m, 2], out[m, 3] = rgb[0], rgb[1], rgb[2], 235

# soft stitch edges (alpha only; colour is flat)
a = Image.fromarray(out[..., 3], "L").filter(ImageFilter.GaussianBlur(0.8))
out[..., 3] = np.asarray(a, dtype=np.uint8)

Image.fromarray(out, "RGBA").save("assets/parts-mottle.png")
print("wrote assets/parts-mottle.png", S, "x", S)
