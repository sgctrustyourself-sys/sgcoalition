from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = (ROOT / "index.html").read_text(encoding="utf-8")
ENDING = (ROOT / "compositions" / "liquid.html").read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        print(f"FAIL: {message}")
        sys.exit(1)
    print(f"PASS: {message}")


require('id="liquidMount"' in SOURCE and 'data-duration="4.6"' in SOURCE,
        "root mounts the redesigned ending through the existing 14.6s endpoint")
require('id="lockup"' not in SOURCE and 'src="assets/logo-lockup.png"' not in SOURCE,
        "root no longer adds the separate tan logo overlay")
require(".satellite" not in ENDING and "heroBead" not in ENDING and "gooGroup" not in ENDING,
        "ending contains no bubble/bead scene")
require(all(token in ENDING for token in ('id="walletShot"', 'id="stitched-frame"', 'id="brandMark"')),
        "ending includes the wallet photo, stitched frame, and logo")
require("strokeDashoffset" in ENDING and "window.__timelines['liquid']" in ENDING,
        "stitch reveal is driven by a registered seekable timeline")

for filename in ("logo-lockup-cream.png",):
    logo_path = ROOT / "assets" / filename
    require(logo_path.is_file(), f"{filename} exists")
    if logo_path.is_file():
        logo = Image.open(logo_path).convert("RGBA")
        bbox = logo.getchannel("A").getbbox()
        visible = [p for p in logo.get_flattened_data() if p[3] > 180]
        cream = (231, 216, 200)
        cream_pixels = sum(max(abs(p[channel] - cream[channel]) for channel in range(3)) <= 3 for p in visible)
        require(logo.size == (449, 166) and bbox is not None, f"{filename} preserves proportions and transparency")
        require(visible and cream_pixels / len(visible) >= 0.98, f"{filename} visible artwork is warm cream")

wallet_path = ROOT / "assets" / "ending-wallet.png"
require(wallet_path.is_file(), "wallet macro image is bundled in the project")
if wallet_path.is_file():
    wallet = Image.open(wallet_path)
    require(wallet.size == (2048, 2048), "wallet macro retains its full-resolution source")

print("Wallet ending verification passed.")
