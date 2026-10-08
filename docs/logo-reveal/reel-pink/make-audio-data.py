# make-audio-data.py -- bake the bed's band data for the audio-reactive pulse.
#
# Runs the hyperframes-creative extractor (FFT bands per frame at 30 fps)
# on assets/bed-club.wav, then wraps the result as a synchronously loadable
# script so the composition can read it at parse time (no async fetch --
# the visual must stay a deterministic function of tl.time()).
#
# Outputs:
#   assets/audio-data.json  -- the extractor's raw output (438 frames, 8 bands)
#   assets/audio-data.js    -- window.HF_AUDIO = {...}; loaded by index.html
#
# Usage: python make-audio-data.py

import json
import os
import subprocess
import sys

EXTRACTOR = r"C:/Users/SG/.agents/skills/hyperframes-creative/scripts/extract-audio-data.py"
WAV = "assets/bed-club.wav"
JSON_OUT = "assets/audio-data.json"
JS_OUT = "assets/audio-data.js"

subprocess.run(
    [sys.executable, EXTRACTOR, WAV, "--fps", "30", "--bands", "8", "-o", JSON_OUT],
    check=True,
)

with open(JSON_OUT, "r", encoding="utf-8") as f:
    data = json.load(f)

with open(JS_OUT, "w", encoding="utf-8") as f:
    f.write("window.HF_AUDIO = ")
    json.dump(data, f, separators=(",", ":"))
    f.write(";\n")

print("wrote %s (%d frames, %d bands)" % (
    JS_OUT, data["totalFrames"], len(data["frames"][0]["bands"])))
