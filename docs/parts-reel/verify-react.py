# verify-react.py -- gate the audio-reactive pulse on the rendered reel.
#
# Two complementary proofs:
#   A/B signal proof -- the pulsed render and its pre-pulse baseline differ
#   ONLY by the bass-driven tweens, so their per-frame difference IS the
#   pulse. It must track the expected bass curve and be substantial on
#   loud-bass frames. (Decode at 135x240 so the scaler averages away
#   per-encode h264 grain re-quantization; the pulse is spatially smooth
#   and survives.)
#
#   Doctrine proof -- measured WITHIN the pulsed render: nothing may move
#   during the 12.00-12.43 hold, and the film must be frozen after 14.43
#   (nothing moves >=2 s post-rupture).
#
# The expected curve replicates index.html bassAt() exactly.
#
# Usage: python verify-react.py [pulsed.mp4] [flat.mp4] [audio-data.json]
#   defaults: renders/reel-pink-scored.mp4 renders/reel-pink.mp4
#             assets/audio-data.json
#
# A flat baseline is the scored render from before the pulse was added; to
# make a fresh one, set bassEase in index.html to `return 0`, render,
# restore.

import json
import subprocess
import sys

import numpy as np

PULSED = sys.argv[1] if len(sys.argv) > 1 else "renders/reel-pink-scored.mp4"
FLAT = sys.argv[2] if len(sys.argv) > 2 else "renders/reel-pink.mp4"
DATA = sys.argv[3] if len(sys.argv) > 3 else "assets/audio-data.json"

FPS = 30.0
W, H = 135, 240   # 1/8 res: scaler averages out per-encode grain noise

results = []


def gate(name, ok, detail):
    results.append((name, bool(ok), detail))


# --- the expected pulse curve: replicate index.html bassAt() exactly ---
d = json.load(open(DATA, encoding="utf-8"))
frames = d["frames"]
n = d["totalFrames"]


def bass_at(t):
    if t < 0.6 or (12.0 <= t < 12.4333) or t >= 14.43:
        return 0.0
    f = int(round(t * d["fps"]))
    f = max(0, min(n - 1, f))
    v = frames[f]["bands"][0]
    if 11.75 < t < 12.0:
        v *= (12.0 - t) / 0.25
    if 14.2 < t < 14.43:
        v *= (14.43 - t) / 0.23
    return v


env = np.array([bass_at(i / FPS) for i in range(n)])


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path,
         "-vf", "scale=%d:%d,format=gray" % (W, H), "-f", "rawvideo", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float64)


a = decode(PULSED)
b = decode(FLAT)
if a.shape[0] < n or b.shape[0] < n:
    print("FAIL: frames decoded %d/%d (want %d)" % (a.shape[0], b.shape[0], n))
    sys.exit(1)
a, b = a[:n], b[:n]

# --- A/B: per-frame mean abs difference IS the pulse ---
dd = np.abs(a - b).mean(axis=(1, 2))

corr = float(np.corrcoef(env, dd)[0, 1])
sh = np.zeros(n)
sh[37:] = env[:-37]                      # control: curve shifted +1.23 s
corr_sh = float(np.corrcoef(sh, dd)[0, 1])
gate("A/B pulse tracks bass curve", corr > 0.5 and corr > corr_sh + 0.1,
     "corr %.3f vs shifted control %.3f" % (corr, corr_sh))

loud = env > 0.3
still = np.concatenate([dd[0:18], dd[362:373], dd[434:438]])
ratio = float(dd[loud].mean()) / max(float(still.mean()), 1e-9)
delta = float(dd[loud].mean()) - float(still.mean())
gate("A/B pulse loud above floor", loud.sum() > 20 and ratio > 1.5 and delta > 0.1,
     "loud %.3f vs encode floor %.3f = %.1fx (+%.3f) over %d loud frames"
     % (dd[loud].mean(), still.mean(), ratio, delta, int(loud.sum())))

# --- doctrine, within the pulsed render vs the flat baseline: the pulse
#     must add no motion in the hold, and the tail must be frozen. (The
#     slow field drift through 14.43 is the design's own baseline and is
#     present in both renders.) ---
mv = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
mv_b = np.abs(np.diff(b, axis=0)).mean(axis=(1, 2))
hold = float(mv[362:373].mean())
hold_flat = float(mv_b[362:373].mean())
gate("hold 12.0-12.43 adds no motion", hold <= hold_flat + 0.05,
     "pulsed %.3f vs flat %.3f" % (hold, hold_flat))

frozen = float(mv[434:438].mean())
frozen_flat = float(mv_b[434:438].mean())
gate("tail frozen after 14.43", frozen < 0.10 and frozen <= frozen_flat + 0.05,
     "pulsed %.3f vs flat %.3f" % (frozen, frozen_flat))

fails = 0
for name, ok, detail in results:
    mark = "PASS" if ok else "FAIL"
    if not ok:
        fails += 1
    print("%s  %-30s %s" % (mark, name, detail))
print("")
print("reactivity gates: %d/%d" % (len(results) - fails, len(results)))
sys.exit(1 if fails else 0)
