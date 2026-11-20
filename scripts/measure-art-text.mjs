// scripts/measure-art-text.mjs
//
// Measures the poster's corner label (Y2K ARCHIVE / WALLET) and the Coalition
// wordmark against their containers in BOTH font states:
//   loaded   = Orbitron/Titan One — the embedded base64 faces; this is what
//              every surface renders now (img and direct-open are identical)
//   fallback = synthetic: fonts forced off (monospace / Arial Black) — kept as
//              the degraded-case reference for when faces cannot decode
// run: node scripts/measure-art-text.mjs   (needs the local static server on :52691)

import { chromium } from 'playwright';

const SVG = 'http://127.0.0.1:52691/docs/artwork/ghost-riders-after-dark.svg';
const PILL_W = 270;            // label pill: rect x680 w270
const BADGE_L = 957;           // badge circle cx985 r28

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1500 } });
await page.goto(SVG, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(async () => {
    await Promise.all([
        document.fonts.load('700 17px Orbitron'),
        document.fonts.load('900 92px Orbitron'),
        document.fonts.load('400 47px "Titan One"'),
        document.fonts.load('700 27px "Space Grotesk"'),
    ].map(p => p.catch(() => {})));
    await document.fonts.ready;
});

const read = () => page.evaluate(() => {
    const box = (el) => {
        if (!el) return null;
        const r = el.getBBox();
        return { l: +r.x.toFixed(1), r: +(r.x + r.width).toFixed(1), w: +r.width.toFixed(1),
                 t: +r.y.toFixed(1), b: +(r.y + r.height).toFixed(1) };
    };
    const texts = [...document.querySelectorAll('text')];
    const label = texts.find(t => (t.textContent || '').includes('Y2K ARCHIVE'));
    const word = texts.find(t => (t.textContent || '').trim() === 'Coalition');
    const band = [...document.querySelectorAll('path')].find(x => (x.getAttribute('d') || '').startsWith('M6 166'));
    // Other webfont texts worth watching while we're here: the title, the star
    // caption, and the footer line (widths only — no pill to fit).
    const title = texts.find(t => (t.textContent || '').trim() === 'GHOST RIDERS');
    const noReprints = texts.find(t => (t.textContent || '').trim() === 'NO REPRINTS');
    const footer = texts.find(t => (t.textContent || '').includes('SGCOALITION.XYZ'));
    return {
        label: box(label), word: box(word), band: box(band),
        title: box(title), noReprints: box(noReprints), footer: box(footer),
        wordFont: word && getComputedStyle(word).fontFamily.split(',')[0],
        labelFont: label && getComputedStyle(label).fontFamily.split(',')[0],
        orbitron: document.fonts.check('700 17px Orbitron'),
        titanOne: document.fonts.check('400 47px "Titan One"'),
    };
});

const states = {};
states.loaded = await read();
// No <head> in an SVG document — force the fallback fonts inline instead.
await page.evaluate(() => {
    const texts = [...document.querySelectorAll('text')];
    const pick = (needle) => texts.find(t => (t.textContent || '').includes(needle));
    pick('Y2K ARCHIVE').style.setProperty('font-family', 'monospace', 'important');
    pick('Coalition').style.setProperty('font-family', 'Arial Black, Impact, sans-serif', 'important');
    // .display falls back to Arial Black; .micro to monospace — force every
    // remaining webfont text so the fallback state is measured, not assumed.
    for (const t of texts) {
        if (t.classList.contains('display')) t.style.setProperty('font-family', 'Arial Black, Impact, sans-serif', 'important');
        else if (t.classList.contains('micro')) t.style.setProperty('font-family', 'monospace', 'important');
    }
});
states.fallback = await read();
await page.evaluate(() => {
    for (const t of document.querySelectorAll('text')) t.removeAttribute('style');
});

// Candidate sweep — label: font-size x letter-spacing (em), Orbitron + fallback widths.
const labelSweep = [];
for (const fs of [14, 15, 16, 17]) {
    for (const ls of [0.04, 0.06, 0.08, 0.10, 0.12]) {
        const w = await page.evaluate(([fs, ls]) => {
            const label = [...document.querySelectorAll('text')].find(t => (t.textContent || '').includes('Y2K ARCHIVE'));
            label.style.setProperty('font-size', fs + 'px');
            label.style.setProperty('letter-spacing', (ls * fs) + 'px');
            label.style.setProperty('font-family', '"Orbitron", monospace', 'important');
            const orb = label.getBBox().width;
            label.style.setProperty('font-family', 'monospace', 'important');
            const fb = label.getBBox().width;
            label.removeAttribute('style');
            return { orb: +orb.toFixed(1), fb: +fb.toFixed(1) };
        }, [fs, ls]);
        labelSweep.push({ fs, ls, ...w, orbMargin: +((PILL_W - w.orb) / 2).toFixed(1),
                          orbBadgeGap: +(BADGE_L - (815 + w.orb / 2)).toFixed(1) });
    }
}

// Candidate sweep — wordmark: font-size x letter-spacing (px), Titan One vs Arial Black.
const BAND_W = 388; // band path x6..394
const wordSweep = [];
for (const fs of [40, 43, 44, 45, 47]) {
    for (const ls of [0, 1, 2]) {
        const w = await page.evaluate(([fs, ls]) => {
            const word = [...document.querySelectorAll('text')].find(t => (t.textContent || '').trim() === 'Coalition');
            word.style.setProperty('font-size', fs + 'px');
            word.style.setProperty('letter-spacing', ls + 'px');
            word.style.setProperty('font-family', '"Titan One", sans-serif', 'important');
            const titan = word.getBBox().width;
            word.style.setProperty('font-family', '"Arial Black", Impact, sans-serif', 'important');
            const fb = word.getBBox().width;
            word.removeAttribute('style');
            return { titan: +titan.toFixed(1), fb: +fb.toFixed(1) };
        }, [fs, ls]);
        wordSweep.push({ fs, ls, ...w, titanMargin: +((BAND_W - w.titan) / 2).toFixed(1),
                         fbMargin: +((BAND_W - w.fb) / 2).toFixed(1) });
    }
}

console.log(JSON.stringify({ states, labelSweep, wordSweep }, null, 1));
await browser.close();
