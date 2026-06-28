"""make-per-format-previews.py — emit one preview.html per output dir
(story-reveal/, grid-reveal/, x-reveal/). Each page is a single-format
focused, dark-themed grid of all postable PNGs for that dir.

Run:  python docs/tmp/make-per-format-previews.py
       python docs/tmp/make-per-format-previews.py --scan-sizes
       Re-runs every render (PE-scans each sibling PNG, rewrites the
       STORIES/GRID/X_PREVIEWS size tuples in this script's source AND
       in memory, then emits. Keeps card-meta KB values accurate after
       every Playwright re-render).

Idempotent: re-running overwrites the three preview.html files cleanly;
--scan-sizes also rewrites the script's own source so future runs see the
fresh literal sizes even without the flag.
"""
from pathlib import Path
import argparse
import re

ROOT = Path('.').resolve()
HUB_REL_FROM_OUT = '../preview-grey-wave-assets.html'
FORMATS = ('story', 'grid', 'x')

# PNG sizes in KB. Re-derived from disk on each run when --scan-sizes is
# passed; otherwise these literals are used as-is.
STORIES = [
    (1, 'hero'     , 1262),
    (2, 'detail'   , 1297),
    (3, 'scarcity' ,  583),
    (4, 'manifesto',  570),
    (5, 'cta'      ,  527),
]
GRID = [
    (1, 'hero'     ,  919),
    (2, 'detail'   , 1038),
    (3, 'scarcity' ,  549),
    (4, 'manifesto',  388),
    (5, 'cta'      ,  434),
]
# X rows use friendly variant as the card label, but fileId on disk is 'single' (not 'single-post')
X_FILEID = {'single-post': 'single', 'thread-1': 'thread-1', 'thread-2': 'thread-2', 'thread-3': 'thread-3'}
X_PREVIEWS = [
    ('single-post', 'single-post', 142),
    ('thread-1'   , 'thread-1'   , 294),
    ('thread-2'   , 'thread-2'   , 278),
    ('thread-3'   , 'thread-3'   , 284),
]


# Format-specific metadata table.
#  aspect          : human-readable label ("9:16") used in copy / h1 / intro paragraphs.
#  viewport_css    : viewport math used in the .img-frame { --aspect: ... } CSS rule
#                    (CSS aspect-ratio only accepts `<int>/<int>` or single-number, so "1.91:1" was invalid).
FORMAT_META = {
    'story': {
        'dir':           'docs/story-reveal',
        'title':         'Stories preview — Grey Wave 1/2',
        'h1':            'STORIES (1080\u00d71920) \u00b7 5 SLIDES \u00b7 9:16 IG STORY',
        'viewport':      '1080 \u00d7 1920',
        'aspect':        '9:16',
        'viewport_css':  '1080 / 1920',
        'count':         5,
        'renderer':      'npm run story:reveal -- --slug grey-wave',
        'channel_intro': 'Postable to IG Stories. Each PNG is a clean 1080\u00d71920 RGB frame with no reviewer aids baked in — IG sticker tray (countdown, mention, link, poll, emoji) gets added in-app.',
        'card_naming':   'slide',
        'file_pattern':  lambda n, _layout: f'grey-wave-slide-{n}.png',
        'rows':          STORIES,
    },
    'grid': {
        'dir':           'docs/grid-reveal',
        'title':         'Grid preview — Grey Wave 1/2',
        'h1':            'GRID (1080\u00d71350) \u00b7 5 SLIDES \u00b7 4:5 IG GRID CAROUSEL',
        'viewport':      '1080 \u00d7 1350',
        'aspect':        '4:5',
        'viewport_css':  '1080 / 1350',
        'count':         5,
        'renderer':      'npm run grid:reveal -- --slug grey-wave',
        'channel_intro': 'Postable to the IG Grid as a carousel of 5. Each PNG is a clean 1080\u00d71350 RGB frame; carousel has no IG sticker tray, so the caption + bio link drive action.',
        'card_naming':   'slide',
        'file_pattern':  lambda n, _layout: f'grid-grey-wave-slide-{n}.png',
        'rows':          GRID,
    },
    'x': {
        'dir':           'docs/x-reveal',
        'title':         'X preview — Grey Wave 1/2',
        'h1':            'X (1200\u00d7628) \u00b7 4 IMAGES \u00b7 1.91:1 X FEED (SINGLE + 3-THREAD CROPS)',
        'viewport':      '1200 \u00d7 628',
        'aspect':        '1.91:1',
        'viewport_css':  '1200 / 628',
        'count':         4,
        'renderer':      'npm run x:reveal -- --slug grey-wave',
        'channel_intro': 'Postable to X feed as a single-post + a 3-tweet thread. Each PNG is a clean 1200\u00d7628 RGB frame; X is media-only (no native stickers, no link sticker).',
        'card_naming':   'variant',
        'file_pattern':  lambda n, _layout: f'x-grey-wave-{X_FILEID.get(n, n)}.png',
        'rows':          X_PREVIEWS,
    },
}


# ─── CLI + on-disk size refresh ──────────────────────────────────────────────


def parse_cli() -> argparse.Namespace:
    """Tiny CLI for the per-format preview generator."""
    parser = argparse.ArgumentParser(
        description='Emit preview.html pages for a Coalition drop.',
    )
    parser.add_argument(
        '--scan-sizes',
        action='store_true',
        help='PE-scan each sibling PNG in docs/{story,grid,x}-reveal/ and rewrite the '
             'STORIES/GRID/X_PREVIEWS size tuples in this script\'s source AND in '
             'memory before emitting. Keeps card-meta KB values accurate after every '
             'Playwright re-render, and persists the new literals on disk so a future '
             'no-flag run also sees the fresh sizes.',
    )
    return parser.parse_args()


def _scan_one(path: 'Path', fallback: int, *, label: str) -> int:
    """Stat `path` and return its on-disk size in KB (rounded).
    Falls back to the literal value in the tuple if the PNG is missing and
    prints a one-line warning so the gap is visible at PR time. A genuine
    0-byte PNG is NOT masked — PR-time CI should surface broken renders.
    """
    if not path.exists():
        print(f'  [warn] --scan-sizes: {label} missing at {path}; keeping literal {fallback} KB')
        return fallback
    return round(path.stat().st_size / 1024)


def _format_tuple_block(rows):
    """Render rows as Python source — columns are auto-aligned for readability."""
    pad_n = max(len(repr(n)) for n, _, _ in rows)
    pad_layout = max(len(repr(layout)) for _, layout, _ in rows)
    pad_kb = max(len(str(kb)) for _, _, kb in rows)
    lines = [
        f"    ({repr(n):<{pad_n}}, {repr(layout):<{pad_layout}}, {kb:>{pad_kb}d}),"
        for n, layout, kb in rows
    ]
    return '\n'.join(lines)


def _persist_scanned_tuples_to_source(new_stories, new_grid, new_x):
    """Rewrite the STORIES/GRID/X_PREVIEWS blocks in this script's own source
    so the literals on disk stay in sync with the on-disk PNG sizes after a
    --scan-sizes run. Returns True iff the source was rewritten.

    Anchors each block on its variable name + '=' + '[' opener, then
    lazy-matches lines until the next standalone ']\n'. Correct because no
    tuple-string repr in the current data contains a ']' character.
    """
    src_path = Path(__file__).resolve()
    src = src_path.read_text(encoding='utf-8')
    original = src

    def _sub_block(name, new_rows, *, text):
        """Substitute one tuple block; explicitly takes the input `text` so the
        call chain's data flow is obvious (no closure / default-arg capture).
        """
        pattern = r'^(' + re.escape(name) + r' = \[\n)(?:.*?\n)*?(\]\n)'
        new_block = _format_tuple_block(new_rows)
        return re.sub(
            pattern,
            lambda m: m.group(1) + new_block + '\n' + m.group(2),
            text,
            count=1,
            flags=re.MULTILINE,
        )

    src = _sub_block('STORIES',    new_stories, text=src)
    src = _sub_block('GRID',       new_grid,    text=src)
    src = _sub_block('X_PREVIEWS', new_x,       text=src)

    if src != original:
        src_path.write_text(src, encoding='utf-8')
        return True
    return False


def scan_sibling_sizes() -> None:
    """PE-scan each sibling PNG and rewrite STORIES/GRID/X_PREVIEWS both
    in-memory and on disk (this script's own source) so card-meta KB values
    mirror the actual on-disk bytes after every Playwright re-render.
    """
    print('=== --scan-sizes: rewriting tuple sizes from sibling PNG stat() ===')
    # Guard: scan_sibling_sizes relies on FORMAT_META[fmt_key]['rows'] being the
    # same list reference as STORIES/GRID/X_PREVIEWS. A future lazy-eval rewrite
    # would silently break in-place mutation. Cheap PR-time catch.
    ROW_REFS = {id(STORIES), id(GRID), id(X_PREVIEWS)}
    had_diff = False
    for fmt_key in FORMATS:
        meta = FORMAT_META[fmt_key]
        rows = meta['rows']  # module-level list of tuples, mutated in-place
        assert id(rows) in ROW_REFS, (
            f'FORMAT_META[{fmt_key!r}].rows is no longer aliased to a module-level '
            f'constant; scan_sibling_sizes cannot mutate in place.'
        )
        for i, row in enumerate(rows):
            n, layout, old_kb = row
            path = ROOT / meta['dir'] / meta['file_pattern'](n, layout)
            label = f'{fmt_key} {n}.{layout}'
            new_kb = _scan_one(path, old_kb, label=label)
            if old_kb != new_kb:
                print(f'  [{fmt_key}] {n}.{layout:<10s} {old_kb:>5d} -> {new_kb:>5d} KB')
                had_diff = True
            rows[i] = (n, layout, new_kb)
    # Persist updated tuple literals back to this file so future no-flag runs
    # also see the fresh sizes (and a repeat --scan-sizes becomes a no-op).
    if had_diff and _persist_scanned_tuples_to_source(STORIES, GRID, X_PREVIEWS):
        print('  [wrote] persisted updated STORIES/GRID/X_PREVIEWS blocks back to source file')


# ─── per-card helpers ─────────────────────────────────────────────────────────


def _card_layout_html(fmt_key: str, n, layout: str, meta: dict) -> str:
    """Per-format card-layout slot (right side of .card-head).
    - Stories / Grid: layout name (e.g., 'hero', 'detail') since `n` is the slide number and `layout` is a separate concept.
    - X: aspect ratio ('1.91:1') since X variants ARE the layout — repurposes the right-slot with non-redundant info.
    """
    if meta['card_naming'] == 'slide':
        return layout
    return meta['aspect']  # X variants: show aspect as the right-slot to avoid an empty half


def card_html(fmt_key: str, n, layout: str, size_kb: int, meta: dict) -> str:
    fname = meta['file_pattern'](n, layout)
    head_main = f'Slide {n}' if meta['card_naming'] == 'slide' else f'Variant: {n}'
    layout_slot = _card_layout_html(fmt_key, n, layout, meta)
    alt = f'Grey Wave — {fmt_key} {n}' if str(n) == layout else f'Grey Wave — {fmt_key} {n} ({layout})'
    return (
        f'    <article class="card" id="{fmt_key}-{n}">\n'
        f'      <header class="card-head">\n'
        f'        <div class="card-num">{head_main}</div>\n'
        f'        <div class="card-layout">{layout_slot}</div>\n'
        f'      </header>\n'
        f'      <div class="img-frame" data-mode="postable" data-aspect="{meta["aspect"]}">\n'
        f'        <img src="{fname}" alt="{alt}" draggable="false" />\n'
        f'      </div>\n'
        f'      <footer class="card-foot">\n'
        f'        <code class="card-file">{fname}</code>\n'
        f'        <span class="card-meta">{size_kb} KB · RGB · {meta["viewport"]}</span>\n'
        f'      </footer>\n'
        f'    </article>'
    )


def render_page(meta: dict) -> str:
    cards_html = '\n'.join(card_html(meta['fmt_key'], *row, meta) for row in meta['rows'])
    # Per-format accent — matches the live sgcoalition.xyz per-section color cues:
    #   Stories (scarcity-driven urgency)  → amber.
    #   Grid    (premium carousel mark)    → purple.
    #   X       (single-post hero feed)    → brand web3-blue.
    accent = {
        'story': '#F59E0B',
        'grid':  '#A855F7',
        'x':     '#3B82F6',
    }[meta['fmt_key']]
    # Eyebrow line: short single-clause tag derived from channel_intro (before the first period).
    eyebrow = meta['channel_intro'].split('.', 1)[0].strip()
    # h-display: strip the "·" trailer from meta['h1'] so we keep just the format name (e.g. "STORIES (1080×1920)").
    h_display = meta['h1'].split(' · ')[0]
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{meta["title"]}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;800&family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    /** reset */
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

    /** page shell — mirrors index.html: deep-black bg + global noise overlay. */
    html {{ background: #050505; }}
    body {{
      --format-accent: {accent};
      background: #050505;
      color: #E5E5E5;
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
      padding: 36px 24px 80px;
      max-width: 1500px;
      margin: 0 auto;
      min-height: 100vh;
      position: relative;
    }}
    /** Global noise overlay (SVG fractalNoise at 3.5% opacity, identical recipe to index.html). */
    body::before {{
      content: "";
      position: fixed; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
      pointer-events: none; z-index: 9999;
    }}

    /** scrollbar — match the live site. */
    ::-webkit-scrollbar {{ width: 6px; }}
    ::-webkit-scrollbar-track {{ background: #111; }}
    ::-webkit-scrollbar-thumb {{ background: #333; border-radius: 3px; }}
    ::-webkit-scrollbar-thumb:hover {{ background: #555; }}

    /** utilities — match index.html text-glow / box-glow. */
    .text-glow {{ text-shadow: 0 0 18px rgba(255, 255, 255, 0.18); }}
    .box-glow {{ box-shadow: 0 0 20px rgba(255, 255, 255, 0.05); }}

    /** back-link — Coalition nav-link style: uppercase, tracking-widest, glass panel. */
    a.back-link {{
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 14px; margin-bottom: 22px;
      font-family: 'Inter', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #888; text-decoration: none;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-radius: 2px;
      transition: all 200ms ease;
    }}
    a.back-link::before {{ content: "←"; font-family: 'JetBrains Mono', monospace; font-size: 13px; }}
    a.back-link:hover {{ color: #fff; border-color: rgba(255, 255, 255, 0.25); }}

    /** regen-hint — chip in the format's accent color (mirrors the AIChatWidget's succeeded-toast chip). */
    .regen-hint {{
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 14px; margin: 0 0 26px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
      color: var(--format-accent);
      border: 1px solid color-mix(in srgb, var(--format-accent) 30%, transparent);
      background: color-mix(in srgb, var(--format-accent) 8%, transparent);
      backdrop-filter: blur(4px);
      border-radius: 2px;
      text-transform: uppercase;
    }}
    .regen-hint::before {{ content: "↻"; font-size: 14px; line-height: 1; }}
    .regen-hint code {{ background: transparent; color: inherit; font-family: inherit; }}

    /** display hierarchy — Oswald for the big h1 (matches the live site's "CRAFTED IN BALTIMORE" hero). */
    .eyebrow {{
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.3em;
      color: var(--format-accent);
      text-transform: uppercase;
    }}
    h1.h-display {{
      font-family: 'Oswald', sans-serif;
      font-size: clamp(40px, 7vw, 84px);
      font-weight: 700; line-height: 0.95;
      letter-spacing: -0.005em;
      text-transform: uppercase;
      color: #fff;
      margin: 6px 0 14px;
    }}
    h1.h-display .dim {{ color: #888; }}
    p.intro {{
      font-family: 'Inter', sans-serif;
      font-size: 14px; line-height: 1.7;
      color: #888; font-weight: 300;
      max-width: 72ch; margin: 0 0 14px;
    }}
    p.intro code {{ color: var(--format-accent); background: transparent; font-family: 'JetBrains Mono', monospace; font-size: 12px; }}

    /** chip-row — format metadata (matches the live site's /10 border category pills). */
    .chip-row {{
      display: flex; flex-wrap: wrap; gap: 8px;
      margin: 6px 0 40px;
    }}
    .chip {{
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 10px;
      font-family: 'Inter', sans-serif;
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.18em; text-transform: uppercase;
      color: #aaa;
      border: 1px solid rgba(255, 255, 255, 0.10);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 2px;
    }}
    .chip .dot {{
      width: 5px; height: 5px; border-radius: 50%;
      background: var(--format-accent);
      box-shadow: 0 0 8px var(--format-accent);
    }}

    /** grid + card — "antigravity-card" pattern from index.html (glass + blur + glow lift). */
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 32px;
      margin-top: 4px;
    }}
    .card {{
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
      border-radius: 4px; overflow: hidden;
      display: flex; flex-direction: column;
      transition: all 300ms ease;
      position: relative;
    }}
    .card:hover {{
      border-color: rgba(255, 255, 255, 0.20);
      transform: translateY(-2px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.10), 0 0 30px rgba(255, 255, 255, 0.04);
    }}
    .card-head {{
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(0, 0, 0, 0.30);
    }}
    .card-num {{
      font-family: 'Oswald', sans-serif;
      color: #fff; font-weight: 700;
      letter-spacing: 0.04em;
      font-size: 15px; text-transform: uppercase;
    }}
    .card-layout {{
      color: var(--format-accent);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; letter-spacing: 0.18em;
      text-transform: uppercase;
    }}
    .img-frame {{
      background: #000;
      width: 100%;
      aspect-ratio: {meta["viewport_css"]};
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }}
    .img-frame img {{
      display: block; width: 100%; height: 100%;
      object-fit: contain;
      transition: transform 700ms ease;
    }}
    .card:hover .img-frame img {{ transform: scale(1.04); }}
    /** "POSTABLE" corner badge — proof we never baked reviewer aids into the PNG. */
    .img-frame::after {{
      content: "POSTABLE"; position: absolute; top: 10px; right: 10px;
      padding: 3px 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; font-weight: 700;
      letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--format-accent);
      background: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(4px);
      border: 1px solid color-mix(in srgb, var(--format-accent) 30%, transparent);
      border-radius: 2px;
    }}
    .card-foot {{
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(0, 0, 0, 0.30);
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; font-size: 11px; color: #888;
    }}
    .card-foot code {{ color: #ccc; background: transparent; font-family: 'JetBrains Mono', monospace; font-size: 11px; }}
    .card-foot .card-meta {{ white-space: nowrap; font-family: 'JetBrains Mono', monospace; }}
  </style>
</head>
<body data-format="{meta["fmt_key"]}">
  <a class="back-link" href="{HUB_REL_FROM_OUT}">back to trio hub</a>
  <p class="regen-hint">Re-run after every render: <code>python docs/tmp/make-per-format-previews.py</code></p>
  <span class="eyebrow">{eyebrow}</span>
  <h1 class="h-display">{h_display}</h1>
  <p class="intro">{meta["channel_intro"]}</p>
  <div class="chip-row">
    <span class="chip"><span class="dot"></span>{meta["count"]} postable PNGs</span>
    <span class="chip">{meta["viewport"]}</span>
    <span class="chip">{meta["aspect"]} aspect</span>
    <span class="chip">via <code style="font-family:'JetBrains Mono',monospace;background:transparent;color:#ccc;">{meta["renderer"]}</code></span>
  </div>
  <main class="grid">
{cards_html}
  </main>
</body>
</html>
'''


def main() -> None:
    args = parse_cli()
    if args.scan_sizes:
        scan_sibling_sizes()

    summaries = []
    for fmt_key in FORMATS:
        meta = dict(FORMAT_META[fmt_key])  # shallow copy
        meta['fmt_key'] = fmt_key
        out_path = ROOT / meta['dir'] / 'preview.html'
        out_path.parent.mkdir(parents=True, exist_ok=True)
        html = render_page(meta)
        out_path.write_text(html, encoding='utf-8')

        size = out_path.stat().st_size
        img_srcs = re.findall(r'<img src="([^"]+)"', html)
        section_ids = re.findall(r'id="([^"]+)"', html)
        manifests = re.findall(r'data-format="([^"]+)"', html)
        backdrop_link = re.findall(r'href="([^"]+)"', html)
        aspect_rules = re.findall(r'--aspect:\s*([^;]+);', html)
        summaries.append((fmt_key, size, img_srcs, section_ids, manifests, backdrop_link, aspect_rules))

    # Acceptance print
    print('=== per-format preview.html emit summary ===')
    for fmt_key, size, img_srcs, section_ids, manifests, backdrop_link, aspect_rules in summaries:
        meta = FORMAT_META[fmt_key]
        out_dir = ROOT / meta['dir']
        png_present = [src for src in img_srcs if (out_dir / src).exists()]
        png_missing = [src for src in img_srcs if not (out_dir / src).exists()]
        print(f'\n{fmt_key.upper()} -> {meta["dir"]}/preview.html  ({size} bytes)')
        print(f'  data-format:        {manifests}')
        print(f'  card anchors:       {section_ids}')
        print(f'  back-link href:     {backdrop_link}')
        print(f'  CSS --aspect rule:  {aspect_rules}')
        print(f'  PNG refs resolved:  {len(png_present)}/{len(img_srcs)}')
        if png_missing:
            print(f'  MISSING: {png_missing}')
        else:
            print('  all PNG refs resolve on disk')
    print('\nOK: 3 per-format preview pages emitted.')


if __name__ == '__main__':
    main()
