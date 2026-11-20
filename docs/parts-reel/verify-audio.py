# verify-audio.py -- gate the RENDERED reel's audio track.
#
# Extract first (project-relative; Windows Python cannot see /tmp):
#   ffmpeg -y -i renders/reel-pink.mp4 -vn -ac 1 -ar 48000 renders/bed-extract.wav
# then:
#   python verify-audio.py [wav-path]   (default renders/bed-extract.wav)
#
# Gates the mix against the film's beat map: the drop must land
# sample-exact on the rupture (12.4333 s = frame 373 = 30 fps), the
# lights-down duck must swallow the groove by 10.0, the 12.00-12.43 hold
# must be dead air, and every leopard-wipe cut must carry an accent.

import sys
import wave

import numpy as np

PATH = sys.argv[1] if len(sys.argv) > 1 else "renders/bed-extract.wav"
SR = 48000
RUPTURE = 373.0 / 30.0
WIPES = [2.40, 4.20, 6.00, 7.80]

w = wave.open(PATH, "rb")
n = w.getnframes()
raw = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768.0
if w.getnchannels() == 2:
    raw = raw.reshape(-1, 2).mean(axis=1)
dur = n / float(w.getframerate())

results = []


def gate(name, ok, detail):
    results.append((name, bool(ok), detail))


def rms(t0, t1):
    seg = raw[int(t0 * SR):int(t1 * SR)]
    if len(seg) == 0:
        return 0.0
    return float(np.sqrt(np.mean(seg ** 2)))


# 1 -- duration matches the film
gate("duration 14.6 s", 14.55 <= dur <= 14.65, "%.3f s" % dur)

# 2 -- there is signal at all
gate("audio present", float(np.max(np.abs(raw))) > 0.1,
     "peak %.3f" % float(np.max(np.abs(raw))))

# 3 -- drop onset lands on the rupture (frame 373, +-1 frame)
hop_n = int(0.005 * SR)
e = np.array([np.sqrt(np.mean(raw[i:i + hop_n] ** 2))
              for i in range(0, len(raw) - hop_n, hop_n)])
d = np.diff(e)
w0, w1 = int(12.2 / 0.005), int(12.7 / 0.005)
k = w0 + int(np.argmax(d[w0:w1]))
onset = k * 0.005
gate("drop on rupture", abs(onset - RUPTURE) < 0.034,
     "onset %.4f s vs %.4f s (frame 373)" % (onset, RUPTURE))

# 4 -- the hold before the rupture is dead air against the drop
hold = rms(12.25, 12.42)
drop = rms(12.4333, 12.75)
gate("hold silent vs drop", drop > 0.05 and hold / drop < 0.10,
     "hold %.4f drop %.4f ratio %.4f" % (hold, drop, hold / drop if drop else 9.9))

# 5 -- lights-down duck swallows the groove by 10.0
g = rms(9.0, 9.6)
duck = rms(9.95, 10.05)
gate("duck at lights-down", g > 0.05 and duck / g < 0.35,
     "duck/groove %.3f" % (duck / g if g else 9.9))

# 6 -- an accent on every wipe cut, above both neighbouring beats
for t in WIPES:
    acc = rms(t - 0.10, t + 0.10)
    nb = max(rms(t - 0.45, t - 0.15), rms(t + 0.15, t + 0.45))
    gate("wipe accent %.2f s" % t, nb > 0 and acc / nb > 1.15,
         "ratio %.2f" % (acc / nb if nb else 9.9))

# 7 -- the act-1 groove is actually playing
gate("groove floor", rms(7.8, 9.6) > 0.05, "%.4f" % rms(7.8, 9.6))

# 8 -- the tail fades instead of chopping
gate("tail fade", rms(14.5, 14.6) / max(rms(13.0, 13.5), 1e-9) < 0.4,
     "ratio %.3f" % (rms(14.5, 14.6) / max(rms(13.0, 13.5), 1e-9)))

fails = 0
for name, ok, detail in results:
    mark = "PASS" if ok else "FAIL"
    if not ok:
        fails += 1
    print("%s  %-26s %s" % (mark, name, detail))

print("")
print("audio gates: %d/%d" % (len(results) - fails, len(results)))
sys.exit(1 if fails else 0)
