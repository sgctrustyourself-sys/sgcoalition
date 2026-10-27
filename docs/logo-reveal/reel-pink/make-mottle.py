"""
Generates assets/leopard-mottle.png — the leopard rosette texture that wraps
the liquid bubbles (the print of the Women's Leopard Print Crop T-Shirt).
Deterministic and stamped: no RNG, rosette geometry is a fixed table and the
distance field wraps toroidally so the 512px tile repeats seamlessly.
Run from docs/logo-reveal/reel-pink:  python make-mottle.py
"""
import numpy as np
from PIL import Image

S = 512
yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def wrapped(a, c):
    return (a - c + S / 2) % S - S / 2

# stamped rosette table: (cx, cy, radius, phase) — authored, not generated
ROSETTES = [
    (72, 96, 34, 0.4), (256, 60, 30, 1.9), (430, 120, 36, 3.1),
    (140, 250, 31, 2.2), (330, 260, 35, 0.9), (486, 320, 28, 4.0),
    (60, 420, 33, 5.2), (250, 440, 29, 2.8), (420, 460, 34, 1.3),
]
# small solid spots between the rosettes
DOTS = [
    (170, 140, 11, 0.7), (380, 40, 12, 2.4), (55, 300, 10, 3.6),
    (300, 150, 11, 5.0), (200, 360, 12, 1.1), (460, 220, 10, 4.4),
    (120, 480, 11, 2.0),
]

alpha = np.zeros((S, S))
for cx, cy, r, ph in ROSETTES:
    dx, dy = wrapped(xx, cx), wrapped(yy, cy)
    d = np.sqrt(dx * dx + dy * dy)
    th = np.arctan2(dy, dx)
    # organic outline: two fixed harmonics per rosette
    r_out = r * (1 + 0.22 * np.sin(3 * th + ph) + 0.12 * np.sin(5 * th + 1.7 * ph))
    r_in = r_out * 0.42
    ring = smoothstep(r_in - 3, r_in + 5, d) * (1 - smoothstep(r_out - 6, r_out + 3, d))
    alpha = np.maximum(alpha, 0.85 * ring)

for cx, cy, r, ph in DOTS:
    dx, dy = wrapped(xx, cx), wrapped(yy, cy)
    d = np.sqrt(dx * dx + dy * dy)
    th = np.arctan2(dy, dx)
    r_out = r * (1 + 0.18 * np.sin(3 * th + ph))
    blob = 1 - smoothstep(r_out - 3, r_out + 3, d)
    alpha = np.maximum(alpha, 0.75 * blob)

# soft edges
from PIL import ImageFilter
a_img = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.4))
alpha = np.asarray(a_img, dtype=np.float64) / 255.0

out = np.zeros((S, S, 4), np.uint8)
out[..., 0] = 92   # plum ring, in the shirt's rosette dark (#732454 family)
out[..., 1] = 30
out[..., 2] = 62
out[..., 3] = (alpha * 255).astype(np.uint8)
Image.fromarray(out, "RGBA").save("assets/leopard-mottle.png")
print("wrote assets/leopard-mottle.png", S, "x", S)
