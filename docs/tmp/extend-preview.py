"""extend-preview.py — add a per-format navigation strip and three new sections
(stories 5 cards, grid 5 cards, x 4 cards) to docs/preview-grey-wave-assets.html,
turning it from a 2-image wallet-asset preview into a 17-image trio hub.

Run: python docs/tmp/extend-preview.py
"""
from pathlib import Path
import re

ROOT = Path('.').resolve()
HUB = ROOT / 'docs' / 'preview-grey-wave-assets.html'

# Each row: (n, layout, size_kb, desc, source, stickers, ctx) — 7 columns that
# card() unpacks after its leading `fmt` arg, so card(fmt, *row) = card(fmt, 7 args) = 8 positional args.
STORIES_DATA = [
    (1, 'hero',      1262, 'full-bleed front.jpeg + dark top-left gradient + "COALITION" wordmark + "GREY WAVE" centered + subtitle',  'front.jpeg', 'Countdown sticker (top-right, end-time = drop time) + @sgcoalition mention (bottom-left)', 'IG Story full-screen; top 250 px + bottom 320 px safe zones respected'),
    (2, 'detail',    1296, 'full-bleed back.jpeg + bottom 35% black gradient + "Hand-finished charcoal dye." + subtext',  'back.jpeg',  'Poll sticker (right-side: "Harbor at dawn? Yes / No")',  'IG Story; gradient overlay + safe-zone clearance'),
    (3, 'scarcity',   583, '50/50 split — top half front.jpeg + bottom half solid #000 with "LIMITED EDITION" eyebrow + "1 OF 2" + "$35"',  'front.jpeg', 'Countdown (top-right) + Poll (bottom-left: "Should we run 2/2? Yes / Wait")', 'IG Story primary urgency driver; black-panel copy fully inside bottom safe zone'),
    (4, 'manifesto',  569, 'pure #000 with 10% opacity wallet ghost backdrop + "TRUST YOURSELF." giant + body subtext',  'front.jpeg (ghost 10% opacity)', 'Mention sticker (bottom-right @sgcoalition) + Emoji slider 🔥 (optional)', 'IG Story brand beat; quietest slide; no CTA slot crossed'),
    (5, 'cta',        526, '60/40 split — left 60% front.jpeg cropped tight + right 40% black panel with eyebrow + "SHOP NOW →" + URL',  'front.jpeg', 'Link sticker (on the →; URL = shop_url) + Mention sticker (bottom-left @sgcoalition)', 'IG Story only slide that converts; link sticker → PDP'),
]

GRID_DATA = [
    (1, 'hero',       919, 'full-bleed front.jpeg + dark top-left gradient + "COALITION" wordmark + "GREY WAVE" centered + subtitle',  'front.jpeg', 'No IG carousel stickers (carousel lacks Stories UI controls) — caption does the work', 'IG Grid carousel portrait thumb; works in-feed at small sizes'),
    (2, 'detail',    1037, 'full-bleed back.jpeg + bottom 35% black gradient + "Hand-finished charcoal dye." + subtext',  'back.jpeg',  'No IG carousel stickers', 'IG Grid back wallet shot with overlay copy'),
    (3, 'scarcity',   549, '50/50 split — top half front.jpeg + bottom half solid #000 with eyebrow + "1 OF 2" + "$35"',  'front.jpeg', 'No IG carousel stickers', 'IG Grid scarcity slide; main conversion visual in feed'),
    (4, 'manifesto',  387, 'pure #000 with 10% opacity wallet ghost texture + "TRUST YOURSELF." giant + body subtext',  'front.jpeg (ghost 10% opacity)', 'No IG carousel stickers', 'IG Grid brand beat; intentionally low-key'),
    (5, 'cta',        434, '60/40 split — left 60% front.jpeg + right 40% black panel with eyebrow + "SHOP NOW →" + URL',  'front.jpeg', 'No IG carousel link sticker (no stickers in carousel) — caption + bio link do the work', 'IG Grid closing button; caption directs to bio link'),
]

# X rows are padded so columns line up with card(fmt, n, layout, size_kb, desc, source, stickers, ctx):
# `n` and `layout` both hold the variant string (single-post / thread-N) so fileId + on-page label + alt text all read consistently.
X_DATA = [
    ('single-post', 'single-post', 141, '3-band layout — top black "GREY WAVE" header band / middle wallet contain / bottom black "$35 · 1 of 2 · Once it\u2019s gone" caption band',  'front.jpeg (contain, centered) + black bands above & below', 'No IG stickers (X is media-only)', 'X feed single-post card; pairs with tweet copy from drop-copy'),
    ('thread-1',    'thread-1',    293, 'full-bleed wallet contain + top/bottom dark vignette + "GREY WAVE" 110px overlay left + subtitle bottom-left',                          'front.jpeg (contain, black backdrop) + vignette',                'No IG stickers', 'X thread tweet 1; sets release frame'),
    ('thread-2',    'thread-2',    278, '60/40 split — left 40% black type panel with "LIMITED EDITION" eyebrow + "1 OF 2" + "$35"; right 60% wallet contain',     'front.jpeg (contain, black backdrop)',                            'No IG stickers', 'X thread tweet 2; scarcity knock'),
    ('thread-3',    'thread-3',    283, '55/45 split — left 45% black panel with eyebrow + "SHOP NOW →" + URL; right 55% wallet contain',                       'front.jpeg (contain, black backdrop)',                            'No IG stickers', 'X thread tweet 3; CTA; ends the thread'),
]

VIEW = {'story':'1080 \u00d7 1920', 'grid':'1080 \u00d7 1350', 'x':'1200 \u00d7 628'}
ASPECT = {'story':'9:16', 'grid':'4:5', 'x':'1.91:1'}
DIR_REL = {'story':'../story-reveal', 'grid':'../grid-reveal', 'x':'../x-reveal'}
DIR_ABS = {'story':'docs/story-reveal', 'grid':'docs/grid-reveal', 'x':'docs/x-reveal'}
RENDER_CMD = {'story':'npm run story:reveal -- --slug grey-wave', 'grid':'npm run grid:reveal -- --slug grey-wave', 'x':'npm run x:reveal -- --slug grey-wave'}

PNG_PATH = {
    'story': lambda n: f'../story-reveal/grey-wave-slide-{n}.png',
    'grid':  lambda n: f'../grid-reveal/grid-grey-wave-slide-{n}.png',
    'x':     lambda n: f'../x-reveal/x-grey-wave-{n}.png',
}


def card(fmt, n, layout, size_kb, desc, source, stickers, ctx):
    src = PNG_PATH[fmt](n)
    file_basename = src.split('/')[-1]
    file_path = f'{DIR_ABS[fmt]}/{file_basename}'
    return (
        f'  <div class="card">\n'
        f'    <div class="card-head">\n'
        f'      <div>\n'
        f'        <span class="card-label">{n}</span>\n'
        f'        <span class="card-title">&nbsp; \u00b7 {layout} \u2014 {desc}</span>\n'
        f'      </div>\n'
        f'      <div class="card-subtitle">{size_kb} KB \u00b7 RGB \u00b7 {VIEW[fmt]}</div>\n'
        f'    </div>\n'
        f'    <div class="img-frame fit" data-mode="fit">\n'
        f'      <img src="{src}" alt="Grey Wave \u2014 {fmt} {n} ({layout})" draggable="false">\n'
        f'    </div>\n'
        f'    <table class="meta-table">\n'
        f'      <tr><th>File</th>          <td><code>{file_path}</code></td></tr>\n'
        f'      <tr><th>Viewport</th>      <td>{VIEW[fmt]} <span class="a">({ASPECT[fmt]} aspect)</span></td></tr>\n'
        f'      <tr><th>Mode</th>          <td>RGB (3 channels)</td></tr>\n'
        f'      <tr><th>Alpha</th>         <td><span class="no">no</span> \u00b7 fully opaque \u00b7 flattened onto pure #000</td></tr>\n'
        f'      <tr><th>File size</th>     <td>{size_kb} KB \u00b7 Playwright PNG @1x</td></tr>\n'
        f'      <tr><th>Renderer</th>      <td><code>{RENDER_CMD[fmt]}</code></td></tr>\n'
        f'      <tr><th>Layout</th>        <td><code>{layout}</code> \u2014 {desc}</td></tr>\n'
        f'      <tr><th>Source image</th>  <td>{source}</td></tr>\n'
        f'      <tr><th>Sticker / overlay hints (reviewer-aid only)</th>  <td>{stickers}</td></tr>\n'
        f'      <tr><th>Channel context</th>          <td>{ctx}</td></tr>\n'
        f'    </table>\n'
        f'  </div>'
    )


def section(fmt, title, data, section_id):
    cards_html = '\n'.join(card(fmt, *d) for d in data)
    return (
        f'\n<h2 id="{section_id}">{title}</h2>\n'
        f'<p class="meta">{len(data)} outputs \u00b7 viewport {VIEW[fmt]} \u00b7 generated by <code>{RENDER_CMD[fmt]}</code></p>\n'
        f'<div class="grid">{cards_html}\n</div>'
    )


TOP_NAV = (
    '\n  <nav class="format-subnav" aria-label="Per-format preview jumps">\n'
    '    <strong>FORMAT JUMPS</strong>\n'
    '    <a href="#stories-section">Stories (5, 1080\u00d71920)</a>\n'
    '    <a href="#grid-section">Grid (5, 1080\u00d71350)</a>\n'
    '    <a href="#x-section">X (4, 1200\u00d7628)</a>\n'
    '    <span class="hint">\u203a 17-image hub (2 wallet source + 5 stories + 5 grid + 4 x + drops-registry cross-ref); source-asset cards at top, rendered sections below.</span>\n'
    '  </nav>'
)

SUBNAV_CSS = (
    '\n  /* \u2500\u2500\u2500 Per-format navigation strip \u2500\u2500\u2500 */\n'
    '  .format-subnav {\n'
    '    background: #0e0e0e; border: 1px solid var(--rule);\n'
    '    padding: 12px 18px; border-radius: 4px;\n'
    '    margin: 12px 0 24px;\n'
    '    font-size: 12px;\n'
    '    color: var(--muted);\n'
    '    display: flex; gap: 14px; align-items: center; flex-wrap: wrap;\n'
    '  }\n'
    '  .format-subnav strong { color: #fff; letter-spacing: 0.1em; text-transform: uppercase; font-size: 11px; margin-right: 4px; }\n'
    '  .format-subnav a {\n'
    '    background: #1a1a1a; border: 1px solid #333; color: var(--ink);\n'
    '    padding: 6px 12px; border-radius: 3px;\n'
    '    font-family: inherit; font-size: 11px; letter-spacing: 0.05em;\n'
    '    text-transform: uppercase; text-decoration: none;\n'
    '    font-weight: 600;\n'
    '  }\n'
    '  .format-subnav a:hover { background: #222; border-color: #444; color: var(--accent); }\n'
    '  .format-subnav .hint { margin-left: auto; color: var(--muted); font-size: 11px; }\n'
    '  .format-subnav code { background: transparent; color: var(--accent); padding: 0; font-size: 11px; }\n'
)


def main() -> None:
    if not HUB.exists():
        raise SystemExit(f'Hub file not found: {HUB}')

    text = HUB.read_text(encoding='utf-8')
    original_size = HUB.stat().st_size

    # Idempotency: refuse to extend an already-extended hub
    if 'format-subnav' in text and 'STORIES (1080\u00d71920)' in text:
        raise SystemExit('Hub already extended (marker substring present). Re-run on a fresh checkout.')

    # 1) Top nav strip
    h1_anchor = '<h1>COALITION GREY WAVE \u2014 ASSET PREVIEW</h1>\n\n  <blockquote class="pair-with">'
    new_h1_block = '<h1>COALITION GREY WAVE \u2014 ASSET PREVIEW</h1>' + TOP_NAV + '\n\n  <blockquote class="pair-with">'
    if text.count(h1_anchor) != 1:
        raise SystemExit(f'h1 anchor count expected 1, got {text.count(h1_anchor)}')
    text = text.replace(h1_anchor, new_h1_block, 1)

    # 2) Subnav CSS inserted before first </style>
    css_close = '</style>'
    if text.count(css_close) < 1:
        raise SystemExit('No </style> found in hub')
    text = text.replace(css_close, SUBNAV_CSS + '</style>', 1)

    # 3) Three new sections inserted BEFORE the existing <footer>
    footer_anchor = '<footer>\n  <p>Pair with'
    if text.count(footer_anchor) != 1:
        raise SystemExit(f'footer anchor count expected 1, got {text.count(footer_anchor)}')

    stories_section = section('story', 'STORIES (1080\u00d71920) \u00b7 5 SLIDES \u00b7 9:16 IG STORY',          STORIES_DATA, 'stories-section')
    grid_section    = section('grid',  'GRID  (1080\u00d71350) \u00b7 5 SLIDES \u00b7 4:5 IG GRID CAROUSEL', GRID_DATA,  'grid-section')
    x_section       = section('x',     'X     (1200\u00d7628)  \u00b7 4 IMAGES \u00b7 1.91:1 X FEED (SINGLE-POST + 3-THREAD CROPS)', X_DATA, 'x-section')

    all_sections_block = stories_section + '\n' + grid_section + '\n' + x_section + '\n\n\n<footer>\n  <p>Pair with'
    text = text.replace(footer_anchor, all_sections_block, 1)

    HUB.write_text(text, encoding='utf-8')

    # ---- Acceptance ----
    final_size = HUB.stat().st_size
    section_h2 = re.findall(r'<h2 id="([^"]+)">([^<]+)</h2>', text)
    cards_in_doc = re.findall(r'<div class="card">', text)
    img_srcs = re.findall(r'<img src="([^"]+)"', text)
    anchors = sorted(set(re.findall(r'id="([^"]+)"', text)))

    print(f'size: {original_size} -> {final_size} bytes (delta {final_size - original_size:+d})')

    print(f'<h2 id=...> headings: {len(section_h2)} (expected at least 4: 1 existing + 3 new)')
    for sec_id, sec_title in section_h2:
        print(f'  - #{sec_id}: {sec_title.strip()[:80]}')

    print(f'<div class="card"> cards: {len(cards_in_doc)} (expected 16: 2 existing source + 14 new rendered)')
    print(f'<img src=...> tags: {len(img_srcs)} (expected 16)')

    print(f'unique anchors: {anchors}')

    # Verify all new img paths resolve
    resolved = 0
    unresolved = []
    for kind in ('story', 'grid', 'x'):
        sub = ROOT / DIR_REL[kind].lstrip('./')
        for src in img_srcs:
            if not src.startswith(DIR_REL[kind] + '/'):
                continue
            name = src[len(DIR_REL[kind]) + 1:]
            if (sub / name).exists():
                resolved += 1
            else:
                unresolved.append(src)
    print(f'rendered PNG references that resolve: {resolved} (expected 14)')
    if unresolved:
        print(f'  UNRESOLVED: {unresolved}')

    print('OK: trio hub applied to docs/preview-grey-wave-assets.html')


if __name__ == '__main__':
    main()
