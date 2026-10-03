# make-bed.py -- Baltimore-club-style bed for reel-pink. Deterministic.
#
# The picture is already authored to a 133.33 BPM grid: the four leopard
# wipes swap slides at 2.40 / 4.20 / 6.00 / 7.80 -- exactly 1.8 s apart,
# one bar at 133.33 BPM (bar = 1.8 s, beat = 0.45 s). The bed puts a club
# downbeat on every wipe swap, ducks to near-silence at the 9.68 s
# lights-down (gain 1-x^2, the exact mirror of the veil's power2.in
# opacity x^2), builds a riser through the liquid approach (10.0-12.0),
# goes SILENT for the 12.00-12.43 hold, and lands the drop sample-exact
# on the rupture:
#
#     rupture = frame 373 at 30 fps = 373/30 s = sample 596800 at 48 kHz
#
# Everything is stamped (seeded RNG, fixed tables) -- no wall-clock time,
# no run-to-run randomness. Writes assets/bed-club.wav:
# 48 kHz, 16-bit stereo, exactly 14.600 s (700800 samples).
#
# Usage: python make-bed.py

import os
import wave

import numpy as np
from scipy import signal

SR = 48000
DUR = 14.6
N = int(round(SR * DUR))  # 700800

BEAT = 0.45               # 133.333 BPM
BAR = 4 * BEAT            # 1.8 s
T0 = 0.60                 # first downbeat (so 2.40/4.20/6.00/7.80 land on bars)
WIPE_SWAPS = [2.40, 4.20, 6.00, 7.80]   # slide swaps = wipe sweep midpoints
WIPE_DIR = [1, -1, 1, -1]               # ribbon sweeps ->R, <-L, ->R, <-L
DUCK_IN = 9.68
DUCK_OUT = 10.0
RUPTURE = 373.0 / 30.0                  # 12.4333... s
R_SAMP = int(round(RUPTURE * SR))       # 596800 exactly

rng = np.random.default_rng(7)

busA = np.zeros((N, 2))   # act-1 groove (gets the lights-down duck)
mix = np.zeros((N, 2))    # everything else


def place(buf, t, sig, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0:
        return
    a = max(0, i)
    b = min(N, i + len(sig))
    s = sig[a - i: b - i]
    p = np.asarray(pan, dtype=np.float64)
    if p.ndim == 0:
        p = np.full(len(s), float(p))
    ang = (np.clip(p, -1.0, 1.0) + 1.0) * (np.pi / 4.0)   # equal power
    buf[a:b, 0] += s * gain * np.cos(ang)
    buf[a:b, 1] += s * gain * np.sin(ang)


def tarr(dur):
    n = int(round(dur * SR))
    return n, np.arange(n) / SR


def kick(dur=0.5, f0=150.0, f1=48.0, decay=0.16):
    n, t = tarr(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / decay)
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.22
    click = signal.sosfilt(
        signal.butter(2, [900, 5000], btype="bandpass", fs=SR, output="sos"), click)
    return np.tanh((body + click) * 1.2) * 0.9


def sub(freq=55.0, dur=0.35):
    n, t = tarr(dur)
    s = np.tanh(np.sin(2 * np.pi * freq * t) * 1.7) * 0.7
    e = np.exp(-t / (dur * 0.45)) * np.minimum(1.0, t / 0.004)
    return s * e


def clap(dur=0.22):
    n, t = tarr(dur)
    noise = rng.standard_normal(n)
    noise = signal.sosfilt(
        signal.butter(2, [1100, 3200], btype="bandpass", fs=SR, output="sos"), noise)
    e = np.exp(-t / 0.075)
    out = noise * e
    for d, g in ((0.008, 0.7), (0.016, 0.5), (0.024, 0.35)):
        k = int(d * SR)
        out[k:] += (noise * e)[: n - k] * g
    return out / 2.2


def hat(dur=0.06):
    n, t = tarr(dur)
    noise = rng.standard_normal(n)
    noise = signal.sosfilt(
        signal.butter(2, 8000, btype="highpass", fs=SR, output="sos"), noise)
    return noise * np.exp(-t / 0.012) * 0.8


def vchop(f0=220.0, dur=0.16, form=(730.0, 1090.0, 2440.0)):
    n, t = tarr(dur)
    saw = signal.sawtooth(2 * np.pi * f0 * t)
    out = np.zeros(n)
    for fc in form:
        sos = signal.butter(2, [fc * 0.85, fc * 1.18],
                            btype="bandpass", fs=SR, output="sos")
        out += signal.sosfilt(sos, saw)
    e = np.minimum(1.0, t / 0.012) * np.exp(-t / (dur * 0.32))
    return out / 3.0 * e


def bell(f=880.0, dur=0.9, ratio=3.51, index=5.0):
    n, t = tarr(dur)
    mi = index * np.exp(-t / 0.12)
    s = np.sin(2 * np.pi * f * t + mi * np.sin(2 * np.pi * f * ratio * t))
    return s * np.exp(-t / (dur * 0.28)) * np.minimum(1.0, t / 0.001)


def stab(freqs, dur=0.35, cutoff=2600.0):
    n, t = tarr(dur)
    s = np.zeros(n)
    for k, f in enumerate(freqs):
        s += signal.sawtooth(2 * np.pi * f * t + 0.37 * k)
    s /= len(freqs)
    s = signal.sosfilt(
        signal.butter(2, cutoff, btype="lowpass", fs=SR, output="sos"), s)
    e = np.minimum(1.0, t / 0.004) * np.exp(-t / (dur * 0.3))
    return s * e


def whoosh(dur=0.24, f_start=600.0, f_end=4200.0, env=None):
    n = int(round(dur * SR))
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    step = max(1, n // 12)
    for k in range(12):
        a = k * step
        b = min(n, (k + 1) * step + 256)
        if a >= n:
            break
        frac = k / 11.0
        fc = f_start * (f_end / f_start) ** frac
        sos = signal.butter(2, [max(120.0, fc * 0.6), min(19000.0, fc * 1.7)],
                            btype="bandpass", fs=SR, output="sos")
        out[a:b] += signal.sosfilt(sos, noise[a:b])
    if env is None:
        t = np.arange(n) / SR
        env = np.sin(np.pi * t / (n / SR)) ** 1.5
    return out * env


def snare(dur=0.16, tone=2400.0):
    n, t = tarr(dur)
    noise = rng.standard_normal(n)
    noise = signal.sosfilt(
        signal.butter(2, [tone * 0.6, tone * 1.9], btype="bandpass", fs=SR, output="sos"),
        noise)
    return noise * np.exp(-t / 0.038) * 0.9


# ---- intro 0.0-0.60: the pad swells open, a whoosh leads into the grid ----
pad = stab([110.0, 130.81, 164.81], dur=0.62, cutoff=1200.0)
t_p = np.arange(len(pad)) / SR
pad = pad * (t_p / (len(pad) / SR)) ** 1.2
place(busA, 0.0, pad, 0.5)
place(busA, 0.12, whoosh(0.48, 300.0, 2600.0), 0.5)

# ---- act-1 groove: bars at 0.60 + 1.8k. Four-on-floor kick (the club
#      pulse), clap on 2 & 4, offbeat hats, sub on 1 & 3, an "ah" chop
#      on the offbeat of 3 every other bar. The 9.60 downbeat plays and
#      then the duck swallows it. ----
for bi in range(6):
    B = T0 + bi * BAR
    place(busA, B, kick(), 1.0)
    if B + 1.35 < DUCK_IN + 0.2:
        for k in range(1, 4):
            place(busA, B + k * BEAT, kick(), 0.92)
        place(busA, B + 0.5 * BEAT, clap(), 0.5)
        place(busA, B + 2.5 * BEAT, clap(), 0.5)
        for k in range(4):
            place(busA, B + k * BEAT + 0.5 * BEAT, hat(), 0.45,
                  pan=0.35 if k % 2 else -0.35)
        place(busA, B + 2 * BEAT, sub(55.0 if bi % 2 == 0 else 65.41, 0.32), 0.85)
        if bi % 2 == 1:
            place(busA, B + 1.5 * BEAT, vchop(220.0), 0.5)
    # else: the 9.60 downbeat's kick alone -- the duck swallows its tail

# ---- wipe stabs: on every slide swap the club downbeat is doubled by a
#      chord stab + a silver bell, and the print ribbon whooshes past,
#      panned the way it sweeps ----
for wi, t_w in enumerate(WIPE_SWAPS):
    place(busA, t_w, stab([220.0, 261.63, 329.63, 493.88], 0.3), 0.75)
    place(busA, t_w, bell(1046.5 if wi % 2 else 880.0, 0.7), 0.45,
          pan=0.25 if wi % 2 == 0 else -0.25)
    n_w = int(round(0.24 * SR))
    w = whoosh(0.24, 500.0, 5200.0)
    pan_env = np.linspace(-0.8 * WIPE_DIR[wi], 0.8 * WIPE_DIR[wi], n_w)
    place(busA, t_w - 0.12, w, 0.55, pan=pan_env)

# ---- the lights-down duck: gain 1 - x^2 over 9.68-10.00 (the veil's
#      power2.in fade-in mirrored), then nothing of act 1 remains ----
duck = np.ones(N)
i0 = int(round(DUCK_IN * SR))
i1 = int(round(DUCK_OUT * SR))
x = np.linspace(0.0, 1.0, i1 - i0)
duck[i0:i1] = 1.0 - x * x
duck[i1:] = 0.0
mix += busA * duck[:, None]

# ---- riser 10.0-12.0 (the liquid approach), tail to ~12.25, then the
#      13-frame hold is dead air so the drop owns the rupture ----
n_r = int(round(2.25 * SR))
t_r = np.arange(n_r) / SR
r_env = np.where(t_r <= 2.0, (t_r / 2.0) ** 1.8, np.exp(-(t_r - 2.0) / 0.055))
place(mix, 10.0, whoosh(2.25, 260.0, 9000.0, env=r_env), 0.75)

f_g = 110.0 * (4.0 ** (t_r / 2.0))
ph_g = 2 * np.pi * np.cumsum(f_g) / SR
gline = (np.sin(ph_g) * 0.6 + signal.sawtooth(ph_g) * 0.25) * r_env
place(mix, 10.0, gline, 0.4)

t_h = 10.0
step = 0.225
while t_h < 12.0:
    g = 0.28 + 0.6 * (t_h - 10.0) / 2.0
    place(mix, t_h, snare(0.14), g * 0.8)
    t_h += step
    if t_h > 11.45:
        step = 0.1125
    if t_h > 11.85:
        step = 0.05625

# ---- THE DROP -- sample-exact on the rupture (596800) ----
place(mix, RUPTURE, kick(0.6, f0=180.0, f1=42.0, decay=0.22), 1.15)

n_s = int(round(0.9 * SR))
t_s = np.arange(n_s) / SR
f_s = 95.0 * (38.0 / 95.0) ** np.minimum(1.0, t_s / 0.5)
ph_s = 2 * np.pi * np.cumsum(f_s) / SR
drop = np.sin(ph_s) * np.exp(-t_s / 0.35) * np.minimum(1.0, t_s / 0.002)
place(mix, RUPTURE, drop, 0.95)

n_c = int(round(1.3 * SR))
t_c = np.arange(n_c) / SR
crash = rng.standard_normal(n_c)
crash = signal.sosfilt(
    signal.butter(2, 3000, btype="highpass", fs=SR, output="sos"), crash)
place(mix, RUPTURE, crash * np.exp(-t_c / 0.42), 0.5, pan=0.15)

place(mix, RUPTURE, bell(880.0, 1.0), 0.45, pan=-0.2)
place(mix, RUPTURE, bell(1318.5, 0.8), 0.30, pan=0.25)
place(mix, RUPTURE, stab([220.0, 261.63, 329.63, 493.88], 0.4), 0.8)

# ---- post-rupture groove on a fresh grid from the rupture itself ----
for k in range(5):                       # kicks at R, +0.45 ... +1.8
    t_k = RUPTURE + k * BEAT
    if k > 0:
        place(mix, t_k, kick(), 0.95)
    if k % 2 == 1:
        place(mix, t_k, clap(), 0.55)
    place(mix, t_k + 0.5 * BEAT, hat(), 0.5,
          pan=0.3 if k % 2 else -0.3)
place(mix, RUPTURE, sub(55.0, 0.4), 0.9)
place(mix, RUPTURE + 2 * BEAT, sub(65.41, 0.4), 0.85)
place(mix, RUPTURE + 1.5 * BEAT, vchop(220.0), 0.5)      # 13.1083
place(mix, RUPTURE + 3.5 * BEAT, vchop(246.94), 0.5)     # 14.0083
place(mix, RUPTURE + 2 * BEAT, bell(659.25, 0.7), 0.4, pan=-0.25)   # E5
place(mix, RUPTURE + 3 * BEAT, bell(880.0, 0.7), 0.4, pan=0.25)     # A5

# ---- master: gentle saturation, edge fades, peak to -1 dBFS ----
mix = np.tanh(mix * 1.1) * 0.92
fi = int(0.02 * SR)
mix[:fi] *= np.linspace(0.0, 1.0, fi)[:, None]
fo0 = int(14.38 * SR)
mix[fo0:] *= np.linspace(1.0, 0.0, N - fo0)[:, None]
peak = float(np.max(np.abs(mix)))
mix *= 0.89 / peak

os.makedirs("assets", exist_ok=True)
pcm = (np.clip(mix, -1.0, 1.0) * 32767.0).astype("<i2")
with wave.open("assets/bed-club.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())


def rms(t0, t1):
    seg = mix[int(t0 * SR):int(t1 * SR)]
    return float(np.sqrt(np.mean(seg ** 2)))


print("wrote assets/bed-club.wav -- %d samples = %.3f s" % (N, N / SR))
print("rupture sample (must be 596800): %d" % R_SAMP)
print("downbeats:", ", ".join("%.2f" % (T0 + k * BAR) for k in range(6)))
print("wipe swaps:", ", ".join("%.2f" % t for t in WIPE_SWAPS))
print("rms groove 7.8-9.6   %.4f" % rms(7.8, 9.6))
print("rms ducked 9.7-10.0  %.4f" % rms(9.7, 10.0))
print("rms hold 12.25-12.42 %.4f" % rms(12.25, 12.42))
print("rms drop 12.43-12.75 %.4f" % rms(12.4333, 12.75))
print("peak %.3f" % peak)
