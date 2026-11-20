"""
scripts/upscalePartsImages.py — Real-ESRGAN upscale for the Coalition 'Parts'
wallet photos.

Why: the local render sources max out at 1024x1024 (imgur's ceiling for these
uploads), while every other drop ships at 1200-1600. A 1024 square full-bled
into a 1080x1920 frame is stretched 1.875x, so it reads soft. This reconstructs
detail before the renderer sees it.

Pipeline position:
    scripts/pullPartsImages.ts --confirm   # download max-res (1024) originals
    python scripts/upscalePartsImages.py   # <- this: 1024 -> 2048 master
    npx tsx scripts/render-story.ts ...    # or the HyperFrames reel

Model: RealESRGAN 'general-x4v3' compact net (scale 4). Chosen over the RRDB
x2plus/x4plus nets because this box is CPU-only torch — the compact net is
roughly an order of magnitude faster and still faithful on product shots.
Output is downscaled to TARGET (2048) with LANCZOS.

Usage
    python scripts/upscalePartsImages.py                 # all four
    python scripts/upscalePartsImages.py --only 3-4      # substring filter
    python scripts/upscalePartsImages.py --target 2048   # output long edge
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from spandrel import ModelLoader

PROJECT_ROOT = Path(__file__).resolve().parent.parent
IMAGES = PROJECT_ROOT / "public" / "images"
CACHE = Path(os.environ.get("TEMP", ".")) / "opencode" / "upscale"
MODEL_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth"
MODEL_PATH = CACHE / "realesr-general-x4v3.pth"

SLUGS = ["parts-wallet-3-4-front", "parts-wallet-3-4-back",
         "parts-wallet-4-4-front", "parts-wallet-4-4-back"]

TILE = 384   # input tile edge
PAD = 24     # overlap so seams don't show


def ensure_model() -> Path:
    if not MODEL_PATH.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {MODEL_URL}")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def upscale(model, arr: np.ndarray) -> np.ndarray:
    """Tiled inference. arr is HWC float32 in [0,1]; returns HWC float32."""
    h, w, _ = arr.shape
    s = model.scale
    out = np.zeros((h * s, w * s, 3), dtype=np.float32)
    tiles = [(y, x) for y in range(0, h, TILE) for x in range(0, w, TILE)]
    for i, (y, x) in enumerate(tiles, 1):
        y0, x0 = max(0, y - PAD), max(0, x - PAD)
        y1, x1 = min(h, y + TILE + PAD), min(w, x + TILE + PAD)
        t = torch.from_numpy(arr[y0:y1, x0:x1]).permute(2, 0, 1).unsqueeze(0).float()
        with torch.no_grad():
            o = model(t).clamp(0, 1).squeeze(0).permute(1, 2, 0).numpy()
        th, tw = min(h, y + TILE) - y, min(w, x + TILE) - x
        oy, ox = (y - y0) * s, (x - x0) * s
        out[y * s:(y + th) * s, x * s:(x + tw) * s] = o[oy:oy + th * s, ox:ox + tw * s]
        print(f"    tile {i}/{len(tiles)}", end="\r", flush=True)
    print(" " * 24, end="\r")
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="substring filter over slug names")
    ap.add_argument("--target", type=int, default=2048, help="output long edge")
    args = ap.parse_args()

    model = ModelLoader().load_from_file(str(ensure_model())).eval()
    print(f"model {model.architecture.name}  scale x{model.scale}  torch {torch.__version__} (threads={torch.get_num_threads()})")

    slugs = [s for s in SLUGS if args.only in s]
    if not slugs:
        print(f"no slug matched --only {args.only!r}")
        return 1

    for slug in slugs:
        src = IMAGES / f"{slug}.png"
        if not src.exists():
            print(f"  ! missing {src}")
            continue
        img = Image.open(src).convert("RGB")
        w0, h0 = img.size
        t0 = time.time()
        print(f"▸ {slug}  {w0}x{h0}")
        arr = np.asarray(img, dtype=np.float32) / 255.0
        big = upscale(model, arr)
        hi = Image.fromarray((big * 255.0 + 0.5).astype(np.uint8), "RGB")
        if max(hi.size) > args.target:
            scale = args.target / max(hi.size)
            hi = hi.resize((round(hi.width * scale), round(hi.height * scale)), Image.LANCZOS)
        hi.save(src, "PNG", optimize=True)
        kb = src.stat().st_size / 1024
        print(f"  ✓ {w0}x{h0} -> {hi.width}x{hi.height}  · {kb:.0f} KB  · {time.time()-t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
